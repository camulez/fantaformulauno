// Report per round: espone il dettaglio che il motore già calcola a ogni gara ma che
// computeStandings scarta (tiene solo il totale). Qui NON si ricalcola nulla: i numeri
// arrivano da computeTeamRound tramite explainTeamRound.

import { supabase } from '../db/supabase';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import {
  computeTeamRound,
  explainTeamRound,
  RoundRaw,
  RosterSlot,
  TeamRoster,
  SlotExplain,
} from './scoring';

const SLOTS: RosterSlot[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

export const SLOT_LABEL: Record<RosterSlot, string> = {
  telaio: 'Telaio',
  motore: 'Motore',
  pilota1: 'Pilota 1',
  pilota2: 'Pilota 2',
  sponsor: 'Sponsor',
  benzina: 'Benzina',
};

interface Comp {
  id: string;
  kind: string;
  name: string;
  ref_driver_id: string | null;
  ref_fia_team_id: string | null;
}
interface Assign {
  fantasy_team_id: string;
  slot: RosterSlot;
  component_id: string;
  from_round: number;
  to_round: number | null;
}

/** Carica una volta tutto ciò che serve per i report della stagione. */
async function loadReportData(seasonId: string) {
  const [roundsR, teamsR, compR, drvR, fiaR, assignR, srR, poleR, drsR, rulesR, lineupR] =
    await Promise.all([
      supabase.from('rounds').select('id, round_no, code, name, status').eq('season_id', seasonId).order('round_no'),
      supabase.from('fantasy_teams').select('id, name, person_id').eq('season_id', seasonId),
      supabase.from('components').select('id, kind, name, ref_driver_id, ref_fia_team_id').eq('season_id', seasonId),
      supabase.from('drivers').select('id, name, fia_team_id').eq('season_id', seasonId),
      supabase.from('fia_teams').select('id, name').eq('season_id', seasonId),
      supabase.from('roster_assignments').select('fantasy_team_id, slot, component_id, from_round, to_round'),
      supabase.from('session_results').select('round_id, driver_id, session, fia_points, deduction'),
      supabase.from('poles').select('round_id, pole_driver_id'),
      supabase.from('drs_declarations').select('fantasy_team_id, round_id, slot'),
      supabase.from('season_rules').select('config').eq('season_id', seasonId).maybeSingle(),
      supabase.from('round_lineups').select('round_id, fia_team_id, driver_id'),
    ]);

  const rules: ScoringRules = { ...DEFAULT_RULES, ...((rulesR.data?.config as Partial<ScoringRules>) ?? {}) };
  const scoredRounds = (roundsR.data ?? []).filter((r) => r.status === 'scored');
  const teams = teamsR.data ?? [];
  const compById = new Map<string, Comp>((compR.data ?? []).map((c) => [c.id, c as Comp]));
  const driverName = new Map<string, string>((drvR.data ?? []).map((d) => [d.id, d.name]));
  const fiaName = new Map<string, string>((fiaR.data ?? []).map((t) => [t.id, t.name]));

  // lineup di fallback quando non ci sono round_lineups espliciti
  const driversByTeam = new Map<string, string[]>();
  for (const d of drvR.data ?? []) {
    if (!d.fia_team_id) continue;
    const arr = driversByTeam.get(d.fia_team_id) ?? [];
    arr.push(d.id);
    driversByTeam.set(d.fia_team_id, arr);
  }

  const rawByRound = new Map<string, RoundRaw>();
  for (const r of scoredRounds) {
    const race: RoundRaw['race'] = {};
    const sprint: RoundRaw['sprint'] = {};
    for (const s of srR.data ?? []) {
      if (s.round_id !== r.id) continue;
      const entry = {
        points: s.fia_points ?? 0,
        deduction: (s.deduction ?? 'none') as 'none' | 'partial' | 'total',
      };
      if (s.session === 'race') race[s.driver_id] = entry;
      else sprint[s.driver_id] = entry;
    }
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

  const drsMap = new Map<string, Map<string, RosterSlot>>();
  for (const d of drsR.data ?? []) {
    const m = drsMap.get(d.fantasy_team_id) ?? new Map();
    m.set(d.round_id, d.slot as RosterSlot);
    drsMap.set(d.fantasy_team_id, m);
  }

  const assignments = (assignR.data ?? []) as Assign[];

  /** Componenti attivi per una squadra in un dato round (mercato datato). */
  function componentsAt(teamId: string, roundNo: number): Partial<Record<RosterSlot, Comp>> {
    const active: Partial<Record<RosterSlot, Comp>> = {};
    for (const a of assignments) {
      if (a.fantasy_team_id !== teamId) continue;
      if (a.from_round <= roundNo && (a.to_round == null || a.to_round >= roundNo)) {
        const c = compById.get(a.component_id);
        if (c) active[a.slot] = c;
      }
    }
    return active;
  }

  function rosterAt(teamId: string, roundNo: number): TeamRoster | null {
    const a = componentsAt(teamId, roundNo);
    if (SLOTS.some((s) => !a[s])) return null;
    return {
      telaioTeamId: a.telaio!.ref_fia_team_id!,
      motoreWorksTeamId: a.motore!.ref_fia_team_id!,
      p1DriverId: a.pilota1!.ref_driver_id!,
      p2DriverId: a.pilota2!.ref_driver_id!,
      sponsorTeamId: a.sponsor!.ref_fia_team_id!,
      benzinaTeamId: a.benzina!.ref_fia_team_id!,
    };
  }

  return { rules, scoredRounds, teams, driverName, fiaName, rawByRound, drsMap, componentsAt, rosterAt };
}

/** Sostituisce gli id con i nomi, così il frontend deve solo formattare. */
function nameSlot(
  s: SlotExplain,
  driverName: Map<string, string>,
  fiaName: Map<string, string>
) {
  switch (s.slot) {
    case 'telaio':
    case 'motore':
      return {
        slot: s.slot,
        points: s.points,
        scuderia: fiaName.get(s.fiaTeamId) ?? '—',
        drivers: s.drivers.map((d) => ({
          name: driverName.get(d.driverId) ?? '—',
          race: d.race,
          sprint: d.sprint,
          raceDeduction: d.raceDeduction,
          sprintDeduction: d.sprintDeduction,
          counted: d.counted,
        })),
      };
    case 'pilota1':
    case 'pilota2':
      return {
        slot: s.slot,
        points: s.points,
        pilota: driverName.get(s.driverId) ?? '—',
        race: s.race,
        sprint: s.sprint,
      };
    default:
      return {
        slot: s.slot,
        points: s.points,
        scuderia: fiaName.get(s.fiaTeamId) ?? '—',
        carsScored: s.carsScored,
        perCar: s.perCar,
      };
  }
}

/** Report dettagliato di UNA squadra in UN round. */
export async function teamRoundReport(seasonId: string, teamId: string, roundNo: number) {
  const d = await loadReportData(seasonId);
  const round = d.scoredRounds.find((r) => r.round_no === roundNo);
  if (!round) return { error: 'Round non disputato' as const };
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return { error: 'Squadra non trovata' as const };

  const raw = d.rawByRound.get(round.id)!;

  // punti di tutte le squadre in questo round, per posizione e distacco
  const allPoints = d.teams.map((t) => {
    const r = d.rosterAt(t.id, roundNo);
    if (!r) return { teamId: t.id, name: t.name, points: 0 };
    const b = computeTeamRound(raw, r, d.rules, d.drsMap.get(t.id)?.get(round.id));
    return { teamId: t.id, name: t.name, points: b.total };
  });
  const sorted = [...allPoints].sort((a, b) => b.points - a.points);
  const position = sorted.findIndex((x) => x.teamId === teamId) + 1;
  const best = sorted[0]?.points ?? 0;

  const roster = d.rosterAt(teamId, roundNo);
  if (!roster) {
    return {
      round: { round_no: round.round_no, code: round.code, name: round.name },
      team: { teamId: team.id, name: team.name },
      incomplete: true as const,
      total: 0,
      position,
      best,
      rows: [],
      derived: null,
    };
  }

  const comps = d.componentsAt(teamId, roundNo);
  const ex = explainTeamRound(raw, roster, d.rules, d.drsMap.get(teamId)?.get(round.id));

  const rows = ex.slots.map((s) => ({
    ...nameSlot(s, d.driverName, d.fiaName),
    label: SLOT_LABEL[s.slot],
    componentName: comps[s.slot]?.name ?? '—',
  }));

  return {
    round: { round_no: round.round_no, code: round.code, name: round.name },
    team: { teamId: team.id, name: team.name },
    incomplete: false as const,
    total: ex.breakdown.total,
    position,
    best,
    rows,
    derived: {
      pole: {
        points: ex.pole.points,
        driverName: ex.pole.poleDriverId ? d.driverName.get(ex.pole.poleDriverId) ?? '—' : null,
        owned: ex.pole.owned,
      },
      teamManager: ex.teamManager,
      drs: {
        ...ex.drs,
        slotLabel: ex.drs.slot ? SLOT_LABEL[ex.drs.slot] : null,
        componentName: ex.drs.slot ? comps[ex.drs.slot]?.name ?? null : null,
      },
    },
  };
}

/** Tabella di stagione: righe = pezzi (+ derivati), colonne = gare. */
export async function teamSeasonMatrix(seasonId: string, teamId: string) {
  const d = await loadReportData(seasonId);
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return { error: 'Squadra non trovata' as const };

  const rounds = d.scoredRounds.map((r) => ({ round_no: r.round_no, code: r.code }));

  const keys = [...SLOTS, 'pole', 'teamManager', 'drsBonus'] as const;
  const labels: Record<string, string> = {
    ...SLOT_LABEL,
    pole: 'Pole',
    teamManager: 'Team Manager',
    drsBonus: 'DRS',
  };
  const points: Record<string, number[]> = {};
  for (const k of keys) points[k] = [];
  const componentNames: Record<string, string[]> = {};
  for (const s of SLOTS) componentNames[s] = [];
  const columnTotals: number[] = [];

  for (const r of d.scoredRounds) {
    const roster = d.rosterAt(teamId, r.round_no);
    if (!roster) {
      for (const k of keys) points[k].push(0);
      columnTotals.push(0);
      continue;
    }
    const raw = d.rawByRound.get(r.id)!;
    const b = computeTeamRound(raw, roster, d.rules, d.drsMap.get(teamId)?.get(r.id));
    for (const k of keys) points[k].push(b[k as keyof typeof b] as number);
    columnTotals.push(b.total);

    const comps = d.componentsAt(teamId, r.round_no);
    for (const s of SLOTS) {
      const nm = comps[s]?.name;
      if (nm && !componentNames[s].includes(nm)) componentNames[s].push(nm);
    }
  }

  const rows = keys.map((k) => ({
    key: k,
    label: labels[k],
    componentNames: componentNames[k] ?? [],
    points: points[k],
    total: points[k].reduce((a, b) => a + b, 0),
  }));

  return {
    team: { teamId: team.id, name: team.name },
    rounds,
    rows,
    columnTotals,
    grandTotal: columnTotals.reduce((a, b) => a + b, 0),
  };
}
