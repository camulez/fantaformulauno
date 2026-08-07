"use client";

import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Chip, DataRow, Label, Note, Section, fieldCls, StickyBar } from "@/components/ui";
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
    return <p className="note mt-10 text-center">Caricamento…</p>;
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

  return (
    <div className="space-y-4 pb-28">
      {/* Stato */}
      <div className="flex items-center justify-between">
        <Chip tone={approved ? "acid" : "quiet"}>{approved ? "● Approvato" : "○ Bozza modificabile"}</Chip>
        {auctionActive && <Label className="text-acid-deep">Asta in corso</Label>}
      </div>

      {KIND_ORDER.map((kind) => {
        const rows = components.filter((c) => c.kind === kind);
        if (rows.length === 0) return null;
        return (
          <Section key={kind} title={KIND_LABEL[kind]} className="rounded-xl">
            <ul>
              {rows.map((c) => {
                const taken = !!c.assignedTo;
                return (
                  <DataRow key={c.id} className={`flex items-center gap-3 py-1.5 ${taken ? "opacity-40" : ""}`}>
                    {/* chip intensità: acceso quanto vale il pezzo */}
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border"
                      style={tileStyle(ACID, c.basePrice, maxBase)}
                      title={`valore ${c.basePrice}`}
                    />
                    <span className={`min-w-0 flex-1 truncate text-sm text-bone ${taken ? "line-through" : ""}`}>
                      {c.name}
                      {taken && <span className="num ml-2 text-[10px] text-acid-deep">→ {c.owner}</span>}
                    </span>
                    {approved || taken ? (
                      <span className="num w-16 text-right text-sm text-acid">{c.basePrice}</span>
                    ) : (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={valueOf(c)}
                        onChange={(e) => setEdited((p) => ({ ...p, [c.id]: e.target.value }))}
                        className={`${fieldCls} num w-16 bg-carbon-950 px-2 py-1 text-right text-sm`}
                      />
                    )}
                  </DataRow>
                );
              })}
            </ul>
          </Section>
        );
      })}

      {/* Barra azioni */}
      <StickyBar width="lg">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/95 p-2 backdrop-blur">
          {approved ? (
            <Btn onClick={reopen} disabled={busy} variant="quiet" className="flex-1">
              {busy ? "…" : "Riapri listino"}
            </Btn>
          ) : (
            <>
              <Btn onClick={save} disabled={busy} variant="outline" className="flex-1">
                {busy ? "…" : "Salva valori"}
              </Btn>
              <Btn onClick={approve} disabled={busy} className="flex-1">
                Approva
              </Btn>
            </>
          )}
        </div>
        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
      </StickyBar>
    </div>
  );
}
