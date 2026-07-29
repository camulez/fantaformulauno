"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";

export function ProfileForm({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const digits = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 4);

  async function save() {
    if (saving) return;
    setMsg(null);
    setError(null);
    const body: { currentPin: string; newName?: string; newPin?: string } = { currentPin };
    if (name.trim() && name.trim() !== currentName) body.newName = name.trim();
    if (newPin) body.newPin = newPin;
    if (!body.newName && !body.newPin) {
      setError("Nessuna modifica da salvare");
      return;
    }
    if (currentPin.length !== 4) {
      setError("Inserisci il PIN attuale (4 cifre)");
      return;
    }
    setSaving(true);
    try {
      await clientFetch("/auth/me", { method: "PUT", body: JSON.stringify(body) });
      setMsg("Salvato");
      setCurrentPin("");
      setNewPin("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Il tuo nome
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-lg text-bone outline-none focus:border-acid"
        />
      </label>

      <label className="block">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Nuovo PIN (opzionale, 4 cifre)
        </span>
        <input
          value={newPin}
          onChange={(e) => setNewPin(digits(e.target.value))}
          inputMode="numeric"
          placeholder="— — — —"
          className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-center font-[family-name:var(--font-mono)] text-lg tracking-[0.4em] text-bone outline-none focus:border-acid"
        />
      </label>

      <label className="block">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-amber">
          PIN attuale (per confermare)
        </span>
        <input
          value={currentPin}
          onChange={(e) => setCurrentPin(digits(e.target.value))}
          inputMode="numeric"
          placeholder="— — — —"
          className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-center font-[family-name:var(--font-mono)] text-lg tracking-[0.4em] text-bone outline-none focus:border-acid"
        />
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-acid py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-widest text-carbon-950 transition-opacity disabled:opacity-50"
      >
        {saving ? "Salvataggio…" : "Salva"}
      </button>
      {msg && <p className="text-center font-[family-name:var(--font-mono)] text-xs text-acid">{msg}</p>}
      {error && <p className="text-center font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
    </div>
  );
}
