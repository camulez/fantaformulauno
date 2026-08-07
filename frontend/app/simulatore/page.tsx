import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { SimLoader } from "@/components/sim/SimLoader";
import { TRACKS, buildGeometry, minRadius } from "@/lib/sim/track";
import type { Me, StandingsResult } from "@/lib/types";

const mono = "font-[family-name:var(--font-mono)]";

export default async function SimulatorePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  await serverFetch<Me>("/auth/me");
  const { r } = await searchParams;
  const roundNo = Number(r);

  // Circuito scelto: si guida.
  if (Number.isInteger(roundNo) && TRACKS.some((t) => t.roundNo === roundNo)) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">
          <SimLoader roundNo={roundNo} />
        </main>
        <BottomNav />
      </div>
    );
  }

  // Altrimenti: scelta del circuito.
  // I round già corsi arrivano dall'elenco vero (non "i primi N": R4 e R5 sono in
  // calendario ma non ancora disputati).
  let corsi = new Set<number>();
  try {
    const st = await serverFetch<StandingsResult>("/standings/current");
    corsi = new Set(st.rounds.map((r) => r.round_no));
  } catch {
    corsi = new Set();
  }

  const cards = TRACKS.map((t) => {
    const g = buildGeometry(t);
    return {
      roundNo: t.roundNo,
      code: t.code,
      name: t.name,
      km: (g.length / 1000).toFixed(2),
      curva: Math.round(minRadius(g)),
    };
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <p className={`${mono} text-[10px] uppercase tracking-[0.3em] text-acid-deep`}>Simulatore</p>
        <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">Scegli il circuito</h1>
        <p className={`${mono} mt-1 text-[10px] uppercase tracking-widest text-bone-dim`}>
          {TRACKS.length} tracciati · un giro di riscaldamento e uno cronometrato
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((c) => {
            const disputato = corsi.has(c.roundNo);
            return (
              <Link
                key={c.roundNo}
                href={`/simulatore?r=${c.roundNo}`}
                className="panel group rounded-xl border border-line/60 p-3 transition-colors hover:border-acid/50"
              >
                <div className="flex items-baseline justify-between">
                  <span className={`${mono} text-lg font-bold text-acid`}>{c.code}</span>
                  <span className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>R{c.roundNo}</span>
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-bone">{c.name}</p>
                <p className={`${mono} mt-1 text-[9px] uppercase tracking-wider text-bone-dim`}>
                  {c.km} km · curva {c.curva} m
                  {disputato && <span className="text-acid-deep"> · corso</span>}
                </p>
              </Link>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
