export interface PersonPublic {
  id: string;
  name: string;
}

export interface Me {
  id: string;
  name: string;
}

export interface SeasonInfo {
  id: string;
  year: number;
  mode: "summary" | "live";
  status: string;
  total_rounds: number;
  roundsScored: number;
  roundsRemaining: number;
}

export interface FiaTeam {
  id: string;
  name: string;
}

export interface Driver {
  id: string;
  name: string;
  fia_team_id: string | null;
  is_reserve: boolean;
}

export interface ComponentRef {
  id: string;
  kind: "telaio" | "motore" | "pilota" | "sponsor" | "benzina";
  name: string;
  ref_driver_id: string | null;
  ref_fia_team_id: string | null;
  base_price: number;
}

export interface RoundInfo {
  id: string;
  round_no: number;
  code: string | null;
  name: string | null;
  has_sprint: boolean;
  status: string;
}

export interface ReferenceData {
  seasonId: string;
  teams: FiaTeam[];
  drivers: Driver[];
  components: ComponentRef[];
  rounds: RoundInfo[];
  rules: { raceScale: number[]; sprintScale: number[] };
}

export type SessionKind = "race" | "sprint";
export type Deduction = "none" | "partial" | "total";

export interface SessionResultRow {
  driver_id: string;
  session: SessionKind;
  position: number | null;
  fia_points: number;
  dnf: boolean;
  deduction: Deduction;
}

export interface RoundResults {
  round: RoundInfo;
  results: SessionResultRow[];
  poleDriverId: string | null;
}

export interface StandingBreakdown {
  telaio: number;
  motore: number;
  pilota1: number;
  pilota2: number;
  sponsor: number;
  benzina: number;
  pole: number;
  teamManager: number;
  drsBonus: number;
}

export interface TeamStanding {
  teamId: string;
  name: string;
  total: number;
  perRound: number[];
  cumulative: number[];
  breakdown: StandingBreakdown;
  gpWins: number;
  seconds: number;
  thirds: number;
}

export interface StandingsResult {
  rounds: { round_no: number; code: string | null }[];
  teams: TeamStanding[];
}

export interface TeamDetail extends TeamStanding {
  position: number;
  rounds: { round_no: number; code: string | null }[];
  roster: { slot: string; name: string }[];
}

export interface RoundDetail {
  round: { round_no: number; code: string | null };
  teams: { teamId: string; name: string; roundPoints: number; cumulative: number }[];
}

export interface AlboRow {
  year: number;
  champion?: string;
  tmCup?: string;
}

export interface TitoliRow {
  name: string;
  championships: number;
  tmCups: number;
  participations: number;
}

export interface HistoryData {
  albo: AlboRow[];
  titoli: TitoliRow[];
}

export interface AuctionRules {
  budget: number;
  minIncrement: number;
  phaseOrder: string[];
}

// ─── Stato dell'asta (tabellone) ───
export type AuctionSlot = "motore" | "sponsor" | "pilota1" | "benzina" | "telaio" | "pilota2";
export type AuctionKind = "telaio" | "motore" | "pilota" | "sponsor" | "benzina";

export interface AuctionComponent {
  id: string;
  kind: AuctionKind;
  name: string;
  basePrice: number;
  scuderiaId: string | null;
  assignedTo: string | null;
}
export interface AuctionParticipant {
  teamId: string;
  teamName: string;
  personName: string;
  budget: number;
  garage: Partial<Record<AuctionSlot, string>>;
}
export interface AuctionSlip {
  teamId: string;
  componentId: string;
  amount: number;
}
export interface AuctionRoundState {
  slot: AuctionSlot;
  roundNumber: number;
  activeTeamIds: string[];
  availableComponentIds: string[];
  slips: AuctionSlip[];
  mode: "bidding" | "tiebreak";
  tieComponentId: string | null;
  tieTeamIds: string[];
  pendingTiebreaks: { componentId: string; teamIds: string[]; amount: number }[];
  assignments: { teamId: string; componentId: string; componentName: string; amount: number }[];
}
export interface AuctionState {
  seasonId: string;
  status: "lobby" | "category" | "done";
  budgetInitial: number;
  participants: AuctionParticipant[];
  components: AuctionComponent[];
  round: AuctionRoundState | null;
  history: { slot: AuctionSlot; componentId: string; componentName: string; winnerTeamId: string; amount: number }[];
  lastAssignments: { teamId: string; componentId: string; componentName: string; amount: number }[];
  phaseOrder: AuctionSlot[];
  restricted: Record<string, string[]>;
  allFull: boolean;
}

export interface ScoringRules {
  raceScale: number[];
  sprintScale: number[];
  fastestLapPoint: number;
  polePoints: number;
  teamManagerPoints: number;
  sponsorPointsPerCar: number;
  benzinaPointsPerCar: number;
  drsMultiplier: number;
  drsScope: "race" | "race_sprint";
  drsPerSeason: number;
  auction: AuctionRules;
}

// ─── Report per round ───
export type ReportSlot = "telaio" | "motore" | "pilota1" | "pilota2" | "sponsor" | "benzina";
export type Deduzione = "none" | "partial" | "total";

export interface ReportCtorDriver {
  name: string;
  race: number;
  sprint: number;
  raceDeduction: Deduzione;
  sprintDeduction: Deduzione;
  counted: number;
}
interface ReportRowBase {
  points: number;
  label: string;
  componentName: string;
}
// Unione discriminata su `slot`: così il frontend può restringere il tipo con uno switch.
export type ReportRow =
  | (ReportRowBase & { slot: "telaio" | "motore"; scuderia: string; drivers: ReportCtorDriver[] })
  | (ReportRowBase & { slot: "pilota1" | "pilota2"; pilota: string; race: number; sprint: number })
  | (ReportRowBase & { slot: "sponsor" | "benzina"; scuderia: string; carsScored: number; perCar: number });

export interface RoundReport {
  round: { round_no: number; code: string | null; name: string | null };
  team: { teamId: string; name: string };
  incomplete: boolean;
  total: number;
  position: number;
  best: number;
  rows: ReportRow[];
  derived: {
    pole: { points: number; driverName: string | null; owned: boolean };
    teamManager: { p1Scored: boolean; p2Scored: boolean; points: number };
    drs: {
      slot: ReportSlot | null;
      bonus: number;
      scope: "race" | "race_sprint";
      multiplier: number;
      slotLabel: string | null;
      componentName: string | null;
    };
  } | null;
}

export interface SeasonMatrixRow {
  key: string;
  label: string;
  componentNames: string[];
  points: number[];
  total: number;
}
export interface SeasonMatrix {
  team: { teamId: string; name: string };
  rounds: { round_no: number; code: string | null }[];
  rows: SeasonMatrixRow[];
  columnTotals: number[];
  grandTotal: number;
}

export interface ComponentValue {
  id: string;
  kind: AuctionKind;
  name: string;
  basePrice: number;
  assignedTo: string | null;
  owner: string | null;
}
export interface ValuesPayload {
  approved: boolean;
  auctionActive: boolean;
  components: ComponentValue[];
}

export interface RosterHistoryRow {
  slot: string;
  name: string;
  fromRound: number;
  toRound: number | null;
}

export interface AlboSeasonRow {
  id: string;
  year: number;
  mode: "live" | "summary";
  status: string;
  championId: string | null;
  championName: string | null;
  tmCupId: string | null;
  tmCupName: string | null;
}

export interface Message {
  id: string;
  body: string;
  createdAt: string;
  author: string;
}

// ── Simulatore ──
export interface SimTrack {
  roundNo: number;
  code: string | null;
  name: string | null;
  status: string;
  /** Il GP non è ancora stato disputato: si può girare. */
  open: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  myBest: number | null;
  record: { timeMs: number; person: string } | null;
}

export interface SimTracksPayload {
  tracks: SimTrack[];
  maxAttempts: number;
}

export interface SimLapResult {
  attemptsUsed: number;
  attemptsLeft: number;
  timeMs: number;
  myBest: number;
  isRecord: boolean;
}

export interface SimLeaderboardRow {
  person: string;
  timeMs: number;
  rawMs: number;
  penaltyMs: number;
  violations: number;
  brakeAssist: boolean;
  attempts: number;
}

export interface SimLeaderboard {
  round: { round_no: number; code: string | null; name: string | null; status: string } | null;
  open: boolean;
  rows: SimLeaderboardRow[];
}
