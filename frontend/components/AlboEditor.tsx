"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Field, Label, Note, fieldCls } from "@/components/ui";
import type { AlboSeasonRow, PersonPublic } from "@/lib/types";
import { TrophyIcon } from "@/components/icons";

export function AlboEditor({
  people,
  initialSeasons,
}: {
  people: PersonPublic[];
  initialSeasons: AlboSeasonRow[];
}) {
  const [seasons, setSeasons] = useState<AlboSeasonRow[]>(initialSeasons);
  const [year, setYear] = useState<string>("");
  const [championId, setChampionId] = useState<string>("");
  const [tmCupId, setTmCupId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingYear, setEditingYear] = useState<number | null>(null);

  async function refresh() {
    const fresh = await clientFetch<{ seasons: AlboSeasonRow[] }>("/history/seasons");
    setSeasons(fresh.seasons);
  }

  function reset() {
    setYear("");
    setChampionId("");
    setTmCupId("");
    setEditingYear(null);
    setError(null);
  }

  function loadForEdit(s: AlboSeasonRow) {
    setYear(String(s.year));
    setChampionId(s.championId ?? "");
    setTmCupId(s.tmCupId ?? "");
    setEditingYear(s.year);
    setError(null);
  }

  async function save() {
    const y = parseInt(year, 10);
    if (!Number.isInteger(y) || y < 1990 || y > 2100) {
      setError("Inserisci un anno valido (1990–2100).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await clientFetch("/history/season", {
        method: "POST",
        body: JSON.stringify({
          year: y,
          championPersonId: championId || null,
          tmCupPersonId: tmCupId || null,
        }),
      });
      await refresh();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: AlboSeasonRow) {
    if (!confirm(`Eliminare la stagione ${s.year} dall'albo d'oro?`)) return;
    setError(null);
    try {
      await clientFetch(`/history/season/${s.year}`, { method: "DELETE" });
      await refresh();
      if (editingYear === s.year) reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nell'eliminazione");
    }
  }

  const selectCls = `${fieldCls} bg-carbon-950 text-sm`;

  return (
    <div className="space-y-5">
      {/* Form aggiungi/modifica */}
      <Card accent className="p-4">
        <Label className="text-acid">
          {editingYear ? `Modifica stagione ${editingYear}` : "Aggiungi stagione"}
        </Label>

        <div className="mt-3 space-y-3">
          <Field label="Anno">
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={editingYear !== null}
              placeholder="es. 2005"
              className={`${selectCls} num disabled:opacity-60`}
            />
          </Field>

          <Field label="Campione">
            <select value={championId} onChange={(e) => setChampionId(e.target.value)} className={selectCls}>
              <option value="">— nessuno —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vincitore Coppa Team Manager">
            <select value={tmCupId} onChange={(e) => setTmCupId(e.target.value)} className={selectCls}>
              <option value="">— nessuno —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Note tone="err">{error}</Note>

        <div className="mt-4 flex gap-2">
          <Btn onClick={save} disabled={saving} className="flex-1">
            {saving ? "…" : editingYear ? "Aggiorna" : "Salva"}
          </Btn>
          {editingYear !== null && (
            <Btn onClick={reset} variant="quiet">
              Annulla
            </Btn>
          )}
        </div>
      </Card>

      {/* Elenco stagioni */}
      <div>
        <Label>Stagioni in archivio</Label>
        {seasons.length === 0 ? (
          <p className="label mt-2 text-center">Nessuna stagione. Aggiungi la prima qui sopra.</p>
        ) : (
          <ul className="ignite mt-2 space-y-2">
            {seasons.map((s) => (
              <li key={s.id} className="panel flex items-center gap-3 rounded-lg px-4 py-3">
                <span className="num w-12 shrink-0 text-lg font-bold text-acid">{s.year}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm text-bone">
                    <TrophyIcon className="inline h-3.5 w-3.5 text-acid-deep" /> {s.championName ?? "—"}
                  </p>
                  <p className="note truncate">
                    Coppa TM: {s.tmCupName ?? "—"}
                    {s.mode === "live" && <span className="ml-2 text-acid">· live</span>}
                  </p>
                </div>
                <button
                  onClick={() => loadForEdit(s)}
                  className="label transition-colors hover:text-acid"
                  style={{ transitionDuration: "var(--dur-1)" }}
                >
                  Modifica
                </button>
                {s.mode === "summary" && (
                  <button
                    onClick={() => remove(s)}
                    className="label transition-colors hover:text-red"
                    style={{ transitionDuration: "var(--dur-1)" }}
                  >
                    Elimina
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
