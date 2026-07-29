// Donut di distribuzione punti per categoria (quote delle squadre), SVG a mano.
export interface DonutTeam {
  name: string;
  color: string;
}
export interface DonutGroup {
  label: string;
  values: number[]; // un valore per squadra (stesso ordine di `teams`)
}

const CX = 45;
const CY = 45;
const R = 36;
const RI = 22;

function arc(a0: number, a1: number): string {
  const pt = (radius: number, a: number) => [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(R, a0);
  const [x1, y1] = pt(R, a1);
  const [x2, y2] = pt(RI, a1);
  const [x3, y3] = pt(RI, a0);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${RI} ${RI} 0 ${large} 0 ${x3} ${y3} Z`;
}

function Donut({ teams, group }: { teams: DonutTeam[]; group: DonutGroup }) {
  const total = group.values.reduce((s, v) => s + v, 0);
  let angle = -Math.PI / 2;
  const slices = group.values.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    return { color: teams[i].color, a0, a1, v };
  });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 90 90" className="h-24 w-24">
        {total === 0 ? (
          <circle cx={CX} cy={CY} r={(R + RI) / 2} fill="none" stroke="var(--line)" strokeWidth={R - RI} />
        ) : (
          slices.map(
            (s, i) =>
              s.v > 0 && (
                <path key={i} d={arc(s.a0, s.a1 - 0.012)} fill={s.color} />
              )
          )
        )}
        <text x={CX} y={CY + 3.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--bone)" fontFamily="var(--font-mono)">
          {total}
        </text>
      </svg>
      <p className="mt-1 text-center font-[family-name:var(--font-mono)] text-[9px] uppercase leading-tight tracking-widest text-bone-dim">
        {group.label}
      </p>
    </div>
  );
}

export function CategoryDonuts({ teams, groups }: { teams: DonutTeam[]; groups: DonutGroup[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {groups.map((g) => (
        <Donut key={g.label} teams={teams} group={g} />
      ))}
    </div>
  );
}
