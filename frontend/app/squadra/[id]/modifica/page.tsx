import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { RosterForm } from "@/components/RosterForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, ReferenceData } from "@/lib/types";

export default async function ModificaRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, cur] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ current: Record<string, string> }>(`/roster/team/${id}`),
  ]);

  return (
    <Screen>
      <PageHeader
        back={`/squadra/${id}`}
        backLabel="Squadra"
        title="Modifica roster"
        subtitle="Setup a mano, valido dal primo round"
      />

      <Main width="md">
        <RosterForm teamId={id} components={ref.components} current={cur.current} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
