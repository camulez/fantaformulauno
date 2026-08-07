"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Chip, Label, Note } from "@/components/ui";
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

  return (
    <Card accent className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label className="text-acid">Ciclo stagionale</Label>
        <Chip>
          {season.year} · {closed ? "chiusa" : season.status}
        </Chip>
      </div>

      {!closed ? (
        <Btn
          onClick={() =>
            run(
              "close",
              "/rollover/close",
              `Chiudere la stagione ${season.year} e archiviare campione, Coppa TM e piazzamenti nell'albo d'oro?`
            )
          }
          disabled={busy !== null}
          full
        >
          {busy === "close" ? "Archiviazione…" : `Chiudi e archivia stagione ${season.year}`}
        </Btn>
      ) : (
        <div className="space-y-2">
          <Btn
            onClick={() => run("reopen", "/rollover/reopen", `Riaprire la stagione ${season.year} per correzioni?`)}
            disabled={busy !== null}
            variant="quiet"
            full
          >
            {busy === "reopen" ? "…" : `Riapri stagione ${season.year}`}
          </Btn>
          <Btn
            onClick={() =>
              run(
                "new",
                "/rollover/new-season",
                `Aprire la stagione ${season.year + 1}? Erediterà regole e squadre (budget azzerato) e diventerà la stagione corrente. La ${season.year} resterà consultabile nello storico.`
              )
            }
            disabled={busy !== null}
            full
          >
            {busy === "new" ? "Creazione…" : `Apri stagione ${season.year + 1}`}
          </Btn>
        </div>
      )}

      <Note tone="ok">{msg}</Note>
      <Note tone="err">{error}</Note>
      <p className="note mt-3">
        La chiusura calcola classifica finale, campione e Coppa TM dai risultati e li scrive nell&apos;albo. È ripetibile
        e correggibile (riapri, poi richiudi).
      </p>
    </Card>
  );
}
