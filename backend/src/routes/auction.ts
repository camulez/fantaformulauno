import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { getCurrentSeasonId } from '../services/currentSeason';
import { AuctionState, PHASE_ORDER, Slot } from '../types/auction';
import { loadState, saveState, clearState } from '../services/auctionStore';
import {
  startCategoryRound,
  logSlip,
  removeSlip,
  resolveRound,
  getRestrictedComponentIds,
  allGaragesFull,
} from '../services/auctionEngine';
import { commitAuctionToRoster } from '../services/commitAuction';

export const auctionRouter = Router();
auctionRouter.use(requireAuth);

const SLOT_SET = new Set<Slot>(['motore', 'sponsor', 'pilota1', 'benzina', 'telaio', 'pilota2']);

// Costruisce lo stato iniziale dal DB (squadre + componenti + scuderia dei piloti).
async function buildInitialState(seasonId: string): Promise<AuctionState | { error: string }> {
  const [teamsR, compsR, driversR] = await Promise.all([
    supabase.from('fantasy_teams').select('id, name, budget_initial, people(name)').eq('season_id', seasonId),
    supabase.from('components').select('id, kind, name, base_price, ref_driver_id, ref_fia_team_id').eq('season_id', seasonId),
    supabase.from('drivers').select('id, fia_team_id').eq('season_id', seasonId),
  ]);
  const teams = teamsR.data ?? [];
  const comps = compsR.data ?? [];
  if (teams.length === 0) return { error: 'Nessuna squadra nella stagione' };
  if (comps.length === 0) return { error: 'Nessun componente nella stagione' };

  const driverTeam = new Map((driversR.data ?? []).map((d) => [d.id, d.fia_team_id as string | null]));

  return {
    seasonId,
    status: 'lobby',
    budgetInitial: teams[0].budget_initial ?? 1835,
    participants: teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      personName: (t.people as unknown as { name: string } | null)?.name ?? t.name,
      budget: t.budget_initial ?? 1835,
      garage: {},
    })),
    components: comps.map((c) => ({
      id: c.id,
      kind: c.kind as AuctionState['components'][number]['kind'],
      name: c.name,
      basePrice: c.base_price ?? 0,
      scuderiaId: c.kind === 'pilota' ? driverTeam.get(c.ref_driver_id ?? '') ?? null : c.ref_fia_team_id ?? null,
      assignedTo: null,
    })),
    round: null,
    history: [],
    lastAssignments: [],
  };
}

// Aggiunge la mappa dei componenti vietati per squadra (per lo slot in gioco) per il tabellone.
function withRestrictions(state: AuctionState) {
  const restricted: Record<string, string[]> = {};
  if (state.round) {
    for (const p of state.participants) {
      restricted[p.teamId] = getRestrictedComponentIds(state, p.teamId, state.round.slot);
    }
  }
  return { ...state, phaseOrder: PHASE_ORDER, restricted, allFull: allGaragesFull(state) };
}

async function currentSeasonOr404(res: import('express').Response): Promise<string | null> {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    res.status(404).json({ error: 'Nessuna stagione' });
    return null;
  }
  return seasonId;
}

// Stato corrente dell'asta (per il tabellone + polling).
auctionRouter.get('/state', async (_req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const state = await loadState(seasonId);
  res.json({ state: state ? withRestrictions(state) : null });
});

// Avvia/reimposta la sessione d'asta (lobby) dai dati correnti.
auctionRouter.post('/start', async (_req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const built = await buildInitialState(seasonId);
  if ('error' in built) {
    res.status(400).json({ error: built.error });
    return;
  }
  const saved = await saveState(seasonId, built);
  if (saved.error) {
    res.status(500).json({ error: saved.error });
    return;
  }
  res.json({ state: withRestrictions(built) });
});

// Avvia il round di una categoria.
auctionRouter.post('/category', async (req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const slot = (req.body?.slot ?? '') as Slot;
  if (!SLOT_SET.has(slot)) {
    res.status(400).json({ error: 'Slot non valido' });
    return;
  }
  const state = await loadState(seasonId);
  if (!state) {
    res.status(400).json({ error: "Asta non avviata" });
    return;
  }
  const r = startCategoryRound(state, slot);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  await saveState(seasonId, state);
  res.json({ state: withRestrictions(state) });
});

// Registra un biglietto letto.
auctionRouter.post('/bid', async (req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const { teamId, componentId, amount } = req.body as { teamId?: string; componentId?: string; amount?: number };
  if (!teamId || !componentId || typeof amount !== 'number') {
    res.status(400).json({ error: 'Dati offerta incompleti' });
    return;
  }
  const state = await loadState(seasonId);
  if (!state) {
    res.status(400).json({ error: 'Asta non avviata' });
    return;
  }
  const r = logSlip(state, teamId, componentId, amount);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  await saveState(seasonId, state);
  res.json({ state: withRestrictions(state) });
});

// Rimuove un biglietto (correzione).
auctionRouter.post('/unbid', async (req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const teamId = (req.body?.teamId ?? '') as string;
  const state = await loadState(seasonId);
  if (!state) {
    res.status(400).json({ error: 'Asta non avviata' });
    return;
  }
  removeSlip(state, teamId);
  await saveState(seasonId, state);
  res.json({ state: withRestrictions(state) });
});

// Risolve il round corrente.
auctionRouter.post('/resolve', async (_req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const state = await loadState(seasonId);
  if (!state) {
    res.status(400).json({ error: 'Asta non avviata' });
    return;
  }
  const r = resolveRound(state);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  await saveState(seasonId, state);
  res.json({
    state: withRestrictions(state),
    outcome: { tiebreak: r.tiebreak ?? null, categoryComplete: !!r.categoryComplete, subRound: !!r.subRound },
  });
});

// Conclude l'asta → scrive i roster (from_round=1).
auctionRouter.post('/commit', async (req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  const force = req.body?.force === true;
  const state = await loadState(seasonId);
  if (!state) {
    res.status(400).json({ error: 'Asta non avviata' });
    return;
  }
  const r = await commitAuctionToRoster(seasonId, state, force);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  state.status = 'done';
  await saveState(seasonId, state);
  res.json({ ok: true, assignments: r.assignments });
});

// Azzera la sessione d'asta.
auctionRouter.post('/reset', async (_req, res) => {
  const seasonId = await currentSeasonOr404(res);
  if (!seasonId) return;
  await clearState(seasonId);
  res.json({ ok: true });
});
