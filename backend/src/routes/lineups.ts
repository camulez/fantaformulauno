import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import {
  formazioneEffettiva,
  formazioneEreditata,
  organicoDiAnagrafica,
  puntiSenzaScuderia,
  scuderieModificate,
  validaFormazione,
  catenaSostituzioni,
  sostitutoSpettante,
  assentiDalRound,
  LineupRow,
  RigaScritta,
} from '../services/lineups';
import { proprietarioAl, Assegnazione } from '../services/proprieta';

export const lineupsRouter = Router();
lineupsRouter.use(requireAuth);

/** Piloti per scuderia secondo l'anagrafica (organico "abituale", senza riserve). */
async function anagrafica(seasonId: string) {
  const { data } = await supabase
    .from('drivers')
    .select('id, name, fia_team_id, is_reserve')
    .eq('season_id', seasonId)
    .order('name');
  return { piloti: data ?? [], per: organicoDiAnagrafica(data ?? []) };
}

/**
 * Tutte le formazioni scritte della stagione, con il round a cui appartengono. Servono tutte, non solo
 * quelle del round richiesto: una formazione vale finché non la si cambia (vedi `formazioneEffettiva`).
 */
async function righeDellaStagione(seasonId: string): Promise<RigaScritta[]> {
  const { data: rounds } = await supabase.from('rounds').select('id, round_no').eq('season_id', seasonId);
  const roundNoDi = new Map((rounds ?? []).map((r) => [r.id, r.round_no]));
  if (roundNoDi.size === 0) return [];
  const { data } = await supabase
    .from('round_lineups')
    .select('round_id, fia_team_id, driver_id')
    .in('round_id', [...roundNoDi.keys()]);
  return (data ?? []).map((l) => ({ round_no: roundNoDi.get(l.round_id)!, fia_team_id: l.fia_team_id, driver_id: l.driver_id }));
}

/**
 * Formazione di UN round: organico abituale, organico effettivo e cosa è stato cambiato.
 * Serve per le sostituzioni: se un pilota corre per una scuderia diversa dalla sua, i suoi
 * punti devono contare per il costruttore che lo ha schierato.
 */
lineupsRouter.get('/round/:n', async (req, res) => {
  const roundNo = Number(req.params.n);
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data: round } = await supabase
    .from('rounds')
    .select('id, round_no, code, name, has_sprint, status')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .maybeSingle();
  if (!round) {
    res.status(404).json({ error: 'Round non trovato' });
    return;
  }

  const [{ piloti, per }, { data: teams }, righe, { data: sr }] = await Promise.all([
    anagrafica(seasonId),
    supabase.from('fia_teams').select('id, name').eq('season_id', seasonId).order('name'),
    righeDellaStagione(seasonId),
    supabase.from('session_results').select('driver_id, fia_points').eq('round_id', round.id),
  ]);

  const { lineup: effettivi, da } = formazioneEffettiva(per, righe, roundNo);
  const modificate = new Set(scuderieModificate(per, effettivi));

  // Punti fatti da piloti che non risultano schierati da nessuna scuderia: la formazione è rimasta
  // indietro (tipicamente un titolare rientrato mentre si ereditava ancora il sostituto).
  const puntiDi = new Map<string, number>();
  for (const s of sr ?? []) if ((s.fia_points ?? 0) > 0) puntiDi.set(s.driver_id, (puntiDi.get(s.driver_id) ?? 0) + s.fia_points);
  const nome = new Map(piloti.map((d) => [d.id, d.name]));
  const senzaScuderia = puntiSenzaScuderia(effettivi, [...puntiDi.keys()]).map((id) => ({
    id,
    name: nome.get(id) ?? '—',
    punti: puntiDi.get(id) ?? 0,
  }));

  res.json({
    round: { roundNo: round.round_no, code: round.code, name: round.name, hasSprint: round.has_sprint, scored: round.status === 'scored' },
    drivers: piloti.map((d) => ({ id: d.id, name: d.name, fiaTeamId: d.fia_team_id, isReserve: d.is_reserve })),
    teams: (teams ?? []).map((t) => ({
      fiaTeamId: t.id,
      name: t.name,
      abituale: per[t.id] ?? [],
      effettiva: effettivi[t.id] ?? [],
      modificata: modificate.has(t.id),
      scrittaQui: da[t.id] === roundNo,
      ereditataDa: da[t.id] !== undefined && da[t.id] < roundNo ? da[t.id] : null,
    })),
    senzaScuderia,
  });
});

/**
 * ART. II — i piloti posseduti che non sono scesi in pista in questo round.
 *
 * Il valore di questa rotta è la CATENA: davanti a «Hadjar non ha corso» il Team Manager
 * dovrebbe ricostruire a mente che al suo posto è andato Lawson, che Lawson è di Pio, che
 * quindi si applica l'Art. II.d e che la possibilità 2 gli dà diritto a Tsunoda. Tutti i dati
 * per dedurlo ci sono già: formazione del round, anagrafica e proprietà. Lo fa l'app.
 *
 * ⚠️ Non decide al posto suo: l'Art. II.d e l'Art. II.e dicono «a sua discrezione». Qui si
 * propone, la scelta resta di chi legge.
 */
lineupsRouter.get('/round/:n/art2', async (req, res) => {
  const roundNo = Number(req.params.n);
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data: round } = await supabase
    .from('rounds')
    .select('id, round_no, code, name, status')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .maybeSingle();
  if (!round) {
    res.status(404).json({ error: 'Round non trovato' });
    return;
  }

  const [{ piloti, per }, righe, { data: comps }, { data: ass }, { data: teams }, { data: sr }] =
    await Promise.all([
      anagrafica(seasonId),
      righeDellaStagione(seasonId),
      supabase.from('components').select('id, name, ref_driver_id').eq('season_id', seasonId).eq('kind', 'pilota'),
      supabase.from('roster_assignments').select('fantasy_team_id, slot, component_id, from_round, to_round'),
      supabase.from('fantasy_teams').select('id, name').eq('season_id', seasonId),
      supabase.from('session_results').select('driver_id, session, fia_points').eq('round_id', round.id),
    ]);

  const nomeDriver = new Map(piloti.map((d) => [d.id, d.name]));
  const nomeTeam = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const compDiDriver = new Map((comps ?? []).filter((c) => c.ref_driver_id).map((c) => [c.ref_driver_id as string, c.id]));
  const driverDiComp = new Map((comps ?? []).map((c) => [c.id, c.ref_driver_id as string | null]));
  const nomeComp = new Map((comps ?? []).map((c) => [c.id, c.name]));

  const nostre = new Set((teams ?? []).map((t) => t.id));
  const assegnazioni: Assegnazione[] = (ass ?? [])
    .filter((a) => nostre.has(a.fantasy_team_id))
    .map((a) => ({
      fantasyTeamId: a.fantasy_team_id,
      slot: a.slot,
      componentId: a.component_id,
      from: a.from_round,
      to: a.to_round,
    }));

  const puntiDi = (driverId: string, sessione: string) =>
    (sr ?? []).filter((x) => x.driver_id === driverId && x.session === sessione).reduce((s, x) => s + (x.fia_points ?? 0), 0);

  const effettivi = formazioneEffettiva(per, righe, roundNo).lineup;
  const anelli = catenaSostituzioni(per, effettivi);
  // Solo chi non ha corso DA NESSUNA PARTE: chi ha solo cambiato macchina non ha perso niente.
  const assenti = new Set(assentiDalRound(per, effettivi));

  const rif = (id: string | null) => (id ? { id, name: nomeDriver.get(id) ?? '—' } : null);

  const casi = [];
  for (const anello of anelli) {
    if (!assenti.has(anello.assente)) continue;
    const compAssente = compDiDriver.get(anello.assente);
    // Un pilota che non è di nessuno non apre nessun caso: l'Art. II parla del TUO pilota.
    if (!compAssente) continue;
    const proprietaria = assegnazioni.find((a) => a.componentId === compAssente);
    if (!proprietaria) continue;

    // Chi occupa DAVVERO quello slot in questo round: se è un altro, il caso è già sistemato.
    const occupante = assegnazioni.find(
      (a) =>
        a.fantasyTeamId === proprietaria.fantasyTeamId &&
        a.slot === proprietaria.slot &&
        a.from <= roundNo &&
        (a.to == null || a.to >= roundNo)
    );
    const risolto = occupante && occupante.componentId !== compAssente ? occupante.componentId : null;

    const base = {
      teamId: proprietaria.fantasyTeamId,
      teamName: nomeTeam.get(proprietaria.fantasyTeamId) ?? '—',
      slot: proprietaria.slot,
      assente: rif(anello.assente)!,
    };

    if (risolto) {
      const d = driverDiComp.get(risolto);
      casi.push({
        ...base,
        stato: 'risolto' as const,
        sostituto: { id: d ?? risolto, name: nomeComp.get(risolto) ?? '—' },
        race: d ? puntiDi(d, 'race') : 0,
        sprint: d ? puntiDi(d, 'sprint') : 0,
      });
      continue;
    }

    const esito = sostitutoSpettante(anelli, anello.assente, (driverId) => {
      const c = compDiDriver.get(driverId);
      return c ? proprietarioAl(assegnazioni, c, roundNo) : null;
    });

    casi.push({
      ...base,
      stato: 'aperto' as const,
      caso: esito.caso,
      percorso: esito.percorso.map((d) => rif(d)!),
      spettante: esito.spettante
        ? { ...rif(esito.spettante)!, race: puntiDi(esito.spettante, 'race'), sprint: puntiDi(esito.spettante, 'sprint') }
        : null,
      ambiguo: esito.ambiguo,
      candidati: esito.candidati.map((d) => rif(d)!),
      bloccatoDa: esito.bloccatoDa ? nomeTeam.get(esito.bloccatoDa) ?? '—' : null,
    });
  }

  res.json({
    round: { roundNo: round.round_no, code: round.code, name: round.name, scored: round.status === 'scored' },
    casi,
  });
});

/**
 * Salva la formazione di un round. Si scrivono SOLO le scuderie diverse da quella che il round
 * EREDITEREBBE (l'ultima formazione scritta prima, o l'anagrafica): un round senza righe significa
 * «come la gara prima».
 *
 * ⚠️ Il confronto è con l'ereditata, non con l'anagrafica. «Hadjar rientra in Red Bull» coincide con
 * l'anagrafica ma è una riga vera da scrivere: senza, il round continuerebbe a ereditare Lawson.
 */
lineupsRouter.put('/round/:n', async (req, res) => {
  const roundNo = Number(req.params.n);
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data: round } = await supabase
    .from('rounds').select('id').eq('season_id', seasonId).eq('round_no', roundNo).maybeSingle();
  if (!round) {
    res.status(404).json({ error: 'Round non trovato' });
    return;
  }

  const body = req.body as { teams?: { fiaTeamId: string; driverIds: string[] }[] };
  const richieste = body.teams ?? [];

  const [{ per }, righe] = await Promise.all([anagrafica(seasonId), righeDellaStagione(seasonId)]);
  const ereditata = formazioneEreditata(per, righe, roundNo).lineup;
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

  // Solo ciò che si discosta da quanto il round erediterebbe finisce nel database.
  const daScrivere: LineupRow[] = [];
  for (const t of richieste) {
    if (uguali(ereditata[t.fiaTeamId], t.driverIds)) continue;
    for (const d of t.driverIds) daScrivere.push({ fia_team_id: t.fiaTeamId, driver_id: d });
  }

  // Un pilota schierato altrove non deve restare anche nella scuderia in cui lo si ereditava.
  const schierati = new Set(daScrivere.map((r) => r.driver_id));
  const toccate = new Set(daScrivere.map((r) => r.fia_team_id));
  for (const [teamId, piloti] of Object.entries(ereditata)) {
    if (toccate.has(teamId)) continue;
    const restano = piloti.filter((d) => !schierati.has(d));
    if (restano.length !== piloti.length) {
      for (const d of restano) daScrivere.push({ fia_team_id: teamId, driver_id: d });
    }
  }

  // Il controllo va fatto sulla formazione COMPLETA del round (scritta + ereditata): un pilota
  // non può correre per due scuderie, nemmeno se una delle due è solo ereditata.
  const scritteOra = new Set(daScrivere.map((r) => r.fia_team_id));
  const completa: LineupRow[] = [
    ...daScrivere,
    ...Object.entries(ereditata)
      .filter(([teamId]) => !scritteOra.has(teamId))
      .flatMap(([teamId, piloti]) => piloti.map((d) => ({ fia_team_id: teamId, driver_id: d }))),
  ];
  const problema = validaFormazione(completa);
  if (problema) {
    res.status(400).json({ error: problema.messaggio });
    return;
  }

  await supabase.from('round_lineups').delete().eq('round_id', round.id);
  if (daScrivere.length) {
    const { error } = await supabase
      .from('round_lineups')
      .insert(daScrivere.map((r) => ({ round_id: round.id, ...r })));
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
  res.json({ ok: true, scuderieModificate: [...new Set(daScrivere.map((r) => r.fia_team_id))].length });
});
