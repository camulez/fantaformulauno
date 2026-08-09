// Test del premio simulatore. Esegui: cd backend && npx tsx src/services/simulatorPoints.check.ts
//
// Il punto delicato: con il premio SPENTO il campionato deve restare identico a com'era
// prima che il simulatore esistesse (è la condizione che tiene valido il gate
// 778/634/558/285); con il premio acceso il punto deve finire alla squadra della persona
// che ha fatto il miglior tempo, non a chi ha girato di più.
import { awardSimulatorPoints, SimLapRow } from './simulatorPoints';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

// Pio e Staiv corrono; Anzo non ha squadra in questa stagione.
const squadre = new Map<string, string>([
  ['p-pio', 't-pio'],
  ['p-staiv', 't-staiv'],
  ['p-zippo', 't-zippo'],
]);

const giri: SimLapRow[] = [
  // R4: Pio fa tre tentativi, il migliore è 58.200; Staiv uno solo, più lento.
  { round_no: 4, person_id: 'p-pio', time_ms: 62_500 },
  { round_no: 4, person_id: 'p-pio', time_ms: 58_200 },
  { round_no: 4, person_id: 'p-pio', time_ms: 62_000 },
  { round_no: 4, person_id: 'p-staiv', time_ms: 67_100 },
  // R5: vince Staiv, anche se Pio ha girato di più.
  { round_no: 5, person_id: 'p-pio', time_ms: 71_000 },
  { round_no: 5, person_id: 'p-pio', time_ms: 70_800 },
  { round_no: 5, person_id: 'p-staiv', time_ms: 69_900 },
  // R7: parità esatta al millisecondo fra Pio e zippo.
  { round_no: 7, person_id: 'p-pio', time_ms: 60_000 },
  { round_no: 7, person_id: 'p-zippo', time_ms: 60_000 },
  { round_no: 7, person_id: 'p-staiv', time_ms: 60_001 },
  // R9: gira solo una persona senza squadra: nessuno prende il punto.
  { round_no: 9, person_id: 'p-fantasma', time_ms: 55_000 },
];

// ── Premio spento: il campionato non cambia di una virgola ──
{
  const zero = awardSimulatorPoints(giri, squadre, 0);
  check('con premio 0 non si assegna nulla', zero.size === 0, `${zero.size} round premiati`);
  const negativo = awardSimulatorPoints(giri, squadre, -3);
  check('un premio negativo non assegna nulla', negativo.size === 0);
}

// ── Premio acceso ──
{
  const p = awardSimulatorPoints(giri, squadre, 1);

  check('R4: il punto va a Pio (miglior tempo)', p.get(4)?.get('t-pio') === 1, JSON.stringify([...(p.get(4) ?? [])]));
  check('R4: Staiv non prende niente', p.get(4)?.get('t-staiv') === undefined);
  check('R4: premiata una sola squadra', p.get(4)?.size === 1, `${p.get(4)?.size}`);

  check('R5: vince Staiv anche se Pio ha girato di più', p.get(5)?.get('t-staiv') === 1);
  check('R5: Pio non prende niente', p.get(5)?.get('t-pio') === undefined);

  check('R7: in parità premiati entrambi', p.get(7)?.get('t-pio') === 1 && p.get(7)?.get('t-zippo') === 1);
  check('R7: il terzo per un millesimo resta fuori', p.get(7)?.get('t-staiv') === undefined);

  check('R9: chi non ha squadra non porta punti a nessuno', p.get(9) === undefined);

  // Conta il miglior tempo, non il numero di tentativi.
  const soloUnGiro = awardSimulatorPoints(
    [
      { round_no: 1, person_id: 'p-staiv', time_ms: 50_000 },
      { round_no: 1, person_id: 'p-pio', time_ms: 50_001 },
      { round_no: 1, person_id: 'p-pio', time_ms: 50_002 },
      { round_no: 1, person_id: 'p-pio', time_ms: 50_003 },
    ],
    squadre,
    1
  );
  check('tre tentativi lenti non battono un tentativo veloce', soloUnGiro.get(1)?.get('t-staiv') === 1);
}

// ── Il premio è configurabile, non fisso a 1 ──
{
  const p = awardSimulatorPoints(giri, squadre, 5);
  check('il premio vale quanto dice la matrice', p.get(4)?.get('t-pio') === 5, `${p.get(4)?.get('t-pio')}`);
}

// ── Nessun giro registrato: mappa vuota, non un crash ──
{
  const p = awardSimulatorPoints([], squadre, 1);
  check('senza giri registrati non si assegna nulla', p.size === 0);
}

console.log(`\nPremio simulatore: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
