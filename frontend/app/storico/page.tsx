import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import type { HistoryData, Me } from "@/lib/types";
import { TrophyIcon } from "@/components/icons";

export default async function StoricoPage() {
  await serverFetch<Me>("/auth/me");
  const { albo, titoli } = await serverFetch<HistoryData>("/history");

  const empty = albo.length === 0 && titoli.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-start justify-between border-b border-line/70 px-5 py-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
            FantaFormula1
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">Albo d'oro</h1>
        </div>
        <Link
          href="/storico/gestione"
          className="mt-1 rounded-lg border border-acid/40 bg-acid/5 px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-acid transition-colors hover:bg-acid/10"
        >
          Gestisci
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-5">
        {empty ? (
          <div className="panel accent-bar mt-6 rounded-xl px-5 py-10 text-center">
            <TrophyIcon className="mx-auto h-8 w-8 text-acid-deep" />
            <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase leading-relaxed tracking-widest text-bone-dim">
              Nessuna stagione in archivio.<br />
              Aggiungi i campioni delle stagioni passate<br />
              (campione + Coppa Team Manager).
            </p>
            <Link
              href="/storico/gestione"
              className="mt-5 inline-block rounded-lg border border-acid/40 bg-acid/5 px-5 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-acid transition-colors hover:bg-acid/10"
            >
              + Aggiungi stagione
            </Link>
          </div>
        ) : (
          <>
            {/* Albo d'oro per stagione */}
            <section>
              <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Stagioni
              </h2>
              <ul className="space-y-2">
                {albo.map((r) => (
                  <li key={r.year} className="panel flex items-center gap-3 rounded-lg px-4 py-3">
                    <span className="w-12 font-[family-name:var(--font-mono)] text-lg font-bold text-acid">{r.year}</span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm text-bone">
                        <span className="text-acid-deep">Campione:</span> {r.champion ?? "—"}
                      </p>
                      <p className="truncate font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-bone-dim">
                        Coppa TM: {r.tmCup ?? "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Titoli per persona */}
            <section>
              <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
                Titoli & bacheca
              </h2>
              <table className="w-full font-[family-name:var(--font-mono)] text-xs">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-bone-dim">
                    <th className="py-1 text-left font-normal">Persona</th>
                    <th className="py-1 text-right font-normal">Titoli</th>
                    <th className="py-1 text-right font-normal">Coppe TM</th>
                    <th className="py-1 text-right font-normal">Stagioni</th>
                  </tr>
                </thead>
                <tbody>
                  {titoli.map((t) => (
                    <tr key={t.name} className="border-t border-line/50">
                      <td className="py-1.5 text-left text-bone">{t.name}</td>
                      <td className="py-1.5 text-right text-acid">{t.championships}</td>
                      <td className="py-1.5 text-right text-bone">{t.tmCups}</td>
                      <td className="py-1.5 text-right text-bone-dim">{t.participations}</td>
                    </tr>
                  ))}
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
