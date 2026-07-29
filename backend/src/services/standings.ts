// Layer DB → motore: legge i risultati grezzi e i roster (datati) dal database,
// costruisce gli input per scoring.ts e calcola le classifiche della stagione.
import { supabase } from '../db/supabase';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import { computeTeamRound, RoundRaw, RosterSlot, TeamRoster } from './scoring';

export interface TeamStanding {
  teamId: string;
  name: string;
  total: number;
  perRound: number[]; // punti per round (ordine dei round disputati)
  cumulative: number[];
  breakdown: {
    telaio: number; motore: number; pilota1: number; pilota2: number;
    sponsor: number; benzina: number; pole: number; teamManager: number; drsBonus: number;
  };
  // Spareggi: piazzamenti per-round (vittorie GP fantasy, 2°, 3°).
  gpWins: number;
  seconds: number;
  thirds: number;
}

export interface StandingsResult {
  rounds: { round_no: number; code: string | null }[];
  teams: TeamStanding[];
}

// Spareggio Campione (Reg.): punti → Race vinte dal Team → più 2° → più 3° → punti TM.
export function championCompare(a: TeamStanding, b: TeamStanding): number {
  return (
    b.total - a.total ||
    b.gpWins - a.gpWins ||
    b.seconds - a.seconds ||
    b.thirds - a.thirds ||
    b.breakdown.teamManager - a.breakdown.teamManager
  );
}

// Spareggio Coppa TM (Reg.): punti TM → somma punti Pilota → Race vinte → piazzamento (totale).
export function tmCupCompare(a: TeamStanding, b: TeamStanding): number {
  return (
    b.breakdown.teamManager - a.breakdown.teamManager ||
    (b.breakdown.pilota1 + b.breakdown.pilota2) - (a.breakdown.pilota1 + a.breakdown.pilota2) ||
    b.gpWins - a.gpWins ||
    b.total - a.total
  );
}

interface Comp { id: string; kind: string; ref_driver_id: string | null; ref_fia_team_id: string | null; }
interface Assign { fantasy_team_id: string; slot: RosterSlot; component_id: string; from_round: number; to_round: number | null; }

export async function computeStandings(seasonId: string): Promise<StandingsResult> {
  const [roundsR, teamsR, compR, drvR, assignR, srR, poleR, drsR, rulesR, lineupR] = await Promise.all([
    supabase.from('rounds').select('id, round_no, code, status').eq('season_id', seasonId).order('round_no'),
    supabase.from('fantasy_teams').select('id, name').eq('season_id', seasonId),
    supabase.from('components').select('id, kind, ref_driver_id, ref_fia_team_id').eq('season_id', seasonId),
    supabase.from('drivers').select('id, fia_team_id').eq('season_id', seasonId),
    supabase.from('roster_assignments').select('fantasy_team_id, slot, component_id, from_round, to_round'),
    supabase.from('session_results').select('round_id, driver_id, session, fia_points, deduction'),
    supabase.from('poles').select('round_id, pole_driver_id'),
    supabase.from('drs_declarations').select('fantasy_team_id, round_id, slot'),
    supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle(),
    supabase.from('round_lineups').select('round_id, fia_team_id, driver_id'),
  ]);

  const rules: ScoringRules = { ...DEFAULT_RULES, ...((rulesR.data?.config as Partial<ScoringRules>) ?? {}) };
  const scoredRounds = (roundsR.data ?? []).filter((r) => r.status === 'scored');
  const roundIds = new Set(scoredRounds.map((r) => r.id));
  const teams = teamsR.data ?? [];
  const compById = new Map<string, Comp>((compR.data ?? []).map((c) => [c.id, c as Comp]));

  // lineup di fallback: piloti per scuderia (drivers.fia_team_id)
  const driversByTeam = new Map<string, string[]>();
  for (const d of drvR.data ?? []) {
    if (!d.fia_team_id) continue;
    const arr = driversByTeam.get(d.fia_team_id) ?? [];
    arr.push(d.id);
    driversByTeam.set(d.fia_team_id, arr);
  }

  // RoundRaw per ciascun round disputato
  const rawByRound = new Map<string, RoundRaw>();
  for (const r of scoredRounds) {
    const race: RoundRaw['race'] = {};
    const sprint: RoundRaw['sprint'] = {};
    for (const s of srR.data ?? []) {
      if (s.round_id !== r.id) continue;
      const entry = { points: s.fia_points ?? 0, deduction: (s.deduction ?? 'none') as 'none' | 'partial' | 'total' };
      if (s.session === 'race') race[s.driver_id] = entry;
      else sprint[s.driver_id] = entry;
    }
    // lineup: round_lineups se presenti, altrimenti fallback
    const roundLineups = (lineupR.data ?? []).filter((l) => l.round_id === r.id);
    let lineup: Record<string, string[]>;
    if (roundLineups.length) {
      lineup = {};
      for (const l of roundLineups) (lineup[l.fia_team_id] ??= []).push(l.driver_id);
    } else {
      lineup = Object.fromEntries(driversByTeam);
    }
    const pole = (poleR.data ?? []).find((p) => p.round_id === r.id);
    rawByRound.set(r.id, { race, sprint, lineup, poleDriverId: pole?.pole_driver_id ?? null });
  }

  // DRS map: fantasy_team_id -> round_id -> slot
  const drsMap = new Map<string, Map<string, RosterSlot>>();
  for (const d of drsR.data ?? []) {
    if (!roundIds.has(d.round_id)) continue;
    const m = drsMap.get(d.fantasy_team_id) ?? new Map();
    m.set(d.round_id, d.slot as RosterSlot);
    drsMap.set(d.fantasy_team_id, m);
  }

  const assignments = assignR.data ?? [];
  function resolveRoster(teamId: string, roundNo: number): TeamRoster | null {
    const active: Partial<Record<RosterSlot, Comp>> = {};
    for (const a of assignments as Assign[]) {
      if (a.fantasy_team_id !== teamId) continue;
      if (a.from_round <= roundNo && (a.to_round == null || a.to_round >= roundNo)) {
        active[a.slot] = compById.get(a.component_id);
      }
    }
    const need: RosterSlot[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];
    if (need.some((s) => !active[s])) return null;
    return {
      telaioTeamId: active.telaio!.ref_fia_team_id!,
      motoreWorksTeamId: active.motore!.ref_fia_team_id!,
      p1DriverId: active.pilota1!.ref_driver_id!,
      p2DriverId: active.pilota2!.ref_driver_id!,
      sponsorTeamId: active.sponsor!.ref_fia_team_id!,
      benzinaTeamId: active.benzina!.ref_fia_team_id!,
    };
  }

  const standings: TeamStanding[] = teams.map((t) => {
    const perRound: number[] = [];
    const cumulative: number[] = [];
    const acc = { telaio: 0, motore: 0, pilota1: 0, pilota2: 0, sponsor: 0, benzina: 0, pole: 0, teamManager: 0, drsBonus: 0 };
    let run = 0;
    for (const r of scoredRounds) {
      const roster = resolveRoster(t.id, r.round_no);
      const raw = rawByRound.get(r.id)!;
      if (!roster) {
        perRound.push(0);
        cumulative.push(run);
        continue;
      }
      const drsSlot = drsMap.get(t.id)?.get(r.id);
      const b = computeTeamRound(raw, roster, rules, drsSlot);
      perRound.push(b.total);
      run += b.total;
      cumulative.push(run);
      acc.telaio += b.telaio; acc.motore += b.motore; acc.pilota1 += b.pilota1; acc.pilota2 += b.pilota2;
      acc.sponsor += b.sponsor; acc.benzina += b.benzina; acc.pole += b.pole; acc.teamManager += b.teamManager; acc.drsBonus += b.drsBonus;
    }
    return { teamId: t.id, name: t.name, total: run, perRound, cumulative, breakdown: acc, gpWins: 0, seconds: 0, thirds: 0 };
  });

  // Spareggi: per ogni round conta i piazzamenti (1°/2°/3°) di ogni squadra (competition ranking, gestisce le parità).
  for (let i = 0; i < scoredRounds.length; i++) {
    for (const t of standings) {
      const mine = t.perRound[i] ?? 0;
      const rank = 1 + standings.filter((o) => (o.perRound[i] ?? 0) > mine).length;
      if (rank === 1) t.gpWins++;
      else if (rank === 2) t.seconds++;
      else if (rank === 3) t.thirds++;
    }
  }

  standings.sort(championCompare);
  return { rounds: scoredRounds.map((r) => ({ round_no: r.round_no, code: r.code })), teams: standings };
}

// Roster corrente (attivo) di una squadra: slot → nome componente.
export async function getTeamRoster(
  seasonId: string,
  teamId: string
): Promise<{ slot: string; name: string }[]> {
  const [assignR, compR] = await Promise.all([
    supabase.from('roster_assignments').select('slot, component_id, to_round').eq('fantasy_team_id', teamId),
    supabase.from('components').select('id, name').eq('season_id', seasonId),
  ]);
  const compName = new Map((compR.data ?? []).map((c) => [c.id, c.name]));
  const order: RosterSlot[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];
  const bySlot = new Map<string, string>();
  for (const a of assignR.data ?? []) {
    if (a.to_round == null) bySlot.set(a.slot, compName.get(a.component_id) ?? '—');
  }
  return order.map((slot) => ({ slot, name: bySlot.get(slot) ?? '—' }));
}
