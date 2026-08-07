// Test dei moduli puri del simulatore. Esegui: cd frontend && npx tsx lib/sim/physics.check.ts
import {
  MONACO,
  buildGeometry,
  curvatureAt,
  worldAt,
  rightNormal,
  sampleAt,
  minSelfDistance,
  minRadius,
  STEP,
} from "./track";
import {
  createCar,
  step,
  simulate,
  TICK,
  isOffTrack,
  formatTime,
  cornerSpeedLimit,
  steerForCurvature,
  GRIP,
  Input,
} from "./physics";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error("  ✗ " + name + (extra ? "  → " + extra : ""));
  }
}

const geom = buildGeometry(MONACO);

// ── 1. Geometria: l'anello si chiude e le misure sono coerenti ──
{
  const first = geom.points[0];
  const last = geom.points[geom.points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.z - first.z);
  check("anello chiuso (ultimo≈primo)", gap < STEP * 1.5, `scarto ${gap.toFixed(2)} m`);

  // La chiusura dell'anello accorcia leggermente il percorso: si controlla che resti
  // nell'ordine di grandezza dichiarato (non un valore esatto).
  const declared = MONACO.ops.reduce((a, o) => a + o.len, 0);
  check(
    "lunghezza nell'ordine di grandezza dichiarato",
    geom.length > declared * 0.8 && geom.length < declared * 1.1,
    `${geom.length.toFixed(0)} m vs ${declared} m dichiarati`
  );
  check("lunghezza da circuito vero (1.5–5 km)", geom.length > 1500 && geom.length < 5000, `${geom.length.toFixed(0)} m`);
  check("campioni sufficienti", geom.points.length > 300, `${geom.points.length}`);
  check("array allineati", geom.headings.length === geom.points.length && geom.curvature.length === geom.points.length);

  // Il giro completo deve corrispondere a un angolo giro.
  let total = 0;
  for (let i = 0; i < geom.curvature.length; i++) {
    const segLen = geom.length / geom.points.length;
    total += geom.curvature[i] * segLen;
  }
  check("giro completo ≈ 360°", Math.abs(Math.abs(total) - Math.PI * 2) < 0.35, `${((total * 180) / Math.PI).toFixed(1)}°`);

  // ── VINCOLI DI GUIDABILITÀ (richiesti dall'utente dopo la prima prova) ──
  const rMin = minRadius(geom);
  check("nessuna curva più stretta di 30 m di raggio", rMin > 30, `curva più stretta: R ${rMin.toFixed(1)} m`);

  const selfD = minSelfDistance(geom);
  check(
    "la pista non passa mai vicino a sé stessa",
    selfD > geom.roadWidth + 10,
    `avvicinamento minimo ${selfD.toFixed(1)} m (larghezza pista ${geom.roadWidth} m)`
  );

  // La curva più stretta deve essere percorribile a una velocità sensata.
  const vTight = Math.sqrt(GRIP / (1 / rMin));
  check("la curva più stretta è percorribile sopra i 70 km/h", vTight * 3.6 > 70, `${(vTight * 3.6).toFixed(0)} km/h`);

  // Esistono curve in entrambe le direzioni.
  check("curve a destra e a sinistra", Math.max(...geom.curvature) > 0.005 && Math.min(...geom.curvature) < -0.005);
}

// ── 1b. CONVENZIONE DEI SEGNI ──
// Questo blocco esiste perché lo sterzo risultava invertito: c'erano DUE errori di segno
// (normale "destra" e verso della curvatura) che si annullavano nel comportamento in curva
// ma non nei comandi. Qui si verifica la geometria vera, non la coerenza interna.
{
  const square = buildGeometry({
    roundNo: 99,
    code: "TST",
    name: "Quadrato a destra",
    roadWidth: 10,
    ops: [
      { kind: "s", len: 120 }, { kind: "t", len: 90, deg: 90 },
      { kind: "s", len: 120 }, { kind: "t", len: 90, deg: 90 },
      { kind: "s", len: 120 }, { kind: "t", len: 90, deg: 90 },
      { kind: "s", len: 120 }, { kind: "t", len: 90, deg: 90 },
    ],
  });
  const avg = square.curvature.reduce((a, b) => a + b, 0) / square.curvature.length;
  check("gradi positivi → curvatura positiva (destra)", avg > 0, `media ${avg.toFixed(4)}`);

  // Dove la curvatura è positiva la pista deve piegare verso la DESTRA del pilota.
  let idx = -1;
  for (let t = 0; t < square.curvature.length; t++) {
    if (square.curvature[t] > 0.005) {
      idx = t;
      break;
    }
  }
  check("esiste un tratto in curva", idx >= 0);
  if (idx >= 0) {
    const rn = rightNormal(square.headings[idx]);
    const j = (idx + 8) % square.points.length;
    const dx = square.points[j].x - square.points[idx].x;
    const dz = square.points[j].z - square.points[idx].z;
    check(
      "in curva a destra il tracciato si sposta verso destra",
      dx * rn.nx + dz * rn.nz > 0,
      `proiezione ${(dx * rn.nx + dz * rn.nz).toFixed(2)}`
    );
  }

  // Scostamento laterale positivo = alla destra del pilota, nel mondo.
  const c0 = worldAt(geom, 0, 0);
  const c1 = worldAt(geom, 0, 6);
  const rn0 = rightNormal(geom.headings[sampleAt(geom, 0)]);
  const px = c1.x - c0.x;
  const pz = c1.z - c0.z;
  check("lateral positivo = destra del pilota", px * rn0.nx + pz * rn0.nz > 5.9);
}

// ── 2. worldAt: coerenza posizione/scostamento ──
{
  const c = worldAt(geom, 500, 0);
  const r = worldAt(geom, 500, 5);
  const d = Math.hypot(r.x - c.x, r.z - c.z);
  check("scostamento laterale di 5 m = 5 m nel mondo", Math.abs(d - 5) < 0.01, `${d.toFixed(3)}`);
}

// ── 3. Determinismo: stessi input → stesso risultato, al millimetro ──
{
  const inputs: Input[] = [];
  for (let i = 0; i < 1800; i++) {
    inputs.push({ steer: Math.sin(i / 37) * 0.8, brake: i % 300 > 270 });
  }
  const a = simulate(geom, inputs);
  const b = simulate(geom, inputs);
  check("determinismo: distanza identica", a.s === b.s, `${a.s} vs ${b.s}`);
  check("determinismo: velocità identica", a.speed === b.speed);
  check("determinismo: laterale identico", a.lateral === b.lateral);
  check("il tempo simulato avanza", a.s > 100, `${a.s.toFixed(0)} m in 30 s`);
}

// ── 4. Comportamento longitudinale ──
{
  // Isolo la dinamica longitudinale: tengo l'auto al centro pista (altrimenti, non
  // sterzando in un circuito cittadino, finirebbe contro le barriere — ed è corretto così).
  const car = createCar();
  const full: Input = { steer: 0, brake: false };
  for (let i = 0; i < 60 * 12; i++) {
    step(car, full, geom);
    car.lateral = 0;
    car.yaw = 0;
  }
  check("accelera fino a una velocità di punta plausibile", car.speed > 55 && car.speed < 90, `${car.speed.toFixed(1)} m/s`);

  const before = car.speed;
  for (let i = 0; i < 60 * 2; i++) step(car, { steer: 0, brake: true }, geom);
  check("il freno rallenta davvero", car.speed < before * 0.5, `${before.toFixed(1)} → ${car.speed.toFixed(1)}`);
}

// ── 5. Sterzo e fuoripista ──
{
  const car = createCar();
  car.speed = 30;
  for (let i = 0; i < 60 * 2; i++) step(car, { steer: 1, brake: false }, geom);
  check("sterzando a destra ci si sposta a destra", car.lateral > 0.5, `${car.lateral.toFixed(2)} m`);

  const off = createCar();
  off.speed = 60;
  off.lateral = geom.roadWidth / 2 + 2;
  check("rilevamento fuoripista", isOffTrack(off, geom));
  const v0 = off.speed;
  for (let i = 0; i < 60; i++) step(off, { steer: 0, brake: false }, geom);
  check("fuori pista si perde velocità", off.speed < v0, `${v0.toFixed(1)} → ${off.speed.toFixed(1)}`);
}

// ── 6. Un giro intero si chiude in un tempo plausibile ──
{
  // Pilota automatico: sterza quanto serve per seguire la curvatura ALLA VELOCITÀ ATTUALE
  // (lo sterzo necessario dipende dalla velocità) e frena in base al limite d'aderenza
  // della curva che sta arrivando.
  const car = createCar();
  let ticks = 0;
  const maxTicks = 60 * 240;
  while (car.s < geom.length && ticks < maxTicks) {
    const kNow = curvatureAt(geom, car.s + 8);
    // curva più stretta nei prossimi metri (distanza di frenata)
    let kAhead = 0;
    const look = 40 + car.speed * car.speed / 55;
    for (let d = 10; d < look; d += 10) {
      const k = Math.abs(curvatureAt(geom, car.s + d));
      if (k > kAhead) kAhead = k;
    }
    const vLimit = cornerSpeedLimit(kAhead);
    const brake = car.speed > vLimit * 1.05;

    const base = steerForCurvature(kNow);
    const correction = -car.lateral * 0.012 - car.yaw * 1.6;
    const steer = Math.max(-1, Math.min(1, base + correction));
    step(car, { steer, brake }, geom);
    ticks++;
  }
  const secs = ticks * TICK;
  check("il giro si chiude", car.s >= geom.length, `${car.s.toFixed(0)}/${geom.length.toFixed(0)} m`);
  check("tempo sul giro plausibile (30–180 s)", secs > 30 && secs < 180, `${secs.toFixed(1)} s`);
  console.log(`  · giro automatico: ${formatTime(secs * 1000)} su ${geom.length.toFixed(0)} m`);
}

// ── 7. Formattazione tempi ──
{
  check("formato tempo", formatTime(84318) === "1:24.318", formatTime(84318));
  check("formato tempo non valido", formatTime(-1) === "--:--.---");
}

console.log(`\nSimulatore (geometria + fisica): ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
