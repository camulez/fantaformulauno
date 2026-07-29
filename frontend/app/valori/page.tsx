import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ValuesEditor } from "@/components/ValuesEditor";
import type { Me } from "@/lib/types";

export default async function ValoriPage() {
  await serverFetch<Me>("/auth/me");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/asta" className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Asta
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Listino valori</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Prezzi base d&apos;asta · intensità ∝ valore
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <ValuesEditor />
      </main>

      <BottomNav />
    </div>
  );
}
