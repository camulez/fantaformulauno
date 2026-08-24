// Regolamento fantaformulauno 2026 — trascritto dal PDF ufficiale firmato a Parigi il
// 27 febbraio 2026 («2026 World Championship Regulations Official-3.pdf»).
//
// È un documento COSTITUZIONALE: si cambia una volta l'anno, al rollover. Per questo sta
// qui, versionato col codice, e non in una tabella: nessuna migrazione, nessun editor da
// mantenere per una cosa che si tocca a stagione.
//
// ⚠️ Il testo è VERBATIM. Se un giorno diverge dal PDF, il PDF ha ragione.

import type { ScoringRules } from "./types";

/** Una cifra citata dal regolamento, da confrontare con quella davvero impostata nell'app. */
export interface ValoreCitato {
  etichetta: string;
  /** Quanto dice il regolamento. */
  atteso: string | number;
  /** Come si legge il valore applicato dalla configurazione di stagione. */
  applicato: (r: ScoringRules) => string | number;
}

export interface Articolo {
  n: string;
  testo: string;
  sub?: { n: string; testo: string }[];
  /** La sezione dell'app che mette in pratica questo articolo. */
  applica?: { href: string; label: string };
  valori?: ValoreCitato[];
}

export interface Titolo {
  id: string;
  titolo: string;
  intro?: string;
  articoli: Articolo[];
}

export const NOTE: Record<string, string> = {
  "1": "Fase d'Asta: fase dell'Asta dedicata all'aggiudicazione di uno specifico Componente.",
  "2": "Round si compone di: Practice · Sprint Qualifying · Sprint · Qualifying · Race.",
  "3": "Non sono considerati eventuali Punti DRS.",
};

export const FIRMA = {
  luogo: "Parigi",
  data: "27 febbraio 2026",
  team: [
    "Anzo Grand Prix International",
    "Marchese Motori&Mignotte",
    "Pio Motori & Propulsioni",
    "Scuderia Da Silva",
    "Staiv Squadra Corse",
    "zippof1team",
  ],
};

export const PREAMBOLO =
  "Il presente Documento norma e disciplina il Campionato del Mondo fantaformulauno. Il Documento è composto dai seguenti titoli: 1) Regolamento Asta, 2) Regolamento Campionato.";

export const REGOLAMENTO: Titolo[] = [
  {
    id: "asta",
    titolo: "Regolamento Asta",
    intro: "La formazione di ciascun Team avviene attraverso l'Asta.",
    articoli: [
      {
        n: "I",
        testo:
          "Ciascun Team Manager ha a disposizione un budget in M$ pari alla media dei punti del Campionato fantaformulauno 2025 realizzati dalle prime quattro scuderie del Campionato FIA 2025. Per il Campionato fantaformulauno 2026 il budget è stabilito in 1.835 M$.",
        applica: { href: "/asta", label: "Tabellone d'asta" },
        valori: [{ etichetta: "Budget squadra", atteso: 1835, applicato: (r) => r.auction.budget }],
      },
      {
        n: "II",
        testo:
          "Il prezzo del Componente in M$ è pari ai punti del precedente Campionato fantaformulauno e costituisce la base d'asta originaria.",
        applica: { href: "/valori", label: "Listino valori" },
      },
      {
        n: "III",
        testo:
          "Al termine dell'Asta, ciascun Team deve essere formato dai seguenti Componenti: telaio, motore, due piloti, sponsor, benzina.",
      },
      {
        n: "IV",
        testo:
          "Il Team non può includere le seguenti coppie di Componenti della medesima scuderia del Campionato FIA: Telaio&Motore; Telaio/Motore&Pilota.",
      },
      {
        n: "V",
        testo:
          "I Componenti sono battuti nel seguente ordine di Fase d'Asta¹: Motore · Sponsor · Pilota 1 · Benzina · Telaio · Pilota 2.",
        valori: [
          {
            etichetta: "Ordine delle fasi",
            atteso: "motore · sponsor · pilota1 · benzina · telaio · pilota2",
            applicato: (r) => r.auction.phaseOrder.join(" · "),
          },
        ],
      },
      {
        n: "VI",
        testo:
          "Durante le Fasi d'Asta deve essere noto a tutti l'ammontare delle disponibilità economiche di ciascun Team Manager.",
      },
      {
        n: "VII",
        testo: "L'offerta deve essere superiore al prezzo di base d'asta originaria («base d'asta più 1 M$»).",
        valori: [{ etichetta: "Rilancio minimo", atteso: 1, applicato: (r) => r.auction.minIncrement }],
      },
      {
        n: "VIII",
        testo:
          "Nel caso due o più Team Manager offrano la stessa cifra per il medesimo Componente, viene ripetuta la battuta d'asta per il Componente in questione; alla ripetizione della battuta devono partecipare i Team Manager che hanno fatto l'offerta più alta per il Componente in questione, mentre hanno facoltà di parteciparvi i Team Manager che per il medesimo Componente hanno fatto un'offerta più bassa. La base d'asta diviene l'offerta minima fatta da chi interviene alla ripetizione della battuta e così sino all'aggiudicazione del Componente.",
      },
      {
        n: "IX",
        testo:
          "La Fase d'Asta continua con successive battute d'asta sino a quando il Componente è stato aggiudicato da tutti i Team Manager. Qualora un solo Team Manager al termine di ogni Fase d'Asta rimanesse ancora privo del Componente, acquista il Componente tra quelli ancora sul mercato al prezzo di base d'asta originaria.",
      },
      {
        n: "X",
        testo:
          "L'eventuale offerta fatta in modo erroneo — offrendo una cifra maggiore del Capitale effettivamente disponibile, indicando un Componente non acquistabile ai sensi dell'art. IV, indicando un Componente non presente sul mercato, offrendo una cifra inferiore alla «base d'asta più 1 M$» o più in generale compilando il foglio dell'offerta in modo non chiaro, incompleto o palesemente sbagliato — determina la non validità dell'offerta. Il Team Manager, prima di proseguire la Fase d'Asta secondo l'Art. VIII, attende l'aggiudicazione del Componente da parte dei restanti Team Manager.",
      },
      {
        n: "XI",
        testo:
          "Il Team Manager che all'inizio o nel corso di una Fase d'Asta non disponga del Capitale per fare l'offerta deve cedere al valore di base d'asta originaria e acquistare al valore di base d'asta originaria uno o più Componenti e avere quindi il Capitale sufficiente per continuare a prendere parte alla Fase d'Asta nel rispetto dell'Art. III.",
      },
      {
        n: "XII",
        testo:
          "I M$ non investiti durante l'Asta costituiranno il Capitale da utilizzarsi durante il resto della stagione.",
      },
    ],
  },
  {
    id: "campionato",
    titolo: "Regolamento Campionato",
    articoli: [
      {
        n: "I",
        testo:
          "Il Campionato del Mondo fantaformulauno è perfettamente conforme al Campionato FIA, adeguandosi pertanto a tutte le modifiche derivanti dalle decisioni prese dai vertici della FIA che hanno effetto immediato sui Team nei limiti del presente Regolamento.",
      },
      {
        n: "II",
        testo:
          "Nel caso in cui il Pilota non scenda in pista durante una o più fasi del Round² possono sussistere le seguenti casistiche (oltre al caso particolare dell'Art. III).",
        applica: { href: "/inserisci", label: "Formazione della gara" },
        sub: [
          {
            n: "II.a",
            testo:
              "Provvedimento di squalifica per uno o più Round promosso dalla FIA (o direzione di gara o organismo equivalente): nessuna possibilità di sostituzione del Pilota. Il Pilota rientra nel Team a fine squalifica.",
          },
          {
            n: "II.b",
            testo:
              "Sostituzione con pilota non presente in Campionato FIA: il sostituto diviene temporaneamente parte del Team. Il Pilota rientra nel Team contestualmente al ritorno nel Round e indipendentemente dalla scuderia dove rientra e dalle sorti del pilota che lo ha sostituito.",
          },
          {
            n: "II.c",
            testo:
              "Sostituzione con pilota già presente in Campionato FIA non appartenente ad altro Team: il sostituto diviene temporaneamente parte del Team. Il Pilota rientra nel Team contestualmente al ritorno nel Round e indipendentemente dalla scuderia dove rientra e dalle sorti del pilota che lo ha sostituito.",
          },
          {
            n: "II.d",
            testo:
              "Sostituzione con pilota appartenente a un altro Team: in questo caso il Team Manager rimane effettivamente privo del pilota e pertanto sono a sua discrezione le seguenti possibilità. Possibilità 1 — acquisto di un nuovo pilota tra quelli disponibili sul mercato avendo a disposizione, oltre al proprio Capitale, una cifra pari alla base d'asta originaria del Pilota più i punti (convertiti in M$) già realizzati durante il Campionato FIA. Il prezzo del nuovo pilota è pari alla sua base d'asta originaria più i punti³ (convertiti in M$) già realizzati durante il Campionato FIA. Il Pilota si considera quindi definitivamente venduto, pertanto non è più parte del Team ed è ufficialmente sul mercato. Possibilità 2 — sostituzione con l'eventuale pilota a sua volta in sostituzione del pilota già appartenente ad altro Team. Il Pilota rientra nel Team contestualmente al suo ritorno nel Round e indipendentemente dalla scuderia dove rientra e dalle sorti del pilota che lo ha sostituito.",
          },
          {
            n: "II.e",
            testo:
              "Mancata sostituzione del Pilota o mancata sostituzione del pilota già appartenente ad altro Team: il Team Manager a sua discrezione può attenersi a quanto all'Art. II.d possibilità 1 oppure attendere il verificarsi di una delle casistiche di cui all'Art. II.",
          },
        ],
      },
      {
        n: "III",
        testo:
          "Nel caso di ritiro di una scuderia dal Campionato FIA i Team Manager interessati per pilota, motore, telaio, sponsor e benzina acquistano il nuovo Componente tra quelli disponibili sul mercato avendo a disposizione, oltre al proprio Capitale, una cifra pari alla base d'asta originaria più i punti³ (convertiti in M$) realizzati durante il Campionato FIA dal Componente che è venuto a mancare sino al momento dell'acquisto. Il prezzo del nuovo Componente è pari alla sua base d'asta originaria più i punti³ (convertiti in M$) già realizzati durante il Campionato FIA.",
        applica: { href: "/squadra", label: "Mercato" },
      },
      {
        n: "IV",
        testo:
          "Nel caso il ritiro della scuderia o dei suoi piloti di cui all'Art. III si riveli temporaneo è facoltà del Team Manager decidere a sua discrezione uno o più Componenti, a condizione che siano ancora disponibili sul mercato; in questo caso il Team Manager opera con la medesima modalità di acquisto/vendita utilizzata per la sostituzione (Art. II). La decisione deve essere comunicata entro il Round del rientro e l'operazione di riacquisizione può essere svolta entro i tempi tecnici strettamente necessari (varranno comunque retroattivamente i punti acquisiti nel Round di rientro).",
      },
      {
        n: "V",
        testo:
          "La detrazione parziale di punti Sprint o Race alla scuderia del Campionato FIA ha validità nel Campionato fantaformulauno relativamente a telaio e motore.",
      },
      {
        n: "VI",
        testo:
          "La detrazione totale di punti Race alla scuderia del Campionato FIA ha validità nel Campionato fantaformulauno relativamente a telaio, motore, sponsor e benzina.",
      },
    ],
  },
  {
    id: "punteggi",
    titolo: "Assegnazione Punteggi",
    articoli: [
      {
        n: "I",
        testo:
          "Pilota, Motore e Telaio ottengono i punti Race secondo quanto riportato nella Classifica del Campionato FIA.",
        applica: { href: "/report", label: "Report per gara" },
      },
      {
        n: "II",
        testo:
          "Punto Pole: il Pilota ottiene 3 punti in caso di miglior tempo in Qualifying, salvo nel caso di penalità che lo obblighi a una posizione in griglia nella Race diversa da P1, in questo caso il Punto Pole è attribuito di conseguenza al II miglior tempo in Qualifying (e così a seguire).",
        valori: [{ etichetta: "Punti pole", atteso: 3, applicato: (r) => r.polePoints }],
      },
      {
        n: "III",
        testo:
          "Punto Sprint: il Pilota ottiene i punti Sprint secondo quanto riportato nella Classifica del Campionato FIA.",
      },
      {
        n: "IV",
        testo:
          "Telaio e Motore ottengono i punti Sprint come ottenuti dal Pilota e secondo quanto riportato per le scuderie nella Classifica del Campionato FIA.",
      },
      {
        n: "V",
        testo:
          "Benzina ottiene 6 punti per ogni monoposto a punti in Race (salvo quanto disposto nel Regolamento Campionato).",
        valori: [{ etichetta: "Benzina, per monoposto", atteso: 6, applicato: (r) => r.benzinaPointsPerCar }],
      },
      {
        n: "VI",
        testo:
          "Sponsor ottiene 3 punti per ogni monoposto a punti in Race (salvo quanto disposto nel Regolamento Campionato).",
        valori: [{ etichetta: "Sponsor, per monoposto", atteso: 3, applicato: (r) => r.sponsorPointsPerCar }],
      },
      {
        n: "VII",
        testo:
          "Il Team Manager ottiene 3 punti se a entrambi i Piloti sono assegnati punti Race nella Classifica del Campionato FIA.",
        valori: [{ etichetta: "Punti Team Manager", atteso: 3, applicato: (r) => r.teamManagerPoints }],
      },
      {
        n: "VIII",
        testo:
          "Punto DRS: il DRS permette di raddoppiare i punti della Race riportati nella Classifica del Campionato FIA (sono esclusi i punti Sprint). Durante la stagione il Team Manager ha facoltà di utilizzare 6 DRS (uno per Componente). Può essere utilizzato un solo DRS a Race che deve essere dichiarato entro l'inizio della sessione Qualifying.",
        applica: { href: "/drs", label: "Tabellone DRS" },
        valori: [
          { etichetta: "Moltiplicatore", atteso: "×2", applicato: (r) => `×${r.drsMultiplier}` },
          { etichetta: "DRS a stagione", atteso: 6, applicato: (r) => r.drsPerSeason },
          {
            etichetta: "Cosa raddoppia",
            atteso: "solo Race",
            applicato: (r) => (r.drsScope === "race" ? "solo Race" : "Race e Sprint"),
          },
        ],
      },
    ],
  },
  {
    id: "campione",
    titolo: "Assegnazione titolo di Campione del Mondo",
    intro:
      "Il vincitore del Campionato del Mondo fantaformulauno è stabilito in base ai seguenti criteri, nel loro ordine.",
    articoli: [
      { n: "I", testo: "Maggior numero di punti di Classifica del Campionato fantaformulauno." },
      {
        n: "II",
        testo:
          "In caso di parità, maggior numero di Race del Campionato fantaformulauno vinti dal Team. Si intende per Race vinto quello in cui il Team (o i Team, in caso di parimerito) ottenga il maggior numero di punti rispetto agli altri.",
      },
      { n: "III", testo: "In caso di parità, maggior numero di secondi posti." },
      { n: "IV", testo: "In caso di parità, maggior numero di terzi posti." },
      { n: "V", testo: "In caso di parità, miglior punteggio Team Manager." },
      { n: "VI", testo: "In caso di parità il titolo è assegnato ex-aequo." },
    ],
  },
  {
    id: "team-manager",
    titolo: "Assegnazione titolo Team Manager",
    intro: "Il vincitore della Coppa Team Manager è stabilito in base ai seguenti criteri, nel loro ordine.",
    articoli: [
      { n: "I", testo: "Maggior numero di punti Team Manager." },
      { n: "II", testo: "In caso di parità, maggiore somma dei punti Pilota come da Classifica del Campionato FIA." },
      { n: "III", testo: "In caso di parità, maggior numero di Race del Campionato fantaformulauno vinti." },
      { n: "IV", testo: "In caso di parità, miglior piazzamento in Classifica." },
      { n: "V", testo: "In caso di parità il titolo è assegnato ex-aequo." },
    ],
  },
];
