import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { DrsForm } from "@/components/DrsForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, ReferenceData } from "@/lib/types";

export default async function DrsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  const [ref, drs] = await Promise.all([
    serverFetch<ReferenceData>("/reference/current"),
    serverFetch<{ current: Record<number, string>; max: number }>(`/drs/team/${id}`),
  ]);

  return (
    <Screen>
      <PageHeader
        back={`/squadra/${id}`}
        backLabel="Squadra"
        title="DRS"
        subtitle="Raddoppia i punti Gara di un componente"
      />

      <Main width="md">
        <DrsForm teamId={id} rounds={ref.rounds} current={drs.current} max={drs.max} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
