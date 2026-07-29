import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { MarketForm } from "@/components/MarketForm";
import type { Me, ReferenceData, RosterHistoryRow } from "@/lib/types";

export default async function MercatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, hist] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ history: RosterHistoryRow[] }>(`/roster/team/${id}/history`),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link
          href={`/squadra/${id}`}
          className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid"
        >
          ← Squadra
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Mercato</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Trasferimenti in stagione con validità dal round
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <MarketForm teamId={id} components={ref.components} rounds={ref.rounds} initialHistory={hist.history} />
      </main>

      <BottomNav />
    </div>
  );
}
