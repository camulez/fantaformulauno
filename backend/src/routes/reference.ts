import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { DEFAULT_RULES } from '../config/defaultRules';

export const referenceRouter = Router();
referenceRouter.use(requireAuth);

// Anagrafica FIA della stagione corrente: scuderie, piloti, componenti, calendario + scala punti FIA.
referenceRouter.get('/current', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }

  const [teams, drivers, components, rounds, rulesRow] = await Promise.all([
    supabase.from('fia_teams').select('id, name').eq('season_id', seasonId).order('name'),
    supabase.from('drivers').select('id, name, fia_team_id, is_reserve').eq('season_id', seasonId).order('name'),
    supabase.from('components').select('id, kind, name, ref_driver_id, ref_fia_team_id, base_price').eq('season_id', seasonId).order('kind'),
    supabase.from('rounds').select('id, round_no, code, name, has_sprint, status').eq('season_id', seasonId).order('round_no'),
    supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle(),
  ]);

  const config = { ...DEFAULT_RULES, ...((rulesRow.data?.config as Partial<typeof DEFAULT_RULES>) ?? {}) };

  res.json({
    seasonId,
    teams: teams.data ?? [],
    drivers: drivers.data ?? [],
    components: components.data ?? [],
    rounds: rounds.data ?? [],
    rules: { raceScale: config.raceScale, sprintScale: config.sprintScale },
  });
});
