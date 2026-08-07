import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { SimLoader } from "@/components/sim/SimLoader";
import type { Me } from "@/lib/types";

export default async function SimulatorePage() {
  await serverFetch<Me>("/auth/me");

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <SimLoader roundNo={8} />
      </main>
      <BottomNav />
    </div>
  );
}
