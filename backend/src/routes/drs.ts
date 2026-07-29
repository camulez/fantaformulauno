import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { DEFAULT_RULES } from '../config/defaultRules';

export const drsRouter = Router();
drsRouter.use(requireAuth);

const SLOTS = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

// Dichiarazioni DRS di una squadra: roundNo → slot.
drsRouter.get('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const [{ data: decls }, { data: rounds }] = await Promise.all([
    supabase.from('drs_declarations').select('round_id, slot').eq('fantasy_team_id', req.params.teamId),
    supabase.from('rounds').select('id, round_no').eq('season_id', seasonId),
  ]);
  const noById = new Map((rounds ?? []).map((r) => [r.id, r.round_no]));
  const current: Record<number, string> = {};
  for (const d of decls ?? []) {
    const rn = noById.get(d.round_id);
    if (rn != null) current[rn] = d.slot;
  }
  res.json({ current, max: DEFAULT_RULES.drsPerSeason });
});

// Sostituisce le dichiarazioni DRS della squadra (1 per round, 1 per componente, ≤ max stagione).
drsRouter.put('/team/:teamId', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const teamId = req.params.teamId;
  const body = req.body as { declarations?: { roundNo: number; slot: string }[] };
  const decls = (body.declarations ?? []).filter((d) => SLOTS.includes(d.slot) && Number.isInteger(d.roundNo));

  const slots = decls.map((d) => d.slot);
  const rns = decls.map((d) => d.roundNo);
  if (new Set(slots).size !== slots.length) {
    res.status(400).json({ error: 'Ogni componente può avere il DRS una sola volta' });
    return;
  }
  if (new Set(rns).size !== rns.length) {
    res.status(400).json({ error: 'Massimo 1 DRS per round' });
    return;
  }
  if (decls.length > DEFAULT_RULES.drsPerSeason) {
    res.status(400).json({ error: `Massimo ${DEFAULT_RULES.drsPerSeason} DRS a stagione` });
    return;
  }

  const { data: rounds } = await supabase.from('rounds').select('id, round_no').eq('season_id', seasonId);
  const idByNo = new Map((rounds ?? []).map((r) => [r.round_no, r.id]));
  const rows: { fantasy_team_id: string; round_id: string; slot: string }[] = [];
  for (const d of decls) {
    const rid = idByNo.get(d.roundNo);
    if (!rid) {
      res.status(400).json({ error: `Round ${d.roundNo} inesistente` });
      return;
    }
    rows.push({ fantasy_team_id: teamId, round_id: rid, slot: d.slot });
  }

  await supabase.from('drs_declarations').delete().eq('fantasy_team_id', teamId);
  if (rows.length) {
    const { error } = await supabase.from('drs_declarations').insert(rows);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
  res.json({ ok: true, saved: rows.length });
});
