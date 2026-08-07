import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { MessageBoard } from "@/components/MessageBoard";
import { Screen, Main, PageHeader } from "@/components/ui";
import type { Me, Message } from "@/lib/types";

export default async function BachecaPage() {
  await serverFetch<Me>("/auth/me");
  const { messages } = await serverFetch<{ messages: Message[] }>("/messages");

  return (
    <Screen>
      <PageHeader back="/" backLabel="Home" title="Bacheca" subtitle="Il muretto dei box" />

      <Main width="md">
        <MessageBoard initial={messages} />
      </Main>

      <BottomNav />
    </Screen>
  );
}
