// Motore di punteggio — funzioni PURE (nessun I/O). Tutti i valori arrivano da ScoringRules
// (season_rules.config): nessuna costante cablata. Il ricalcolo è idempotente: si "rigiocano"
// i dati grezzi FIA e si sommano i componenti del roster di ogni squadra.

import { ScoringRules } from '../config/defaultRules';

export type DeductionKind = 'none' | 'partial' | 'total';

export interface SessionEntry {
  points: number;
  deduction?: DeductionKind;
}

// Dati grezzi FIA di UN round (già in forma normalizzata).
export interface RoundRaw {
  race: Record<string, SessionEntry>;    // driverId -> punti Race FIA
  sprint: Record<string, SessionEntry>;  // driverId -> punti Sprint FIA (vuoto se no sprint)
  poleDriverId?: string | null;          // pilota con il Punto Pole (dopo penalità)
  lineup: Record<string, string[]>;      // fiaTeamId -> piloti che hanno gareggiato (gestisce riserve)
}

export type RosterSlot =
  | 'telaio'
  | 'motore'
  | 'pilota1'
  | 'pilota2'
  | 'sponsor'
  | 'benzina';

// Roster di una squadra fantasy risolto in id FIA.
export interface TeamRoster {
  telaioTeamId: string;      // scuderia del telaio
  motoreWorksTeamId: string; // scuderia "di fabbrica" del motore
  p1DriverId: string;
  p2DriverId: string;
  sponsorTeamId: string;     // scuderia dello sponsor
  benzinaTeamId: string;     // scuderia della benzina
}

export interface TeamRoundBreakdown {
  telaio: number;
  motore: number;
  pilota1: number;
  pilota2: number;
  sponsor: number;
  benzina: number;
  pole: number;
  teamManager: number;
  drsBonus: number;
  total: number;
}

const ded = (e?: SessionEntry): DeductionKind => e?.deduction ?? 'none';

// Contributo di una sessione al COSTRUTTORE (telaio/motore): escluso se penalizzato (parziale o totale).
const ctorSess = (e?: SessionEntry): number => (e && ded(e) === 'none' ? e.points : 0);

/**
 * Calcola il punteggio di UNA squadra fantasy in UN round, dai dati grezzi FIA.
 * `drsSlot` = slot su cui la squadra ha giocato il DRS in questo round (o undefined).
 */
export function computeTeamRound(
  raw: RoundRaw,
  roster: TeamRoster,
  rules: ScoringRules,
  drsSlot?: RosterSlot
): TeamRoundBreakdown {
  // "monoposto a punti in Race": punti Race > 0 e non azzerata da detrazione TOTALE.
  const carScored = (d: string): boolean =>
    (raw.race[d]?.points ?? 0) > 0 && ded(raw.race[d]) !== 'total';

  const driverAll = (d: string): number =>
    (raw.race[d]?.points ?? 0) + (raw.sprint[d]?.points ?? 0);
  const driverRace = (d: string): number => raw.race[d]?.points ?? 0;

  const ctorAll = (teamId: string): number =>
    (raw.lineup[teamId] ?? []).reduce(
      (s, d) => s + ctorSess(raw.race[d]) + ctorSess(raw.sprint[d]),
      0
    );
  const ctorRace = (teamId: string): number =>
    (raw.lineup[teamId] ?? []).reduce((s, d) => s + ctorSess(raw.race[d]), 0);
  const carsScored = (teamId: string): number =>
    (raw.lineup[teamId] ?? []).filter(carScored).length;

  const telaio = ctorAll(roster.telaioTeamId);
  const motore = ctorAll(roster.motoreWorksTeamId);
  const pilota1 = driverAll(roster.p1DriverId);
  const pilota2 = driverAll(roster.p2DriverId);
  const sponsor = rules.sponsorPointsPerCar * carsScored(roster.sponsorTeamId);
  const benzina = rules.benzinaPointsPerCar * carsScored(roster.benzinaTeamId);

  // Pole: va alla squadra che possiede quel pilota (P1/P2), non al telaio.
  const owned = [roster.p1DriverId, roster.p2DriverId];
  const pole =
    raw.poleDriverId && owned.includes(raw.poleDriverId) ? rules.polePoints : 0;

  // Team Manager: 3 pt se ENTRAMBI i piloti POSSEDUTI (P1 e P2) prendono punti Race.
  // (Verificato sui dati R11: i due piloti sono quelli della squadra fantasy, non della scuderia del telaio.)
  const teamManager =
    carScored(roster.p1DriverId) && carScored(roster.p2DriverId)
      ? rules.teamManagerPoints
      : 0;

  // DRS: raddoppia i punti (di default solo Race) del componente su cui è giocato.
  let drsBonus = 0;
  if (drsSlot && rules.drsMultiplier > 1) {
    const extra = rules.drsMultiplier - 1;
    const full = rules.drsScope === 'race_sprint';
    switch (drsSlot) {
      case 'telaio':
        drsBonus = (full ? ctorAll(roster.telaioTeamId) : ctorRace(roster.telaioTeamId)) * extra;
        break;
      case 'motore':
        drsBonus = (full ? ctorAll(roster.motoreWorksTeamId) : ctorRace(roster.motoreWorksTeamId)) * extra;
        break;
      case 'pilota1':
        drsBonus = (full ? driverAll(roster.p1DriverId) : driverRace(roster.p1DriverId)) * extra;
        break;
      case 'pilota2':
        drsBonus = (full ? driverAll(roster.p2DriverId) : driverRace(roster.p2DriverId)) * extra;
        break;
      case 'sponsor':
        drsBonus = sponsor * extra; // sponsor è tutto "Race"
        break;
      case 'benzina':
        drsBonus = benzina * extra;
        break;
    }
  }

  const total =
    telaio + motore + pilota1 + pilota2 + sponsor + benzina + pole + teamManager + drsBonus;

  return { telaio, motore, pilota1, pilota2, sponsor, benzina, pole, teamManager, drsBonus, total };
}

export interface SeasonRoundInput {
  raw: RoundRaw;
  drsSlot?: RosterSlot; // DRS giocato da QUESTA squadra in questo round
}

/** Somma stagionale del punteggio di una squadra su più round. */
export function computeSeasonTotal(
  rounds: SeasonRoundInput[],
  roster: TeamRoster,
  rules: ScoringRules
): { total: number; perRound: TeamRoundBreakdown[] } {
  const perRound = rounds.map((r) => computeTeamRound(r.raw, roster, rules, r.drsSlot));
  const total = perRound.reduce((s, b) => s + b.total, 0);
  return { total, perRound };
}
