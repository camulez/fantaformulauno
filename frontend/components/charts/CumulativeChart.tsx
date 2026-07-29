// Andamento cumulativo del campionato (line chart multi-serie, SVG a mano).
export interface Series {
  name: string;
  color: string;
  values: number[]; // cumulativo per round
}

const W = 360;
const H = 230;
const M = { top: 14, right: 12, bottom: 26, left: 30 };

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const step = Math.pow(10, Math.floor(Math.log10(v))) / 2;
  return Math.ceil(v / step) * step;
}

export function CumulativeChart({
  rounds,
  series,
}: {
  rounds: string[];
  series: Series[];
}) {
  const n = rounds.length;
  const maxV = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / maxV) * innerH;

  const yTicks = 4;
  const gridVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxV / yTicks) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Andamento campionato">
      {/* gridlines + y labels */}
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={M.left} x2={W - M.right} y1={y(gv)} y2={y(gv)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={M.left - 4} y={y(gv) + 3} textAnchor="end" fontSize={8} fill="var(--bone-dim)" fontFamily="var(--font-mono)">
            {gv}
          </text>
        </g>
      ))}
      {/* x labels (ogni 2 round per non affollare) */}
      {rounds.map((r, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={7.5} fill="var(--bone-dim)" fontFamily="var(--font-mono)">
            {r}
          </text>
        ) : null
      )}
      {/* linee */}
      {series.map((s) => {
        const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={2.4} fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}
