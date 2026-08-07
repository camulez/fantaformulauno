import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, Card, Label, Empty, Btn } from "@/components/ui";
import type { Me, SeasonInfo, StandingsResult } from "@/lib/types";

/**
 * Registro vetrina. Composizione non lineare: il leader non è una riga come le altre,
 * è un blocco a sé; il resto della griglia è una torre dei tempi che si accende in cascata.
 */
export default async function ClassificaPage() {
  await serverFetch<Me>("/auth/me"); // gate

  const [standings, season] = await Promise.all([
    serverFetch<StandingsResult>("/standings/current"),
    serverFetch<SeasonInfo>("/season/current").catch(() => null),
  ]);

  const teams = standings.teams;
  const leader = teams[0];
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
    <Screen>
      <header className="relative overflow-hidden border-b border-line/70 px-5 pb-4 pt-4">
        <span
          aria-hidden
          className="num pointer-events-none absolute -right-2 -top-4 select-none font-bold leading-none text-bone/[0.04]"
          style={{ fontSize: "var(--text-5xl)" }}
        >
          {season?.year ?? 2026}
        </span>
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <Label className="text-acid-deep">FantaFormula1 · {season?.year ?? 2026}</Label>
            <h1
              className="mt-0.5 font-semibold uppercase leading-none tracking-wide text-bone"
              style={{ fontSize: "var(--text-3xl)" }}
            >
              Mondiale
            </h1>
          </div>
          <span className="num shrink-0 text-sm text-bone-dim">
            R{disputed}
            {season ? ` / ${season.total_rounds}` : ""}
          </span>
        </div>
      </header>

      <Main width="md">
        {teams.length === 0 ? (
          <Empty
            title="Nessun risultato"
            action={<Btn href="/inserisci">Inserisci una gara</Btn>}
          >
            La classifica si popola appena inserisci il primo Gran Premio.
          </Empty>
        ) : (
          <>
            {/* ── il leader: blocco a sé, non una riga fra le altre ── */}
            {leader && (
              <Link href={`/squadra/${leader.teamId}`} className="block">
                <Card tone="hi" accent chamfer className="rise px-5 pb-4 pt-4">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <Label className="text-acid">Leader</Label>
                      <p
                        className="mt-0.5 truncate font-semibold uppercase leading-tight tracking-wide text-bone"
                        style={{ fontSize: "var(--text-xl)" }}
                      >
                        {leader.name}
                      </p>
                      <p className="label mt-2 tracking-wider">
                        <span className="num text-bone-dim">{leader.gpWins}</span> GP vinti
                      </p>
                    </div>
                    <p
                      className="num digit-glow shrink-0 font-bold leading-[0.85] text-acid"
                      style={{ fontSize: "var(--text-4xl)" }}
                    >
                      {leader.total}
                    </p>
                  </div>
                </Card>
              </Link>
            )}

            {/* ── gli inseguitori: torre dei tempi ── */}
            <ol className="ignite mt-3 space-y-1.5">
              {teams.slice(1).map((t, i) => {
                const gap = (leader?.total ?? 0) - t.total;
                const width = leader && leader.total > 0 ? Math.round((t.total / leader.total) * 100) : 0;
                return (
                  <li key={t.teamId}>
                    <Link href={`/squadra/${t.teamId}`} className="panel flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <span className="num w-6 text-center text-lg font-bold text-bone-dim">{i + 2}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold uppercase tracking-wide text-bone">{t.name}</p>
                        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-carbon-950">
                          <div className="h-full rounded-full bg-bone-dim/50" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-lg font-bold leading-none text-bone">{t.total}</p>
                        <p className="num mt-1 text-[10px] text-bone-dim">−{gap}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>

            {/* ── Coppa Team Manager ── */}
            <section className="mt-7">
              <Label>Coppa Team Manager</Label>
              <Card className="mt-2 px-4 py-1">
                <ul className="ignite">
                  {tmCup.map((t, i) => (
                    <li key={t.teamId} className="data-row flex items-center gap-3 py-2">
                      <span className={`num w-5 text-center text-sm font-bold ${i === 0 ? "text-acid" : "text-bone-dim"}`}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-bone">{t.name}</span>
                      <span className="num text-sm font-bold text-bone">{t.breakdown.teamManager}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
