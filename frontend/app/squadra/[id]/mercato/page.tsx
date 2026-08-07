import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { MarketForm } from "@/components/MarketForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, ReferenceData, RosterHistoryRow } from "@/lib/types";

export default async function MercatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, hist] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ history: RosterHistoryRow[] }>(`/roster/team/${id}/history`),
  ]);

  return (
    <Screen>
      <PageHeader
        back={`/squadra/${id}`}
        backLabel="Squadra"
        title="Mercato"
        subtitle="Trasferimenti in stagione con validità dal round"
      />

      <Main width="md">
        <MarketForm teamId={id} components={ref.components} rounds={ref.rounds} initialHistory={hist.history} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
