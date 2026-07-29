"use client";

import { useState } from "react";
import type { TeamStanding } from "@/lib/types";
import { shortName as short } from "@/lib/shortName";

type ColoredTeam = TeamStanding & { color: string };

export function HeadToHead({ teams }: { teams: ColoredTeam[] }) {
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(teams.length > 1 ? 1 : 0);

  const A = teams[aIdx];
  const B = teams[bIdx];
  if (!A || !B) return null;

  const n = Math.min(A.perRound.length, B.perRound.length);
  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < n; i++) {
    const pa = A.perRound[i] ?? 0;
    const pb = B.perRound[i] ?? 0;
    if (pa > pb) aWins++;
    else if (pb > pa) bWins++;
  }
  const cat = (t: ColoredTeam) => ({
    tm: t.breakdown.telaio + t.breakdown.motore,
    pil: t.breakdown.pilota1 + t.breakdown.pilota2,
    sb: t.breakdown.sponsor + t.breakdown.benzina,
  });
  const ca = cat(A);
  const cb = cat(B);

  return (
    <div>
      {/* Selettori */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Selector teams={teams} value={aIdx} exclude={bIdx} onChange={setAIdx} color={A.color} />
        <Selector teams={teams} value={bIdx} exclude={aIdx} onChange={setBIdx} color={B.color} />
      </div>

      <div className="space-y-2">
        <Row label="Punti totali" a={A.total} b={B.total} ca={A.color} cb={B.color} />
        <Row label="GP vinti" a={A.gpWins} b={B.gpWins} ca={A.color} cb={B.color} />
        <Row label="Round vinti (diretti)" a={aWins} b={bWins} ca={A.color} cb={B.color} />
        <Row label="Telaio + Motore" a={ca.tm} b={cb.tm} ca={A.color} cb={B.color} />
        <Row label="Piloti" a={ca.pil} b={cb.pil} ca={A.color} cb={B.color} />
        <Row label="Sponsor + Benzina" a={ca.sb} b={cb.sb} ca={A.color} cb={B.color} />
      </div>
    </div>
  );
}

function Selector({
  teams,
  value,
  exclude,
  onChange,
  color,
}: {
  teams: ColoredTeam[];
  value: number;
  exclude: number;
  onChange: (i: number) => void;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-carbon-950 px-2 py-1">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-bone outline-none"
      >
        {teams.map((t, i) => (
          <option key={t.teamId} value={i} disabled={i === exclude} className="bg-carbon-950">
            {short(t.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({ label, a, b, ca, cb }: { label: string; a: number; b: number; ca: string; cb: string }) {
  const aWin = a > b;
  const bWin = b > a;
  return (
    <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-sm">
      <span className="w-10 text-left font-bold" style={{ color: aWin ? ca : "var(--bone-dim)" }}>
        {a}
      </span>
      <span className="flex-1 text-center text-[10px] uppercase tracking-widest text-bone-dim">{label}</span>
      <span className="w-10 text-right font-bold" style={{ color: bWin ? cb : "var(--bone-dim)" }}>
        {b}
      </span>
    </div>
  );
}
