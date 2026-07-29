import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import type { Me, RoundDetail } from "@/lib/types";

export default async function RoundPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  await serverFetch<Me>("/auth/me");

  let data: RoundDetail;
  try {
    data = await serverFetch<RoundDetail>(`/standings/round/${n}`);
  } catch {
    notFound();
  }

  const top = data!.teams[0]?.roundPoints ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/" className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Home
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
              GP fantasy
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">
              R{data!.round.round_no} · {data!.round.code}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
          Punti fatti in questo round
        </p>
        <ol className="space-y-2">
          {data!.teams.map((t, i) => {
            const isTop = i === 0 && top > 0;
            return (
              <li key={t.teamId} className="panel rounded-lg">
                <Link href={`/squadra/${t.teamId}`} className="flex items-center gap-3 px-3 py-3">
                  <span className={`w-6 text-center font-[family-name:var(--font-mono)] text-lg font-bold ${isTop ? "text-acid digit-glow" : "text-bone-dim"}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold uppercase tracking-wide ${isTop ? "text-acid" : "text-bone"}`}>
                      {t.name}
                    </p>
                    <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-bone-dim">
                      totale {t.cumulative}
                    </p>
                  </div>
                  <p className={`font-[family-name:var(--font-mono)] text-lg font-bold ${isTop ? "text-acid" : "text-bone"}`}>
                    +{t.roundPoints}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      </main>

      <BottomNav />
    </div>
  );
}
