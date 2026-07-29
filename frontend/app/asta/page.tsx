import { serverFetch } from "@/lib/api.server";
import { ComingSoon } from "@/components/ComingSoon";
import type { Me } from "@/lib/types";

export default async function AstaPage() {
  await serverFetch<Me>("/auth/me");
  return (
    <ComingSoon title="Asta" phase="F5">
      Asta a busta chiusa: Motore → Sponsor → Pilota 1 → Benzina → Telaio → Pilota 2.
    </ComingSoon>
  );
}
