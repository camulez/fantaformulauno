import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ResultsForm } from "@/components/ResultsForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me } from "@/lib/types";

// Registro strumento: il budget va sulla leggibilità del modulo, non sulla testata.
export default async function InserisciPage() {
  await serverFetch<Me>("/auth/me"); // gate: redirect a /login se non autenticato

  return (
    <Screen>
      <PageHeader
        back="/"
        backLabel="Home"
        kicker="FantaFormula1"
        title="Inserisci risultati"
        subtitle="Piloti per posizione · i punti si compilano da soli"
      />

      <Main width="md" className="px-0 py-0">
        <ResultsForm />
      </Main>

      <BottomNav />
    </Screen>
  );
}
