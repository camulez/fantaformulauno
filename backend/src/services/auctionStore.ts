// Persistenza dello stato d'asta come blob JSON su auction_sessions (una sessione per stagione).
import { supabase } from '../db/supabase';
import { AuctionState } from '../types/auction';

export async function loadState(seasonId: string): Promise<AuctionState | null> {
  const { data } = await supabase
    .from('auction_sessions')
    .select('id, state')
    .eq('season_id', seasonId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const state = (data?.state ?? null) as AuctionState | null;
  return state && state.participants ? state : null;
}

export async function saveState(seasonId: string, state: AuctionState): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('auction_sessions')
    .select('id')
    .eq('season_id', seasonId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('auction_sessions')
      .update({ status: state.status, state, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { error: error?.message };
  }
  const { error } = await supabase
    .from('auction_sessions')
    .insert({ season_id: seasonId, status: state.status, state });
  return { error: error?.message };
}

export async function clearState(seasonId: string): Promise<void> {
  await supabase.from('auction_sessions').delete().eq('season_id', seasonId);
}
