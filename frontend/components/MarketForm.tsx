"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Field, Label, Note, fieldCls } from "@/components/ui";
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

  const selectCls = `${fieldCls} text-sm`;

  return (
    <div className="space-y-6">
      {/* Nuovo trasferimento */}
      <Card accent className="p-4">
        <Label className="text-acid">Nuovo trasferimento</Label>

        <div className="mt-3 space-y-3">
          <Field label="Slot" tone="acid">
            <select
              value={slot}
              onChange={(e) => {
                setSlot(e.target.value);
                setComponentId("");
              }}
              className={selectCls}
            >
              <option value="">— seleziona —</option>
              {SLOTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nuovo componente" tone="acid">
            <select
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              disabled={!slot}
              className={`${selectCls} disabled:opacity-50`}
            >
              <option value="">— seleziona —</option>
              {compOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valido dal round" tone="acid">
            <select value={fromRound} onChange={(e) => setFromRound(e.target.value)} className={selectCls}>
              <option value="">— seleziona —</option>
              {roundOpts.map((r) => (
                <option key={r.round_no} value={r.round_no}>
                  R{r.round_no}
                  {r.code ? ` · ${r.code}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Btn onClick={transfer} disabled={saving} size="lg" full className="mt-4">
          {saving ? "Registrazione…" : "Registra trasferimento"}
        </Btn>
        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
        <p className="note mt-3">
          I punti del vecchio componente valgono fino al round precedente; dal round scelto contano quelli del nuovo.
          Per la formazione di inizio stagione usa invece «Modifica roster».
        </p>
      </Card>

      {/* Timeline assegnazioni */}
      <div>
        <Label>Storico assegnazioni</Label>
        {timeline.length === 0 ? (
          <p className="label mt-2 text-center">Nessuna assegnazione registrata.</p>
        ) : (
          <ul className="ignite mt-2 space-y-3">
            {timeline.map(([slotKey, rows]) => (
              <li key={slotKey} className="panel rounded-lg px-4 py-3">
                <Label className="text-acid-deep">{SLOT_LABEL[slotKey] ?? slotKey}</Label>
                <ul className="mt-1.5 space-y-1">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-bone">{r.name}</span>
                      <span className="num shrink-0 text-[11px] tracking-wider text-bone-dim">
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
