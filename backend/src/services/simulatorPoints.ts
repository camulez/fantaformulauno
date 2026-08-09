// Punti di campionato assegnati dal simulatore.
//
// Regola PURA (niente database): classifiche e report leggono entrambi da qui, così non possono divergere
// (stessa disciplina di `computeTeamRound` per il punteggio vero).
//
// Quando si assegnano: al momento in cui il GP viene disputato. È coerente con la regola
// del simulatore — si gira PRIMA della gara, e appena la gara è a referto il circuito si
// chiude e la classifica dei tempi si congela. Quindi il premio si legge sui round
// `scored`, gli stessi su cui gira il campionato.

/** round_no → (fantasy_team_id → punti). Vuota se il premio è spento. */
export type SimPointsMap = Map<number, Map<string, number>>;

export const NO_SIM_POINTS: SimPointsMap = new Map();

export interface SimLapRow {
  round_no: number;
  person_id: string;
  time_ms: number;
}

/**
 * Parte PURA: dai giri registrati ai punti per squadra. Senza database, quindi
 * verificabile da riga di comando (simulatorPoints.check.ts).
 */
export function awardSimulatorPoints(
  laps: SimLapRow[],
  teamOfPerson: Map<string, string>,
  prize: number
): SimPointsMap {
  if (!prize || prize <= 0) return new Map();

  // Miglior tempo di ogni persona su ogni circuito.
  const bestByRound = new Map<number, Map<string, number>>();
  for (const l of laps) {
    const perPerson = bestByRound.get(l.round_no) ?? new Map<string, number>();
    const prev = perPerson.get(l.person_id);
    if (prev === undefined || l.time_ms < prev) perPerson.set(l.person_id, l.time_ms);
    bestByRound.set(l.round_no, perPerson);
  }

  const out: SimPointsMap = new Map();
  for (const [roundNo, perPerson] of bestByRound) {
    if (perPerson.size === 0) continue;
    const best = Math.min(...perPerson.values());
    const perTeam = new Map<string, number>();
    for (const [personId, t] of perPerson) {
      // Parità al millisecondo: premiati entrambi. È talmente improbabile che non vale
      // la pena inventare uno spareggio, e togliere il punto a chi ha pareggiato sarebbe peggio.
      if (t !== best) continue;
      const teamId = teamOfPerson.get(personId);
      if (teamId) perTeam.set(teamId, prize);
    }
    if (perTeam.size > 0) out.set(roundNo, perTeam);
  }
  return out;
}
