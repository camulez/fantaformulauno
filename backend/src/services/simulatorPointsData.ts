// Adattatore database → regola pura del premio simulatore.
// Sta a `simulatorPoints.ts` come `standings.ts` sta a `scoring.ts`: qui si legge, lì si decide.
import { supabase } from '../db/supabase';
import { ScoringRules } from '../config/defaultRules';
import { awardSimulatorPoints, NO_SIM_POINTS, SimLapRow, SimPointsMap } from './simulatorPoints';

export async function loadSimulatorPoints(seasonId: string, rules: ScoringRules): Promise<SimPointsMap> {
  const prize = rules.simulatorPoints ?? 0;
  // Spento: nessuna query, e il campionato resta identico a com'era prima che il
  // simulatore esistesse. È la garanzia che tiene valido il gate 778/634/558/285.
  if (!prize || prize <= 0) return NO_SIM_POINTS;

  const [lapsR, teamsR] = await Promise.all([
    supabase.from('sim_laps').select('round_no, person_id, time_ms').eq('season_id', seasonId),
    supabase.from('fantasy_teams').select('id, person_id').eq('season_id', seasonId),
  ]);

  const teamOfPerson = new Map<string, string>();
  for (const t of teamsR.data ?? []) {
    if (t.person_id) teamOfPerson.set(t.person_id, t.id);
  }

  return awardSimulatorPoints((lapsR.data ?? []) as SimLapRow[], teamOfPerson, prize);
}
