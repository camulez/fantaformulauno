"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Note, StickyBar } from "@/components/ui";
import type { RoundInfo } from "@/lib/types";

const SLOT_LABEL: Record<string, string> = {
  telaio: "Telaio",
  motore: "Motore",
  pilota1: "Pilota 1",
  pilota2: "Pilota 2",
  sponsor: "Sponsor",
  benzina: "Benzina",
};
const SLOTS = Object.keys(SLOT_LABEL);

export function DrsForm({
  teamId,
  rounds,
  current,
  max,
}: {
  teamId: string;
  rounds: RoundInfo[];
  current: Record<number, string>;
  max: number;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<number, string>>(() => ({ ...current }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usedCount = useMemo(() => Object.values(sel).filter(Boolean).length, [sel]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    const declarations = Object.entries(sel)
      .filter(([, s]) => s)
      .map(([rn, s]) => ({ roundNo: Number(rn), slot: s }));
    try {
      const res = await clientFetch<{ saved: number }>(`/drs/team/${teamId}`, {
        method: "PUT",
        body: JSON.stringify({ declarations }),
      });
      setMsg(`Salvato · ${res.saved} DRS`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <p className="note mb-1">
        Il DRS <span className="text-acid">moltiplica ×2</span> i punti di Gara del pezzo su cui lo
        giochi: non aggiunge punti, raddoppia quelli che quel pezzo fa.
      </p>
      <p className="label mb-3">
        <span className="text-acid">{usedCount}</span> / {max} usati · uno per categoria, uno per gara ·
        le gare già corse sono bloccate
      </p>
      <div className="space-y-1.5">
        {rounds.map((r) => {
          const usedElsewhere = new Set(
            Object.entries(sel)
              .filter(([rn]) => Number(rn) !== r.round_no)
              .map(([, s]) => s)
              .filter(Boolean)
          );
          const val = sel[r.round_no] ?? "";
          // Gara già disputata: il DRS si dichiara PRIMA delle qualifiche, quindi qui non si
          // tocca più. Resta visibile — è storia — ma bloccato. Per correggerlo si riapre il
          // round da «Inserisci». Il server rifiuta comunque, questo evita di provarci.
          const corsa = r.status === "scored";
          return (
            <div key={r.id} className={`flex items-center gap-2 ${corsa ? "opacity-55" : ""}`}>
              <span className="num w-16 shrink-0 text-xs text-bone">
                R{r.round_no} <span className="text-bone-dim">{r.code}</span>
              </span>
              <select
                value={val}
                disabled={corsa}
                title={corsa ? "GP già disputato: il DRS non si cambia più" : undefined}
                onChange={(e) => setSel((p) => ({ ...p, [r.round_no]: e.target.value }))}
                className={`min-w-0 flex-1 rounded border bg-carbon-950 px-2 py-1.5 text-sm outline-none focus:border-acid disabled:cursor-not-allowed ${
                  val ? "border-acid/60 text-acid" : "border-line text-bone"
                }`}
              >
                <option value="">— nessun DRS —</option>
                {SLOTS.filter((s) => !usedElsewhere.has(s) || s === val).map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABEL[s]}
                  </option>
                ))}
              </select>
              {corsa && <span className="label shrink-0">corsa</span>}
            </div>
          );
        })}
      </div>

      <StickyBar>
        <Btn onClick={save} disabled={saving} size="lg" full>
          {saving ? "Salvataggio…" : "Salva DRS"}
        </Btn>
        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
      </StickyBar>
    </div>
  );
}
