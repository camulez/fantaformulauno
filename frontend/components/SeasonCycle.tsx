"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import type { SeasonInfo } from "@/lib/types";

export function SeasonCycle({ season }: { season: SeasonInfo | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!season) return null;
  const closed = season.status === "closed";

  async function run(key: string, path: string, confirmMsg: string) {
    if (busy) return;
    if (!confirm(confirmMsg)) return;
    setBusy(key);
    setMsg(null);
    setError(null);
    try {
      const r = await clientFetch<{ champion?: string; tmCup?: string; year?: number; archived?: number }>(path, {
        method: "POST",
        body: "{}",
      });
      if (r.champion) setMsg(`Stagione ${r.year} archiviata · Campione ${r.champion} · Coppa TM ${r.tmCup}`);
      else if (path.endsWith("new-season")) setMsg(`Stagione ${r.year} creata`);
      else setMsg("Fatto");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "w-full rounded-lg px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest transition-opacity disabled:opacity-40";

  return (
    <div className="panel accent-bar rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-acid">
          Ciclo stagionale
        </p>
        <span className="rounded-full border border-line px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          {season.year} · {closed ? "chiusa" : season.status}
        </span>
      </div>

      {!closed ? (
        <button
          onClick={() =>
            run(
              "close",
              "/rollover/close",
              `Chiudere la stagione ${season.year} e archiviare campione, Coppa TM e piazzamenti nell'albo d'oro?`
            )
          }
          disabled={busy !== null}
          className={`${btn} bg-acid text-carbon-950`}
        >
          {busy === "close" ? "Archiviazione…" : `Chiudi e archivia stagione ${season.year}`}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() =>
              run("reopen", "/rollover/reopen", `Riaprire la stagione ${season.year} per correzioni?`)
            }
            disabled={busy !== null}
            className={`${btn} border border-line text-bone hover:border-acid`}
          >
            {busy === "reopen" ? "…" : `Riapri stagione ${season.year}`}
          </button>
          <button
            onClick={() =>
              run(
                "new",
                "/rollover/new-season",
                `Aprire la stagione ${season.year + 1}? Erediterà regole e squadre (budget azzerato) e diventerà la stagione corrente. La ${season.year} resterà consultabile nello storico.`
              )
            }
            disabled={busy !== null}
            className={`${btn} bg-acid text-carbon-950`}
          >
            {busy === "new" ? "Creazione…" : `Apri stagione ${season.year + 1}`}
          </button>
        </div>
      )}

      {msg && <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-acid">{msg}</p>}
      {error && <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
      <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed tracking-wider text-bone-dim">
        La chiusura calcola classifica finale, campione e Coppa TM dai risultati e li scrive nell'albo. È ripetibile e
        correggibile (riapri, poi richiudi).
      </p>
    </div>
  );
}
