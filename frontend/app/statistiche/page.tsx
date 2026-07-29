import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { CategoryDonuts } from "@/components/charts/CategoryDonuts";
import { HeadToHead } from "@/components/HeadToHead";
import { teamColor } from "@/lib/chartColors";
import type { Me, StandingsResult } from "@/lib/types";

const short = (name: string) => name.split(" ")[0];

export default async function StatistichePage() {
  await serverFetch<Me>("/auth/me");
  const standings = await serverFetch<StandingsResult>("/standings/current");
  const teams = standings.teams;
  const colored = teams.map((t, i) => ({ ...t, color: teamColor(i) }));
  const rounds = standings.rounds.map((r) => `R${r.round_no}`);

  const series = colored.map((t) => ({ name: t.name, color: t.color, values: t.cumulative }));
  const donutTeams = colored.map((t) => ({ name: short(t.name), color: t.color }));
  const groups = [
    { label: "Telaio + Motore", values: colored.map((t) => t.breakdown.telaio + t.breakdown.motore) },
    { label: "Piloti", values: colored.map((t) => t.breakdown.pilota1 + t.breakdown.pilota2) },
    { label: "Sponsor + Benzina", values: colored.map((t) => t.breakdown.sponsor + t.breakdown.benzina) },
  ];

  // Record
  let bestRound = { name: "—", round: "", points: 0 };
  for (const t of colored) {
    t.perRound.forEach((p, i) => {
      if (p > bestRound.points) bestRound = { name: short(t.name), round: rounds[i] ?? "", points: p };
    });
  }
  const mostWins = [...colored].sort((a, b) => b.gpWins - a.gpWins)[0];
  const gap = (colored[0]?.total ?? 0) - (colored[colored.length - 1]?.total ?? 0);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
          FantaFormula1
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">Dati</h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-5">
        {teams.length === 0 ? (
          <p className="mt-10 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
            Nessun dato ancora.
          </p>
        ) : (
          <>
            {/* Legenda squadre */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {colored.map((t) => (
                <span key={t.teamId} className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-bone-dim">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {short(t.name)}
                </span>
              ))}
            </div>

            {/* Andamento cumulativo */}
            <section className="panel rounded-lg p-3">
              <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Andamento campionato
              </h2>
              <CumulativeChart rounds={rounds} series={series} />
            </section>

            {/* Distribuzione per categoria */}
            <section className="panel rounded-lg p-3">
              <h2 className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Distribuzione punti per categoria
              </h2>
              <CategoryDonuts teams={donutTeams} groups={groups} />
            </section>

            {/* Record */}
            <section className="panel rounded-lg p-3">
              <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Record
              </h2>
              <ul className="space-y-1.5 font-[family-name:var(--font-mono)] text-xs">
                <li className="flex items-center justify-between">
                  <span className="text-bone-dim">🏁 Più GP vinti</span>
                  <span className="text-bone">{mostWins ? `${short(mostWins.name)} · ${mostWins.gpWins}` : "—"}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-bone-dim">⚡ Miglior round</span>
                  <span className="text-bone">
                    {bestRound.points > 0 ? `${bestRound.name} · ${bestRound.round} · +${bestRound.points}` : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-bone-dim">📊 Distacco leader-ultimo</span>
                  <span className="text-bone">{gap} pt</span>
                </li>
              </ul>
            </section>

            {/* Testa a testa */}
            <section className="panel rounded-lg p-3">
              <h2 className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Testa a testa
              </h2>
              <HeadToHead teams={colored} />
            </section>

            {/* Media / max / min per round */}
            <section className="panel rounded-lg p-3">
              <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Media · max · min (punti per round)
              </h2>
              <table className="w-full font-[family-name:var(--font-mono)] text-xs">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-bone-dim">
                    <th className="py-1 text-left font-normal">Squadra</th>
                    <th className="py-1 text-right font-normal">GP</th>
                    <th className="py-1 text-right font-normal">Media</th>
                    <th className="py-1 text-right font-normal">Max</th>
                    <th className="py-1 text-right font-normal">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {colored.map((t) => {
                    const pr = t.perRound;
                    const media = pr.length ? Math.round(t.total / pr.length) : 0;
                    return (
                      <tr key={t.teamId} className="border-t border-line/50">
                        <td className="py-1.5 text-left text-bone">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: t.color }} />
                          {short(t.name)}
                        </td>
                        <td className="py-1.5 text-right text-acid">{t.gpWins}</td>
                        <td className="py-1.5 text-right text-bone">{media}</td>
                        <td className="py-1.5 text-right text-acid">{pr.length ? Math.max(...pr) : 0}</td>
                        <td className="py-1.5 text-right text-bone-dim">{pr.length ? Math.min(...pr) : 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
