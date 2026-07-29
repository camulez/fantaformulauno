import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';

export const seasonRouter = Router();
seasonRouter.use(requireAuth);

// Stagione corrente + progresso (gare disputate / totali / mancanti).
seasonRouter.get('/current', async (_req, res) => {
  const { data: season, error } = await supabase
    .from('seasons')
    .select('id, year, mode, status, total_rounds')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!season) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }

  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', season.id)
    .eq('status', 'scored');

  const roundsScored = count ?? 0;
  res.json({
    ...season,
    roundsScored,
    roundsRemaining: Math.max(0, (season.total_rounds ?? 0) - roundsScored),
  });
});

// Matrice punteggi/asta della stagione corrente (merge coi default).
seasonRouter.get('/rules', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const { data } = await supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle();
  const config: ScoringRules = { ...DEFAULT_RULES, ...((data?.config as Partial<ScoringRules>) ?? {}) };
  res.json({ config });
});

// Salva la matrice punteggi/asta.
seasonRouter.put('/rules', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const body = (req.body?.config ?? undefined) as Partial<ScoringRules> | undefined;
  if (!body) {
    res.status(400).json({ error: 'config mancante' });
    return;
  }
  const merged: ScoringRules = {
    ...DEFAULT_RULES,
    ...body,
    auction: { ...DEFAULT_RULES.auction, ...(body.auction ?? {}) },
  };

  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const okScale = (a: unknown) => Array.isArray(a) && a.length > 0 && a.every(num);
  if (!okScale(merged.raceScale) || !okScale(merged.sprintScale)) {
    res.status(400).json({ error: 'Scale punti non valide (numeri, almeno una posizione)' });
    return;
  }
  const scalars: (keyof ScoringRules)[] = [
    'fastestLapPoint',
    'polePoints',
    'teamManagerPoints',
    'sponsorPointsPerCar',
    'benzinaPointsPerCar',
    'drsMultiplier',
    'drsPerSeason',
  ];
  for (const k of scalars) {
    if (!num(merged[k])) {
      res.status(400).json({ error: `Valore non valido: ${k}` });
      return;
    }
  }
  if (merged.drsScope !== 'race' && merged.drsScope !== 'race_sprint') {
    res.status(400).json({ error: 'Ambito DRS non valido' });
    return;
  }
  if (!num(merged.auction.budget) || !num(merged.auction.minIncrement)) {
    res.status(400).json({ error: 'Parametri asta non validi' });
    return;
  }

  const up = await supabase.from('season_rules').upsert(
    { season_id: seasonId, config: merged },
    { onConflict: 'season_id' }
  );
  if (up.error) {
    res.status(500).json({ error: up.error.message });
    return;
  }
  res.json({ ok: true, config: merged });
});
