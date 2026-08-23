import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { mergeLineups, scuderieModificate, validaFormazione, LineupRow } from '../services/lineups';

export const lineupsRouter = Router();
lineupsRouter.use(requireAuth);

/** Piloti per scuderia secondo l'anagrafica (organico "abituale"). */
async function anagrafica(seasonId: string) {
  const { data } = await supabase
    .from('drivers')
    .select('id, name, fia_team_id, is_reserve')
    .eq('season_id', seasonId)
    .order('name');
  const per: Record<string, string[]> = {};
  for (const d of data ?? []) {
    // Le riserve non fanno parte dell'organico abituale di nessuno: entrano solo se schierate.
    if (d.fia_team_id && !d.is_reserve) (per[d.fia_team_id] ??= []).push(d.id);
  }
  return { piloti: data ?? [], per };
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

  const [{ piloti, per }, { data: teams }, { data: righe }] = await Promise.all([
    anagrafica(seasonId),
    supabase.from('fia_teams').select('id, name').eq('season_id', seasonId).order('name'),
    supabase.from('round_lineups').select('fia_team_id, driver_id').eq('round_id', round.id),
  ]);

  const effettivi = mergeLineups(per, (righe ?? []) as LineupRow[]);
  const modificate = new Set(scuderieModificate(per, effettivi));

  res.json({
    round: { roundNo: round.round_no, code: round.code, name: round.name, hasSprint: round.has_sprint, scored: round.status === 'scored' },
    drivers: piloti.map((d) => ({ id: d.id, name: d.name, fiaTeamId: d.fia_team_id, isReserve: d.is_reserve })),
    teams: (teams ?? []).map((t) => ({
      fiaTeamId: t.id,
      name: t.name,
      abituale: per[t.id] ?? [],
      effettiva: effettivi[t.id] ?? [],
      modificata: modificate.has(t.id),
    })),
  });
});

/**
 * Salva la formazione. Si scrivono SOLO le scuderie diverse dall'abituale e si cancellano
 * quelle tornate normali: la tabella resta piccola e leggibile, e un round senza righe
 * significa «tutti al loro posto».
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

  const { per } = await anagrafica(seasonId);
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

  // Solo ciò che si discosta davvero dall'anagrafica finisce nel database.
  const daScrivere: LineupRow[] = [];
  for (const t of richieste) {
    if (uguali(per[t.fiaTeamId], t.driverIds)) continue;
    for (const d of t.driverIds) daScrivere.push({ fia_team_id: t.fiaTeamId, driver_id: d });
  }

  const problema = validaFormazione(daScrivere);
  if (problema) {
    res.status(400).json({ error: problema.messaggio });
    return;
  }
  // Un pilota schierato altrove non deve restare anche nella sua scuderia abituale.
  const schierati = new Set(daScrivere.map((r) => r.driver_id));
  const toccate = new Set(daScrivere.map((r) => r.fia_team_id));
  for (const [teamId, piloti] of Object.entries(per)) {
    if (toccate.has(teamId)) continue;
    const restano = piloti.filter((d) => !schierati.has(d));
    if (restano.length !== piloti.length) {
      for (const d of restano) daScrivere.push({ fia_team_id: teamId, driver_id: d });
    }
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
