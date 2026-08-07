"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Field, Note, fieldCls } from "@/components/ui";

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

  const pinCls = `${fieldCls} num text-center text-lg tracking-[0.4em]`;

  return (
    <div className="space-y-4">
      <Field label="Il tuo nome">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className={`${fieldCls} text-lg`}
        />
      </Field>

      <Field label="Nuovo PIN (opzionale, 4 cifre)">
        <input
          value={newPin}
          onChange={(e) => setNewPin(digits(e.target.value))}
          inputMode="numeric"
          placeholder="— — — —"
          className={pinCls}
        />
      </Field>

      <Field label="PIN attuale (per confermare)" tone="amber">
        <input
          value={currentPin}
          onChange={(e) => setCurrentPin(digits(e.target.value))}
          inputMode="numeric"
          placeholder="— — — —"
          className={pinCls}
        />
      </Field>

      <Btn onClick={save} disabled={saving} size="lg" full>
        {saving ? "Salvataggio…" : "Salva"}
      </Btn>
      <Note tone="ok">{msg}</Note>
      <Note tone="err">{error}</Note>
    </div>
  );
}
