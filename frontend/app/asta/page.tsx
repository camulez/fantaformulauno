import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { AuctionRoom } from "@/components/auction/AuctionRoom";
import { Screen, Main, PageHeader, Btn } from "@/components/ui";
import type { Me } from "@/lib/types";

export default async function AstaPage() {
  await serverFetch<Me>("/auth/me");

  return (
    <Screen>
      <PageHeader
        kicker="FantaFormula1"
        title="Asta"
        subtitle="Offerte su carta · il tabellone compone i garage"
        size="lg"
        action={
          <Btn href="/valori" variant="outline">
            Valori
          </Btn>
        }
      />

      <Main width="lg">
        <AuctionRoom />
      </Main>

      <BottomNav />
    </Screen>
  );
}
