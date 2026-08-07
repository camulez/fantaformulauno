import { Router } from 'express';
import { supabase } from '../db/supabase';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { teamRoundReport, teamSeasonMatrix } from '../services/report';

export const reportRouter = Router();
reportRouter.use(requireAuth);

// La squadra di chi è collegato, nella stagione corrente: il report si apre sulla propria.
reportRouter.get('/my-team', async (req: AuthedRequest, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data } = await supabase
    .from('fantasy_teams')
    .select('id, name')
    .eq('season_id', seasonId)
    .eq('person_id', req.personId ?? '')
    .maybeSingle();
  if (!data) {
    res.status(404).json({ error: 'Nessuna squadra per questa persona' });
    return;
  }
  res.json({ teamId: data.id, name: data.name });
});

// Tabella di stagione di una squadra: righe = pezzi (+ Pole/TM/DRS), colonne = gare.
reportRouter.get('/season/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const out = await teamSeasonMatrix(seasonId, req.params.teamId);
  if ('error' in out) {
    res.status(404).json(out);
    return;
  }
  res.json(out);
});

// Dettaglio di una squadra in un round, con la spiegazione di ogni punteggio.
reportRouter.get('/round/:roundNo/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const roundNo = Number(req.params.roundNo);
  if (!Number.isInteger(roundNo)) {
    res.status(400).json({ error: 'Round non valido' });
    return;
  }
  const out = await teamRoundReport(seasonId, req.params.teamId, roundNo);
  if ('error' in out) {
    res.status(404).json(out);
    return;
  }
  res.json(out);
});
