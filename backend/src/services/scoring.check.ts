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
/** Per le asserzioni che non sono numeriche (es. «il DRS non è stato giocato»). */
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
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
  ok('nessun DRS giocato', b.drs === null);
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

section('DRS = MOLTIPLICATORE dello slot, non punti in più');
{
  // Il punto della sezione: dopo il DRS il valore DELLO SLOT cambia. Se un giorno
  // qualcuno rimette il raddoppio in una voce separata, questi test diventano rossi.
  const senza = computeTeamRound(base, roster, R);

  // pilota1: 33 in tutto (25 gara + 8 sprint); il DRS raddoppia solo i 25 di gara.
  const onP1 = computeTeamRound(base, roster, R, 'pilota1');
  eq('pilota1 vale il doppio dei suoi punti GARA', onP1.pilota1, 33 + 25);
  eq('  base prima del raddoppio', onP1.drs!.base, 33);
  eq('  quota moltiplicata (solo gara)', onP1.drs!.moltiplicata, 25);
  eq('  punti aggiunti dal raddoppio', onP1.drs!.aggiunta, 25);
  eq('  lo sprint NON viene raddoppiato', onP1.pilota1 - senza.pilota1, 25);
  eq('gli altri slot non si muovono', onP1.motore, senza.motore);
  eq('il totale cresce del raddoppio', onP1.total, senza.total + 25);

  // motore: costruttore A in gara = 25+10 = 35
  const onMot = computeTeamRound(base, roster, R, 'motore');
  eq('motore raddoppiato sui punti gara del costruttore', onMot.motore, 43 + 35);
  eq('  aggiunta', onMot.drs!.aggiunta, 35);

  // sponsor: tutti punti "gara", quindi raddoppia per intero
  const onSpo = computeTeamRound(base, roster, R, 'sponsor');
  eq('sponsor raddoppiato per intero', onSpo.sponsor, 6 * 2);
  eq('  aggiunta', onSpo.drs!.aggiunta, 6);

  // ⚠️ L'invariante che protegge dal doppio conteggio.
  const somma = onMot.telaio + onMot.motore + onMot.pilota1 + onMot.pilota2 +
                onMot.sponsor + onMot.benzina + onMot.pole + onMot.teamManager;
  eq('il totale è la somma degli slot: il DRS non si somma a parte', onMot.total, somma);
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
