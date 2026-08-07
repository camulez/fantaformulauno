"use client";

import { useEffect, useMemo, useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Field, Label, Note, Section, fieldCls, StickyBar } from "@/components/ui";
import type { Driver, ReferenceData, RoundResults } from "@/lib/types";
import { BoltIcon, CheckIcon } from "@/components/icons";

const RACE_POS = 10;
const SPRINT_POS = 8;

export function ResultsForm() {
  const [ref, setRef] = useState<ReferenceData | null>(null);
  const [roundNo, setRoundNo] = useState<number | null>(null);
  const [race, setRace] = useState<string[]>(Array(RACE_POS).fill(""));
  const [sprint, setSprint] = useState<string[]>(Array(SPRINT_POS).fill(""));
  const [pole, setPole] = useState("");
  const [markScored, setMarkScored] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<ReferenceData>("/reference/current")
      .then(setRef)
      .catch(() => setError("Impossibile caricare l'anagrafica"));
  }, []);

  const selected = useMemo(() => ref?.rounds.find((r) => r.round_no === roundNo) ?? null, [ref, roundNo]);
  const raceScale = ref?.rules.raceScale ?? [];
  const sprintScale = ref?.rules.sprintScale ?? [];
  const drivers = ref?.drivers ?? [];

  async function loadRound(n: number) {
    setRoundNo(n);
    setMsg(null);
    setError(null);
    setRace(Array(RACE_POS).fill(""));
    setSprint(Array(SPRINT_POS).fill(""));
    setPole("");
    try {
      const data = await clientFetch<RoundResults>(`/results/round/${n}`);
      const r = Array(RACE_POS).fill("") as string[];
      const s = Array(SPRINT_POS).fill("") as string[];
      for (const row of data.results) {
        if (row.session === "race") {
          const pos = row.position && row.position >= 1 && row.position <= RACE_POS ? row.position : raceScale.indexOf(row.fia_points) + 1;
          if (pos >= 1 && pos <= RACE_POS) r[pos - 1] = row.driver_id;
        } else {
          const pos = row.position && row.position >= 1 && row.position <= SPRINT_POS ? row.position : sprintScale.indexOf(row.fia_points) + 1;
          if (pos >= 1 && pos <= SPRINT_POS) s[pos - 1] = row.driver_id;
        }
      }
      setRace(r);
      setSprint(s);
      setPole(data.poleDriverId ?? "");
    } catch {
      setError("Errore nel caricamento del round");
    }
  }

  async function save() {
    if (!roundNo || saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    const results: { driver_id: string; session: "race" | "sprint"; position: number; fia_points: number }[] = [];
    race.forEach((d, i) => {
      if (d) results.push({ driver_id: d, session: "race", position: i + 1, fia_points: raceScale[i] ?? 0 });
    });
    if (selected?.has_sprint) {
      sprint.forEach((d, i) => {
        if (d) results.push({ driver_id: d, session: "sprint", position: i + 1, fia_points: sprintScale[i] ?? 0 });
      });
    }
    try {
      const res = await clientFetch<{ saved: number }>(`/results/round/${roundNo}`, {
        method: "PUT",
        body: JSON.stringify({ results, poleDriverId: pole || null, markScored }),
      });
      setMsg(`Salvato · ${res.saved} risultati`);
      const fresh = await clientFetch<ReferenceData>("/reference/current");
      setRef(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  if (error && !ref) {
    return <p className="num px-5 py-8 text-sm text-red">{error}</p>;
  }
  if (!ref) {
    return (
      <p className="note px-5 py-8">Caricamento anagrafica…</p>
    );
  }

  return (
    <div className="px-4 pb-28">
      <Label className="mb-2 mt-2 block">Scegli il round</Label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {ref.rounds.map((r) => {
          const active = r.round_no === roundNo;
          return (
            <button
              key={r.id}
              onClick={() => loadRound(r.round_no)}
              className={`num flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition-colors ${
                active ? "border-acid bg-acid/10 text-acid" : "border-line text-bone-dim hover:border-bone-dim hover:text-bone"
              }`}
              style={{ transitionDuration: "var(--dur-1)" }}
            >
              <span className="text-xs font-bold">R{r.round_no}</span>
              <span className="text-[9px] tracking-wider">
                {r.code}
                {r.has_sprint ? <BoltIcon className="ml-1 inline h-3 w-3 align-[-1px]" /> : null}
                {r.status === "scored" ? <CheckIcon className="ml-1 inline h-3 w-3 align-[-1px]" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {!selected && (
        <p className="note mt-8 text-center">Seleziona un round per inserire l&apos;ordine d&apos;arrivo.</p>
      )}

      {selected && (
        <>
          <div className="mt-4 mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold uppercase tracking-wide text-bone">
              R{selected.round_no} · {selected.name}
            </h2>
            {selected.has_sprint && (
              <Label className="text-acid">
                <BoltIcon className="mr-1 inline h-3 w-3 align-[-1px]" />
                Sprint
              </Label>
            )}
          </div>

          <div className="mb-4">
            <Field label="Punto Pole (miglior tempo in Qualifying)">
              <select value={pole} onChange={(e) => setPole(e.target.value)} className={`${fieldCls} text-sm`}>
                <option value="">— nessuna —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <PositionGrid title="Ordine d'arrivo — Race (Top 10)" scale={raceScale} values={race} drivers={drivers} onChange={setRace} />

          {selected.has_sprint && (
            <div className="mt-4">
              <PositionGrid title="Sprint (Top 8)" scale={sprintScale} values={sprint} drivers={drivers} onChange={setSprint} />
            </div>
          )}

          <label className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={markScored} onChange={(e) => setMarkScored(e.target.checked)} className="h-4 w-4 accent-[var(--acid)]" />
            <Label>Segna round come disputato</Label>
          </label>

          <StickyBar>
            <Btn onClick={save} disabled={saving} size="lg" full>
              {saving ? "Salvataggio…" : `Salva R${selected.round_no}`}
            </Btn>
            <Note tone="ok">{msg}</Note>
            <Note tone="err">{error}</Note>
          </StickyBar>
        </>
      )}
    </div>
  );
}

function PositionGrid({
  title,
  scale,
  values,
  drivers,
  onChange,
}: {
  title: string;
  scale: number[];
  values: string[];
  drivers: Driver[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Section title={title} className="rounded-lg">
      <div className="space-y-1">
        {values.map((val, i) => {
          const used = new Set(values.filter((_, j) => j !== i).filter(Boolean));
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="num w-6 shrink-0 text-xs font-bold text-bone-dim">P{i + 1}</span>
              <span className="num w-6 shrink-0 text-right text-xs text-acid">{scale[i] ?? 0}</span>
              <select
                value={val}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className="min-w-0 flex-1 rounded border border-line bg-carbon-950 px-2 py-1.5 text-sm text-bone outline-none focus:border-acid"
              >
                <option value="">—</option>
                {drivers
                  .filter((d) => !used.has(d.id) || d.id === val)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
