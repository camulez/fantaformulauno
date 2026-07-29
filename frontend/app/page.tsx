import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/LogoutButton";
import type { Me, PersonPublic, SeasonInfo, StandingsResult } from "@/lib/types";

export default async function HomePage() {
  // Reindirizza a /login se non autenticato (serverFetch gestisce il 401).
  const me = await serverFetch<Me>("/auth/me");
  const people = await serverFetch<PersonPublic[]>("/auth/people");

  // Resiliente: se la colonna total_rounds non è ancora applicata, l'indicatore si nasconde.
  let season: SeasonInfo | null = null;
  try {
    season = await serverFetch<SeasonInfo>("/season/current");
  } catch {
    season = null;
  }
  let standings: StandingsResult | null = null;
  try {
    standings = await serverFetch<StandingsResult>("/standings/current");
  } catch {
    standings = null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line/70 px-5 py-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
            FantaFormula1 · 2026
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">
            Box <span className="text-acid">{me.name}</span>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-3">
            <Link
              href="/bacheca"
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-acid"
            >
              Bacheca
            </Link>
            <Link
              href="/profilo"
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-acid"
            >
              Profilo
            </Link>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.25em] text-bone-dim">
            Griglia {season?.year ?? 2026}
          </h2>
          <span className="rounded-full border border-line px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid">
            {season ? `R${season.roundsScored} / ${season.total_rounds}` : "Pre-season"}
          </span>
        </div>
        {season && (
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
            {season.roundsRemaining === season.total_rounds
              ? `Stagione non avviata · ${season.total_rounds} gare in calendario`
              : `${season.roundsRemaining} gare mancanti`}
          </p>
        )}

        {standings && standings.rounds.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
              Round disputati
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {standings.rounds.map((r) => (
                <Link
                  key={r.round_no}
                  href={`/round/${r.round_no}`}
                  className="flex shrink-0 flex-col items-center rounded-lg border border-line px-3 py-1.5 text-bone-dim transition-colors hover:border-acid hover:text-acid"
                >
                  <span className="font-[family-name:var(--font-mono)] text-xs font-bold">R{r.round_no}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-wider">{r.code}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <ol className="space-y-2">
          {people.map((p, i) => (
            <li
              key={p.id}
              className="rise panel flex items-center gap-4 rounded-lg px-4 py-3"
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <span className="w-6 font-[family-name:var(--font-mono)] text-lg font-bold text-bone-dim">
                {i + 1}
              </span>
              <span className="flex-1 text-lg font-semibold uppercase tracking-wide text-bone">
                {p.name}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-sm text-bone-dim">
                — pt
              </span>
            </li>
          ))}
        </ol>

        <Link
          href="/inserisci"
          className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-acid/40 bg-acid/5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-acid transition-colors hover:bg-acid/10"
        >
          + Inserisci risultati gara
        </Link>

        <p className="mt-6 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase leading-relaxed tracking-widest text-bone-dim">
          Campionato non ancora avviato.<br />
          Punti e classifica arriveranno dai risultati di gara.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
