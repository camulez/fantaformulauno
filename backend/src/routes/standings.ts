import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { computeStandings, getTeamRoster } from '../services/standings';

export const standingsRouter = Router();
standingsRouter.use(requireAuth);

// Classifica della stagione corrente (calcolata on-the-fly dai risultati inseriti).
standingsRouter.get('/current', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  res.json(await computeStandings(seasonId));
});

// Dettaglio di una squadra: standing + posizione + roster corrente.
standingsRouter.get('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const all = await computeStandings(seasonId);
  const idx = all.teams.findIndex((t) => t.teamId === req.params.teamId);
  if (idx < 0) {
    res.status(404).json({ error: 'Squadra non trovata' });
    return;
  }
  const roster = await getTeamRoster(seasonId, req.params.teamId);
  res.json({ ...all.teams[idx], position: idx + 1, rounds: all.rounds, roster });
});

// Dettaglio di un round: squadre ordinate per punti fatti in quel round (il "GP fantasy").
standingsRouter.get('/round/:roundNo', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const roundNo = Number(req.params.roundNo);
  const all = await computeStandings(seasonId);
  const idx = all.rounds.findIndex((r) => r.round_no === roundNo);
  if (idx < 0) {
    res.status(404).json({ error: 'Round non disputato' });
    return;
  }
  const teams = all.teams
    .map((t) => ({ teamId: t.teamId, name: t.name, roundPoints: t.perRound[idx] ?? 0, cumulative: t.cumulative[idx] ?? 0 }))
    .sort((a, b) => b.roundPoints - a.roundPoints || b.cumulative - a.cumulative);
  res.json({ round: all.rounds[idx], teams });
});
