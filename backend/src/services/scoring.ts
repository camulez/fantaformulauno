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

/**
 * Il DRS applicato in un round. ⚠️ NON è un punteggio in più: è un MOLTIPLICATORE.
 * I punti che aggiunge sono GIÀ dentro il valore dello slot su cui è giocato — sommarli
 * di nuovo al totale li conterebbe due volte. Questo oggetto serve solo a raccontare
 * quanto del valore di quel componente viene dal raddoppio.
 */
export interface DrsApplied {
  slot: RosterSlot;
  /** Punti dello slot PRIMA del raddoppio. */
  base: number;
  /** La quota di quei punti che il moltiplicatore ha toccato (di norma i soli punti Gara). */
  moltiplicata: number;
  /** Punti aggiunti dal raddoppio. Già compresi nel valore dello slot. */
  aggiunta: number;
  multiplier: number;
  scope: ScoringRules['drsScope'];
}

export interface TeamRoundBreakdown {
  // ⚠️ I sei slot INCLUDONO già l'effetto del DRS, quando giocato.
  telaio: number;
  motore: number;
  pilota1: number;
  pilota2: number;
  sponsor: number;
  benzina: number;
  pole: number;
  teamManager: number;
  /** Descrizione del DRS giocato, informativa. Vedi `DrsApplied`: non è un addendo. */
  drs: DrsApplied | null;
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

  // ── DRS: MOLTIPLICA i punti (di default solo quelli di Gara) del componente scelto ──
  // L'effetto viene sommato DENTRO lo slot, non messo a parte: è un moltiplicatore, e va
  // letto così anche dai numeri. `drs` racconta soltanto quanto di quel valore è raddoppio.
  const base = { telaio, motore, pilota1, pilota2, sponsor, benzina };
  let drs: DrsApplied | null = null;

  if (drsSlot && rules.drsMultiplier > 1) {
    const extra = rules.drsMultiplier - 1;
    const full = rules.drsScope === 'race_sprint';
    // Quota di punti dello slot che il moltiplicatore tocca.
    const moltiplicata =
      drsSlot === 'telaio' ? (full ? ctorAll(roster.telaioTeamId) : ctorRace(roster.telaioTeamId))
      : drsSlot === 'motore' ? (full ? ctorAll(roster.motoreWorksTeamId) : ctorRace(roster.motoreWorksTeamId))
      : drsSlot === 'pilota1' ? (full ? driverAll(roster.p1DriverId) : driverRace(roster.p1DriverId))
      : drsSlot === 'pilota2' ? (full ? driverAll(roster.p2DriverId) : driverRace(roster.p2DriverId))
      : drsSlot === 'sponsor' ? sponsor // sponsor e benzina sono tutti punti "Gara"
      : benzina;

    const aggiunta = moltiplicata * extra;
    drs = {
      slot: drsSlot,
      base: base[drsSlot],
      moltiplicata,
      aggiunta,
      multiplier: rules.drsMultiplier,
      scope: rules.drsScope,
    };
    base[drsSlot] += aggiunta;
  }

  const total =
    base.telaio + base.motore + base.pilota1 + base.pilota2 + base.sponsor + base.benzina +
    pole + teamManager;

  return { ...base, pole, teamManager, drs, total };
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

// ─────────────────────────────────────────────────────────────────────────────
// SPIEGAZIONE DEL PUNTEGGIO (per il report di round)
//
// Funzione PURA e separata: i NUMERI vengono da computeTeamRound (unica autorità,
// così report e classifica non possono divergere), qui si ricava solo il "da dove
// arrivano". Le parti spiegate devono sempre sommare al numero del motore: è
// esattamente ciò che verifica report.check.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface CtorDriverLine {
  driverId: string;
  race: number;
  sprint: number;
  raceDeduction: DeductionKind;
  sprintDeduction: DeductionKind;
  counted: number; // quanto ha davvero contribuito al costruttore
}

/**
 * Il raddoppio visto dallo slot. `points` dello slot lo comprende già: serve per poter
 * dire «43 di gara raddoppiati» invece di far comparire un numero dal nulla.
 */
export interface SlotDrs {
  moltiplicata: number;
  aggiunta: number;
  multiplier: number;
}

type SlotBase = { points: number; drs: SlotDrs | null };

export type SlotExplain =
  | (SlotBase & { slot: 'telaio' | 'motore'; fiaTeamId: string; drivers: CtorDriverLine[] })
  | (SlotBase & { slot: 'pilota1' | 'pilota2'; driverId: string; race: number; sprint: number })
  | (SlotBase & { slot: 'sponsor' | 'benzina'; fiaTeamId: string; carsScored: number; perCar: number });

export interface RoundExplain {
  breakdown: TeamRoundBreakdown;
  slots: SlotExplain[];
  pole: { poleDriverId: string | null; owned: boolean; points: number };
  teamManager: { p1Scored: boolean; p2Scored: boolean; points: number };
  /** Il DRS giocato, se c'è. I suoi punti sono già dentro lo slot: vedi `DrsApplied`. */
  drs: DrsApplied | null;
}

export function explainTeamRound(
  raw: RoundRaw,
  roster: TeamRoster,
  rules: ScoringRules,
  drsSlot?: RosterSlot
): RoundExplain {
  const breakdown = computeTeamRound(raw, roster, rules, drsSlot);

  const carScored = (d: string): boolean =>
    (raw.race[d]?.points ?? 0) > 0 && ded(raw.race[d]) !== 'total';

  const ctorLines = (fiaTeamId: string): CtorDriverLine[] =>
    (raw.lineup[fiaTeamId] ?? []).map((d) => ({
      driverId: d,
      race: raw.race[d]?.points ?? 0,
      sprint: raw.sprint[d]?.points ?? 0,
      raceDeduction: ded(raw.race[d]),
      sprintDeduction: ded(raw.sprint[d]),
      counted: ctorSess(raw.race[d]) + ctorSess(raw.sprint[d]),
    }));

  const carsScored = (fiaTeamId: string): number =>
    (raw.lineup[fiaTeamId] ?? []).filter(carScored).length;

  // Il raddoppio riguarda un solo slot: qui lo si attacca a quello giusto.
  const drsDi = (slot: RosterSlot): SlotDrs | null =>
    breakdown.drs && breakdown.drs.slot === slot
      ? {
          moltiplicata: breakdown.drs.moltiplicata,
          aggiunta: breakdown.drs.aggiunta,
          multiplier: breakdown.drs.multiplier,
        }
      : null;

  const slots: SlotExplain[] = [
    { slot: 'telaio', points: breakdown.telaio, drs: drsDi('telaio'), fiaTeamId: roster.telaioTeamId, drivers: ctorLines(roster.telaioTeamId) },
    { slot: 'motore', points: breakdown.motore, drs: drsDi('motore'), fiaTeamId: roster.motoreWorksTeamId, drivers: ctorLines(roster.motoreWorksTeamId) },
    {
      slot: 'pilota1',
      drs: drsDi('pilota1'),
      points: breakdown.pilota1,
      driverId: roster.p1DriverId,
      race: raw.race[roster.p1DriverId]?.points ?? 0,
      sprint: raw.sprint[roster.p1DriverId]?.points ?? 0,
    },
    {
      slot: 'pilota2',
      drs: drsDi('pilota2'),
      points: breakdown.pilota2,
      driverId: roster.p2DriverId,
      race: raw.race[roster.p2DriverId]?.points ?? 0,
      sprint: raw.sprint[roster.p2DriverId]?.points ?? 0,
    },
    {
      slot: 'sponsor',
      drs: drsDi('sponsor'),
      points: breakdown.sponsor,
      fiaTeamId: roster.sponsorTeamId,
      carsScored: carsScored(roster.sponsorTeamId),
      perCar: rules.sponsorPointsPerCar,
    },
    {
      slot: 'benzina',
      drs: drsDi('benzina'),
      points: breakdown.benzina,
      fiaTeamId: roster.benzinaTeamId,
      carsScored: carsScored(roster.benzinaTeamId),
      perCar: rules.benzinaPointsPerCar,
    },
  ];

  return {
    breakdown,
    slots,
    pole: {
      poleDriverId: raw.poleDriverId ?? null,
      owned: !!raw.poleDriverId && [roster.p1DriverId, roster.p2DriverId].includes(raw.poleDriverId),
      points: breakdown.pole,
    },
    teamManager: {
      p1Scored: carScored(roster.p1DriverId),
      p2Scored: carScored(roster.p2DriverId),
      points: breakdown.teamManager,
    },
    drs: breakdown.drs,
  };
}
