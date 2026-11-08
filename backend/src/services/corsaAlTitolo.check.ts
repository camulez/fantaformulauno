// Test di «chi è ancora in corsa». Esegui: cd backend && npx tsx src/services/corsaAlTitolo.check.ts
//
// Il test che conta è il primo: su rose separate il massimo è 137, e quel 137 si verifica a
// mano. Serve perché l'errore facile qui è sommare il massimo di ogni casella (che darebbe
// 160) dimenticando che i dieci punteggi si assegnano UNA volta ciascuno.
import {
  massimoVantaggioRound,
  corsaAlTitolo,
  RegoleCorsa,
  RosaFantasy,
  RoundFuturo,
} from './corsaAlTitolo';

let pass = 0;
let fail = 0;
function check(nome: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error('  ✗ ' + nome + (extra ? '  → ' + extra : ''));
  }
}

const REGOLE: RegoleCorsa = {
  raceScale: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintScale: [8, 7, 6, 5, 4, 3, 2, 1],
  polePoints: 3,
  teamManagerPoints: 3,
  sponsorPointsPerCar: 3,
  benzinaPointsPerCar: 6,
  drsMultiplier: 2,
  drsScope: 'race',
};

// 11 scuderie da 2 piloti, come un vero schieramento.
const SCUDERIE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const lineup: Record<string, string[]> = Object.fromEntries(SCUDERIE.map((s) => [s, [s + '1', s + '2']]));

const round = (hasSprint = false, rose: Record<string, RosaFantasy> = {}): RoundFuturo => ({
  roundNo: 21,
  code: 'BRA',
  hasSprint,
  lineup,
  rose,
});

const rosa = (t: string, m: string, p1: string, p2: string, s: string, b: string): RosaFantasy => ({
  telaio: t, motore: m, p1, p2, sponsor: s, benzina: b,
});

// ── 1. ROSE SEPARATE: il conto si fa a mano ──
// Rivale: telaio A, motore B, P1 A1, P2 B1, sponsor A, benzina B.
// Pesi: A1 = 1+1 = 2 (bonus 3), B1 = 1+1 = 2 (bonus 6), A2 = 1 (bonus 3), B2 = 1 (bonus 6).
// Migliore distribuzione: 25→A1 (53), 18→B1 (42), 15→A2 (18), 12→B2 (18) = 131
// + 3 di Team Manager (vanno a punti entrambi i suoi piloti) + 3 di pole = 137.
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const leader = rosa('C', 'D', 'C1', 'D1', 'C', 'D');
  const v = massimoVantaggioRound(round(), rivale, leader, REGOLE);
  check('rose separate: massimo 137 in una gara', v === 137, String(v));
  check('NON è la somma dei massimi di casella (160)', v < 160);
}

// ── 2. ROSE IDENTICHE: non si guadagna nulla, resta la sola pole ──
{
  const stessa = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const v = massimoVantaggioRound(round(), stessa, { ...stessa }, REGOLE);
  check('rose identiche: solo il punto pole', v === REGOLE.polePoints, String(v));
}

// ── 3. L'INCROCIO RIDUCE IL MASSIMO ──
// Se il telaio del rivale è la scuderia del motore del leader, i punti di quei piloti
// si annullano: il tetto deve scendere rispetto al caso separato.
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const separato = massimoVantaggioRound(round(), rivale, rosa('C', 'D', 'C1', 'D1', 'C', 'D'), REGOLE);
  const incrociato = massimoVantaggioRound(round(), rivale, rosa('C', 'A', 'C1', 'D1', 'C', 'D'), REGOLE);
  check('condividere una scuderia abbassa il tetto', incrociato < separato, `${incrociato} vs ${separato}`);
}

// ── 4. IL DRS AIUTA, MA SOLO IN GARA ──
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const leader = rosa('C', 'D', 'C1', 'D1', 'C', 'D');
  const senza = massimoVantaggioRound(round(), rivale, leader, REGOLE);
  const conTelaio = massimoVantaggioRound(round(), rivale, leader, REGOLE, 'telaio');
  check('il DRS sul telaio aumenta il massimo', conTelaio > senza, `${conTelaio} vs ${senza}`);

  // Con lo Sprint: il DRS «solo Gara» non deve toccare i punti Sprint.
  const sprintSenza = massimoVantaggioRound(round(true), rivale, leader, REGOLE);
  const sprintCon = massimoVantaggioRound(round(true), rivale, leader, REGOLE, 'telaio');
  check('lo Sprint aumenta il massimo', sprintSenza > senza, `${sprintSenza} vs ${senza}`);
  check(
    'il DRS «solo Gara» non raddoppia lo Sprint',
    sprintCon - sprintSenza === conTelaio - senza,
    `${sprintCon - sprintSenza} vs ${conTelaio - senza}`
  );
}

// ── 5. ELIMINAZIONE, PAREGGIO E CAMPIONE ──
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const leader = rosa('C', 'D', 'C1', 'D1', 'C', 'D');
  const r = round(false, { capo: leader, sfida: rivale });
  const perGara = massimoVantaggioRound(r, rivale, leader, REGOLE); // 137

  // Un solo round: con 138 di distacco è fuori, con 137 può solo pareggiare, con 136 è vivo.
  for (const [distacco, atteso] of [[138, 'fuori'], [137, 'pari'], [136, 'vivo']] as const) {
    const esito = corsaAlTitolo({ capo: 1000, sfida: 1000 - distacco }, [r], { capo: 0, sfida: 0 }, REGOLE)!;
    const s = esito.squadre[0];
    const etichetta = s.fuori ? 'fuori' : s.soloPari ? 'pari' : 'vivo';
    check(`distacco ${distacco} su un massimo di ${perGara} → ${atteso}`, etichetta === atteso, etichetta);
    check(`distacco ${distacco}: campione solo se l'altro è fuori`, esito.campioneMatematico === (atteso === 'fuori'));
  }
}

// ── 6. IL DRS DISPONIBILE ALZA IL TETTO, E NON PIÙ DI UNO PER GARA ──
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const leader = rosa('C', 'D', 'C1', 'D1', 'C', 'D');
  const due = [round(false, { capo: leader, sfida: rivale }), { ...round(false, { capo: leader, sfida: rivale }), roundNo: 22 }];
  const senza = corsaAlTitolo({ capo: 1000, sfida: 0 }, due, { capo: 0, sfida: 0 }, REGOLE)!.squadre[0];
  const uno = corsaAlTitolo({ capo: 1000, sfida: 0 }, due, { capo: 0, sfida: 1 }, REGOLE)!.squadre[0];
  const dieci = corsaAlTitolo({ capo: 1000, sfida: 0 }, due, { capo: 0, sfida: 10 }, REGOLE)!.squadre[0];
  check('con un DRS il tetto sale', uno.massimoRecuperabile > senza.massimoRecuperabile);
  check('due DRS valgono più di uno', dieci.massimoRecuperabile > uno.massimoRecuperabile);
  check(
    'dieci DRS non valgono più di due gare',
    dieci.massimoRecuperabile - senza.massimoRecuperabile === 2 * (uno.massimoRecuperabile - senza.massimoRecuperabile),
    String(dieci.massimoRecuperabile)
  );
}

// ── 7. UNA ROSA INCOMPLETA NON REGALA PUNTI DI GARA ──
{
  const rivale = rosa('A', 'B', 'A1', 'B1', 'A', 'B');
  const leader = rosa('C', 'D', 'C1', 'D1', 'C', 'D');
  const senzaRosa = round(false, { capo: leader }); // la sfidante non ha rosa in questo round
  const esito = corsaAlTitolo({ capo: 1000, sfida: 900 }, [senzaRosa], { capo: 0, sfida: 0 }, REGOLE)!;
  check('round senza rosa: non recupera niente', esito.squadre[0].massimoRecuperabile === 0);
  check('e quindi è fuori', esito.squadre[0].fuori);
}

// ── 8. NESSUN ROUND RIMASTO: il leader è campione ──
{
  const esito = corsaAlTitolo({ capo: 1000, sfida: 999 }, [], { capo: 0, sfida: 0 }, REGOLE)!;
  check('a stagione finita il leader è campione', esito.campioneMatematico);
  check('e chi insegue è fuori anche per un punto', esito.squadre[0].fuori);
}

console.log(`\nCorsa al titolo: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
