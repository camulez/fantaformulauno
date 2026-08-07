import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ProfileForm } from "@/components/ProfileForm";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me } from "@/lib/types";

export default async function ProfiloPage() {
  const me = await serverFetch<Me>("/auth/me");

  return (
    <Screen>
      <PageHeader back="/" backLabel="Home" title="Profilo" subtitle={me.name} />

      <Main width="md">
        <ProfileForm currentName={me.name} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
