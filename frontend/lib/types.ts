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
