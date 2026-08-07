"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/api";
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

  const selectCls =
    "w-full rounded-lg border border-line bg-carbon-950 px-3 py-2 text-sm text-bone outline-none focus:border-acid";

  return (
    <div className="space-y-5">
      {/* Form aggiungi/modifica */}
      <div className="panel accent-bar rounded-xl p-4">
        <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-acid">
          {editingYear ? `Modifica stagione ${editingYear}` : "Aggiungi stagione"}
        </p>

        <label className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Anno
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={editingYear !== null}
          placeholder="es. 2005"
          className={`${selectCls} mb-3 disabled:opacity-60`}
        />

        <label className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Campione
        </label>
        <select value={championId} onChange={(e) => setChampionId(e.target.value)} className={`${selectCls} mb-3`}>
          <option value="">— nessuno —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim">
          Vincitore Coppa Team Manager
        </label>
        <select value={tmCupId} onChange={(e) => setTmCupId(e.target.value)} className={`${selectCls} mb-4`}>
          <option value="">— nessuno —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {error && <p className="mb-2 font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-acid px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-carbon-950 transition-opacity disabled:opacity-40"
          >
            {saving ? "…" : editingYear ? "Aggiorna" : "Salva"}
          </button>
          {editingYear !== null && (
            <button
              onClick={reset}
              className="rounded-lg border border-line px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-bone-dim transition-colors hover:text-acid"
            >
              Annulla
            </button>
          )}
        </div>
      </div>

      {/* Elenco stagioni */}
      <div>
        <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
          Stagioni in archivio
        </p>
        {seasons.length === 0 ? (
          <p className="text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
            Nessuna stagione. Aggiungi la prima qui sopra.
          </p>
        ) : (
          <ul className="space-y-2">
            {seasons.map((s) => (
              <li key={s.id} className="panel flex items-center gap-3 rounded-lg px-4 py-3">
                <span className="w-12 font-[family-name:var(--font-mono)] text-lg font-bold text-acid">{s.year}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm text-bone">
                    <TrophyIcon className="inline h-3.5 w-3.5 text-acid-deep" /> {s.championName ?? "—"}
                  </p>
                  <p className="truncate font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-bone-dim">
                    Coppa TM: {s.tmCupName ?? "—"}
                    {s.mode === "live" && <span className="ml-2 text-acid">· live</span>}
                  </p>
                </div>
                <button
                  onClick={() => loadForEdit(s)}
                  className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-acid"
                >
                  Modifica
                </button>
                {s.mode === "summary" && (
                  <button
                    onClick={() => remove(s)}
                    className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-red"
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
