// Piloti di riserva: si possono SCHIERARE e si possono OCCUPARE uno slot, ma non si comprano.
//
// ⚠️ Correzione di una mia decisione sbagliata. Quando è nato `POST /reference/driver` avevo
// scritto che una riserva «non è un pezzo comprabile all'asta e non si può possedere». La prima
// metà è giusta, la seconda la smentisce il Regolamento: l'Art. II.b/II.c dice che il sostituto
// «diviene temporaneamente parte del Team», e l'Art. II.d possibilità 2 dà diritto al sostituto
// del sostituto — che è quasi sempre una riserva (Tsunoda, GP d'Olanda e Monza 2026).
//
// Le due proprietà vanno quindi separate:
//  · OCCUPABILE  → serve un `components`, perché `roster_assignments` punta lì;
//  · COMPRABILE  → NON si memorizza, si DERIVA: un componente pilota il cui driver è marcato
//                  `is_reserve` resta fuori dall'asta e dal listino valori.
// Così non serve nessuna colonna nuova e nessuno script SQL da far girare a mano.
import { supabase } from '../db/supabase';

/**
 * Restituisce il `components` del pilota, creandolo se manca. Idempotente.
 *
 * Serve per le riserve create prima di questa correzione (Tsunoda esiste come `drivers` ma
 * senza componente): la prima volta che entra in una squadra, il pezzo nasce qui.
 */
export async function assicuraComponentePilota(
  seasonId: string,
  driverId: string
): Promise<{ componentId?: string; error?: string }> {
  const { data: esistente } = await supabase
    .from('components')
    .select('id')
    .eq('season_id', seasonId)
    .eq('kind', 'pilota')
    .eq('ref_driver_id', driverId)
    .maybeSingle();
  if (esistente) return { componentId: esistente.id };

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('season_id', seasonId)
    .eq('id', driverId)
    .maybeSingle();
  if (!driver) return { error: 'Pilota non in anagrafica' };

  const { data, error } = await supabase
    .from('components')
    .insert({ season_id: seasonId, kind: 'pilota', name: driver.name, ref_driver_id: driver.id, base_price: 0 })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { componentId: data.id };
}

/**
 * Gli id dei componenti che NON vanno all'asta né nel listino: quelli di una riserva.
 * Una riserva non ha una base d'asta sensata — non era in anagrafica a inizio stagione.
 */
export async function componentiNonComprabili(seasonId: string): Promise<Set<string>> {
  const { data: riserve } = await supabase
    .from('drivers')
    .select('id')
    .eq('season_id', seasonId)
    .eq('is_reserve', true);
  const ids = new Set((riserve ?? []).map((d) => d.id));
  if (ids.size === 0) return new Set();

  const { data: comps } = await supabase
    .from('components')
    .select('id, ref_driver_id')
    .eq('season_id', seasonId)
    .eq('kind', 'pilota');
  return new Set((comps ?? []).filter((c) => c.ref_driver_id && ids.has(c.ref_driver_id)).map((c) => c.id));
}
