import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import type { Me, SeasonInfo, StandingsResult } from "@/lib/types";

export default async function ClassificaPage() {
  await serverFetch<Me>("/auth/me"); // gate

  const [standings, season] = await Promise.all([
    serverFetch<StandingsResult>("/standings/current"),
    serverFetch<SeasonInfo>("/season/current").catch(() => null),
  ]);

  const teams = standings.teams;
  const leader = teams[0]?.total ?? 0;
  const disputed = standings.rounds.length;

  // Coppa Team Manager: punti TM → somma punti Pilota → Race vinte → piazzamento.
  const tmCup = [...teams].sort((a, b) => {
    const tm = b.breakdown.teamManager - a.breakdown.teamManager;
    if (tm) return tm;
    const pil = b.breakdown.pilota1 + b.breakdown.pilota2 - (a.breakdown.pilota1 + a.breakdown.pilota2);
    if (pil) return pil;
    if (b.gpWins !== a.gpWins) return b.gpWins - a.gpWins;
    return b.total - a.total;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-end justify-between border-b border-line/70 px-5 py-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
            FantaFormula1 · {season?.year ?? 2026}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">
            Mondiale
          </h1>
        </div>
        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
          R{disputed}
          {season ? ` / ${season.total_rounds}` : ""}
        </span>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {teams.length === 0 ? (
          <p className="mt-10 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
            Nessun risultato ancora inserito.
          </p>
        ) : (
          <ol className="space-y-2">
            {teams.map((t, i) => {
              const gap = leader - t.total;
              const width = leader > 0 ? Math.round((t.total / leader) * 100) : 0;
              const top = i === 0;
              return (
                <li
                  key={t.teamId}
                  className="rise panel rounded-lg px-3 py-3"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <Link href={`/squadra/${t.teamId}`} className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center font-[family-name:var(--font-mono)] text-lg font-bold ${
                        top ? "text-acid digit-glow" : "text-bone-dim"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold uppercase tracking-wide ${
                          top ? "text-acid" : "text-bone"
                        }`}
                      >
                        {t.name}
                      </p>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-carbon-950">
                        <div
                          className={`h-full rounded-full ${top ? "bg-acid" : "bg-bone-dim/60"}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-[family-name:var(--font-mono)] text-lg font-bold ${
                          top ? "text-acid" : "text-bone"
                        }`}
                      >
                        {t.total}
                      </p>
                      <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-bone-dim">
                        {top ? "leader" : `−${gap}`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {teams.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
              Coppa Team Manager
            </h2>
            <ol className="space-y-1.5">
              {tmCup.map((t, i) => (
                <li key={t.teamId} className="panel flex items-center gap-3 rounded-lg px-3 py-2">
                  <span
                    className={`w-5 text-center font-[family-name:var(--font-mono)] text-sm font-bold ${
                      i === 0 ? "text-acid" : "text-bone-dim"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${i === 0 ? "text-acid" : "text-bone"}`}>
                    {t.name}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-bone">
                    {t.breakdown.teamManager}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
