// Test della linea del tempo del roster.
// Esegui: cd backend && npx tsx src/services/rosterTimeline.check.ts
//
// Nascono da un difetto vero trovato collaudando le sostituzioni dell'Art. II: registrando
// un rientro dopo una sostituzione a termine si producevano un intervallo capovolto
// (R14–13) e DUE assegnazioni aperte sullo stesso slot. Con due righe sovrapposte la rosa
// diventa non deterministica e il punteggio dipende dall'ordine di lettura.
import { applicaIntervallo, occupanteAl, titolarePrecedente, sovrapposizioni, Intervallo } from './rosterTimeline';

let pass = 0;
let fail = 0;
function check(nome: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else { fail++; console.error('  ✗ ' + nome + (extra ? '  → ' + extra : '')); }
}
const mostra = (t: Intervallo[]) =>
  t.map((i) => `${i.componentId}:R${i.from}-${i.to ?? '∞'}`).join(' · ');

// Titolare per tutta la stagione.
const base: Intervallo[] = [{ componentId: 'hadjar', from: 1, to: null }];

// ── 1. Sostituzione a termine (Art. II.b/II.c) ──
{
  const t = applicaIntervallo(base, { componentId: 'lindblad', from: 14, to: 15 });
  check('tre tratti: prima, sostituto, rientro', t.length === 3, mostra(t));
  check('il titolare esce a R13', t[0].componentId === 'hadjar' && t[0].to === 13, mostra(t));
  check('il sostituto copre R14-R15', t[1].componentId === 'lindblad' && t[1].from === 14 && t[1].to === 15);
  check('il titolare rientra da R16 e resta', t[2].componentId === 'hadjar' && t[2].from === 16 && t[2].to === null);
  check('nessuna sovrapposizione', sovrapposizioni(t).length === 0, sovrapposizioni(t).join());
  check('a R14 corre il sostituto', occupanteAl(t, 14) === 'lindblad');
  check('a R13 e R16 corre il titolare', occupanteAl(t, 13) === 'hadjar' && occupanteAl(t, 16) === 'hadjar');
}

// ── 2. IL CASO CHE ROMPEVA: rientro registrato dopo una sostituzione a termine ──
{
  const conRientro = applicaIntervallo(base, { componentId: 'lindblad', from: 14, to: 15 });
  // il titolare rientra prima del previsto, da R15
  const t = applicaIntervallo(conRientro, { componentId: 'hadjar', from: 15, to: null });
  check('niente intervalli capovolti', t.every((i) => (i.to ?? 99) >= i.from), mostra(t));
  check('niente sovrapposizioni', sovrapposizioni(t).length === 0, mostra(t));
  check('una sola assegnazione aperta', t.filter((i) => i.to === null).length === 1, mostra(t));
  check('a R14 il sostituto, da R15 il titolare', occupanteAl(t, 14) === 'lindblad' && occupanteAl(t, 15) === 'hadjar');
}

// ── 3. Sostituzione aperta, poi rientro ──
{
  const aperta = applicaIntervallo(base, { componentId: 'lindblad', from: 14, to: null });
  check('sostituzione aperta: due tratti', aperta.length === 2, mostra(aperta));
  check('chi rientra è il titolare di prima', titolarePrecedente(aperta, 20) === 'hadjar');

  const t = applicaIntervallo(aperta, { componentId: 'hadjar', from: 17, to: null });
  check('dopo il rientro: tre tratti', t.length === 3, mostra(t));
  check('il sostituto si ferma a R16', t[1].componentId === 'lindblad' && t[1].to === 16, mostra(t));
  check('nessuna sovrapposizione', sovrapposizioni(t).length === 0);
  check('una sola aperta', t.filter((i) => i.to === null).length === 1);
}

// ── 4. Un buco in mezzo divide in due ──
{
  const t = applicaIntervallo([{ componentId: 'a', from: 1, to: 20 }], { componentId: 'b', from: 5, to: 7 });
  check('si divide in tre tratti', t.length === 3, mostra(t));
  check('primo tratto R1-4', t[0].to === 4);
  check('ultimo tratto R8-20', t[2].from === 8 && t[2].to === 20, mostra(t));
  check('nessuna sovrapposizione', sovrapposizioni(t).length === 0);
}

// ── 5. Copertura totale: il vecchio sparisce ──
{
  const t = applicaIntervallo([{ componentId: 'a', from: 5, to: 8 }], { componentId: 'b', from: 1, to: null });
  check('il coperto per intero sparisce', t.length === 1 && t[0].componentId === 'b', mostra(t));
}

// ── 6. Sostituzioni successive di piloti diversi ──
{
  let t = applicaIntervallo(base, { componentId: 'lindblad', from: 5, to: 6 });
  t = applicaIntervallo(t, { componentId: 'tsunoda', from: 10, to: 11 });
  check('due sostituzioni convivono', t.length === 5, mostra(t));
  check('nessuna sovrapposizione', sovrapposizioni(t).length === 0, mostra(t));
  check('R5 lindblad, R7 hadjar, R10 tsunoda, R12 hadjar',
    occupanteAl(t, 5) === 'lindblad' && occupanteAl(t, 7) === 'hadjar' &&
    occupanteAl(t, 10) === 'tsunoda' && occupanteAl(t, 12) === 'hadjar', mostra(t));
}

// ── 7. La sentinella: una sovrapposizione va vista ──
{
  const rotta: Intervallo[] = [
    { componentId: 'a', from: 1, to: null },
    { componentId: 'b', from: 14, to: null },
  ];
  check('due aperte sullo stesso slot vengono segnalate', sovrapposizioni(rotta).length > 0);
}

// ── 8. Tratti attaccati dello stesso pilota si fondono ──
{
  const conRientro = applicaIntervallo(base, { componentId: 'lindblad', from: 14, to: 15 });
  const t = applicaIntervallo(conRientro, { componentId: 'hadjar', from: 14, to: null });
  check('annullare la sostituzione lascia UN solo tratto', t.length === 1, mostra(t));
  check('  ed è il titolare per tutta la stagione', t[0].componentId === 'hadjar' && t[0].from === 1 && t[0].to === null, mostra(t));
}

console.log(`\nLinea del tempo del roster: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
