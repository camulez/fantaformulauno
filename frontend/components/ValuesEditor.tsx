"use client";

import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import type { AuctionKind, ComponentValue, ValuesPayload } from "@/lib/types";
import { tileStyle } from "@/lib/tileIntensity";

const KIND_ORDER: AuctionKind[] = ["telaio", "motore", "pilota", "sponsor", "benzina"];
const KIND_LABEL: Record<AuctionKind, string> = {
  telaio: "Telai",
  motore: "Motori",
  pilota: "Piloti",
  sponsor: "Sponsor",
  benzina: "Benzina",
};
const ACID = "#c6ff3a";

export function ValuesEditor() {
  const [data, setData] = useState<ValuesPayload | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await clientFetch<ValuesPayload>("/components/values");
      setData(res);
    } catch {
      /* ignora blip polling */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  if (!data) {
    return <p className="mt-10 text-center font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-bone-dim">Caricamento…</p>;
  }

  const { approved, auctionActive, components } = data;
  const maxBase = Math.max(0, ...components.map((c) => c.basePrice));
  const valueOf = (c: ComponentValue) => (edited[c.id] !== undefined ? edited[c.id] : String(c.basePrice));

  async function save() {
    const values = Object.entries(edited)
      .map(([id, v]) => ({ id, basePrice: parseInt(v, 10) }))
      .filter((x) => Number.isInteger(x.basePrice) && x.basePrice >= 0);
    if (values.length === 0) {
      setError("Nessuna modifica da salvare.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await clientFetch("/components/values", { method: "PUT", body: JSON.stringify({ values }) });
      setEdited({});
      await refresh();
      setMsg("Valori salvati");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (Object.keys(edited).length > 0 && !confirm("Ci sono modifiche non salvate: approvare comunque (verranno ignorate)?")) return;
    setBusy(true);
    setError(null);
    try {
      await clientFetch("/components/values/approve", { method: "POST", body: "{}" });
      setEdited({});
      await refresh();
      setMsg("Listino approvato · visibile a tutti");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      await clientFetch("/components/values/reopen", { method: "POST", body: "{}" });
      await refresh();
      setMsg("Listino riaperto");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest transition-opacity disabled:opacity-40";

  return (
    <div className="space-y-4 pb-28">
      {/* Stato */}
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full border px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest ${
            approved ? "border-acid/50 bg-acid/10 text-acid" : "border-line text-bone-dim"
          }`}
        >
          {approved ? "● Approvato" : "○ Bozza modificabile"}
        </span>
        {auctionActive && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid-deep">Asta in corso</span>
        )}
      </div>

      {KIND_ORDER.map((kind) => {
        const rows = components.filter((c) => c.kind === kind);
        if (rows.length === 0) return null;
        return (
          <section key={kind} className="panel rounded-xl p-3">
            <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-acid-deep">{KIND_LABEL[kind]}</p>
            <ul className="divide-y divide-line/40">
              {rows.map((c) => {
                const taken = !!c.assignedTo;
                return (
                  <li key={c.id} className={`flex items-center gap-3 py-1.5 ${taken ? "opacity-40" : ""}`}>
                    {/* chip intensità */}
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border"
                      style={tileStyle(ACID, c.basePrice, maxBase)}
                      title={`valore ${c.basePrice}`}
                    />
                    <span className={`min-w-0 flex-1 truncate text-sm text-bone ${taken ? "line-through" : ""}`}>
                      {c.name}
                      {taken && <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] text-acid-deep">→ {c.owner}</span>}
                    </span>
                    {approved || taken ? (
                      <span className="w-16 text-right font-[family-name:var(--font-mono)] text-sm text-acid">{c.basePrice}</span>
                    ) : (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={valueOf(c)}
                        onChange={(e) => setEdited((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="w-16 rounded-lg border border-line bg-carbon-950 px-2 py-1 text-right text-sm text-bone outline-none focus:border-acid"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Barra azioni */}
      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-2xl px-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/95 p-2 backdrop-blur">
          {approved ? (
            <button onClick={reopen} disabled={busy} className={`${btn} flex-1 border border-line text-bone hover:border-acid`}>
              {busy ? "…" : "Riapri listino"}
            </button>
          ) : (
            <>
              <button onClick={save} disabled={busy} className={`${btn} flex-1 bg-acid/90 text-carbon-950`}>
                {busy ? "…" : "Salva valori"}
              </button>
              <button onClick={approve} disabled={busy} className={`${btn} flex-1 bg-acid text-carbon-950`}>
                Approva
              </button>
            </>
          )}
        </div>
        {msg && <p className="mt-1 text-center font-[family-name:var(--font-mono)] text-xs text-acid">{msg}</p>}
        {error && <p className="mt-1 text-center font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
      </div>
    </div>
  );
}
