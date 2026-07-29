// Motore d'asta (funzioni pure che mutano lo stato passato). Portato e adattato da
// fanta-f1/backend/src/services/auctionEngine.ts, senza reveal/shuffle/flip: le offerte
// sono cartacee, il banditore registra gli esiti letti a voce alta e l'app fa da arbitro.
import {
  AuctionState,
  Slot,
  slotToKind,
  conflictSlots,
  PendingTiebreak,
  RoundAssignment,
} from '../types/auction';

const ALL_SLOTS: Slot[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

type Result = { ok: boolean; error?: string };

// Componenti vietati a una squadra per lo slot in gioco (vincoli di scuderia).
export function getRestrictedComponentIds(state: AuctionState, teamId: string, slot: Slot): string[] {
  const p = state.participants.find((x) => x.teamId === teamId);
  if (!p) return [];
  const kind = slotToKind(slot);
  const byId = new Map(state.components.map((c) => [c.id, c]));
  const forbidden = new Set<string>();
  for (const s of conflictSlots(slot)) {
    const cid = p.garage[s];
    if (!cid) continue;
    const sc = byId.get(cid)?.scuderiaId;
    if (sc) forbidden.add(sc);
  }
  if (forbidden.size === 0) return [];
  return state.components
    .filter((c) => c.kind === kind && c.scuderiaId && forbidden.has(c.scuderiaId))
    .map((c) => c.id);
}

// Avvia un round per una categoria (slot). Attivi = chi non ha ancora quello slot.
export function startCategoryRound(state: AuctionState, slot: Slot): Result {
  if (state.round) return { ok: false, error: 'Un round è già in corso' };
  const kind = slotToKind(slot);
  const active = state.participants.filter((p) => !p.garage[slot]);
  if (active.length === 0) return { ok: false, error: 'Tutti hanno già questo slot' };
  const available = state.components.filter((c) => c.kind === kind && c.assignedTo === null);
  if (available.length < active.length)
    return { ok: false, error: 'Componenti disponibili insufficienti per questa categoria' };

  state.round = {
    slot,
    roundNumber: 1,
    activeTeamIds: active.map((p) => p.teamId),
    availableComponentIds: available.map((c) => c.id),
    slips: [],
    mode: 'bidding',
    tieComponentId: null,
    tieTeamIds: [],
    pendingTiebreaks: [],
    assignments: [],
  };
  state.status = 'category';
  state.lastAssignments = [];
  return { ok: true };
}

// Registra (o aggiorna) il biglietto letto dal banditore per una squadra.
export function logSlip(state: AuctionState, teamId: string, componentId: string, amount: number): Result {
  const r = state.round;
  if (!r) return { ok: false, error: 'Nessun round in corso' };

  const p = state.participants.find((x) => x.teamId === teamId);
  if (!p) return { ok: false, error: 'Squadra non trovata' };
  const comp = state.components.find((c) => c.id === componentId);
  if (!comp) return { ok: false, error: 'Componente non trovato' };
  if (!Number.isFinite(amount)) return { ok: false, error: 'Cifra non valida' };

  if (r.mode === 'tiebreak') {
    if (!r.tieTeamIds.includes(teamId)) return { ok: false, error: 'Non sei in questo pareggio' };
    if (componentId !== r.tieComponentId) return { ok: false, error: 'Nel pareggio il componente è fissato' };
  } else {
    if (!r.activeTeamIds.includes(teamId)) return { ok: false, error: 'Squadra non attiva in questo round' };
    if (!r.availableComponentIds.includes(componentId))
      return { ok: false, error: 'Componente non disponibile in questo round' };
    if (getRestrictedComponentIds(state, teamId, r.slot).includes(componentId))
      return { ok: false, error: 'Vietato: stessa scuderia di un componente già in rosa' };
  }

  const minBid = comp.basePrice + 1;
  if (amount < minBid) return { ok: false, error: `Offerta minima: ${minBid}` };
  if (amount > p.budget) return { ok: false, error: `Oltre il budget (${p.budget})` };

  // Sostituisce l'eventuale biglietto precedente della stessa squadra.
  r.slips = r.slips.filter((s) => s.teamId !== teamId);
  r.slips.push({ teamId, componentId, amount });
  return { ok: true };
}

// Rimuove un biglietto (correzione prima della risoluzione).
export function removeSlip(state: AuctionState, teamId: string): Result {
  const r = state.round;
  if (!r) return { ok: false, error: 'Nessun round in corso' };
  r.slips = r.slips.filter((s) => s.teamId !== teamId);
  return { ok: true };
}

// Tutti i biglietti attesi sono stati registrati?
export function allSlipsIn(state: AuctionState): boolean {
  const r = state.round;
  if (!r) return false;
  const expected = r.mode === 'tiebreak' ? r.tieTeamIds : r.activeTeamIds;
  return expected.every((id) => r.slips.some((s) => s.teamId === id));
}

function assign(state: AuctionState, teamId: string, componentId: string, amount: number): RoundAssignment {
  const p = state.participants.find((x) => x.teamId === teamId)!;
  const comp = state.components.find((c) => c.id === componentId)!;
  p.budget -= amount;
  p.garage[state.round!.slot] = componentId;
  comp.assignedTo = teamId;
  const a: RoundAssignment = { teamId, componentId, componentName: comp.name, amount };
  state.round!.assignments.push(a);
  return a;
}

function recordHistory(state: AuctionState, componentId: string, winnerTeamId: string, amount: number, bids: { teamId: string; amount: number }[]) {
  const comp = state.components.find((c) => c.id === componentId)!;
  state.history.push({
    slot: state.round!.slot,
    componentId,
    componentName: comp.name,
    winnerTeamId,
    amount,
    bids,
  });
}

// Risolve il round corrente (bidding o tiebreak): assegna i vincitori, gestisce
// pareggi (ribattuta) e sub-round per i non-vincitori. Ritorna gli assegnati.
export function resolveRound(state: AuctionState): { ok: boolean; error?: string; assignments?: RoundAssignment[]; tiebreak?: PendingTiebreak; categoryComplete?: boolean; subRound?: boolean } {
  const r = state.round;
  if (!r) return { ok: false, error: 'Nessun round in corso' };
  const made: RoundAssignment[] = [];

  if (r.mode === 'tiebreak') {
    const bids = r.slips.filter((s) => s.componentId === r.tieComponentId);
    if (bids.length > 0) {
      const max = Math.max(...bids.map((b) => b.amount));
      const top = bids.filter((b) => b.amount === max);
      if (top.length > 1) {
        // Ancora pari: nuova ribattuta sullo stesso componente.
        r.tieTeamIds = top.map((b) => b.teamId);
        r.slips = [];
        return { ok: true, assignments: [], tiebreak: { componentId: r.tieComponentId!, teamIds: r.tieTeamIds, amount: max } };
      }
      const w = top[0];
      made.push(assign(state, w.teamId, r.tieComponentId!, w.amount));
      recordHistory(state, r.tieComponentId!, w.teamId, w.amount, bids.map((b) => ({ teamId: b.teamId, amount: b.amount })));
    }
    // Prossimo pareggio in coda?
    if (r.pendingTiebreaks.length > 0) {
      const next = r.pendingTiebreaks.shift()!;
      r.tieComponentId = next.componentId;
      r.tieTeamIds = next.teamIds;
      r.slips = [];
      state.lastAssignments = made;
      return { ok: true, assignments: made, tiebreak: next };
    }
    r.mode = 'bidding';
    r.slips = [];
    return advance(state, made);
  }

  // mode = bidding: raggruppa per componente.
  const groups = new Map<string, typeof r.slips>();
  for (const s of r.slips) {
    const g = groups.get(s.componentId) ?? [];
    g.push(s);
    groups.set(s.componentId, g);
  }
  const tiebreaks: PendingTiebreak[] = [];
  for (const [componentId, slips] of groups) {
    const max = Math.max(...slips.map((s) => s.amount));
    const top = slips.filter((s) => s.amount === max);
    if (top.length === 1) {
      made.push(assign(state, top[0].teamId, componentId, max));
      recordHistory(state, componentId, top[0].teamId, max, slips.map((s) => ({ teamId: s.teamId, amount: s.amount })));
    } else {
      tiebreaks.push({ componentId, teamIds: top.map((s) => s.teamId), amount: max });
    }
  }

  if (tiebreaks.length > 0) {
    const first = tiebreaks[0];
    r.pendingTiebreaks = tiebreaks.slice(1);
    r.mode = 'tiebreak';
    r.tieComponentId = first.componentId;
    r.tieTeamIds = first.teamIds;
    r.slips = [];
    state.lastAssignments = made;
    return { ok: true, assignments: made, tiebreak: first };
  }

  return advance(state, made);
}

// Dopo le assegnazioni: sub-round per i non-vincitori o categoria/asta completata.
function advance(state: AuctionState, made: RoundAssignment[]) {
  const r = state.round!;
  const wonThisCategory = new Set(r.assignments.map((a) => a.teamId));
  const nonWinners = r.activeTeamIds.filter((id) => !wonThisCategory.has(id));
  state.lastAssignments = made;

  if (nonWinners.length === 0) {
    // Categoria completata.
    state.round = null;
    if (allGaragesFull(state)) state.status = 'done';
    else state.status = 'category';
    return { ok: true, assignments: made, categoryComplete: true };
  }

  // Sub-round: gli stessi slot, nuovi item disponibili, solo i non-vincitori.
  const kind = slotToKind(r.slot);
  const available = state.components.filter((c) => c.kind === kind && c.assignedTo === null);
  r.roundNumber += 1;
  r.availableComponentIds = available.map((c) => c.id);
  r.activeTeamIds = nonWinners;
  r.slips = [];
  r.mode = 'bidding';
  r.tieComponentId = null;
  r.tieTeamIds = [];
  r.pendingTiebreaks = [];
  return { ok: true, assignments: made, subRound: true };
}

export function allGaragesFull(state: AuctionState): boolean {
  return state.participants.every((p) => ALL_SLOTS.every((s) => p.garage[s]));
}
