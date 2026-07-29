import { supabase } from '../db/supabase';

// Id della stagione corrente (l'anno più recente).
export async function getCurrentSeasonId(): Promise<string | null> {
  const { data } = await supabase
    .from('seasons')
    .select('id')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
