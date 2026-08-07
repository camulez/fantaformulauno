// Geometria dei circuiti del simulatore — modulo PURO (nessun Three.js, nessun DOM).
//
// UNICA FONTE DI VERITÀ: la sequenza di rettilinei e curve qui sotto. Da essa si ricava
// la linea centrale del circuito, e da quella discendono SIA la pista 3D SIA la mappa in
// pianta — che quindi corrispondono per costruzione, senza nulla da sincronizzare.

export type Op =
  | { kind: "s"; len: number } // rettilineo: lunghezza in metri
  | { kind: "t"; len: number; deg: number }; // curva: lunghezza d'arco in metri, angolo totale in gradi (+ = destra)

export interface TrackDef {
  roundNo: number;
  code: string;
  name: string;
  roadWidth: number; // metri
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

export const TRACKS: TrackDef[] = [MONACO];

export function getTrack(roundNo: number): TrackDef {
  return TRACKS.find((x) => x.roundNo === roundNo) ?? MONACO;
}

/**
 * Costruisce la linea centrale percorrendo le istruzioni a passo costante, poi chiude
 * l'anello distribuendo l'errore residuo lungo tutto il percorso (così la forma non si
 * deforma). Headings e curvatura sono ricalcolati DOPO la chiusura, per restare coerenti
 * con i punti effettivi.
 */
export function buildGeometry(def: TrackDef): TrackGeom {
  const pts: { x: number; z: number }[] = [];
  let x = 0;
  let z = 0;
  let heading = 0; // 0 = verso +z

  // CONVENZIONE DEI SEGNI (fonte di un bug di sterzo invertito, va tenuta ferma):
  // la direzione di marcia è (sin h, cos h). Guardando avanti, la DESTRA del pilota è
  // (-cos h, sin h) — non (+cos h, -sin h) — e di conseguenza aumentare `h` significa
  // curvare a SINISTRA. Qui si nega l'angolo così che `deg` positivo = curva a destra,
  // coerentemente con `curvature` e con la fisica.
  for (const op of def.ops) {
    const steps = Math.max(1, Math.round(op.len / STEP));
    const dStep = op.len / steps;
    const dTheta = op.kind === "t" ? -((op.deg * Math.PI) / 180) / steps : 0;
    for (let i = 0; i < steps; i++) {
      pts.push({ x, z });
      heading += dTheta;
      x += Math.sin(heading) * dStep;
      z += Math.cos(heading) * dStep;
    }
  }

  // Chiusura dolce dell'anello: l'errore finale si spalma linearmente sui punti.
  const n = pts.length;
  const ex = x - pts[0].x;
  const ez = z - pts[0].z;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    pts[i].x -= ex * f;
    pts[i].z -= ez * f;
  }

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
