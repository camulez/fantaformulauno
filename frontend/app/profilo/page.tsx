import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { ProfileForm } from "@/components/ProfileForm";
import type { Me } from "@/lib/types";

export default async function ProfiloPage() {
  const me = await serverFetch<Me>("/auth/me");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/" className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">Profilo</h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        <ProfileForm currentName={me.name} />
      </main>

      <BottomNav />
    </div>
  );
}
