import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/LogoutButton";
import { Screen, Main, Card, Label, Btn } from "@/components/ui";
import type { Me, SeasonInfo, StandingsResult } from "@/lib/types";

const LINKS = [
  { href: "/report", label: "Report" },
  { href: "/bacheca", label: "Bacheca" },
  { href: "/impostazioni", label: "Regole" },
  { href: "/profilo", label: "Profilo" },
];

export default async function HomePage() {
  // serverFetch reindirizza a /login se non autenticato
  const me = await serverFetch<Me>("/auth/me");

  const [season, standings, myTeam] = await Promise.all([
    serverFetch<SeasonInfo>("/season/current").catch(() => null),
    serverFetch<StandingsResult>("/standings/current").catch(() => null),
    serverFetch<{ teamId: string; name: string }>("/report/my-team").catch(() => null),
  ]);

  const teams = standings?.teams ?? [];
  const myIndex = myTeam ? teams.findIndex((t) => t.teamId === myTeam.teamId) : -1;
  const mine = myIndex >= 0 ? teams[myIndex] : null;
  const leader = teams[0];
  const gap = mine && leader ? leader.total - mine.total : 0;
  const ultimoRound = standings?.rounds.at(-1);

  return (
    <Screen>
      <header className="relative overflow-hidden border-b border-line/70 px-5 pb-4 pt-4">
        {/* Titolo sopra, collegamenti sotto: su schermo stretto affiancarli spezzava
            il titolo su tre righe. */}
        <div className="relative">
          <Label className="text-acid-deep">FantaFormula1 · {season?.year ?? 2026}</Label>
          <h1
            className="mt-0.5 truncate font-semibold uppercase leading-none tracking-wide text-bone"
            style={{ fontSize: "var(--text-3xl)" }}
          >
            Box <span className="text-acid">{me.name}</span>
          </h1>
          <div className="mt-3 flex items-center gap-4 border-t border-line/50 pt-2.5">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="label transition-colors hover:text-acid"
                style={{ transitionDuration: "var(--dur-1)" }}
              >
                {l.label}
              </Link>
            ))}
            <span className="ml-auto">
              <LogoutButton />
            </span>
          </div>
        </div>
      </header>

      <Main width="md" className="space-y-5">
        {/* ── la tua posizione: il dato che interessa appena apri ── */}
        {mine ? (
          <Link href={`/squadra/${mine.teamId}`} className="block">
            <Card tone="hi" accent chamfer className="rise px-5 pb-4 pt-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <Label>La tua scuderia</Label>
                  <p
                    className="mt-0.5 truncate font-semibold uppercase leading-tight tracking-wide text-bone"
                    style={{ fontSize: "var(--text-lg)" }}
                  >
                    {mine.name}
                  </p>
                  <p className="label mt-2 tracking-wider">
                    {myIndex === 0 ? "in testa al mondiale" : `−${gap} dal leader`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num digit-glow font-bold leading-[0.85] text-acid" style={{ fontSize: "var(--text-4xl)" }}>
                    {mine.total}
                  </p>
                  <p className="num mt-1 text-sm text-bone-dim">{myIndex + 1}° su {teams.length}</p>
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Card tone="hi" chamfer className="px-5 py-6 text-center">
            <p className="label leading-relaxed">Nessuna scuderia collegata al tuo profilo.</p>
          </Card>
        )}

        {/* ── stato della stagione ── */}
        {season && (
          <div className="flex items-center justify-between px-1">
            <Label>Stagione {season.year}</Label>
            <span className="num text-sm text-bone-dim">
              <span className="text-acid">{season.roundsScored}</span> / {season.total_rounds} gare
            </span>
          </div>
        )}

        {/* ── i round disputati ── */}
        {standings && standings.rounds.length > 0 && (
          <section>
            <Label>Round disputati</Label>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {standings.rounds.map((r) => (
                <Link
                  key={r.round_no}
                  href={`/report/${r.round_no}`}
                  className="panel flex shrink-0 flex-col items-center rounded-lg px-3 py-2 text-bone-dim transition-colors hover:border-acid hover:text-acid"
                  style={{ transitionDuration: "var(--dur-1)" }}
                >
                  <span className="num text-sm font-bold text-bone">{r.code ?? `R${r.round_no}`}</span>
                  <span className="num text-[10px]">R{r.round_no}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── azioni ── */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Btn href="/inserisci" variant="outline">
            Inserisci gara
          </Btn>
          <Btn href={ultimoRound ? `/report/${ultimoRound.round_no}` : "/report"} variant="quiet">
            Ultimo report
          </Btn>
        </div>
      </Main>

      <BottomNav />
    </Screen>
  );
}
