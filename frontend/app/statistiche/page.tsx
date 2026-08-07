import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { CategoryDonuts } from "@/components/charts/CategoryDonuts";
import { HeadToHead } from "@/components/HeadToHead";
import { Screen, Main, PageHeader, Section, DataTable, Empty, Btn } from "@/components/ui";
import { teamColor } from "@/lib/chartColors";
import { shortName as short } from "@/lib/shortName";
import type { Me, StandingsResult } from "@/lib/types";
import { BoltIcon, ChartIcon, FlagIcon } from "@/components/icons";

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
    <Screen>
      <PageHeader kicker="FantaFormula1" title="Dati" subtitle="Andamento, distribuzioni, record" size="lg" />

      <Main width="md" className="space-y-4">
        {teams.length === 0 ? (
          <Empty title="Nessun dato ancora" action={<Btn href="/inserisci">Inserisci una gara</Btn>}>
            I grafici si popolano appena c&apos;è il primo Gran Premio a referto.
          </Empty>
        ) : (
          <>
            {/* Legenda squadre */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {colored.map((t) => (
                <span key={t.teamId} className="label flex items-center gap-1.5 tracking-wider">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {short(t.name)}
                </span>
              ))}
            </div>

            <Section title="Andamento campionato">
              <CumulativeChart rounds={rounds} series={series} />
            </Section>

            <Section title="Distribuzione punti per categoria">
              <CategoryDonuts teams={donutTeams} groups={groups} />
            </Section>

            {/* Il solo blocco con l'acid su questa schermata: è il dato che si va a cercare. */}
            <Section title="Record">
              <ul className="ignite text-xs">
                <RecordRow
                  icon={<FlagIcon className="h-3.5 w-3.5" />}
                  label="Più GP vinti"
                  value={mostWins ? `${short(mostWins.name)} · ${mostWins.gpWins}` : "—"}
                />
                <RecordRow
                  icon={<BoltIcon className="h-3.5 w-3.5" />}
                  label="Miglior round"
                  value={bestRound.points > 0 ? `${bestRound.name} · ${bestRound.round} · +${bestRound.points}` : "—"}
                  highlight
                />
                <RecordRow
                  icon={<ChartIcon className="h-3.5 w-3.5" />}
                  label="Distacco leader-ultimo"
                  value={`${gap} pt`}
                />
              </ul>
            </Section>

            <Section title="Testa a testa">
              <HeadToHead teams={colored} />
            </Section>

            <Section title="Media · max · min (punti per round)">
              <DataTable head={["Squadra", "GP", "Media", "Max", "Min"]}>
                {colored.map((t) => {
                  const pr = t.perRound;
                  const media = pr.length ? Math.round(t.total / pr.length) : 0;
                  return (
                    <tr key={t.teamId} className="border-t border-line/50">
                      <td className="py-2 text-left text-bone">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: t.color }}
                        />
                        {short(t.name)}
                      </td>
                      <td className="py-2 text-right text-bone">{t.gpWins}</td>
                      <td className="py-2 text-right text-bone">{media}</td>
                      <td className="py-2 text-right font-bold text-bone">{pr.length ? Math.max(...pr) : 0}</td>
                      <td className="py-2 text-right text-bone-dim">{pr.length ? Math.min(...pr) : 0}</td>
                    </tr>
                  );
                })}
              </DataTable>
            </Section>
          </>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}

function RecordRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="data-row flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-1.5 text-bone-dim">
        {icon}
        {label}
      </span>
      <span className={`num font-bold ${highlight ? "text-acid" : "text-bone"}`}>{value}</span>
    </li>
  );
}
