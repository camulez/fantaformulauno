"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import type { ComponentRef, RoundInfo, RosterHistoryRow } from "@/lib/types";

const SLOTS: { key: string; label: string; kind: ComponentRef["kind"] }[] = [
  { key: "telaio", label: "Telaio", kind: "telaio" },
  { key: "motore", label: "Motore", kind: "motore" },
  { key: "pilota1", label: "Pilota 1", kind: "pilota" },
  { key: "pilota2", label: "Pilota 2", kind: "pilota" },
  { key: "sponsor", label: "Sponsor", kind: "sponsor" },
  { key: "benzina", label: "Benzina", kind: "benzina" },
];
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.key, s.label]));

export function MarketForm({
  teamId,
  components,
  rounds,
  initialHistory,
}: {
  teamId: string;
  components: ComponentRef[];
  rounds: RoundInfo[];
  initialHistory: RosterHistoryRow[];
}) {
  const router = useRouter();
  const [history, setHistory] = useState<RosterHistoryRow[]>(initialHistory);
  const [slot, setSlot] = useState<string>("");
  const [componentId, setComponentId] = useState<string>("");
  const [fromRound, setFromRound] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kind = SLOTS.find((s) => s.key === slot)?.kind;
  const compOpts = kind ? components.filter((c) => c.kind === kind) : [];
  // Trasferimento datato: da R2 in poi (R1 = usa l'editor roster).
  const roundOpts = rounds.filter((r) => r.round_no >= 2).sort((a, b) => a.round_no - b.round_no);

  // Timeline raggruppata per slot.
  const bySlot = new Map<string, RosterHistoryRow[]>();
  for (const h of history) {
    const arr = bySlot.get(h.slot) ?? [];
    arr.push(h);
    bySlot.set(h.slot, arr);
  }
  const slotOrder = SLOTS.map((s) => s.key);
  const timeline = [...bySlot.entries()].sort(
    (a, b) => slotOrder.indexOf(a[0]) - slotOrder.indexOf(b[0])
  );

  async function transfer() {
    if (saving) return;
    if (!slot || !componentId || !fromRound) {
      setError("Compila slot, componente e round di validità.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await clientFetch(`/roster/team/${teamId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ slot, componentId, fromRound: parseInt(fromRound, 10) }),
      });
      const fresh = await clientFetch<{ history: RosterHistoryRow[] }>(`/roster/team/${teamId}/history`);
      setHistory(fresh.history);
      setMsg("Trasferimento registrato");
      setSlot("");
      setComponentId("");
      setFromRound("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel trasferimento");
    } finally {
      setSaving(false);
    }
  }

  const fieldCls =
    "mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-bone outline-none focus:border-acid";

  return (
    <div className="space-y-6">
      {/* Nuovo trasferimento */}
      <div className="panel accent-bar rounded-xl p-4">
        <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-acid">
          Nuovo trasferimento
        </p>

        <label className="block">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid-deep">
            Slot
          </span>
          <select
            value={slot}
            onChange={(e) => {
              setSlot(e.target.value);
              setComponentId("");
            }}
            className={fieldCls}
          >
            <option value="">— seleziona —</option>
            {SLOTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid-deep">
            Nuovo componente
          </span>
          <select
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            disabled={!slot}
            className={`${fieldCls} disabled:opacity-50`}
          >
            <option value="">— seleziona —</option>
            {compOpts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid-deep">
            Valido dal round
          </span>
          <select value={fromRound} onChange={(e) => setFromRound(e.target.value)} className={fieldCls}>
            <option value="">— seleziona —</option>
            {roundOpts.map((r) => (
              <option key={r.round_no} value={r.round_no}>
                R{r.round_no}
                {r.code ? ` · ${r.code}` : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={transfer}
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-acid py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-widest text-carbon-950 transition-opacity disabled:opacity-50"
        >
          {saving ? "Registrazione…" : "Registra trasferimento"}
        </button>
        {msg && <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-xs text-acid">{msg}</p>}
        {error && <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed tracking-wider text-bone-dim">
          I punti del vecchio componente valgono fino al round precedente; dal round scelto contano quelli del nuovo.
          Per la formazione di inizio stagione usa invece «Modifica roster».
        </p>
      </div>

      {/* Timeline assegnazioni */}
      <div>
        <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
          Storico assegnazioni
        </p>
        {timeline.length === 0 ? (
          <p className="text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
            Nessuna assegnazione registrata.
          </p>
        ) : (
          <ul className="space-y-3">
            {timeline.map(([slotKey, rows]) => (
              <li key={slotKey} className="panel rounded-lg px-4 py-3">
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid-deep">
                  {SLOT_LABEL[slotKey] ?? slotKey}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-bone">{r.name}</span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tracking-wider text-bone-dim">
                        R{r.fromRound}–{r.toRound == null ? "ora" : `R${r.toRound}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
