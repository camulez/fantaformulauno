// Collaudo dei circuiti: i 24 del campionato più la pista prova.
// Esegui: cd frontend && npx tsx lib/sim/tracks.check.ts
// Ogni tracciato deve essere GUIDABILE e SANO:
//  · nessuna curva sotto i 30 m di raggio (altrimenti non si sta in pista);
//  · non deve mai passare vicino a sé stesso (cordoli di traverso in mezzo alla carreggiata);
//  · l'anello si chiude e la lunghezza è da circuito vero.
import { TRACKS, TRAINING, buildGeometry, minRadius, minSelfDistance, STEP } from "./track";
import { cornerSpeedLimit } from "./physics";

const R_MIN_OK = 30;
const CLEAR_MARGIN = 10;

let fail = 0;
const rows: string[] = [];

// La pista prova passa dagli stessi vincoli dei circuiti veri: è quella su cui si impara,
// deve essere la più sana di tutte.
const ALL = [TRAINING, ...TRACKS];

for (const def of ALL) {
  const g = buildGeometry(def);
  const rMin = minRadius(g);
  const clear = minSelfDistance(g);
  const vTight = cornerSpeedLimit(1 / rMin) * 3.6;

  const first = g.points[0];
  const last = g.points[g.points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.z - first.z);

  // verso di percorrenza: somma della curvatura
  const turn = g.curvature.reduce((a, k) => a + k, 0) * (g.length / g.points.length);
  const senso = turn > 0 ? "orario" : "antiorario";

  const problems: string[] = [];
  if (!(rMin > R_MIN_OK)) problems.push(`raggio min ${rMin.toFixed(0)} m`);
  if (!(clear > g.roadWidth + CLEAR_MARGIN)) problems.push(`si avvicina a sé stesso a ${clear.toFixed(0)} m`);
  if (!(gap < STEP * 1.5)) problems.push(`anello non chiuso (${gap.toFixed(1)} m)`);
  if (!(g.length > 1400 && g.length < 5200)) problems.push(`lunghezza ${g.length.toFixed(0)} m`);
  if (!(Math.abs(Math.abs(turn) - Math.PI * 2) < 0.35)) problems.push(`giro ${((turn * 180) / Math.PI).toFixed(0)}°`);

  const ok = problems.length === 0;
  if (!ok) fail++;

  rows.push(
    `${ok ? "✅" : "❌"} R${String(def.roundNo).padStart(2)} ${def.code.padEnd(4)} ${def.name.padEnd(24)}` +
      ` ${(g.length / 1000).toFixed(2)} km  R${rMin.toFixed(0).padStart(3)} m  min${clear.toFixed(0).padStart(4)} m` +
      `  ${vTight.toFixed(0).padStart(3)} km/h  ${senso}` +
      (ok ? "" : `\n      ↳ ${problems.join(" · ")}`)
  );
}

console.log(rows.join("\n"));
console.log(
  `\nCircuiti: ${ALL.length} (${TRACKS.length} campionato + pista prova) · ${ALL.length - fail} validi, ${fail} da sistemare` +
    `\n(vincoli: raggio > ${R_MIN_OK} m, distanza da sé stesso > larghezza+${CLEAR_MARGIN} m)`
);
process.exit(fail === 0 ? 0 : 1);
