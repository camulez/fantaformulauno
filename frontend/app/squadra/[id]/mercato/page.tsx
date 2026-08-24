import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { MarketForm } from "@/components/MarketForm";
import { SostituzioneForm } from "@/components/SostituzioneForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, ReferenceData, RosterHistoryRow } from "@/lib/types";

export default async function MercatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, hist, cur] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ history: RosterHistoryRow[] }>(`/roster/team/${id}/history`),
    serverFetch<{ current: Record<string, string> }>(`/roster/team/${id}`),
  ]);

  return (
    <Screen>
      <PageHeader
        back={`/squadra/${id}`}
        backLabel="Squadra"
        title="Mercato e sostituzioni"
        subtitle="Art. II · piloti che non corrono, e trasferimenti datati"
      />

      <Main width="md" className="space-y-5">
        {/* Art. II viene prima: è il caso che capita davvero durante la stagione. */}
        <SostituzioneForm
          teamId={id}
          components={ref.components}
          rounds={ref.rounds}
          rosterAttuale={cur.current}
        />

        <MarketForm teamId={id} components={ref.components} rounds={ref.rounds} initialHistory={hist.history} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
