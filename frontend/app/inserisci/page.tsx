import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ResultsForm } from "@/components/ResultsForm";
import type { Me } from "@/lib/types";

export default async function InserisciPage() {
  await serverFetch<Me>("/auth/me"); // gate: redirect a /login se non autenticato

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
          FantaFormula1
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">
          Inserisci risultati
        </h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1">
        <ResultsForm />
      </main>

      <BottomNav />
    </div>
  );
}
