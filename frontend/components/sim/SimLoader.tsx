"use client";

import dynamic from "next/dynamic";

// Three.js viene caricato SOLO qui, lato client: non pesa sul bundle del resto dell'app.
const SimGame = dynamic(() => import("./SimGame"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-carbon-950">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-bone-dim">
        Carico il circuito…
      </p>
    </div>
  ),
});

export function SimLoader({ roundNo }: { roundNo?: number }) {
  return <SimGame roundNo={roundNo} />;
}
