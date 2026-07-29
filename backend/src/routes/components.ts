import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { loadState } from '../services/auctionStore';

export const componentsRouter = Router();
componentsRouter.use(requireAuth);

async function getConfig(seasonId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle();
  return (data?.config as Record<string, unknown>) ?? {};
}

async function setApproved(seasonId: string, approved: boolean): Promise<string | undefined> {
  const config = await getConfig(seasonId);
  config.valuesApproved = approved;
  const { data: existing } = await supabase.from('season_rules').select('season_id').eq('season_id', seasonId).maybeSingle();
  const q = existing
    ? supabase.from('season_rules').update({ config }).eq('season_id', seasonId)
    : supabase.from('season_rules').insert({ season_id: seasonId, config });
  const { error } = await q;
  return error?.message;
}

// Listino valori d'asta della stagione corrente (+ approvazione + pezzi assegnati in asta).
componentsRouter.get('/values', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const [compsR, config, state] = await Promise.all([
    supabase.from('components').select('id, kind, name, base_price').eq('season_id', seasonId).order('kind').order('name'),
    getConfig(seasonId),
    loadState(seasonId),
  ]);

  const assigned = new Map<string, { teamId: string; owner: string }>();
  if (state) {
    const nameByTeam = new Map(state.participants.map((p) => [p.teamId, p.personName]));
    for (const c of state.components) {
      if (c.assignedTo) assigned.set(c.id, { teamId: c.assignedTo, owner: nameByTeam.get(c.assignedTo) ?? '' });
    }
  }

  res.json({
    approved: config.valuesApproved === true,
    auctionActive: !!state,
    components: (compsR.data ?? []).map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      basePrice: c.base_price ?? 0,
      assignedTo: assigned.get(c.id)?.teamId ?? null,
      owner: assigned.get(c.id)?.owner ?? null,
    })),
  });
});

// Salva i valori (bulk). Bloccato se il listino è approvato.
componentsRouter.put('/values', async (req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const config = await getConfig(seasonId);
  if (config.valuesApproved === true) {
    res.status(400).json({ error: 'Listino approvato: riapri per modificare' });
    return;
  }
  const values = req.body?.values as { id: string; basePrice: number }[] | undefined;
  if (!Array.isArray(values)) {
    res.status(400).json({ error: 'values mancante' });
    return;
  }
  for (const v of values) {
    if (!v.id || !Number.isInteger(v.basePrice) || v.basePrice < 0) {
      res.status(400).json({ error: 'Valore non valido (interi ≥ 0)' });
      return;
    }
  }
  const results = await Promise.all(
    values.map((v) =>
      supabase.from('components').update({ base_price: v.basePrice }).eq('id', v.id).eq('season_id', seasonId)
    )
  );
  const err = results.find((r) => r.error);
  if (err?.error) {
    res.status(500).json({ error: err.error.message });
    return;
  }
  res.json({ ok: true, saved: values.length });
});

// Approva il listino → read-only per tutti.
componentsRouter.post('/values/approve', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const err = await setApproved(seasonId, true);
  if (err) {
    res.status(500).json({ error: err });
    return;
  }
  res.json({ ok: true, approved: true });
});

// Riapri il listino (solo se l'asta non ha ancora assegnato pezzi).
componentsRouter.post('/values/reopen', async (_req, res) => {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return;
  }
  const state = await loadState(seasonId);
  if (state && (state.history.length > 0 || state.participants.some((p) => Object.keys(p.garage).length > 0))) {
    res.status(400).json({ error: "Asta in corso con pezzi assegnati: i valori non si possono riaprire" });
    return;
  }
  const err = await setApproved(seasonId, false);
  if (err) {
    res.status(500).json({ error: err });
    return;
  }
  res.json({ ok: true, approved: false });
});
