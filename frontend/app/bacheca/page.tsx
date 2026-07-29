import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { MessageBoard } from "@/components/MessageBoard";
import type { Me, Message } from "@/lib/types";

export default async function BachecaPage() {
  await serverFetch<Me>("/auth/me");
  const { messages } = await serverFetch<{ messages: Message[] }>("/messages");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/" className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Bacheca</h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <MessageBoard initial={messages} />
      </main>

      <BottomNav />
    </div>
  );
}
