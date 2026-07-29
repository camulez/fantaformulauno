import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { AuctionRoom } from "@/components/auction/AuctionRoom";
import type { Me } from "@/lib/types";

export default async function AstaPage() {
  await serverFetch<Me>("/auth/me");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
          FantaFormula1
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">Asta</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Offerte su carta · il tabellone compone i garage
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <AuctionRoom />
      </main>

      <BottomNav />
    </div>
  );
}
