import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';

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
