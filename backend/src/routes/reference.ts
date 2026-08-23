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

/**
 * Crea un pilota di RISERVA. Serve quando in una gara scende in pista qualcuno che non è
 * nell'anagrafica di inizio stagione (Tsunoda in Racing Bulls al GP d'Olanda 2026): senza
 * questo, il campionato si ferma finché qualcuno non mette le mani nel database.
 *
 * ⚠️ Non crea un `components`: una riserva NON è un pezzo comprabile all'asta e non si può
 * possedere. I suoi punti contano solo per il costruttore che la schiera.
 */
referenceRouter.post('/driver', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  const fiaTeamId = String(req.body?.fiaTeamId ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Serve il nome del pilota' });
    return;
  }
  if (!fiaTeamId) {
    res.status(400).json({ error: 'Serve la scuderia' });
    return;
  }

  const { data: scuderia } = await supabase
    .from('fia_teams').select('id').eq('season_id', seasonId).eq('id', fiaTeamId).maybeSingle();
  if (!scuderia) {
    res.status(400).json({ error: 'Scuderia non valida' });
    return;
  }

  const { data: esiste } = await supabase
    .from('drivers').select('id, name').eq('season_id', seasonId).ilike('name', name).maybeSingle();
  if (esiste) {
    res.status(409).json({ error: `«${esiste.name}» è già in anagrafica` });
    return;
  }

  const { data, error } = await supabase
    .from('drivers')
    .insert({ season_id: seasonId, name, fia_team_id: fiaTeamId, is_reserve: true })
    .select('id, name, fia_team_id, is_reserve')
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json({ id: data.id, name: data.name, fiaTeamId: data.fia_team_id, isReserve: data.is_reserve });
});
