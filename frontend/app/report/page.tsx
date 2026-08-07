import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import type { Me, SeasonMatrix, StandingsResult } from "@/lib/types";

const mono = "font-[family-name:var(--font-mono)]";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  await serverFetch<Me>("/auth/me");
  const { team: teamParam } = await searchParams;

  const standings = await serverFetch<StandingsResult>("/standings/current");

  let teamId = teamParam;
  if (!teamId) {
    try {
      const mine = await serverFetch<{ teamId: string }>("/report/my-team");
      teamId = mine.teamId;
    } catch {
      teamId = standings.teams[0]?.teamId;
    }
  }

  if (!teamId) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 px-5 py-10 text-center">
          <p className={`${mono} text-[11px] uppercase tracking-widest text-bone-dim`}>Nessuna squadra disponibile.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const m = await serverFetch<SeasonMatrix>(`/report/season/${teamId}`);
  const nRounds = m.rounds.length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/" className={`${mono} text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid`}>
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Report</h1>
        <p className={`${mono} mt-1 text-[10px] uppercase tracking-widest text-bone-dim`}>
          Punti di ogni pezzo, gara per gara
        </p>
      </header>

      <main className="flex-1 pb-6">
        {/* selettore scuderia */}
        <div className="-mx-0 flex gap-2 overflow-x-auto px-4 py-3">
          {standings.teams.map((t) => {
            const active = t.teamId === teamId;
            return (
              <Link
                key={t.teamId}
                href={`/report?team=${t.teamId}`}
                className={`${mono} shrink-0 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                  active ? "border-acid bg-acid/15 text-acid" : "border-line text-bone-dim hover:text-bone"
                }`}
              >
                {t.name.split(" ")[0]}
              </Link>
            );
          })}
        </div>

        {nRounds === 0 ? (
          <p className={`${mono} px-5 py-10 text-center text-[11px] uppercase tracking-widest text-bone-dim`}>
            Nessuna gara disputata.
          </p>
        ) : (
          <>
            <p className={`${mono} px-4 pb-2 text-[10px] uppercase tracking-widest text-acid`}>
              {m.team.name} · {m.grandTotal} pt
            </p>

            <div className="overflow-x-auto">
              <table className="w-max border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-carbon-950 px-3 py-2 text-left">
                      <span className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>Pezzo</span>
                    </th>
                    <th className="bg-carbon-950 px-2 py-2">
                      <span className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>Tot</span>
                    </th>
                    {m.rounds.map((r) => (
                      <th key={r.round_no} className="px-1 py-2">
                        <Link
                          href={`/report/${r.round_no}?team=${teamId}`}
                          className={`${mono} block min-w-[38px] text-center text-[9px] uppercase tracking-wider text-bone-dim hover:text-acid`}
                        >
                          <span className="block font-bold text-bone">{r.code ?? `R${r.round_no}`}</span>
                          <span className="block">R{r.round_no}</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((row) => {
                    const max = Math.max(1, ...row.points);
                    return (
                      <tr key={row.key}>
                        <th className="sticky left-0 z-10 border-t border-line/40 bg-carbon-950 px-3 py-2 text-left">
                          <span className="block whitespace-nowrap text-xs font-semibold text-bone">{row.label}</span>
                          {row.componentNames.length > 0 && (
                            <span className={`${mono} block max-w-[140px] truncate text-[9px] text-bone-dim`}>
                              {row.componentNames.join(" → ")}
                            </span>
                          )}
                        </th>
                        <td className="border-t border-line/40 px-2 py-2 text-right">
                          <span className={`${mono} text-sm font-bold text-acid`}>{row.total}</span>
                        </td>
                        {row.points.map((p, i) => (
                          <td
                            key={i}
                            className="border-t border-line/40 px-1 py-2 text-center"
                            style={p > 0 ? { backgroundColor: `rgba(198,255,58,${0.06 + 0.22 * (p / max)})` } : undefined}
                          >
                            <span className={`${mono} text-xs ${p > 0 ? "text-bone" : "text-bone-dim/40"}`}>
                              {p > 0 ? p : "·"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr>
                    <th className="sticky left-0 z-10 border-t-2 border-line bg-carbon-950 px-3 py-2 text-left">
                      <span className={`${mono} text-[10px] uppercase tracking-widest text-acid`}>Totale gara</span>
                    </th>
                    <td className="border-t-2 border-line px-2 py-2 text-right">
                      <span className={`${mono} text-sm font-bold text-acid`}>{m.grandTotal}</span>
                    </td>
                    {m.columnTotals.map((p, i) => (
                      <td key={i} className="border-t-2 border-line px-1 py-2 text-center">
                        <span className={`${mono} text-xs font-bold text-bone`}>{p}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <p className={`${mono} px-4 pt-3 text-[10px] leading-relaxed tracking-wider text-bone-dim`}>
              Tocca una gara in alto per vedere il dettaglio di quel round.
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
