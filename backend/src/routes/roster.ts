import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import {
  applicaIntervallo,
  sovrapposizioni,
  titolarePrecedente,
  Intervallo,
} from '../services/rosterTimeline';

/**
 * Legge la linea del tempo di uno slot, ci applica un intervallo e la riscrive.
 *
 * ⚠️ Tutte le modifiche al roster passano DA QUI. Scrivere le righe a mano — «chiudo questa,
 * apro quella» — durante il collaudo ha prodotto un intervallo capovolto (R14–13) e due
 * assegnazioni aperte sullo stesso slot: con due righe sovrapposte la rosa diventa non
 * deterministica e il punteggio dipende dall'ordine di lettura.
 */
async function riscriviSlot(
  teamId: string,
  slot: string,
  nuovo: Intervallo,
  source = 'market'
): Promise<{ error?: string }> {
  const { data: righe } = await supabase
    .from('roster_assignments')
    .select('component_id, from_round, to_round')
    .eq('fantasy_team_id', teamId)
    .eq('slot', slot);

  const timeline: Intervallo[] = (righe ?? []).map((r) => ({
    componentId: r.component_id,
    from: r.from_round,
    to: r.to_round,
  }));
  const nuova = applicaIntervallo(timeline, nuovo);

  const problemi = sovrapposizioni(nuova);
  if (problemi.length > 0) return { error: problemi[0] };

  await supabase.from('roster_assignments').delete().eq('fantasy_team_id', teamId).eq('slot', slot);
  const { error } = await supabase.from('roster_assignments').insert(
    nuova.map((i) => ({
      fantasy_team_id: teamId,
      slot,
      component_id: i.componentId,
      from_round: i.from,
      to_round: i.to,
      source,
    }))
  );
  return error ? { error: error.message } : {};
}

export const rosterRouter = Router();
rosterRouter.use(requireAuth);

const SLOT_KIND: Record<string, string> = {
  telaio: 'telaio',
  motore: 'motore',
  pilota1: 'pilota',
  pilota2: 'pilota',
  sponsor: 'sponsor',
  benzina: 'benzina',
};

// Roster corrente (attivo) di una squadra: slot → componentId.
rosterRouter.get('/team/:teamId', async (req, res) => {
  const { data } = await supabase
    .from('roster_assignments')
    .select('slot, component_id, to_round')
    .eq('fantasy_team_id', req.params.teamId);
  const current: Record<string, string> = {};
  for (const a of data ?? []) if (a.to_round == null) current[a.slot] = a.component_id;
  res.json({ current });
});

// Imposta/modifica il roster completo (setup manuale). Sostituisce le assegnazioni con from_round=1.
rosterRouter.put('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const teamId = req.params.teamId;
  const body = req.body as { assignments?: { slot: string; componentId: string }[] };
  const assignments = (body.assignments ?? []).filter((a) => a.slot && a.componentId && SLOT_KIND[a.slot]);

  // Valida: kind del componente coerente con lo slot + appartiene alla stagione.
  const ids = assignments.map((a) => a.componentId);
  const { data: comps } = await supabase
    .from('components')
    .select('id, kind, season_id')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const compMap = new Map((comps ?? []).map((c) => [c.id, c]));
  for (const a of assignments) {
    const c = compMap.get(a.componentId);
    if (!c || c.season_id !== seasonId || c.kind !== SLOT_KIND[a.slot]) {
      res.status(400).json({ error: `Componente non valido per lo slot ${a.slot}` });
      return;
    }
  }
  const p1 = assignments.find((a) => a.slot === 'pilota1')?.componentId;
  const p2 = assignments.find((a) => a.slot === 'pilota2')?.componentId;
  if (p1 && p2 && p1 === p2) {
    res.status(400).json({ error: 'Pilota 1 e Pilota 2 devono essere diversi' });
    return;
  }

  // Sostituzione: cancella le assegnazioni della squadra e reinserisce.
  await supabase.from('roster_assignments').delete().eq('fantasy_team_id', teamId);
  if (assignments.length) {
    const rows = assignments.map((a) => ({
      fantasy_team_id: teamId,
      slot: a.slot,
      component_id: a.componentId,
      from_round: 1,
      source: 'manual',
    }));
    const { error } = await supabase.from('roster_assignments').insert(rows);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
  res.json({ ok: true, saved: assignments.length });
});

// Storico assegnazioni (timeline datata) di una squadra.
rosterRouter.get('/team/:teamId/history', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  const [{ data: assigns }, { data: comps }] = await Promise.all([
    supabase.from('roster_assignments').select('slot, component_id, from_round, to_round').eq('fantasy_team_id', req.params.teamId),
    supabase.from('components').select('id, name').eq('season_id', seasonId ?? ''),
  ]);
  const name = new Map((comps ?? []).map((c) => [c.id, c.name]));
  const history = (assigns ?? [])
    .map((a) => ({ slot: a.slot, name: name.get(a.component_id) ?? '—', fromRound: a.from_round, toRound: a.to_round }))
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.fromRound - b.fromRound);
  res.json({ history });
});

// Trasferimento datato: da fromRound la squadra cambia il componente di uno slot.
rosterRouter.post('/team/:teamId/transfer', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const teamId = req.params.teamId;
  const { slot, componentId, fromRound } = req.body as { slot?: string; componentId?: string; fromRound?: number };
  if (!slot || !SLOT_KIND[slot] || !componentId || !Number.isInteger(fromRound) || (fromRound as number) < 2) {
    res.status(400).json({ error: 'Dati trasferimento non validi (round di validità ≥ 2)' });
    return;
  }
  const { data: comp } = await supabase.from('components').select('id, kind, season_id').eq('id', componentId).maybeSingle();
  if (!comp || comp.season_id !== seasonId || comp.kind !== SLOT_KIND[slot]) {
    res.status(400).json({ error: `Componente non valido per lo slot ${slot}` });
    return;
  }
  // Trasferimento definitivo: il nuovo componente occupa lo slot da fromRound in poi.
  const { error } = await riscriviSlot(teamId, slot, {
    componentId,
    from: fromRound as number,
    to: null,
  });
  if (error) {
    res.status(500).json({ error });
    return;
  }
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ART. II — Il Pilota non scende in pista
//
// Il Regolamento Campionato distingue i casi in base a CHI sostituisce:
//  II.a  squalifica FIA          → nessuna sostituzione, il pilota resta e fa 0 punti
//  II.b  sostituto fuori dalla FIA
//  II.c  sostituto FIA di nessun Team   → entrambi: il sostituto entra TEMPORANEAMENTE
//                                        nel Team, l'originale rientra al suo ritorno
//  II.d  sostituto di un altro Team     → il Team Manager resta privo del pilota:
//        poss. 1 compra dal mercato (prezzo = base d'asta + punti FIA già realizzati)
//        poss. 2 prende il sostituto del sostituto
//
// Il roster è già datato, ma il trasferimento esistente è a tempo indeterminato. Qui si
// aggiunge la SOSTITUZIONE, che ha una fine — è quello che l'Art. II chiede.
// ─────────────────────────────────────────────────────────────────────────────

/** Punti FIA realizzati da un componente nei round già disputati. */
async function puntiRealizzati(seasonId: string, componentId: string): Promise<number> {
  const { data: comp } = await supabase
    .from('components').select('kind, ref_driver_id, ref_fia_team_id').eq('id', componentId).maybeSingle();
  if (!comp) return 0;

  const { data: rounds } = await supabase
    .from('rounds').select('id').eq('season_id', seasonId).eq('status', 'scored');
  const ids = new Set((rounds ?? []).map((r) => r.id));
  if (ids.size === 0) return 0;

  // Quali piloti "sono" questo componente: uno solo per un pilota, i due della scuderia
  // per telaio/motore/sponsor/benzina.
  let driverIds: string[] = [];
  if (comp.ref_driver_id) driverIds = [comp.ref_driver_id];
  else if (comp.ref_fia_team_id) {
    const { data: d } = await supabase
      .from('drivers').select('id').eq('season_id', seasonId).eq('fia_team_id', comp.ref_fia_team_id);
    driverIds = (d ?? []).map((x) => x.id);
  }
  if (driverIds.length === 0) return 0;

  const { data: sr } = await supabase
    .from('session_results').select('round_id, driver_id, fia_points').in('driver_id', driverIds);
  // ⚠️ Sono punti FIA: i Punti DRS non c'entrano e non vanno contati (nota ³ del regolamento).
  return (sr ?? []).filter((x) => ids.has(x.round_id)).reduce((a, b) => a + (b.fia_points ?? 0), 0);
}

/** Prezzo di un Componente sul mercato: base d'asta originaria + punti FIA già realizzati. */
rosterRouter.get('/prezzo/:componentId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data: comp } = await supabase
    .from('components').select('id, name, kind, base_price, season_id').eq('id', req.params.componentId).maybeSingle();
  if (!comp || comp.season_id !== seasonId) {
    res.status(404).json({ error: 'Componente non trovato' });
    return;
  }
  const punti = await puntiRealizzati(seasonId, comp.id);
  res.json({
    componentId: comp.id,
    name: comp.name,
    kind: comp.kind,
    base: comp.base_price ?? 0,
    punti,
    prezzo: (comp.base_price ?? 0) + punti,
  });
});

/**
 * Sostituzione TEMPORANEA di uno slot (Art. II.b, II.c e II.d possibilità 2).
 * Il sostituto occupa lo slot da `fromRound`; se si sa già quando l'originale rientra,
 * `toRound` lo riporta al suo posto dal round successivo.
 */
rosterRouter.post('/team/:teamId/substitute', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const teamId = req.params.teamId;
  const { slot, componentId, fromRound, toRound } = req.body as {
    slot?: string; componentId?: string; fromRound?: number; toRound?: number | null;
  };
  if (!slot || !SLOT_KIND[slot] || !componentId || !Number.isInteger(fromRound) || (fromRound as number) < 1) {
    res.status(400).json({ error: 'Dati sostituzione non validi' });
    return;
  }
  if (toRound != null && (!Number.isInteger(toRound) || toRound < (fromRound as number))) {
    res.status(400).json({ error: 'Il round di rientro deve venire dopo quello di uscita' });
    return;
  }
  const { data: comp } = await supabase
    .from('components').select('id, kind, season_id').eq('id', componentId).maybeSingle();
  if (!comp || comp.season_id !== seasonId || comp.kind !== SLOT_KIND[slot]) {
    res.status(400).json({ error: `Componente non valido per lo slot ${slot}` });
    return;
  }

  // Chi occupa lo slot in quel round: è lui che esce, ed è lui che rientrerà.
  const { data: righe } = await supabase
    .from('roster_assignments')
    .select('component_id, from_round, to_round')
    .eq('fantasy_team_id', teamId)
    .eq('slot', slot);
  const originale = (righe ?? []).find(
    (a) => a.from_round <= (fromRound as number) && (a.to_round == null || a.to_round >= (fromRound as number))
  );
  if (!originale) {
    res.status(400).json({ error: `Nessun componente nello slot ${slot} al round ${fromRound}` });
    return;
  }
  if (originale.component_id === componentId) {
    res.status(400).json({ error: 'Il sostituto è già il titolare dello slot' });
    return;
  }

  // Il sostituto copre la finestra; se il rientro è già noto, l'algebra della linea del
  // tempo lascia intatta la coda del titolare (che quindi torna da solo dal round dopo).
  const esito = await riscriviSlot(teamId, slot, {
    componentId,
    from: fromRound as number,
    to: toRound ?? null,
  });
  if (esito.error) {
    res.status(500).json({ error: esito.error });
    return;
  }
  res.json({ ok: true, rientroProgrammato: toRound != null });
});

/**
 * Rientro del titolare quando la fine della sostituzione non era nota.
 * Riporta nello slot il componente che c'era PRIMA del sostituto attuale.
 */
rosterRouter.post('/team/:teamId/return', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const teamId = req.params.teamId;
  const { slot, fromRound } = req.body as { slot?: string; fromRound?: number };
  if (!slot || !SLOT_KIND[slot] || !Number.isInteger(fromRound) || (fromRound as number) < 2) {
    res.status(400).json({ error: 'Dati rientro non validi' });
    return;
  }

  const { data: righe } = await supabase
    .from('roster_assignments')
    .select('component_id, from_round, to_round')
    .eq('fantasy_team_id', teamId)
    .eq('slot', slot);
  const timeline: Intervallo[] = (righe ?? []).map((r) => ({
    componentId: r.component_id,
    from: r.from_round,
    to: r.to_round,
  }));

  // Il titolare è chi occupava lo slot prima del sostituto attuale.
  const precedente = titolarePrecedente(timeline, fromRound as number);
  if (!precedente) {
    res.status(400).json({ error: 'Non risulta nessun titolare da far rientrare in questo slot' });
    return;
  }

  const esito = await riscriviSlot(teamId, slot, { componentId: precedente, from: fromRound as number, to: null });
  if (esito.error) {
    res.status(500).json({ error: esito.error });
    return;
  }
  res.json({ ok: true, rientrato: precedente });
});

/**
 * Chi possiede cosa, adesso. Serve a capire in quale caso dell'Art. II si è: se il
 * sostituto appartiene a un altro Team siamo nel II.d (il Team Manager resta privo del
 * pilota), altrimenti nel II.b/II.c (il sostituto entra temporaneamente in squadra).
 */
rosterRouter.get('/proprietari', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const [{ data: teams }, { data: comps }, { data: ass }] = await Promise.all([
    supabase.from('fantasy_teams').select('id, name').eq('season_id', seasonId),
    supabase.from('components').select('id').eq('season_id', seasonId),
    supabase.from('roster_assignments').select('fantasy_team_id, slot, component_id, to_round'),
  ]);
  const nome = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const validi = new Set((comps ?? []).map((c) => c.id));

  const di: Record<string, { teamId: string; teamName: string; slot: string }> = {};
  for (const a of ass ?? []) {
    // Solo le assegnazioni ancora aperte: è la fotografia di adesso.
    if (a.to_round != null || !validi.has(a.component_id)) continue;
    di[a.component_id] = {
      teamId: a.fantasy_team_id,
      teamName: nome.get(a.fantasy_team_id) ?? '—',
      slot: a.slot,
    };
  }
  res.json({ di });
});
