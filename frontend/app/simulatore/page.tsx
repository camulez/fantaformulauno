import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { SimLoader } from "@/components/sim/SimLoader";
import { Screen, Main, PageHeader } from "@/components/ui";
import { TRACKS, buildGeometry, minRadius } from "@/lib/sim/track";
import type { Me, StandingsResult } from "@/lib/types";

export default async function SimulatorePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  await serverFetch<Me>("/auth/me");
  const { r } = await searchParams;
  const roundNo = Number(r);

  // Circuito scelto: si guida. La scena 3D ha un linguaggio proprio (DESIGN.md),
  // qui si allineano solo i contorni: nessuna testata sopra il gioco.
  if (Number.isInteger(roundNo) && TRACKS.some((t) => t.roundNo === roundNo)) {
    return (
      <Screen>
        <main className="flex-1">
          <SimLoader roundNo={roundNo} />
        </main>
        <BottomNav />
      </Screen>
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
    <Screen>
      <PageHeader
        kicker="Simulatore"
        title="Scegli il circuito"
        subtitle={`${TRACKS.length} tracciati · un giro di riscaldamento e uno cronometrato`}
        size="lg"
      />

      <Main width="lg">
        <div className="ignite grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((c) => {
            const disputato = corsi.has(c.roundNo);
            return (
              <Link
                key={c.roundNo}
                href={`/simulatore?r=${c.roundNo}`}
                className="panel rounded-xl p-3 transition-colors hover:border-acid/50"
                style={{ transitionDuration: "var(--dur-1)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="num text-lg font-bold text-acid">{c.code}</span>
                  <span className="label">R{c.roundNo}</span>
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-bone">{c.name}</p>
                <p className="label mt-1 tracking-wider">
                  {c.km} km · curva {c.curva} m
                  {disputato && <span className="text-acid-deep"> · corso</span>}
                </p>
              </Link>
            );
          })}
        </div>
      </Main>

      <BottomNav />
    </Screen>
  );
}
