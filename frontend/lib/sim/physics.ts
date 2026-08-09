// Fisica arcade del simulatore — modulo PURO (nessun Three.js, nessun DOM).
// Avanza a TICK FISSO: la stessa sequenza di input produce sempre lo stesso tempo,
// così un giro è riproducibile e verificabile.

import { curvatureAt, TrackGeom } from "./track";

/** Durata di un tick di simulazione, in secondi (60 Hz). */
export const TICK = 1 / 60;

export interface CarState {
  /** Distanza percorsa sul giro, in metri. */
  s: number;
  /** Scostamento dal centro pista, in metri (positivo = destra). */
  lateral: number;
  /** Velocità, in m/s. */
  speed: number;
  /** Errore di direzione rispetto alla tangente della pista, in radianti. */
  yaw: number;
  /** Angolo di sterzo attuale (smorzato), da -1 a 1. */
  steer: number;
  /** Secondi consecutivi passati fuori dai limiti della pista. */
  offFor: number;
  /** Infrazioni ai limiti della pista contate finora. */
  violations: number;
}

export interface Input {
  /** -1 tutto a sinistra, +1 tutto a destra. */
  steer: number;
  brake: boolean;
  /**
   * Se le infrazioni vanno contate. Falso nel giro di riscaldamento e in allenamento:
   * lì si può uscire quanto si vuole senza conseguenze.
   */
  countLimits?: boolean;
}

export const MAX_SPEED = 82; // m/s ≈ 295 km/h
export const GRIP = 18; // accelerazione laterale massima (m/s²) prima di allargare
export const R_MIN = 11; // raggio di sterzata minimo in metri (sterzo tutto a fondo)

const ENGINE = 26; // m/s² a velocità nulla, decrescente
const BRAKE = 42; // m/s²
const DRAG = 0.00042;
const ROLL = 1.2;
const STEER_SMOOTH = 7.0; // quanto rapidamente lo sterzo raggiunge la posizione richiesta
const OFF_DRAG = 14; // decelerazione fuori pista
const OFF_GRIP = 0.42; // aderenza residua fuori pista
const WALL_DRAG = 17; // decelerazione strisciando contro le barriere

// ─────────────────────── LIMITI DELLA PISTA ───────────────────────
// Tagliare una curva è DAVVERO più corto: non è un difetto del modello, è geometria
// (a scostamento e con curvatura κ, un metro percorso all'interno vale 1/(1−κe) metri di
// linea centrale). Nelle corse vere il problema si risolve con una REGOLA, non con più
// attrito — e infatti l'attrito fuori pista, da solo, non bastava.
//
// MISURA che ha deciso il valore della penalità (pilota automatico, 24 circuiti, stessa
// fisica): un pilota che taglia gli interni chiude il giro con 2,7–8,9 s di vantaggio,
// pari a un massimo di **2,05 s per singola uscita**. La penalità è fissata a 3 s: circa
// una volta e mezza il vantaggio massimo, così tagliare è sempre in perdita.
// Il test «tagliare non conviene» in physics.check.ts sorveglia questa proprietà.

/** Penalità, in millisecondi, per ogni infrazione ai limiti della pista. */
export const PENALTY_MS = 3000;
/** Margine oltre il bordo prima di essere considerati fuori: sfiorare il cordolo non è infrazione. */
const LIMIT_MARGIN = 0.5;
/** Quanto bisogna restare fuori perché scatti l'infrazione (secondi). */
const MIN_OFF = 0.2;
/** Ogni quanti secondi di permanenza fuori pista scatta un'altra infrazione. */
const OFF_REPEAT = 2.0;

/** Velocità massima con cui si può percorrere una curva di curvatura k senza allargare. */
export function cornerSpeedLimit(k: number): number {
  const a = Math.abs(k);
  if (a < 1e-5) return MAX_SPEED;
  return Math.min(MAX_SPEED, Math.sqrt(GRIP / a));
}

/**
 * Sterzo necessario per seguire una curvatura k. Con il modello a raggio minimo la
 * velocità di imbardata è `steer · v / R_MIN`, che deve valere `k · v`: la velocità
 * si semplifica e lo sterzo richiesto dipende solo dalla curvatura.
 */
export function steerForCurvature(k: number): number {
  return Math.max(-1, Math.min(1, k * R_MIN));
}

/**
 * Frenata assistita: guarda avanti quanto serve per fermarsi in tempo e dice se bisogna
 * già frenare per la curva che arriva. È una funzione PURA dello stato: non rompe il
 * determinismo del giro (stessa situazione → stessa decisione).
 */
export function assistedBrake(car: CarState, geom: TrackGeom): boolean {
  if (car.speed < 12) return false;
  const lookahead = 30 + (car.speed * car.speed) / (2 * 30);
  let limit = Infinity;
  for (let d = 12; d <= lookahead; d += 8) {
    const v = cornerSpeedLimit(curvatureAt(geom, car.s + d));
    if (v < limit) limit = v;
  }
  return car.speed > limit * 1.06;
}

export function createCar(): CarState {
  return { s: 0, lateral: 0, speed: 0, yaw: 0, steer: 0, offFor: 0, violations: 0 };
}

export function isOffTrack(car: CarState, geom: TrackGeom): boolean {
  return Math.abs(car.lateral) > geom.roadWidth / 2;
}

/** Fuori dai limiti: come `isOffTrack` ma con il margine di tolleranza del cordolo. */
export function isBeyondLimits(car: CarState, geom: TrackGeom): boolean {
  return Math.abs(car.lateral) > geom.roadWidth / 2 + LIMIT_MARGIN;
}

/** Penalità accumulata, in millisecondi. */
export function penaltyMs(car: CarState): number {
  return car.violations * PENALTY_MS;
}

/** Tempo finale di un giro: cronometro puro più le penalità. */
export function finalTime(rawMs: number, car: CarState): number {
  return rawMs + penaltyMs(car);
}

/** Avanza la simulazione di UN tick. Muta e restituisce lo stato. */
export function step(car: CarState, input: Input, geom: TrackGeom): CarState {
  const dt = TICK;
  const k = curvatureAt(geom, car.s);
  const off = isOffTrack(car, geom);

  // ── sterzo smorzato (evita scatti e rende la guida leggibile) ──
  const wanted = Math.max(-1, Math.min(1, input.steer));
  car.steer += (wanted - car.steer) * Math.min(1, STEER_SMOOTH * dt);

  // ── longitudinale ──
  let a: number;
  if (input.brake) {
    a = -BRAKE;
  } else {
    a = ENGINE * (1 - car.speed / MAX_SPEED);
  }
  a -= DRAG * car.speed * car.speed + ROLL;
  if (off) a -= OFF_DRAG;
  car.speed = Math.max(0, car.speed + a * dt);

  // ── laterale ──
  // La macchina ruota per effetto dello sterzo; la pista ruota per effetto della curvatura.
  // La differenza è l'errore di direzione, che sposta l'auto attraverso la pista.
  const grip = off ? GRIP * OFF_GRIP : GRIP;
  // Velocità di imbardata richiesta dallo sterzo (modello a raggio minimo), poi limitata
  // dall'aderenza: oltre il limite la macchina allarga invece di girare di più.
  const desiredRate = (car.steer * car.speed) / R_MIN;
  const maxTurnRate = car.speed > 1 ? grip / car.speed : 2.5;
  const steerRate = Math.max(-maxTurnRate, Math.min(maxTurnRate, desiredRate));

  const trackTurnRate = k * car.speed;
  car.yaw += (steerRate - trackTurnRate) * dt;
  // smorzamento: l'auto tende ad allinearsi alla direzione di marcia
  car.yaw *= 1 - Math.min(1, 1.6 * dt);

  car.lateral += car.speed * car.yaw * dt;
  car.s += car.speed * Math.cos(car.yaw) * dt;

  // Barriere: si striscia contro il muro perdendo velocità in modo continuo,
  // non azzerandola di colpo (un moltiplicatore per tick fermerebbe l'auto all'istante).
  const wall = geom.roadWidth / 2 + 6;
  if (car.lateral > wall || car.lateral < -wall) {
    const side = car.lateral > 0 ? 1 : -1;
    car.lateral = side * wall;
    // leggera imbardata verso l'interno: strisciando si riesce a rientrare, invece di
    // restare incollati al muro fino a fermarsi
    car.yaw = -side * 0.03;
    car.speed = Math.max(0, car.speed - WALL_DRAG * dt);
  }

  // ── limiti della pista ──
  // Una infrazione per uscita (dopo MIN_OFF, così un rimbalzo sul cordolo non conta), poi
  // un'altra ogni OFF_REPEAT secondi di permanenza: chi fa mezzo giro sul prato non se la
  // cava con una penalità sola.
  if (isBeyondLimits(car, geom)) {
    const before = car.offFor;
    car.offFor += dt;
    if (before < MIN_OFF && car.offFor >= MIN_OFF) {
      if (input.countLimits) car.violations++;
    } else if (car.offFor >= MIN_OFF) {
      const n = Math.floor((car.offFor - MIN_OFF) / OFF_REPEAT);
      const nBefore = Math.floor((before - MIN_OFF) / OFF_REPEAT);
      if (n > nBefore && input.countLimits) car.violations++;
    }
  } else {
    car.offFor = 0;
  }

  return car;
}

/**
 * Simula una sequenza di input a tick fissi e restituisce lo stato finale.
 * Usato dai test per verificare il determinismo.
 */
export function simulate(geom: TrackGeom, inputs: Input[], from?: CarState): CarState {
  const car = from ?? createCar();
  for (const i of inputs) step(car, i, geom);
  return car;
}

/** Formatta un tempo in millisecondi come m:ss.mmm */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(t).padStart(3, "0")}`;
}
