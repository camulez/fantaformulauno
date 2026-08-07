import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Label, Empty, Btn } from "@/components/ui";
import type { Me, SeasonMatrix, StandingsResult } from "@/lib/types";

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
      <Screen>
        <PageHeader back="/" backLabel="Home" title="Report" />
        <Main width="md">
          <Empty title="Nessuna squadra disponibile" action={<Btn href="/">Torna alla griglia</Btn>}>
            Il report si costruisce sulla rosa di una scuderia: prima serve almeno una squadra in stagione.
          </Empty>
        </Main>
        <BottomNav />
      </Screen>
    );
  }

  const m = await serverFetch<SeasonMatrix>(`/report/season/${teamId}`);
  const nRounds = m.rounds.length;

  return (
    <Screen>
      <PageHeader back="/" backLabel="Home" title="Report" subtitle="Punti di ogni pezzo, gara per gara" />

      <Main width="full" className="px-0 pb-6 pt-0">
        {/* selettore scuderia */}
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {standings.teams.map((t) => {
            const active = t.teamId === teamId;
            return (
              <Link
                key={t.teamId}
                href={`/report?team=${t.teamId}`}
                className={`label shrink-0 rounded-full border px-3 py-1.5 transition-colors ${
                  active ? "border-acid bg-acid/15 text-acid" : "border-line hover:text-bone"
                }`}
                style={{ transitionDuration: "var(--dur-1)" }}
              >
                {t.name.split(" ")[0]}
              </Link>
            );
          })}
        </div>

        {nRounds === 0 ? (
          <div className="px-4">
            <Empty title="Nessuna gara disputata" action={<Btn href="/inserisci">Inserisci una gara</Btn>}>
              La tabella incrocia i tuoi pezzi con i round: serve almeno un Gran Premio a referto.
            </Empty>
          </div>
        ) : (
          <>
            <p className="label px-4 pb-2 text-acid">
              {m.team.name} · {m.grandTotal} pt
            </p>

            {/* Matrice pezzi × gare. Prima colonna fissa: su telefono 24 gare non ci stanno. */}
            <div className="overflow-x-auto">
              <table className="num w-max border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-carbon-950 px-3 py-2 text-left">
                      <Label>Pezzo</Label>
                    </th>
                    <th className="bg-carbon-950 px-2 py-2">
                      <Label>Tot</Label>
                    </th>
                    {m.rounds.map((r) => (
                      <th key={r.round_no} className="px-1 py-2">
                        <Link
                          href={`/report/${r.round_no}?team=${teamId}`}
                          className="label block min-w-[38px] text-center tracking-wider transition-colors hover:text-acid"
                          style={{ transitionDuration: "var(--dur-1)" }}
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
                          <span className="block whitespace-nowrap font-[family-name:var(--font-display)] text-xs font-semibold text-bone">
                            {row.label}
                          </span>
                          {row.componentNames.length > 0 && (
                            <span className="block max-w-[140px] truncate text-[9px] text-bone-dim">
                              {row.componentNames.join(" → ")}
                            </span>
                          )}
                        </th>
                        <td className="border-t border-line/40 px-2 py-2 text-right">
                          <span className="text-sm font-bold text-acid">{row.total}</span>
                        </td>
                        {row.points.map((p, i) => (
                          <td
                            key={i}
                            className="border-t border-line/40 px-1 py-2 text-center"
                            style={p > 0 ? { backgroundColor: `rgba(198,255,58,${0.06 + 0.22 * (p / max)})` } : undefined}
                          >
                            <span className={`text-xs ${p > 0 ? "text-bone" : "text-bone-dim/40"}`}>{p > 0 ? p : "·"}</span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr>
                    <th className="sticky left-0 z-10 border-t-2 border-line bg-carbon-950 px-3 py-2 text-left">
                      <Label className="text-acid">Totale gara</Label>
                    </th>
                    <td className="border-t-2 border-line px-2 py-2 text-right">
                      <span className="text-sm font-bold text-acid">{m.grandTotal}</span>
                    </td>
                    {m.columnTotals.map((p, i) => (
                      <td key={i} className="border-t-2 border-line px-1 py-2 text-center">
                        <span className="text-xs font-bold text-bone">{p}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="note px-4 pt-3">
              Tocca una gara in alto per vedere il dettaglio di quel round.
            </p>
          </>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
