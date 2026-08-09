// Geometria dei circuiti del simulatore — modulo PURO (nessun Three.js, nessun DOM).
//
// UNICA FONTE DI VERITÀ: la sequenza di rettilinei e curve qui sotto. Da essa si ricava
// la linea centrale del circuito, e da quella discendono SIA la pista 3D SIA la mappa in
// pianta — che quindi corrispondono per costruzione, senza nulla da sincronizzare.

export type Op =
  | { kind: "s"; len: number } // rettilineo: lunghezza in metri
  | { kind: "t"; len: number; deg: number }; // curva: lunghezza d'arco in metri, angolo totale in gradi (+ = destra)

/** Ambientazione: cittadino (palazzi vicini) o autodromo in mezzo al verde. */
export type Scenery = "city" | "park";

export interface TrackDef {
  roundNo: number;
  code: string;
  name: string;
  roadWidth: number; // metri
  scenery: Scenery;
  ops: Op[];
}

export interface TrackGeom {
  /** Linea centrale campionata a passo costante, anello chiuso. */
  points: { x: number; z: number }[];
  /** Direzione (radianti) in ogni campione. */
  headings: number[];
  /** Curvatura con segno (rad/m) in ogni campione: + = destra. */
  curvature: number[];
  /** Distanza cumulata dall'inizio, in metri. */
  distance: number[];
  /** Lunghezza totale del giro in metri. */
  length: number;
  roadWidth: number;
}

/** Passo di campionamento della linea centrale, in metri. */
export const STEP = 4;

const s = (len: number): Op => ({ kind: "s", len });
const t = (len: number, deg: number): Op => ({ kind: "t", len, deg });

// Monaco — versione GUIDABILE. Due vincoli, verificati dai test in physics.check.ts:
//  1. nessuna curva più stretta di ~30 m di raggio (con un tornante vero non si sta in pista);
//  2. il tracciato non passa mai vicino a sé stesso, altrimenti cordoli e barriere di un
//     tratto finiscono in mezzo a un altro tratto, di traverso alla direzione di marcia.
// Gli angoli sommano a 360°, come deve fare un circuito chiuso. Non riproduce la planimetria
// reale di Monaco: ne conserva il carattere (cittadino, curve medio-lente, muri vicini).
export const MONACO: TrackDef = {
  roundNo: 8,
  code: "MON",
  name: "Monaco",
  roadWidth: 14,
  scenery: "city",
  ops: [
    s(380), //             rettilineo dei box
    t(85, 55), //          curva veloce a destra  · R ≈ 88 m
    s(110),
    t(75, 80), //          destra media           · R ≈ 54 m  ← la più stretta
    s(80),
    t(45, -35), //         piega a sinistra       · R ≈ 74 m
    s(100),
    t(95, 80), //          curva lunga a destra   · R ≈ 68 m
    s(130),
    t(60, 60), //          destra                 · R ≈ 57 m
    s(70),
    t(55, -40), //         sinistra veloce        · R ≈ 79 m
    s(120),
    t(70, 70), //          destra                 · R ≈ 57 m
    s(90),
    t(80, 70), //          destra ampia           · R ≈ 65 m
    s(140),
    t(35, -30), //         piega a sinistra       · R ≈ 67 m
    s(80),
    t(60, 50), //          ultima a destra        · R ≈ 69 m
    s(110),
  ],
};

const mk = (
  roundNo: number,
  code: string,
  name: string,
  roadWidth: number,
  scenery: Scenery,
  ops: Op[]
): TrackDef => ({ roundNo, code, name, roadWidth, scenery, ops });

// I 24 circuiti. Ognuno riprende il CARATTERE di quello reale (rettilinei lunghi, curvoni,
// tratti tortuosi), non la planimetria: sono piste *analoghe*. Tutti devono passare i due
// vincoli verificati da tracks.check.ts — raggio minimo e nessun avvicinamento a sé stessi.
export const TRACKS: TrackDef[] = [
  // 1 · Albert Park: veloce e scorrevole, curve medio-veloci in sequenza
  mk(1, "AUS", "Australia", 15, "park", [
    s(320), t(90, 70), s(140), t(70, -45), s(90), t(100, 80), s(120), t(80, 60),
    s(150), t(70, -40), s(100), t(90, 75), s(130), t(80, 65), s(110), t(70, -35),
    s(90), t(85, 70), s(140), t(75, 60),
  ]),
  // 2 · Shanghai: la lunga destra che si chiude, poi il rettilineo enorme e il tornantino
  mk(2, "CHI", "Cina", 15, "park", [
    s(240), t(220, 210), s(80), t(90, -75), s(110), t(80, 65), s(140), t(75, -55),
    s(560), t(120, 150), s(90), t(80, 65), s(130), t(70, -45), s(160), t(85, 70),
  ]),
  // 3 · Suzuka: le esse in sequenza, poi Spoon e la 130R (senza incrocio: qui non c'è ponte)
  mk(3, "JAP", "Giappone", 14, "park", [
    s(300), t(110, 85), s(70), t(70, -50), s(60), t(70, 50), s(60), t(70, -50),
    s(60), t(70, 55), s(120), t(95, 75), s(90), t(140, 120), s(180), t(120, 60),
    s(150), t(90, -40), s(120), t(100, 80),
  ]),
  // 4 · Sakhir: stop-and-go, tre staccate secche fra i rettilinei
  mk(4, "BHA", "Bahrain", 15, "park", [
    s(400), t(70, 85), s(130), t(65, 80), s(210), t(75, 70), s(90), t(60, -55),
    s(110), t(70, 60), s(140), t(65, 55), s(120), t(70, -45), s(160), t(75, 70),
    s(130), t(70, 40),
  ]),
  // 5 · Jeddah: velocissimo, una sequenza continua di pieghe fra i muri
  mk(5, "SAR", "Arabia Saudita", 13, "city", [
    s(380), t(120, 55), s(90), t(110, -45), s(80), t(120, 60), s(90), t(110, -50),
    s(100), t(130, 65), s(110), t(120, -45), s(90), t(140, 70), s(120), t(120, -40),
    s(140), t(130, 65), s(170), t(120, 55),
  ]),
  // 6 · Miami: partenza veloce, settore centrale spezzato
  mk(6, "USA", "Miami", 15, "city", [
    s(330), t(95, 75), s(150), t(80, -55), s(90), t(75, 70), s(70), t(65, -60),
    s(80), t(70, 65), s(200), t(100, 80), s(120), t(75, -45), s(140), t(85, 70),
    s(180), t(80, 55),
  ]),
  // 7 · Montréal: rettilinei e varianti secche, muro all'ultima
  mk(7, "CAN", "Canada", 14, "city", [
    s(380), t(70, 90), s(90), t(65, -55), s(200), t(75, 95), s(120), t(65, -50),
    s(260), t(75, 85), s(110), t(70, 65), s(420), t(80, 90), s(90), t(65, -50),
    s(120), t(70, 70),
  ]),
  // 8 · Monaco (già collaudato): cittadino, curve medio-lente, muri vicini
  MONACO,
  // 9 · Barcellona: la lunga destra iniziale, ultimo settore tortuoso
  mk(9, "CAT", "Spagna (Barcellona)", 15, "park", [
    s(340), t(90, 75), s(80), t(160, 130), s(200), t(85, 65), s(120), t(75, -50),
    s(150), t(90, 70), s(90), t(70, 60), s(110), t(65, -45), s(80), t(70, 55),
    s(100), t(75, 60),
  ]),
  // 10 · Red Bull Ring: giro corto, tre allunghi e poche curve
  mk(10, "OST", "Austria", 16, "park", [
    s(420), t(70, 85), s(380), t(75, 90), s(220), t(80, 75), s(140), t(70, -40),
    s(120), t(75, 65), s(180), t(70, 45),
  ]),
  // 11 · Silverstone: curvoni velocissimi e le esse di Maggotts-Becketts
  mk(11, "GBR", "Gran Bretagna", 16, "park", [
    s(300), t(110, 70), s(120), t(130, 80), s(240), t(90, -45), s(70), t(80, 50),
    s(60), t(80, -45), s(70), t(90, 55), s(280), t(120, 75), s(160), t(100, -40),
    s(140), t(110, 65), s(180), t(95, 55),
  ]),
  // 12 · Spa: il più lungo, curvoni in pieno e un allungo interminabile
  mk(12, "BEL", "Belgio", 16, "park", [
    s(300), t(70, -60), s(60), t(90, 75), s(90), t(110, 45), s(620), t(120, 80),
    s(180), t(140, 60), s(200), t(110, -45), s(160), t(130, 70), s(240), t(120, 65),
    s(180), t(90, 70),
  ]),
  // 13 · Hungaroring: tortuoso, praticamente senza rettilinei
  mk(13, "HUN", "Ungheria", 14, "park", [
    s(260), t(70, 85), s(90), t(65, 80), s(80), t(60, -60), s(70), t(65, 70),
    s(90), t(60, -55), s(80), t(70, 75), s(100), t(65, 65), s(70), t(60, -50),
    s(80), t(65, 70), s(90), t(70, 60), s(110), t(65, 55),
  ]),
  // 14 · Zandvoort: corto e ondulato, curve lunghe e paraboliche
  mk(14, "NET", "Olanda", 14, "park", [
    s(280), t(100, 95), s(90), t(80, 70), s(120), t(75, -50), s(100), t(85, 75),
    s(140), t(90, 80), s(110), t(70, -45), s(90), t(80, 65), s(160), t(110, 90),
  ]),
  // 15 · Monza: due rettiloni, tre varianti e la Parabolica
  mk(15, "ITA", "Italia (Monza)", 16, "park", [
    s(620), t(55, 65), t(55, -55), s(240), t(150, 95), s(160), t(55, -60), t(55, 65),
    s(120), t(90, 70), s(90), t(85, 60), s(420), t(60, -55), t(60, 60), t(60, -45),
    s(300), t(180, 130), s(220),
  ]),
  // 16 · Madrid: moderno, misto veloce e tratti guidati
  mk(16, "ESP", "Spagna (Madrid)", 15, "park", [
    s(350), t(90, 80), s(130), t(75, -50), s(110), t(85, 70), s(170), t(95, 75),
    s(120), t(70, -45), s(140), t(80, 65), s(200), t(90, 70), s(110), t(75, -40),
    s(130), t(85, 55),
  ]),
  // 17 · Baku: il rettilineo interminabile e il tratto stretto del castello
  mk(17, "AZB", "Azerbaijan", 13, "city", [
    s(700), t(70, 90), s(120), t(60, 85), s(80), t(55, 80), s(70), t(55, -70),
    s(90), t(60, 85), s(140), t(70, 75), s(260), t(75, 70), s(180), t(65, -55),
    s(200), t(80, 70),
  ]),
  // 18 · Singapore: una sequenza di curve ad angolo retto, di notte
  mk(18, "SNG", "Singapore", 13, "city", [
    s(300), t(60, 85), s(110), t(60, 85), s(90), t(55, -75), s(80), t(60, 85),
    s(120), t(55, 80), s(100), t(60, -70), s(90), t(55, 85), s(130), t(60, 80),
    s(110), t(55, -65), s(100), t(60, 80),
  ]),
  // 19 · Austin: antiorario, le esse in salita e il lungo allungo verso il tornante
  mk(19, "USA", "Stati Uniti (Austin)", 16, "park", [
    s(300), t(90, -95), s(70), t(70, 55), s(60), t(70, -60), s(60), t(70, 55),
    s(60), t(70, -60), s(140), t(110, -85), s(480), t(90, -95), s(150), t(85, -60),
    s(120), t(90, 55), s(160), t(95, -75),
  ]),
  // 20 · Città del Messico: rettilineo enorme e il tratto guidato dello stadio
  mk(20, "MEX", "Messico", 15, "park", [
    s(620), t(70, 85), s(100), t(65, 80), s(180), t(90, 70), s(220), t(80, -50),
    s(160), t(85, 65), s(90), t(60, 75), s(80), t(60, 70), s(110), t(70, 55),
  ]),
  // 21 · Interlagos: antiorario, corto, la S di Senna e la salita finale
  mk(21, "BRA", "Brasile", 14, "park", [
    s(280), t(70, -80), t(65, 60), s(180), t(90, -75), s(140), t(75, -65),
    s(110), t(70, 50), s(120), t(80, -70), s(90), t(70, -60), s(150), t(85, -55),
    s(200), t(90, -65),
  ]),
  // 22 · Las Vegas: lunghissimi rettilinei notturni fra pochi angoli
  mk(22, "USA", "Las Vegas", 15, "city", [
    s(700), t(65, 90), s(200), t(60, 85), s(560), t(70, 80), s(180), t(65, -55),
    s(240), t(70, 75), s(300), t(65, 85),
  ]),
  // 23 · Losail: curvoni medio-veloci uno dietro l'altro
  mk(23, "QTR", "Qatar", 15, "park", [
    s(340), t(110, 80), s(120), t(100, 70), s(90), t(95, -55), s(110), t(105, 75),
    s(130), t(100, 65), s(100), t(90, -45), s(120), t(110, 70), s(150), t(100, 60),
    s(170), t(95, 55),
  ]),
  // 24 · Yas Marina: allunghi e tornantini secchi
  mk(24, "ABD", "Abu Dhabi", 15, "park", [
    s(420), t(60, 90), s(320), t(60, 85), s(140), t(70, -50), s(180), t(65, 75),
    s(110), t(60, 70), s(150), t(70, -45), s(200), t(65, 80), s(130), t(60, 75),
    s(160), t(70, 55),
  ]),
];

/**
 * PISTA PROVA — non fa parte del campionato (roundNo 0, mai in `TRACKS`).
 * Serve a imparare, non a competere: qui non si contano infrazioni e non si salva niente.
 * Disegnata per far esercitare su tutto quello che poi serve davvero, in ordine:
 * un rettilineo lungo per prendere confidenza con la staccata, una curva lenta, una
 * sequenza di esse, un curvone veloce da fare senza toccare il freno.
 * Carreggiata larga 18 m — è una scuola guida, non un esame.
 */
export const TRAINING: TrackDef = mk(0, "TRN", "Pista prova", 18, "park", [
  s(560), //            rettilineo lungo: velocità massima e staccata
  t(80, 85), //         curva lenta a destra: la staccata vera
  s(150),
  t(60, -55), //        esse: sinistra…
  s(55),
  t(60, 55), //         …destra
  s(190),
  t(200, 90), //        curvone veloce a destra, da fare senza freno
  s(140),
  t(70, -45), //        piega a sinistra
  s(120),
  t(85, 75), //         destra media
  s(150),
  t(65, -40), //        sinistra
  s(110),
  t(90, 80), //         destra
  s(180),
  t(75, 55), //         destra d'ingresso al rettilineo
]);

export function getTrack(roundNo: number): TrackDef {
  if (roundNo === TRAINING.roundNo) return TRAINING;
  return TRACKS.find((x) => x.roundNo === roundNo) ?? MONACO;
}

/**
 * Costruisce la linea centrale percorrendo le istruzioni a passo costante, poi chiude
 * l'anello distribuendo l'errore residuo lungo tutto il percorso (così la forma non si
 * deforma). Headings e curvatura sono ricalcolati DOPO la chiusura, per restare coerenti
 * con i punti effettivi.
 */
/**
 * Trova di quanto allungare/accorciare ogni rettilineo perché l'anello si chiuda.
 * Lo spostamento finale è LINEARE nelle lunghezze dei rettilinei (gli angoli, e quindi le
 * direzioni, non cambiano): si risolve quindi in forma chiusa con la correzione di norma
 * minima, cioè quella che tocca i rettilinei il meno possibile. Due o tre passate bastano.
 */
function solveClosure(ops: Op[], balance: number): number[] {
  const scale = ops.map(() => 1);

  for (let pass = 0; pass < 3; pass++) {
    let x = 0;
    let z = 0;
    let heading = 0;
    // contributo di ciascun rettilineo allo spostamento totale, per unità di scala
    const contrib: { i: number; dx: number; dz: number }[] = [];

    ops.forEach((op, i) => {
      if (op.kind === "s") {
        const len = op.len * scale[i];
        const dx = Math.sin(heading) * len;
        const dz = Math.cos(heading) * len;
        contrib.push({ i, dx, dz });
        x += dx;
        z += dz;
      } else {
        const steps = Math.max(1, Math.round(op.len / STEP));
        const dStep = op.len / steps;
        const dTheta = -((op.deg * balance * Math.PI) / 180) / steps;
        for (let k = 0; k < steps; k++) {
          heading += dTheta;
          x += Math.sin(heading) * dStep;
          z += Math.cos(heading) * dStep;
        }
      }
    });

    if (Math.hypot(x, z) < 0.5 || contrib.length === 0) break;

    // correzione di norma minima: Δ = Aᵀ (A Aᵀ)⁻¹ (−P), con A = [dx dz] per rettilineo
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    for (const c of contrib) {
      a11 += c.dx * c.dx;
      a12 += c.dx * c.dz;
      a22 += c.dz * c.dz;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-9) break;
    const l1 = (-x * a22 + z * a12) / det;
    const l2 = (-z * a11 + x * a12) / det;

    for (const c of contrib) {
      const delta = c.dx * l1 + c.dz * l2;
      // niente rettilinei che spariscono o esplodono
      scale[c.i] = Math.max(0.35, Math.min(2.5, scale[c.i] * (1 + delta)));
    }
  }

  return scale;
}

/** Ricampiona una polilinea chiusa a passo costante, così tutti i segmenti sono uguali. */
function resampleClosed(pts: { x: number; z: number }[], step: number) {
  const n = pts.length;
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    seg.push(d);
    total += d;
  }
  const count = Math.max(16, Math.round(total / step));
  const exact = total / count;
  const out: { x: number; z: number }[] = [];
  let i = 0;
  let walked = 0;
  for (let k = 0; k < count; k++) {
    const target = k * exact;
    while (i < n - 1 && walked + seg[i] <= target) {
      walked += seg[i];
      i++;
    }
    const t = seg[i] > 1e-9 ? (target - walked) / seg[i] : 0;
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
}

export function buildGeometry(def: TrackDef): TrackGeom {
  const pts: { x: number; z: number }[] = [];
  let x = 0;
  let z = 0;
  let heading = 0; // 0 = verso +z

  // Un circuito chiuso compie esattamente un giro (±360°). Invece di bilanciare a mano
  // gli angoli di 24 tracciati, si riscalano tutti dello stesso fattore: la forma e il
  // carattere restano (la curva più stretta resta la più stretta), l'anello si chiude.
  // Il verso è preservato: negativo = circuito antiorario, come Interlagos o Austin.
  const totalDeg = def.ops.reduce((a, o) => (o.kind === "t" ? a + o.deg : a), 0);
  const targetDeg = totalDeg < 0 ? -360 : 360;
  const balance = Math.abs(totalDeg) > 1 ? targetDeg / totalDeg : 1;

  // CHIUSURA DELL'ANELLO: si allungano/accorciano leggermente i RETTILINEI finché il
  // percorso torna al punto di partenza. Prima l'errore veniva spalmato spostando i punti,
  // ma quello deforma la pista e stringe le curve: correggere i rettilinei lascia intatti
  // i raggi di curvatura, che sono la parte che conta per la guidabilità.
  const straightScale = solveClosure(def.ops, balance);

  // CONVENZIONE DEI SEGNI (fonte di un bug di sterzo invertito, va tenuta ferma):
  // la direzione di marcia è (sin h, cos h). Guardando avanti, la DESTRA del pilota è
  // (-cos h, sin h) — non (+cos h, -sin h) — e di conseguenza aumentare `h` significa
  // curvare a SINISTRA. Qui si nega l'angolo così che `deg` positivo = curva a destra,
  // coerentemente con `curvature` e con la fisica.
  for (let idx = 0; idx < def.ops.length; idx++) {
    const op = def.ops[idx];
    const len = op.kind === "s" ? op.len * straightScale[idx] : op.len;
    const steps = Math.max(1, Math.round(len / STEP));
    const dStep = len / steps;
    const dTheta = op.kind === "t" ? -((op.deg * balance * Math.PI) / 180) / steps : 0;
    for (let i = 0; i < steps; i++) {
      pts.push({ x, z });
      heading += dTheta;
      x += Math.sin(heading) * dStep;
      z += Math.cos(heading) * dStep;
    }
  }

  // Chiusura dolce dell'anello: l'errore finale si spalma linearmente sui punti.
  {
    const m = pts.length;
    const ex = x - pts[0].x;
    const ez = z - pts[0].z;
    for (let i = 0; i < m; i++) {
      const f = i / m;
      pts[i].x -= ex * f;
      pts[i].z -= ez * f;
    }
  }

  // RICAMPIONAMENTO a passo costante. La correzione di chiusura è uno spostamento
  // progressivo: accorcia i segmenti dove si oppone alla direzione di marcia. Siccome la
  // curvatura è angolo/lunghezza, segmenti più corti la gonfiano e facevano sembrare
  // strettissime curve in realtà larghe. Con punti equidistanti il problema sparisce.
  const uniform = resampleClosed(pts, STEP);
  pts.length = 0;
  pts.push(...uniform);
  const n = pts.length;

  // Distanze, direzioni e curvatura ricavate dai punti definitivi.
  const headings: number[] = new Array(n);
  const distance: number[] = new Array(n);
  const curvature: number[] = new Array(n);

  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    headings[i] = Math.atan2(dx, dz);
    distance[i] = acc;
    acc += Math.hypot(dx, dz);
  }
  for (let i = 0; i < n; i++) {
    const h0 = headings[i];
    const h1 = headings[(i + 1) % n];
    let d = h1 - h0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const segLen = Math.max(0.001, (distance[(i + 1) % n] || acc) - distance[i] || STEP);
    // negata: aumentare l'angolo di rotta = curva a sinistra, quindi curvatura POSITIVA = destra
    curvature[i] = -d / segLen;
  }

  return { points: pts, headings, curvature, distance, length: acc, roadWidth: def.roadWidth };
}

/** Indice del campione corrispondente a una distanza sul giro (con avvolgimento). */
export function sampleAt(geom: TrackGeom, s: number): number {
  const len = geom.length;
  let d = s % len;
  if (d < 0) d += len;
  const i = Math.floor((d / len) * geom.points.length);
  return Math.min(geom.points.length - 1, Math.max(0, i));
}

/**
 * Posizione FRAZIONARIA fra due campioni. Serve per interpolare: leggere la linea
 * centrale "a scatti" ogni 4 m faceva ruotare la camera a gradini nelle curve —
 * percepito come scattoso anche con il frame rate a posto.
 */
function fracAt(geom: TrackGeom, s: number) {
  const n = geom.points.length;
  const len = geom.length;
  let d = s % len;
  if (d < 0) d += len;
  const t = (d / len) * n;
  const i = Math.floor(t) % n;
  return { i, j: (i + 1) % n, f: t - Math.floor(t) };
}

/** Interpolazione fra due angoli passando dalla via più corta. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Curvatura (rad/m) alla distanza indicata, interpolata fra i campioni. */
export function curvatureAt(geom: TrackGeom, s: number): number {
  const { i, j, f } = fracAt(geom, s);
  return geom.curvature[i] * (1 - f) + geom.curvature[j] * f;
}

/**
 * Distanza minima fra due punti NON contigui lungo il percorso: misura quanto il
 * tracciato si avvicina a sé stesso. Se scende sotto la larghezza della pista, cordoli
 * e barriere di un tratto finiscono in mezzo a un altro tratto (di traverso alla
 * direzione di marcia) — da evitare sempre.
 */
export function minSelfDistance(geom: TrackGeom): number {
  const n = geom.points.length;
  const skip = Math.ceil(70 / STEP); // ignora i vicini entro 70 m di percorso
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const gap = j - i;
      if (Math.min(gap, n - gap) < skip) continue;
      const a = geom.points[i];
      const b = geom.points[j];
      const d2 = (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
      if (d2 < best) best = d2;
    }
  }
  return Math.sqrt(best);
}

/** Raggio della curva più stretta del tracciato, in metri. */
export function minRadius(geom: TrackGeom): number {
  let maxK = 0;
  for (const k of geom.curvature) maxK = Math.max(maxK, Math.abs(k));
  return maxK > 1e-6 ? 1 / maxK : Infinity;
}

/** Normale verso la DESTRA del pilota (vedi convenzione dei segni in buildGeometry). */
export function rightNormal(h: number) {
  return { nx: -Math.cos(h), nz: Math.sin(h) };
}

/**
 * Posizione nel mondo a una data distanza e scostamento laterale (positivo = destra).
 * Posizione e angolo di rotta sono INTERPOLATI fra i campioni: senza interpolazione la
 * camera ruotava a gradini di ~4 m, e in curva si vedeva come uno scatto continuo.
 */
export function worldAt(geom: TrackGeom, s: number, lateral: number) {
  const { i, j, f } = fracAt(geom, s);
  const p0 = geom.points[i];
  const p1 = geom.points[j];
  const x = p0.x + (p1.x - p0.x) * f;
  const z = p0.z + (p1.z - p0.z) * f;
  const h = lerpAngle(geom.headings[i], geom.headings[j], f);
  const { nx, nz } = rightNormal(h);
  return { x: x + nx * lateral, z: z + nz * lateral, heading: h };
}
