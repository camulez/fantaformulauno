import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { RosterForm } from "@/components/RosterForm";
import type { Me, ReferenceData } from "@/lib/types";

export default async function ModificaRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, cur] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ current: Record<string, string> }>(`/roster/team/${id}`),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href={`/squadra/${id}`} className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Squadra
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Modifica roster</h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <RosterForm teamId={id} components={ref.components} current={cur.current} />
      </main>

      <BottomNav />
    </div>
  );
}
