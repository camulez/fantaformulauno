import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { RulesForm } from "@/components/RulesForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, ScoringRules } from "@/lib/types";

// Registro strumento: densa di campi, il budget va tutto sulla leggibilità.
export default async function ImpostazioniPage() {
  await serverFetch<Me>("/auth/me");
  const { config } = await serverFetch<{ config: ScoringRules }>("/season/rules");

  return (
    <Screen>
      <PageHeader
        back="/"
        backLabel="Home"
        title="Matrice punteggi"
        subtitle="I valori applicati dal motore · il testo è nel Regolamento"
      />

      <Main width="md">
        <RulesForm initial={config} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
