// Config di punteggio/asta di DEFAULT (valori "2026"). È la "matrice a monte":
// il motore di punteggio legge SEMPRE da season_rules.config (non da queste costanti).
// Questi default popolano una nuova stagione e sono poi editabili dall'utente.

export interface AuctionRules {
  budget: number;
  minIncrement: number;
  phaseOrder: Array<'motore' | 'sponsor' | 'pilota1' | 'benzina' | 'telaio' | 'pilota2'>;
}

export interface ScoringRules {
  // Scale posizione→punti (indice 0 = 1° posto). Default = scala FIA.
  raceScale: number[];
  sprintScale: number[];
  fastestLapPoint: number;

  polePoints: number;            // punti pole (al pilota posseduto)
  teamManagerPoints: number;     // se entrambi i piloti della scuderia del telaio vanno a punti Race
  sponsorPointsPerCar: number;   // per monoposto a punti in Race
  benzinaPointsPerCar: number;   // per monoposto a punti in Race

  drsMultiplier: number;         // moltiplicatore DRS
  drsScope: 'race' | 'race_sprint'; // ambito del raddoppio (default: solo Race)
  drsPerSeason: number;          // n. DRS disponibili (uno per componente)

  /**
   * Punti di campionato a chi fa il miglior tempo al simulatore su un circuito.
   * Si assegnano quando il GP viene disputato (lì la classifica del simulatore si
   * congela, perché il circuito si chiude). **Default 0 = il simulatore non tocca
   * il campionato**: è un premio da accendere di proposito.
   */
  simulatorPoints: number;

  auction: AuctionRules;
}

export const DEFAULT_RULES: ScoringRules = {
  raceScale: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintScale: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLapPoint: 0,

  polePoints: 3,
  teamManagerPoints: 3,
  sponsorPointsPerCar: 3,
  benzinaPointsPerCar: 6,

  drsMultiplier: 2,
  drsScope: 'race',
  drsPerSeason: 6,

  simulatorPoints: 0,

  auction: {
    budget: 1835,
    minIncrement: 1,
    phaseOrder: ['motore', 'sponsor', 'pilota1', 'benzina', 'telaio', 'pilota2'],
  },
};
