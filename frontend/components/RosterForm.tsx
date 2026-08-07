"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Field, Note, fieldCls, StickyBar } from "@/components/ui";
import type { ComponentRef } from "@/lib/types";

const SLOTS: { key: string; label: string; kind: ComponentRef["kind"] }[] = [
  { key: "telaio", label: "Telaio", kind: "telaio" },
  { key: "motore", label: "Motore", kind: "motore" },
  { key: "pilota1", label: "Pilota 1", kind: "pilota" },
  { key: "pilota2", label: "Pilota 2", kind: "pilota" },
  { key: "sponsor", label: "Sponsor", kind: "sponsor" },
  { key: "benzina", label: "Benzina", kind: "benzina" },
];

export function RosterForm({
  teamId,
  components,
  current,
}: {
  teamId: string;
  components: ComponentRef[];
  current: Record<string, string>;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, string>>(() => ({
    telaio: current.telaio ?? "",
    motore: current.motore ?? "",
    pilota1: current.pilota1 ?? "",
    pilota2: current.pilota2 ?? "",
    sponsor: current.sponsor ?? "",
    benzina: current.benzina ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byKind = (kind: string) => components.filter((c) => c.kind === kind);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    const assignments = SLOTS.filter((s) => sel[s.key]).map((s) => ({ slot: s.key, componentId: sel[s.key] }));
    try {
      await clientFetch(`/roster/team/${teamId}`, { method: "PUT", body: JSON.stringify({ assignments }) });
      setMsg("Roster salvato");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pb-24">
      {SLOTS.map((s) => {
        const opts = byKind(s.kind).filter((c) => {
          if (s.key === "pilota1") return c.id !== sel.pilota2 || c.id === sel.pilota1;
          if (s.key === "pilota2") return c.id !== sel.pilota1 || c.id === sel.pilota2;
          return true;
        });
        return (
          <Field key={s.key} label={s.label} tone="acid">
            <select
              value={sel[s.key]}
              onChange={(e) => setSel((p) => ({ ...p, [s.key]: e.target.value }))}
              className={`${fieldCls} text-sm`}
            >
              <option value="">— seleziona —</option>
              {opts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        );
      })}

      <StickyBar>
        <Btn onClick={save} disabled={saving} size="lg" full>
          {saving ? "Salvataggio…" : "Salva roster"}
        </Btn>
        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
      </StickyBar>
    </div>
  );
}
