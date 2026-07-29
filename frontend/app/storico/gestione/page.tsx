import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { AlboEditor } from "@/components/AlboEditor";
import { SeasonCycle } from "@/components/SeasonCycle";
import type { AlboSeasonRow, Me, PersonPublic, SeasonInfo } from "@/lib/types";

export default async function GestioneAlboPage() {
  await serverFetch<Me>("/auth/me");
  const people = await serverFetch<PersonPublic[]>("/auth/people");
  const { seasons } = await serverFetch<{ seasons: AlboSeasonRow[] }>("/history/seasons");
  let season: SeasonInfo | null = null;
  try {
    season = await serverFetch<SeasonInfo>("/season/current");
  } catch {
    season = null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link
          href="/storico"
          className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid"
        >
          ← Albo d'oro
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Gestisci albo</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Campione e Coppa TM per ogni stagione passata
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-5">
        <SeasonCycle season={season} />
        <AlboEditor people={people} initialSeasons={seasons} />
      </main>

      <BottomNav />
    </div>
  );
}
