"use client";

import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { PowerIcon } from "@/components/icons";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await clientFetch("/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <button
      onClick={logout}
      className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-red"
    >
      <PowerIcon className="h-3.5 w-3.5" />
      Esci
    </button>
  );
}
