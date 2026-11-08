// Chi è ancora in corsa per il titolo, e chi è matematicamente fuori.
//
// Perché non basta «punti rimasti in palio». Due errori rendono quel conto inutile:
//
//  1. I PUNTI SONO DIECI VALORI, NON UN RUBINETTO. In una gara si assegnano 25, 18, 15, 12,
//     10, 8, 6, 4, 2, 1 — una volta ciascuno. Se i due piloti del tuo telaio prendono 25 e 18,
//     al tuo motore restano al massimo 15 e 12. Sommare il massimo di ogni casella dà numeri
//     che nessun ordine d'arrivo può produrre.
//
//  2. LE ROSE SI INCROCIANO. Quando un inseguitore guadagna, spesso guadagna anche il leader.
//     Caso vero della 2026: il motore di Pio è Red Bull, ma il TELAIO Red Bull è di Da Silva;
//     il Pilota 1 di Pio è Antonelli, ma il MOTORE Mercedes è di Da Silva. Pio non può salire
//     senza tirarsi dietro chi insegue.
//
// Quindi non si calcola «quanto può fare l'inseguitore» ma **quanto può staccare il leader**:
// per ogni gara si cerca l'ordine d'arrivo che massimizza (punti rivale − punti leader).
//
// Modulo PURO: niente database, così il calcolo si collauda da riga di comando.

export type SlotRosa = 'telaio' | 'motore' | 'pilota1' | 'pilota2' | 'sponsor' | 'benzina';

export interface RosaFantasy {
  /** id scuderia FIA */
  telaio: string;
  motore: string;
  sponsor: string;
  benzina: string;
  /** id pilota */
  p1: string;
  p2: string;
}

export interface RoundFuturo {
  roundNo: number;
  code: string | null;
  hasSprint: boolean;
  /** Chi si prevede scenda in pista: id scuderia → id piloti (formazione ereditata). */
  lineup: Record<string, string[]>;
  /** id squadra fantasy → rosa valida in quel round. Assente se la rosa è incompleta. */
  rose: Record<string, RosaFantasy>;
}

export interface RegoleCorsa {
  raceScale: number[];
  sprintScale: number[];
  polePoints: number;
  teamManagerPoints: number;
  sponsorPointsPerCar: number;
  benzinaPointsPerCar: number;
  drsMultiplier: number;
  drsScope: 'race' | 'race_sprint';
}

const SLOTS: SlotRosa[] = ['telaio', 'motore', 'pilota1', 'pilota2', 'sponsor', 'benzina'];

/**
 * Distribuisce `valori` (in ordine decrescente) fra i piloti per massimizzare
 * Σ (valore × peso + bonus), rispettando chi deve esserci e chi non può esserci.
 *
 * Si appoggia alla disuguaglianza del riordinamento: a parità di piloti scelti, il valore più
 * alto va al peso più alto. Quindi basta ordinare i piloti per peso e scorrere i valori in
 * ordine, decidendo per ognuno se lo prende o passa. Il resto è programmazione dinamica.
 */
function miglioreDistribuzione(
  piloti: string[],
  peso: Map<string, number>,
  bonus: Map<string, number>,
  valori: number[],
  obbligatori: string[] = [],
  esclusi: Set<string> = new Set()
): number | null {
  const ordinati = [...piloti].sort(
    (a, b) => (peso.get(b) ?? 0) - (peso.get(a) ?? 0) || (bonus.get(b) ?? 0) - (bonus.get(a) ?? 0)
  );
  const indiceObbligo = new Map(obbligatori.map((d, i) => [d, i]));
  const completo = (1 << obbligatori.length) - 1;
  const MENO_INF = Number.NEGATIVE_INFINITY;

  // dp[valori assegnati][maschera degli obbligatori già piazzati]
  let dp: number[][] = Array.from({ length: valori.length + 1 }, () =>
    new Array(completo + 1).fill(MENO_INF)
  );
  dp[0][0] = 0;

  for (const d of ordinati) {
    const prossimo = dp.map((riga) => [...riga]);
    const w = peso.get(d) ?? 0;
    const b = bonus.get(d) ?? 0;
    const bit = indiceObbligo.has(d) ? 1 << indiceObbligo.get(d)! : 0;
    if (!esclusi.has(d)) {
      for (let j = 0; j < valori.length; j++) {
        for (let m = 0; m <= completo; m++) {
          if (dp[j][m] === MENO_INF) continue;
          const v = dp[j][m] + valori[j] * w + b;
          const m2 = m | bit;
          if (v > prossimo[j + 1][m2]) prossimo[j + 1][m2] = v;
        }
      }
    }
    dp = prossimo;
  }

  const esito = dp[valori.length][completo];
  return esito === MENO_INF ? null : esito;
}

/**
 * Il massimo che `rivale` può guadagnare su `leader` in UN round, su tutti gli ordini
 * d'arrivo possibili. `doppia` = la casella su cui il rivale gioca il DRS (o nessuna).
 */
export function massimoVantaggioRound(
  round: RoundFuturo,
  rosaRivale: RosaFantasy,
  rosaLeader: RosaFantasy,
  regole: RegoleCorsa,
  doppia?: SlotRosa
): number {
  const inPista = [...new Set(Object.values(round.lineup).flat())];
  const diScuderia = (id: string) => round.lineup[id] ?? [];
  const molt = (s: SlotRosa) => (s === doppia ? regole.drsMultiplier : 1);

  // Peso di un punto GARA di ogni pilota dentro la differenza (rivale − leader).
  const pesoGara = new Map<string, number>();
  const pesoSprint = new Map<string, number>();
  const somma = (m: Map<string, number>, d: string, v: number) => m.set(d, (m.get(d) ?? 0) + v);
  // Il DRS raddoppia solo la quota Gara, salvo che le regole dicano diversamente.
  const moltSprint = (s: SlotRosa) => (regole.drsScope === 'race_sprint' ? molt(s) : 1);

  for (const d of diScuderia(rosaRivale.telaio)) { somma(pesoGara, d, molt('telaio')); somma(pesoSprint, d, moltSprint('telaio')); }
  for (const d of diScuderia(rosaRivale.motore)) { somma(pesoGara, d, molt('motore')); somma(pesoSprint, d, moltSprint('motore')); }
  somma(pesoGara, rosaRivale.p1, molt('pilota1')); somma(pesoSprint, rosaRivale.p1, moltSprint('pilota1'));
  somma(pesoGara, rosaRivale.p2, molt('pilota2')); somma(pesoSprint, rosaRivale.p2, moltSprint('pilota2'));

  for (const d of diScuderia(rosaLeader.telaio)) { somma(pesoGara, d, -1); somma(pesoSprint, d, -1); }
  for (const d of diScuderia(rosaLeader.motore)) { somma(pesoGara, d, -1); somma(pesoSprint, d, -1); }
  somma(pesoGara, rosaLeader.p1, -1); somma(pesoSprint, rosaLeader.p1, -1);
  somma(pesoGara, rosaLeader.p2, -1); somma(pesoSprint, rosaLeader.p2, -1);

  // Sponsor e benzina valgono per ogni monoposto a punti in GARA: sono bonus per pilota.
  const bonus = new Map<string, number>();
  for (const d of diScuderia(rosaRivale.sponsor)) somma(bonus, d, regole.sponsorPointsPerCar * molt('sponsor'));
  for (const d of diScuderia(rosaRivale.benzina)) somma(bonus, d, regole.benzinaPointsPerCar * molt('benzina'));
  for (const d of diScuderia(rosaLeader.sponsor)) somma(bonus, d, -regole.sponsorPointsPerCar);
  for (const d of diScuderia(rosaLeader.benzina)) somma(bonus, d, -regole.benzinaPointsPerCar);

  // Il Team Manager è l'unico vincolo «a coppia»: 3 punti se vanno a punti ENTRAMBI i piloti
  // posseduti. Si enumerano i casi, perché non si può esprimere come bonus per pilota.
  const casiRivale: { obblighi: string[]; delta: number }[] = [
    { obblighi: [], delta: 0 },
    { obblighi: [rosaRivale.p1, rosaRivale.p2], delta: regole.teamManagerPoints },
  ];
  const casiLeader: { esclusi: string[]; delta: number }[] = [
    { esclusi: [rosaLeader.p1], delta: 0 },
    { esclusi: [rosaLeader.p2], delta: 0 },
    { esclusi: [], delta: -regole.teamManagerPoints },
  ];

  let migliore = Number.NEGATIVE_INFINITY;
  for (const cr of casiRivale) {
    for (const cl of casiLeader) {
      const esclusi = new Set(cl.esclusi);
      if (cr.obblighi.some((d) => esclusi.has(d))) continue; // richieste incompatibili
      const gara = miglioreDistribuzione(inPista, pesoGara, bonus, regole.raceScale, cr.obblighi, esclusi);
      if (gara === null) continue;
      const v = gara + cr.delta + cl.delta;
      if (v > migliore) migliore = v;
    }
  }

  // Lo Sprint non dà sponsor, benzina né Team Manager: è una distribuzione a sé.
  let sprint = 0;
  if (round.hasSprint) {
    sprint = miglioreDistribuzione(inPista, pesoSprint, new Map(), regole.sprintScale) ?? 0;
  }

  // Il Punto Pole dipende dalle qualifiche, non dall'arrivo: il rivale se lo prende sempre.
  return migliore + sprint + regole.polePoints;
}

export interface EsitoSquadra {
  teamId: string;
  punti: number;
  distacco: number;
  /** Il massimo che può ancora guadagnare SUL LEADER, non in assoluto. */
  massimoRecuperabile: number;
  fuori: boolean;
  /** Vero quando al massimo può pareggiare: deciderebbero gli spareggi. */
  soloPari: boolean;
}

export interface CorsaAlTitolo {
  leaderId: string;
  roundRimasti: number;
  /** Nessun altro può raggiungere il leader: campione matematico. */
  campioneMatematico: boolean;
  squadre: EsitoSquadra[];
}

/**
 * Chi può ancora vincere il campionato.
 *
 * ⚠️ Il risultato è volutamente PRUDENTE: i DRS che restano al leader non vengono contati e
 * si assume che il rivale prenda sempre il Punto Pole. Gli inseguitori risultano quindi più
 * forti di quanto saranno davvero: se qui uno è dichiarato fuori, lo è per davvero.
 * ⚠️ Non si considerano le penalizzazioni FIA, che possono togliere punti già presi.
 */
export function corsaAlTitolo(
  punti: Record<string, number>,
  rounds: RoundFuturo[],
  drsDisponibili: Record<string, number>,
  regole: RegoleCorsa
): CorsaAlTitolo | null {
  const squadre = Object.keys(punti);
  if (squadre.length < 2) return null;
  const leaderId = squadre.reduce((a, b) => (punti[b] > punti[a] ? b : a));

  const esiti: EsitoSquadra[] = [];
  for (const teamId of squadre) {
    if (teamId === leaderId) continue;
    const perRound: { base: number; conDrs: number }[] = [];
    for (const r of rounds) {
      const rr = r.rose[teamId];
      const rl = r.rose[leaderId];
      if (!rr || !rl) continue; // rosa incompleta: quel round non produce punti di gara
      const base = massimoVantaggioRound(r, rr, rl, regole);
      const conDrs =
        regole.drsMultiplier > 1
          ? Math.max(...SLOTS.map((s) => massimoVantaggioRound(r, rr, rl, regole, s)))
          : base;
      perRound.push({ base, conDrs });
    }
    // I DRS rimasti si giocano dove rendono di più, uno per gara.
    const guadagnoDrs = perRound
      .map((p) => p.conDrs - p.base)
      .sort((a, b) => b - a)
      .slice(0, Math.max(0, drsDisponibili[teamId] ?? 0))
      .reduce((s, x) => s + x, 0);

    const massimoRecuperabile = perRound.reduce((s, p) => s + p.base, 0) + guadagnoDrs;
    const distacco = punti[leaderId] - punti[teamId];
    esiti.push({
      teamId,
      punti: punti[teamId],
      distacco,
      massimoRecuperabile,
      fuori: massimoRecuperabile < distacco,
      soloPari: massimoRecuperabile === distacco,
    });
  }

  esiti.sort((a, b) => a.distacco - b.distacco);
  return {
    leaderId,
    roundRimasti: rounds.length,
    campioneMatematico: esiti.every((e) => e.fuori),
    squadre: esiti,
  };
}
