import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

type SessionKind = 'race' | 'sprint';
type Deduction = 'none' | 'partial' | 'total';

async function roundByNo(roundNo: number) {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) return null;
  const { data } = await supabase
    .from('rounds')
    .select('id, round_no, code, name, has_sprint, status')
    .eq('season_id', seasonId)
    .eq('round_no', roundNo)
    .maybeSingle();
  return data;
}

// Risultati grezzi di un round (per round_no nella stagione corrente).
resultsRouter.get('/round/:roundNo', async (req, res) => {
  const round = await roundByNo(Number(req.params.roundNo));
  if (!round) {
    res.status(404).json({ error: 'Round non trovato' });
    return;
  }
  const [results, pole] = await Promise.all([
    supabase.from('session_results').select('driver_id, session, position, fia_points, dnf, deduction').eq('round_id', round.id),
    supabase.from('poles').select('pole_driver_id').eq('round_id', round.id).maybeSingle(),
  ]);
  res.json({ round, results: results.data ?? [], poleDriverId: pole.data?.pole_driver_id ?? null });
});

// Salvataggio bulk risultati di un round (sostituisce i precedenti).
resultsRouter.put('/round/:roundNo', async (req, res) => {
  const round = await roundByNo(Number(req.params.roundNo));
  if (!round) {
    res.status(404).json({ error: 'Round non trovato' });
    return;
  }

  const body = req.body as {
    results?: Array<{
      driver_id: string;
      session: SessionKind;
      position?: number | null;
      fia_points?: number;
      dnf?: boolean;
      deduction?: Deduction;
    }>;
    poleDriverId?: string | null;
    markScored?: boolean;
  };

  const rows = (body.results ?? [])
    .filter((r) => r.driver_id && (r.session === 'race' || r.session === 'sprint'))
    .map((r) => ({
      round_id: round.id,
      driver_id: r.driver_id,
      session: r.session,
      position: r.position ?? null,
      fia_points: r.fia_points ?? 0,
      dnf: r.dnf ?? false,
      deduction: r.deduction ?? 'none',
    }));

  // Replace results + pole per questo round.
  await supabase.from('session_results').delete().eq('round_id', round.id);
  if (rows.length) {
    const { error } = await supabase.from('session_results').insert(rows);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  await supabase.from('poles').delete().eq('round_id', round.id);
  if (body.poleDriverId) {
    await supabase.from('poles').insert({ round_id: round.id, pole_driver_id: body.poleDriverId });
  }

  if (body.markScored !== undefined) {
    await supabase.from('rounds').update({ status: body.markScored ? 'scored' : 'scheduled' }).eq('id', round.id);
  }

  res.json({ ok: true, saved: rows.length });
});
