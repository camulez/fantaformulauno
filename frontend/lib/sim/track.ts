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

// Monaco: lento e stretto, con il tornante del Grand Hotel e la sezione piscina.
// Gli angoli sommano a 360° (un circuito chiuso compie esattamente un giro completo):
// i rettilinei "veri" hanno una leggera curvatura opposta, come nella realtà.
export const MONACO: TrackDef = {
  roundNo: 8,
  code: "MON",
  name: "Monaco",
  roadWidth: 11,
  ops: [
    s(250), //                    rettilineo dei box
    t(60, 85), //                 Sainte Dévote
    t(250, -60), //               Beau Rivage, in salita
    t(90, -100), //               Massenet
    t(70, 75), //                 Casino
    s(80),
    t(55, 85), //                 Mirabeau
    s(40),
    t(45, 160), //                Tornante del Grand Hotel
    s(50),
    t(60, 70), //                 Portier
    t(450, -70), //               tunnel
    t(150, 40), //                uscita tunnel
    s(60),
    t(40, -60), //                Nouvelle Chicane
    t(40, 65),
    t(180, -60),
    t(60, -85), //                Tabac
    t(45, -55), //                Piscina
    t(45, 60),
    t(45, 55),
    t(45, -50),
    s(60),
    t(45, 130), //                La Rascasse
    s(50),
    t(60, 75), //                 Anthony Noghès
    s(120),
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

  for (const op of def.ops) {
    const steps = Math.max(1, Math.round(op.len / STEP));
    const dStep = op.len / steps;
    const dTheta = op.kind === "t" ? ((op.deg * Math.PI) / 180) / steps : 0;
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
    curvature[i] = d / segLen;
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

/** Curvatura (rad/m) alla distanza indicata. */
export function curvatureAt(geom: TrackGeom, s: number): number {
  return geom.curvature[sampleAt(geom, s)];
}

/** Posizione nel mondo a una data distanza e scostamento laterale (positivo = destra). */
export function worldAt(geom: TrackGeom, s: number, lateral: number) {
  const i = sampleAt(geom, s);
  const p = geom.points[i];
  const h = geom.headings[i];
  // normale a destra rispetto alla direzione di marcia
  const nx = Math.cos(h);
  const nz = -Math.sin(h);
  return { x: p.x + nx * lateral, z: p.z + nz * lateral, heading: h };
}
