import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { AlboEditor } from "@/components/AlboEditor";
import { SeasonCycle } from "@/components/SeasonCycle";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { AlboSeasonRow, Me, PersonPublic, SeasonInfo } from "@/lib/types";

export default async function GestioneAlboPage() {
  await serverFetch<Me>("/auth/me");
  const people = await serverFetch<PersonPublic[]>("/auth/people");
  const { seasons } = await serverFetch<{ seasons: AlboSeasonRow[] }>("/history/seasons");
  let season: SeasonInfo | null = null;
  try {
    season = await serverFetch<SeasonInfo>("/season/current");
  } catch {
    season = null;
  }

  return (
    <Screen>
      <PageHeader
        back="/storico"
        backLabel="Albo d'oro"
        title="Gestisci albo"
        subtitle="Campione e Coppa TM per ogni stagione passata"
      />

      <Main width="md" className="space-y-5">
        <SeasonCycle season={season} />
        <AlboEditor people={people} initialSeasons={seasons} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
