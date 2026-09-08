// Test dell'invariante di proprietà. Esegui: cd backend && npx tsx src/services/proprieta.check.ts
//
// Il test che conta è «NON SI RUBA UN PILOTA DI UN ALTRO TEAM»: è il buco vero, dimostrato
// facendo girare il motore con due squadre sullo stesso pilota (6 punti contati due volte).
import { componenteLibero, proprietarioAl, siSovrappongono, Assegnazione } from './proprieta';

let pass = 0;
let fail = 0;
function check(nome: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error('  ✗ ' + nome + (extra ? '  → ' + extra : ''));
  }
}

// Roster semplificato: Pio ha Lawson tutta la stagione, zippo ha Hadjar.
const rose: Assegnazione[] = [
  { fantasyTeamId: 'pio', slot: 'pilota2', componentId: 'lawson', from: 1, to: null },
  { fantasyTeamId: 'zippo', slot: 'pilota2', componentId: 'hadjar', from: 1, to: null },
  { fantasyTeamId: 'staiv', slot: 'pilota1', componentId: 'verstappen', from: 1, to: null },
];

// ── 1. Sovrapposizione di finestre ──
{
  check('finestre che si toccano si sovrappongono', siSovrappongono(14, 15, 15, 20));
  check('finestre staccate no', !siSovrappongono(14, 15, 16, 20));
  check('una finestra aperta copre tutto il seguito', siSovrappongono(1, null, 14, 15));
  check('due aperte si sovrappongono sempre', siSovrappongono(1, null, 20, null));
  check('un solo round in comune basta', siSovrappongono(10, 14, 14, 18));
}

// ── 2. IL TEST CHE CONTA: non si prende il pilota di un altro Team ──
{
  const conflitto = componenteLibero(rose, 'lawson', 14, 15, 'zippo');
  check('NON SI RUBA UN PILOTA DI UN ALTRO TEAM', conflitto !== null);
  check('dice di chi è', conflitto?.fantasyTeamId === 'pio', String(conflitto?.fantasyTeamId));
  check('dice in quale slot', conflitto?.slot === 'pilota2', String(conflitto?.slot));
}

// ── 3. Un pilota di nessuno è libero ──
{
  check('Tsunoda è libero', componenteLibero(rose, 'tsunoda', 14, 15, 'zippo') === null);
}

// ── 4. Spostare un proprio componente fra i propri slot non è furto ──
{
  check('sul proprio non c\'è conflitto', componenteLibero(rose, 'hadjar', 14, 15, 'zippo') === null);
}

// ── 5. Fuori dalla finestra dell'altro, è libero ──
{
  const aTermine: Assegnazione[] = [
    { fantasyTeamId: 'pio', slot: 'pilota2', componentId: 'lawson', from: 1, to: 13 },
  ];
  check('dopo la scadenza è libero', componenteLibero(aTermine, 'lawson', 14, 15, 'zippo') === null);
  check('dentro la scadenza no', componenteLibero(aTermine, 'lawson', 12, 13, 'zippo') !== null);
  check('a cavallo della scadenza no', componenteLibero(aTermine, 'lawson', 13, null, 'zippo') !== null);
}

// ── 6. Vale per tutti gli slot, non solo per i piloti ──
{
  const conTelaio: Assegnazione[] = [
    { fantasyTeamId: 'anzo', slot: 'telaio', componentId: 'mclaren', from: 1, to: null },
  ];
  check('anche un telaio non si prende in due', componenteLibero(conTelaio, 'mclaren', 5, null, 'pio') !== null);
}

// ── 7. Chi possiede cosa a un dato round ──
{
  check('Lawson è di Pio a R14', proprietarioAl(rose, 'lawson', 14) === 'pio');
  check('Tsunoda non è di nessuno', proprietarioAl(rose, 'tsunoda', 14) === null);
  const aTermine: Assegnazione[] = [
    { fantasyTeamId: 'pio', slot: 'pilota2', componentId: 'lawson', from: 1, to: 13 },
    { fantasyTeamId: 'zippo', slot: 'pilota2', componentId: 'lawson', from: 14, to: null },
  ];
  check('la proprietà segue la data: R13 a Pio', proprietarioAl(aTermine, 'lawson', 13) === 'pio');
  check('la proprietà segue la data: R14 a zippo', proprietarioAl(aTermine, 'lawson', 14) === 'zippo');
}

console.log(`\nProprietà dei componenti: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
