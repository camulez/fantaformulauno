// GATE di validazione del motore sui dati reali R11 (estratti dal PDF, somme già verificate).
// Esegui: npx tsx src/services/gate.check.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_RULES, ScoringRules } from '../config/defaultRules';
import {
  computeSeasonTotal,
  RoundRaw,
  RosterSlot,
  SeasonRoundInput,
  TeamRoster,
} from './scoring';

const data = JSON.parse(readFileSync(join(__dirname, 'r11data.json'), 'utf8')) as {
  race: Record<string, Record<string, number>>;
  sprint: Record<string, Record<string, number>>;
  poles: Record<string, string>;
};

const TEAM_DRIVERS: Record<string, [string, string]> = {
  McLaren: ['Oscar Piastri', 'Lando Norris'],
  Mercedes: ['George Russel', 'Andrea Kimi Antonelli'],
  'Red Bull Racing': ['Max Verstappen', 'Isack Hadjar'],
  Ferrari: ['Charles Leclerc', 'Lewis Hamilton'],
  Williams: ['Alexander Albon', 'Carlos Sainz'],
  'Racing Bulls': ['Liam Lawson', 'Arvid Lindblad'],
  'Aston Martin': ['Lance Stroll', 'Fernando Alonso'],
  'Haas F1 Team': ['Esteban Ocon', 'Olivier Bearman'],
  Audi: ['Niko Hulkenberg', 'Gabriel Bortoleto'],
  Alpine: ['Pierre Gasly', 'Franco Colapinto'],
  Cadillac: ['Sergio Perez', 'Valtteri Bottas'],
};

const ROUNDS = Array.from({ length: 11 }, (_, i) => i + 1);

function roundRaw(r: number): RoundRaw {
  const k = String(r);
  const race: Record<string, { points: number }> = {};
  const sprint: Record<string, { points: number }> = {};
  const lineup: Record<string, string[]> = {};
  for (const [team, ds] of Object.entries(TEAM_DRIVERS)) {
    lineup[team] = [...ds];
    for (const d of ds) {
      race[d] = { points: data.race[d]?.[k] ?? 0 };
      sprint[d] = { points: data.sprint[d]?.[k] ?? 0 };
    }
  }
  return { race, sprint, lineup, poleDriverId: data.poles[k] ?? null };
}

const RAW_ROUNDS = ROUNDS.map((r) => ({ round: r, raw: roundRaw(r) }));

function inputs(drs?: { round: number; slot: RosterSlot }): SeasonRoundInput[] {
  return RAW_ROUNDS.map((r) => ({
    raw: r.raw,
    drsSlot: drs && drs.round === r.round ? drs.slot : undefined,
  }));
}

interface Fantasy {
  name: string;
  roster: TeamRoster;
  expected: number;
  drs?: { round: number; slot: RosterSlot };
}

// Roster delle 6 squadre (PDF pag.2). Anzo/zippo/Marchese/Pio/Scuderia = roster pieno.
const TEAMS: Fantasy[] = [
  { name: 'Anzo', expected: 778, roster: { telaioTeamId: 'Mercedes', motoreWorksTeamId: 'Ferrari', p1DriverId: 'Oscar Piastri', p2DriverId: 'Esteban Ocon', sponsorTeamId: 'Haas F1 Team', benzinaTeamId: 'Mercedes' } },
  { name: 'Marchese', expected: 285, roster: { telaioTeamId: 'Haas F1 Team', motoreWorksTeamId: 'Racing Bulls', p1DriverId: 'Carlos Sainz', p2DriverId: 'Lando Norris', sponsorTeamId: 'McLaren', benzinaTeamId: 'McLaren' } },
  { name: 'Pio', expected: 634, roster: { telaioTeamId: 'Ferrari', motoreWorksTeamId: 'Red Bull Racing', p1DriverId: 'Andrea Kimi Antonelli', p2DriverId: 'Liam Lawson', sponsorTeamId: 'Audi', benzinaTeamId: 'Cadillac' } },
  { name: 'zippo', expected: 558, roster: { telaioTeamId: 'McLaren', motoreWorksTeamId: 'Williams', p1DriverId: 'George Russel', p2DriverId: 'Isack Hadjar', sponsorTeamId: 'Mercedes', benzinaTeamId: 'Ferrari' } },
];

// Scuderia Da Silva: DRS sul Motore (Mercedes) al R02.
const SCUDERIA: Fantasy = {
  name: 'Scuderia',
  expected: 759,
  roster: { telaioTeamId: 'Red Bull Racing', motoreWorksTeamId: 'Mercedes', p1DriverId: 'Charles Leclerc', p2DriverId: 'Olivier Bearman', sponsorTeamId: 'Alpine', benzinaTeamId: 'Red Bull Racing' },
  drs: { round: 2, slot: 'motore' },
};

let fail = 0;
function breakdown(f: Fantasy, rules: ScoringRules) {
  const { total, perRound } = computeSeasonTotal(inputs(f.drs), f.roster, rules);
  const sum = (k: keyof (typeof perRound)[number]) => perRound.reduce((s, b) => s + (b[k] as number), 0);
  return {
    total,
    parts: {
      telaio: sum('telaio'), motore: sum('motore'), pilota1: sum('pilota1'), pilota2: sum('pilota2'),
      sponsor: sum('sponsor'), benzina: sum('benzina'), pole: sum('pole'), teamManager: sum('teamManager'), drsBonus: sum('drsBonus'),
    },
  };
}
function check(f: Fantasy, rules = DEFAULT_RULES) {
  const b = breakdown(f, rules);
  const ok = b.total === f.expected;
  if (!ok) fail++;
  console.log(`${ok ? '✅' : '❌'} ${f.name.padEnd(9)} totale=${b.total} (atteso ${f.expected})`);
  console.log(`     T${b.parts.telaio} M${b.parts.motore} P1:${b.parts.pilota1} P2:${b.parts.pilota2} S${b.parts.sponsor} B${b.parts.benzina} Pole${b.parts.pole} TM${b.parts.teamManager} DRS${b.parts.drsBonus}`);
}

console.log('=== GATE R11 (roster pieno) ===');
TEAMS.forEach((t) => check(t));

console.log('\n=== Scuderia Da Silva — DRS sul Motore@R02, i due criteri ===');
console.log('• DRS solo Race (regola dichiarata):');
check(SCUDERIA, DEFAULT_RULES);
console.log('• DRS Race+Sprint (come nel foglio PDF):');
check(SCUDERIA, { ...DEFAULT_RULES, drsScope: 'race_sprint' });

console.log(`\n${fail === 0 ? '✅ GATE OK' : `⚠️ ${fail} scostamenti (vedi sopra)`}`);
