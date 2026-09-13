// Formazione di gara: chi è sceso in pista per ogni scuderia in UN round.
//
// Serve per le sostituzioni: quando un pilota corre per una scuderia diversa dalla sua
// (Lawson in Red Bull al posto di Hadjar, GP d'Olanda 2026), i suoi punti devono contare
// per il costruttore che lo ha schierato. I punti che prende COME PILOTA non passano di qui:
// vanno sempre a chi lo possiede, qualunque macchina guidi.
//
// Modulo PURO: niente database, così le due regole importanti si collaudano da riga di comando.

/** Organico di una scuderia: id scuderia → id piloti. */
export type Lineup = Record<string, string[]>;

export interface LineupRow {
  fia_team_id: string;
  driver_id: string;
}

/**
 * Organico effettivo del round: si parte da quello di anagrafica e si sovrascrivono SOLO
 * le scuderie davvero modificate.
 *
 * ⚠️ Prima qui c'era un `if (righe.length) {...} else {...}`: bastava scrivere l'organico di
 * una scuderia perché tutte le altre restassero senza piloti — e quindi con zero punti
 * costruttore in quella gara, in silenzio. Il merge per scuderia è il motivo di questo file.
 */
export function mergeLineups(predefiniti: Lineup, scritti: LineupRow[]): Lineup {
  if (scritti.length === 0) return { ...predefiniti };

  const modificate: Lineup = {};
  for (const r of scritti) (modificate[r.fia_team_id] ??= []).push(r.driver_id);

  return { ...predefiniti, ...modificate };
}

// ─── Da quale gara viene una formazione ───
//
// ⚠️ Il baco di Madrid (R16, 2026). Una formazione valeva UNA gara sola: Lawson in Red Bull era scritto
// in Olanda e a Monza, non a Madrid, e a Madrid l'app è tornata in silenzio all'anagrafica — Lawson di
// nuovo in Racing Bulls. Quattro squadre con i punti sbagliati (telaio, motore, sponsor e benzina di
// entrambe le scuderie) e nessun avviso. Una sostituzione che dura più GP andava riscritta a ogni gara.
//
// Ora la formazione di una scuderia SI PORTA AVANTI: vale quella scritta nell'ultima gara in cui è stata
// cambiata, finché non la si cambia di nuovo. Il rischio opposto (il titolare rientra e nessuno aggiorna)
// lo copre `puntiSenzaScuderia`, che se ne accorge dai risultati.

export interface PilotaAnagrafica {
  id: string;
  fia_team_id: string | null;
  is_reserve: boolean;
}

/**
 * Organico di inizio stagione, scuderia per scuderia. **Senza riserve**: una riserva entra in pista solo
 * se è schierata in una formazione. Prima `standings.ts` e `report.ts` le includevano (e `routes/lineups.ts`
 * no): per il motore, in una gara senza formazione, Racing Bulls aveva tre piloti.
 */
export function organicoDiAnagrafica(piloti: PilotaAnagrafica[]): Lineup {
  const per: Lineup = {};
  for (const d of piloti) {
    if (d.fia_team_id && !d.is_reserve) (per[d.fia_team_id] ??= []).push(d.id);
  }
  return per;
}

export interface RigaScritta extends LineupRow {
  round_no: number;
}

export interface FormazioneCalcolata {
  lineup: Lineup;
  /** Per le scuderie che vengono da una formazione scritta: il round in cui è stata scritta. */
  da: Record<string, number>;
}

/** L'ultima formazione scritta per ogni scuderia in un round che rispetta `ammesso`. */
function ultimeScritte(righe: RigaScritta[], ammesso: (roundNo: number) => boolean): FormazioneCalcolata {
  const ultimoRound: Record<string, number> = {};
  for (const r of righe) {
    if (!ammesso(r.round_no)) continue;
    if (ultimoRound[r.fia_team_id] === undefined || r.round_no > ultimoRound[r.fia_team_id]) {
      ultimoRound[r.fia_team_id] = r.round_no;
    }
  }
  const lineup: Lineup = {};
  for (const r of righe) {
    if (ultimoRound[r.fia_team_id] === r.round_no) (lineup[r.fia_team_id] ??= []).push(r.driver_id);
  }
  return { lineup, da: ultimoRound };
}

/** Organico effettivo al round `roundNo`: le formazioni scritte fino a quel round, sopra l'anagrafica. */
export function formazioneEffettiva(anagrafica: Lineup, righe: RigaScritta[], roundNo: number): FormazioneCalcolata {
  const scritte = ultimeScritte(righe, (n) => n <= roundNo);
  return { lineup: { ...anagrafica, ...scritte.lineup }, da: scritte.da };
}

/**
 * Cosa erediterebbe il round `roundNo` se non ci si scrivesse niente: le formazioni dei round PRIMA.
 * È il termine di confronto quando si salva — scrivere «Hadjar rientra» è una riga vera, perché
 * altrimenti si continuerebbe a ereditare Lawson.
 */
export function formazioneEreditata(anagrafica: Lineup, righe: RigaScritta[], roundNo: number): FormazioneCalcolata {
  const scritte = ultimeScritte(righe, (n) => n < roundNo);
  return { lineup: { ...anagrafica, ...scritte.lineup }, da: scritte.da };
}

/**
 * Piloti con punti in un round che non risultano schierati da nessuna scuderia. È impossibile nella
 * realtà, quindi è sempre un segno che la formazione è rimasta indietro — di solito un titolare
 * rientrato mentre si continuava a ereditare il sostituto. I suoi punti costruttore non vanno a nessuno.
 */
export function puntiSenzaScuderia(effettivi: Lineup, conPunti: string[]): string[] {
  const schierati = new Set(Object.values(effettivi).flat());
  return [...new Set(conPunti)].filter((d) => !schierati.has(d));
}

export interface ProblemaFormazione {
  tipo: 'pilota-doppio' | 'troppi-piloti';
  messaggio: string;
}

/**
 * Controlli su una formazione prima di salvarla.
 * Il primo è quello che protegge il punteggio: se lo stesso pilota risulta in due scuderie,
 * i suoi punti finirebbero a due costruttori diversi.
 */
export function validaFormazione(scritti: LineupRow[], maxPerScuderia = 2): ProblemaFormazione | null {
  const scuderieDi = new Map<string, string[]>();
  const perScuderia = new Map<string, number>();

  for (const r of scritti) {
    const s = scuderieDi.get(r.driver_id) ?? [];
    if (!s.includes(r.fia_team_id)) s.push(r.fia_team_id);
    scuderieDi.set(r.driver_id, s);
    perScuderia.set(r.fia_team_id, (perScuderia.get(r.fia_team_id) ?? 0) + 1);
  }

  for (const [driverId, scuderie] of scuderieDi) {
    if (scuderie.length > 1) {
      return {
        tipo: 'pilota-doppio',
        messaggio: `Lo stesso pilota (${driverId}) risulta in due scuderie: i suoi punti finirebbero a due costruttori.`,
      };
    }
  }
  for (const [teamId, n] of perScuderia) {
    if (n > maxPerScuderia) {
      return {
        tipo: 'troppi-piloti',
        messaggio: `Una scuderia (${teamId}) ha ${n} piloti: il massimo è ${maxPerScuderia}.`,
      };
    }
  }
  return null;
}

/** Le scuderie che in questo round differiscono dall'anagrafica. */
export function scuderieModificate(predefiniti: Lineup, effettivi: Lineup): string[] {
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  return Object.keys(effettivi).filter((t) => !uguali(predefiniti[t], effettivi[t]));
}

// ─── Art. II del Regolamento Campionato: la catena delle sostituzioni ───
//
// Il caso vero (GP d'Olanda e Monza 2026): Hadjar (di zippof1team) non corre, al suo posto in
// Red Bull va Lawson — che però è di Pio. L'Art. II.d dice che in quel caso resti privo del
// pilota, e la «possibilità 2» ti dà diritto al pilota che a sua volta ha sostituito Lawson,
// cioè Tsunoda. Ricostruire quella catena a mente ogni volta è il lavoro che qui fa l'app:
// i dati per farlo ci sono già tutti (anagrafica, formazione del round, proprietà).

/** Chi ha lasciato e chi ha preso il posto, scuderia per scuderia, in un round. */
export interface CambioScuderia {
  fiaTeamId: string;
  usciti: string[];
  entrati: string[];
}

export function cambiScuderia(predefiniti: Lineup, effettivi: Lineup): CambioScuderia[] {
  const cambi: CambioScuderia[] = [];
  for (const fiaTeamId of Object.keys(effettivi)) {
    const prima = predefiniti[fiaTeamId] ?? [];
    const dopo = effettivi[fiaTeamId] ?? [];
    const usciti = prima.filter((d) => !dopo.includes(d));
    const entrati = dopo.filter((d) => !prima.includes(d));
    if (usciti.length > 0 || entrati.length > 0) cambi.push({ fiaTeamId, usciti, entrati });
  }
  return cambi;
}

/**
 * Chi, fra i piloti di anagrafica, NON è sceso in pista da nessuna parte in questo round.
 *
 * ⚠️ Distinzione che sembra pedante e non lo è: «ha lasciato la sua scuderia» e «non ha corso»
 * sono cose diverse. Al GP d'Olanda Lawson lascia Racing Bulls, ma corre — per Red Bull. Il suo
 * Team Manager (Pio) prende i suoi punti come sempre e **non** ha nessun caso Art. II aperto.
 * L'articolo parla del Pilota che «non scende in pista», non del pilota che cambia macchina.
 * Senza questo filtro l'app proponeva un risarcimento a chi non aveva perso niente.
 */
export function assentiDalRound(predefiniti: Lineup, effettivi: Lineup): string[] {
  const inPista = new Set(Object.values(effettivi).flat());
  return [...new Set(Object.values(predefiniti).flat())].filter((d) => !inPista.has(d));
}

/**
 * Un anello della catena: chi manca e chi ne ha preso il posto in quella scuderia.
 *
 * ⚠️ Se dalla stessa scuderia esce più di un pilota, l'abbinamento «chi ha sostituito chi»
 * NON è deducibile dai dati: due uscite e due entrate si possono accoppiare in due modi.
 * In quel caso `sostituto` resta null e `ambiguo` diventa true — l'app mostra i candidati
 * e fa scegliere, invece di indovinare.
 */
export interface Anello {
  assente: string;
  fiaTeamId: string;
  sostituto: string | null;
  candidati: string[];
  ambiguo: boolean;
}

export function catenaSostituzioni(predefiniti: Lineup, effettivi: Lineup): Anello[] {
  const anelli: Anello[] = [];
  for (const c of cambiScuderia(predefiniti, effettivi)) {
    const ambiguo = c.usciti.length > 1 || c.entrati.length > 1;
    for (const assente of c.usciti) {
      anelli.push({
        assente,
        fiaTeamId: c.fiaTeamId,
        sostituto: ambiguo ? null : (c.entrati[0] ?? null),
        candidati: c.entrati,
        ambiguo,
      });
    }
  }
  return anelli;
}

/**
 * Quale caso dell'Art. II si applica, e quale pilota spetta al Team.
 *
 * - **II.b/II.c** — il sostituto non è di nessuno: entra temporaneamente nella tua squadra.
 * - **II.d** — il sostituto è di un altro Team: resti privo del pilota. La possibilità 2 ti
 *   dà il sostituto del sostituto, e si scende lungo la catena finché non se ne trova uno libero.
 * - **II.e** — nessuno l'ha sostituito: non c'è niente da prendere.
 *
 * ⚠️ L'**Art. II.a** (squalifica FIA) NON è deducibile dai dati: una squalifica e una semplice
 * assenza si assomigliano. Non viene mai restituito da qui — è un fatto che sa solo chi guarda
 * la gara, e l'interfaccia lo dice a parole invece di fingere di riconoscerlo.
 */
export type CasoArt2 = 'II.bc' | 'II.d' | 'II.e';

export interface EsitoArt2 {
  assente: string;
  caso: CasoArt2;
  /** La catena percorsa: [assente, sostituto, sostituto del sostituto, ...]. */
  percorso: string[];
  /** Il pilota che entra temporaneamente nel Team, o null se non ce n'è uno libero. */
  spettante: string | null;
  ambiguo: boolean;
  /** Solo per II.d: chi possiede il sostituto diretto, cioè perché non puoi prenderlo. */
  bloccatoDa: string | null;
  candidati: string[];
}

/** Quanti anelli si percorrono prima di arrendersi: protegge dai cicli e dai dati strani. */
const MAX_PASSI = 10;

export function sostitutoSpettante(
  anelli: Anello[],
  assente: string,
  /** id del Team che possiede quel pilota, o null se non è di nessuno. */
  proprietarioDi: (driverId: string) => string | null
): EsitoArt2 {
  const perAssente = new Map(anelli.map((a) => [a.assente, a]));
  const percorso = [assente];
  const visti = new Set<string>([assente]);
  let bloccatoDa: string | null = null;
  let corrente = assente;

  for (let passo = 0; passo < MAX_PASSI; passo++) {
    const anello = perAssente.get(corrente);
    // Nessuno ha preso il suo posto: la catena finisce qui.
    if (!anello || (anello.sostituto === null && !anello.ambiguo)) {
      return {
        assente,
        caso: bloccatoDa ? 'II.d' : 'II.e',
        percorso,
        spettante: null,
        ambiguo: false,
        bloccatoDa,
        candidati: anello?.candidati ?? [],
      };
    }
    if (anello.ambiguo) {
      return {
        assente,
        caso: bloccatoDa ? 'II.d' : 'II.bc',
        percorso,
        spettante: null,
        ambiguo: true,
        bloccatoDa,
        candidati: anello.candidati,
      };
    }

    const sostituto = anello.sostituto as string;
    // Un ciclo (A sostituito da B, B sostituito da A) non deve far girare a vuoto.
    if (visti.has(sostituto)) {
      return { assente, caso: 'II.d', percorso, spettante: null, ambiguo: false, bloccatoDa, candidati: [] };
    }
    visti.add(sostituto);
    percorso.push(sostituto);

    const proprietario = proprietarioDi(sostituto);
    if (proprietario === null) {
      // Libero: al primo passo è l'Art. II.b/II.c, più avanti è la possibilità 2 dell'Art. II.d.
      return {
        assente,
        caso: passo === 0 ? 'II.bc' : 'II.d',
        percorso,
        spettante: sostituto,
        ambiguo: false,
        bloccatoDa,
        candidati: anello.candidati,
      };
    }

    // È di un altro Team: Art. II.d, si prosegue col sostituto del sostituto.
    if (bloccatoDa === null) bloccatoDa = proprietario;
    corrente = sostituto;
  }

  return { assente, caso: 'II.d', percorso, spettante: null, ambiguo: false, bloccatoDa, candidati: [] };
}
