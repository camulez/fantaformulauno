// Test spareggio Campione (comparatore). Esegui: npx tsx src/services/spareggi.check.ts
import 'dotenv/config'; // `standings` importa il client supabase (che richiede le env)
import { championCompare, TeamStanding } from './standings';

let pass = 0;
let fail = 0;
function assert(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

function team(name: string, over: Partial<TeamStanding>): TeamStanding {
  return {
    teamId: name, name, total: 100, perRound: [], cumulative: [],
    breakdown: { telaio: 0, motore: 0, pilota1: 0, pilota2: 0, sponsor: 0, benzina: 0, pole: 0, teamManager: 0, drsExtra: 0, simulator: 0 },
    gpWins: 0, seconds: 0, thirds: 0, ...over,
  };
}
// applica solo la parte breakdown se passata
function withTM(t: TeamStanding, tm: number): TeamStanding {
  return { ...t, breakdown: { ...t.breakdown, teamManager: tm } };
}

console.log('▶ Spareggio Campione: punti → GP vinti → 2° → 3° → punti TM');

// 1) A più punti vince
{
  const A = team('A', { total: 110 });
  const B = team('B', { total: 100, gpWins: 9 });
  assert('più punti batte tutto', championCompare(A, B) < 0);
}
// 2) parità punti → più GP vinti
{
  const A = team('A', { total: 100, gpWins: 3 });
  const B = team('B', { total: 100, gpWins: 5, seconds: 9 });
  assert('a pari punti vince chi ha più GP vinti', championCompare(A, B) > 0); // B davanti
}
// 3) parità punti+GP → più secondi posti
{
  const A = team('A', { total: 100, gpWins: 4, seconds: 2 });
  const B = team('B', { total: 100, gpWins: 4, seconds: 5 });
  assert('a pari punti+GP vince chi ha più 2°', championCompare(A, B) > 0);
}
// 4) parità punti+GP+2° → più terzi posti
{
  const A = team('A', { total: 100, gpWins: 4, seconds: 3, thirds: 1 });
  const B = team('B', { total: 100, gpWins: 4, seconds: 3, thirds: 6 });
  assert('a pari punti+GP+2° vince chi ha più 3°', championCompare(A, B) > 0);
}
// 5) parità totale → più punti TM
{
  const A = withTM(team('A', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 6);
  const B = withTM(team('B', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 12);
  assert('ultimo criterio: più punti TM', championCompare(A, B) > 0);
}
// 6) ex-aequo totale → 0
{
  const A = withTM(team('A', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 9);
  const B = withTM(team('B', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 9);
  assert('ex-aequo → 0', championCompare(A, B) === 0);
}
// 7) sort completo
{
  const teams = [
    withTM(team('X', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 9),
    team('Y', { total: 120 }),
    withTM(team('Z', { total: 100, gpWins: 4, seconds: 3, thirds: 2 }), 12),
  ];
  teams.sort(championCompare);
  assert('ordine finale Y, Z, X', teams.map((t) => t.name).join('') === 'YZX');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} test passati, ${fail} falliti.`);
process.exit(fail === 0 ? 0 : 1);
