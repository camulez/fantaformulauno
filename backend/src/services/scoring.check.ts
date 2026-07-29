// Test a funzioni pure del motore di punteggio. Esegui: npx tsx src/services/scoring.check.ts
import { DEFAULT_RULES } from '../config/defaultRules';
import { computeTeamRound, RoundRaw, TeamRoster } from './scoring';

let pass = 0;
let fail = 0;
function eq(name: string, got: number, want: number) {
  if (got === want) {
    pass++;
    console.log(`  ✓ ${name} = ${got}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}: ottenuto ${got}, atteso ${want}`);
  }
}
function section(t: string) {
  console.log(`\n▶ ${t}`);
}

const R = DEFAULT_RULES;

// Scenario base: scuderie A e B, 2 piloti ciascuna.
// Race: a1=25, a2=10, b1=18, b2=0 ; Sprint: a1=8 ; Pole: a1
const base: RoundRaw = {
  race: { a1: { points: 25 }, a2: { points: 10 }, b1: { points: 18 }, b2: { points: 0 } },
  sprint: { a1: { points: 8 } },
  poleDriverId: 'a1',
  lineup: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
};

// Roster: piloti posseduti = a1 (P1) e b1 (P2).
const roster: TeamRoster = {
  telaioTeamId: 'A',
  motoreWorksTeamId: 'A',
  p1DriverId: 'a1',
  p2DriverId: 'b1',
  sponsorTeamId: 'A',
  benzinaTeamId: 'B',
};

section('Componenti base (telaio=somma piloti, sponsor=3/auto, benzina=6/auto, pole al proprietario, TM=P1+P2 a punti)');
{
  const b = computeTeamRound(base, roster, R);
  eq('telaio (A: a1 33 + a2 10)', b.telaio, 43);
  eq('motore (A works)', b.motore, 43);
  eq('pilota1 (a1: 25+8)', b.pilota1, 33);
  eq('pilota2 (b1: 18)', b.pilota2, 18);
  eq('sponsor (A: 2 auto a punti x3)', b.sponsor, 6);
  eq('benzina (B: 1 auto a punti x6)', b.benzina, 6);
  eq('pole (a1 posseduto come P1)', b.pole, 3);
  eq('team manager (P1=a1 e P2=b1 entrambi a punti)', b.teamManager, 3);
  eq('drsBonus (nessun DRS)', b.drsBonus, 0);
  eq('TOTALE', b.total, 43 + 43 + 33 + 18 + 6 + 6 + 3 + 3);
}

section('Pole va al proprietario del PILOTA, non del telaio');
{
  const raw = { ...base, poleDriverId: 'b2' }; // b2 non posseduto
  eq('pole (b2 non posseduto)', computeTeamRound(raw, roster, R).pole, 0);
}

section('Team Manager = 0 se uno dei due piloti posseduti NON va a punti Race');
{
  const raw: RoundRaw = { ...base, race: { ...base.race, b1: { points: 0 } } }; // P2=b1 a 0
  eq('team manager (P2=b1 non a punti)', computeTeamRound(raw, roster, R).teamManager, 0);
}

section('DRS raddoppia SOLO i punti Race (sprint escluso)');
{
  const onP1 = computeTeamRound(base, roster, R, 'pilota1'); // a1 race 25 (+sprint 8 NON raddoppiato)
  eq('drsBonus su pilota1 (=race 25)', onP1.drsBonus, 25);
  const onMot = computeTeamRound(base, roster, R, 'motore'); // ctorRace A = 25+10 = 35
  eq('drsBonus su motore (=race costruttore 35)', onMot.drsBonus, 35);
  const onSpo = computeTeamRound(base, roster, R, 'sponsor'); // sponsor 6
  eq('drsBonus su sponsor (=6)', onSpo.drsBonus, 6);
}

section('Detrazione TOTALE Race: esclude l\'auto da costruttore E da sponsor/benzina');
{
  const raw: RoundRaw = { ...base, race: { ...base.race, a2: { points: 10, deduction: 'total' } } };
  const b = computeTeamRound(raw, roster, R);
  eq('telaio (a2 escluso)', b.telaio, 33);
  eq('sponsor (A: solo a1 -> 1 auto)', b.sponsor, 3);
}

section('Detrazione PARZIALE Race: esclude da costruttore ma l\'auto resta "a punti" per sponsor');
{
  const raw: RoundRaw = { ...base, race: { ...base.race, a2: { points: 10, deduction: 'partial' } } };
  const b = computeTeamRound(raw, roster, R);
  eq('telaio (a2 parziale escluso dal costruttore)', b.telaio, 33);
  eq('sponsor (A: a2 resta a punti -> 2 auto)', b.sponsor, 6);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} test passati, ${fail} falliti.`);
process.exit(fail === 0 ? 0 : 1);
