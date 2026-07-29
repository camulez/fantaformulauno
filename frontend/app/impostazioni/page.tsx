import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { RulesForm } from "@/components/RulesForm";
import type { Me, ScoringRules } from "@/lib/types";

export default async function ImpostazioniPage() {
  await serverFetch<Me>("/auth/me");
  const { config } = await serverFetch<{ config: ScoringRules }>("/season/rules");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Matrice punteggi</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Regole di assegnazione punti della stagione
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <RulesForm initial={config} />
      </main>

      <BottomNav />
    </div>
  );
}
