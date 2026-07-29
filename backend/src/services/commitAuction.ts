// Fine asta → scrive i roster iniziali (from_round=1) e le transazioni d'acquisto.
import { supabase } from '../db/supabase';
import { AuctionState, Slot } from '../types/auction';
import { allGaragesFull } from './auctionEngine';

const SLOTS: Slot[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

export async function commitAuctionToRoster(
  seasonId: string,
  state: AuctionState,
  force = false
): Promise<{ ok: boolean; error?: string; assignments?: number }> {
  if (!allGaragesFull(state)) {
    return { ok: false, error: 'Asta non completa: tutti i garage devono essere pieni' };
  }

  // Guardia: non sovrascrivere i roster di una stagione già giocata senza conferma.
  const { count } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('status', 'scored');
  if ((count ?? 0) > 0 && !force) {
    return {
      ok: false,
      error: `La stagione ha già ${count} round giocati: confermare force per sovrascrivere i roster`,
    };
  }

  // Prezzo pagato per componente (dallo storico d'asta).
  const paid = new Map<string, number>();
  for (const h of state.history) paid.set(h.componentId, h.amount);

  const teamIds = state.participants.map((p) => p.teamId);

  // Sostituisce i roster from_round=1 delle squadre coinvolte.
  await supabase.from('roster_assignments').delete().in('fantasy_team_id', teamIds).eq('from_round', 1);

  const rosterRows: {
    fantasy_team_id: string;
    slot: string;
    component_id: string;
    from_round: number;
    acquired_price: number | null;
    source: string;
  }[] = [];
  const txRows: { fantasy_team_id: string; component_id: string; kind: string; price: number }[] = [];

  for (const p of state.participants) {
    for (const slot of SLOTS) {
      const componentId = p.garage[slot]!;
      const price = paid.get(componentId) ?? null;
      rosterRows.push({
        fantasy_team_id: p.teamId,
        slot,
        component_id: componentId,
        from_round: 1,
        acquired_price: price,
        source: 'auction',
      });
      txRows.push({ fantasy_team_id: p.teamId, component_id: componentId, kind: 'auction', price: price ?? 0 });
    }
  }

  const ins = await supabase.from('roster_assignments').insert(rosterRows);
  if (ins.error) return { ok: false, error: ins.error.message };
  await supabase.from('market_transactions').insert(txRows);

  return { ok: true, assignments: rosterRows.length };
}
