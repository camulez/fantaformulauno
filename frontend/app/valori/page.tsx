import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ValuesEditor } from "@/components/ValuesEditor";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me } from "@/lib/types";

export default async function ValoriPage() {
  await serverFetch<Me>("/auth/me");

  return (
    <Screen>
      <PageHeader
        back="/asta"
        backLabel="Asta"
        title="Listino valori"
        subtitle="Prezzi base d'asta · intensità ∝ valore"
      />

      <Main width="lg">
        <ValuesEditor />
      </Main>

      <BottomNav />
    </Screen>
  );
}
