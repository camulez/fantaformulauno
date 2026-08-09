"use client";

import dynamic from "next/dynamic";

// Three.js viene caricato SOLO qui, lato client: non pesa sul bundle del resto dell'app.
const SimGame = dynamic(() => import("./SimGame"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-carbon-950">
      <p className="note uppercase tracking-[0.25em]">Carico il circuito…</p>
    </div>
  ),
});

export function SimLoader({
  roundNo,
  mode = "training",
  attemptsLeft,
}: {
  roundNo?: number;
  mode?: "timed" | "training";
  attemptsLeft?: number;
}) {
  return <SimGame roundNo={roundNo} mode={mode} attemptsLeft={attemptsLeft} />;
}
