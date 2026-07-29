"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
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
      <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
        <span className="text-acid">{usedCount}</span> / {max} DRS · 1 per componente, 1 per round (solo punti Race)
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
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-xs text-bone">
                R{r.round_no} <span className="text-bone-dim">{r.code}</span>
              </span>
              <select
                value={val}
                onChange={(e) => setSel((p) => ({ ...p, [r.round_no]: e.target.value }))}
                className={`min-w-0 flex-1 rounded border bg-carbon-950 px-2 py-1.5 text-sm outline-none focus:border-acid ${
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
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4">
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-acid py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-widest text-carbon-950 transition-opacity disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : "Salva DRS"}
        </button>
        {msg && <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-xs text-acid">{msg}</p>}
        {error && <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
      </div>
    </div>
  );
}
