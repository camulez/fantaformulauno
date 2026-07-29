import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';

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
  // Chiude l'assegnazione attiva a fromRound-1, poi apre la nuova.
  const { data: cur } = await supabase
    .from('roster_assignments')
    .select('id, from_round')
    .eq('fantasy_team_id', teamId)
    .eq('slot', slot)
    .is('to_round', null)
    .maybeSingle();
  if (cur) {
    if (cur.from_round >= (fromRound as number)) {
      await supabase.from('roster_assignments').delete().eq('id', cur.id);
    } else {
      await supabase.from('roster_assignments').update({ to_round: (fromRound as number) - 1 }).eq('id', cur.id);
    }
  }
  const { error } = await supabase.from('roster_assignments').insert({
    fantasy_team_id: teamId,
    slot,
    component_id: componentId,
    from_round: fromRound,
    to_round: null,
    source: 'market',
  });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});
