"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Note, fieldCls, StickyBar } from "@/components/ui";
import type { ScoringRules } from "@/lib/types";

export function RulesForm({ initial }: { initial: ScoringRules }) {
  const router = useRouter();
  const [r, setR] = useState<ScoringRules>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setScalar<K extends keyof ScoringRules>(k: K, v: ScoringRules[K]) {
    setR((p) => ({ ...p, [k]: v }));
  }
  function setScaleValue(key: "raceScale" | "sprintScale", i: number, v: number) {
    setR((p) => {
      const arr = [...p[key]];
      arr[i] = v;
      return { ...p, [key]: arr };
    });
  }
  function addPos(key: "raceScale" | "sprintScale") {
    setR((p) => ({ ...p, [key]: [...p[key], 0] }));
  }
  function removePos(key: "raceScale" | "sprintScale") {
    setR((p) => (p[key].length > 1 ? { ...p, [key]: p[key].slice(0, -1) } : p));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await clientFetch("/season/rules", { method: "PUT", body: JSON.stringify({ config: r }) });
      setMsg("Matrice salvata · classifiche ricalcolate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const numCls = `${fieldCls} num px-2 text-center text-sm`;
  const labelCls = "label text-acid-deep";

  const Scale = ({ title, field: k }: { title: string; field: "raceScale" | "sprintScale" }) => (
    <section className="panel rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className={labelCls}>{title}</p>
        <div className="flex gap-2">
          <button
            onClick={() => removePos(k)}
            className="h-6 w-6 rounded border border-line font-[family-name:var(--font-mono)] text-sm text-bone-dim hover:border-acid hover:text-acid"
          >
            −
          </button>
          <button
            onClick={() => addPos(k)}
            className="h-6 w-6 rounded border border-line font-[family-name:var(--font-mono)] text-sm text-bone-dim hover:border-acid hover:text-acid"
          >
            +
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {r[k].map((v, i) => (
          <label key={i} className="flex flex-col items-center gap-1">
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-bone-dim">P{i + 1}</span>
            <input
              type="number"
              value={v}
              onChange={(e) => setScaleValue(k, i, Number(e.target.value))}
              className={numCls}
            />
          </label>
        ))}
      </div>
    </section>
  );

  const Field = ({
    label,
    k,
  }: {
    label: string;
    k: "polePoints" | "teamManagerPoints" | "sponsorPointsPerCar" | "benzinaPointsPerCar" | "fastestLapPoint" | "drsMultiplier" | "drsPerSeason";
  }) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-bone">{label}</span>
      <input
        type="number"
        value={r[k]}
        onChange={(e) => setScalar(k, Number(e.target.value))}
        className={`${numCls} w-20`}
      />
    </label>
  );

  return (
    <div className="space-y-4 pb-24">
      <Scale title="Scala punti Gara (posizione → punti)" field="raceScale" />
      <Scale title="Scala punti Sprint" field="sprintScale" />

      <section className="panel rounded-xl p-4 space-y-3">
        <p className={labelCls}>Punti categoria & speciali</p>
        <Field label="Pole (al pilota posseduto)" k="polePoints" />
        <Field label="Team Manager (entrambi i piloti a punti)" k="teamManagerPoints" />
        <Field label="Sponsor (per monoposto a punti)" k="sponsorPointsPerCar" />
        <Field label="Benzina (per monoposto a punti)" k="benzinaPointsPerCar" />
        <Field label="Giro veloce" k="fastestLapPoint" />
      </section>

      <section className="panel rounded-xl p-4 space-y-3">
        <p className={labelCls}>DRS</p>
        <Field label="Moltiplicatore" k="drsMultiplier" />
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-bone">Ambito</span>
          <select
            value={r.drsScope}
            onChange={(e) => setScalar("drsScope", e.target.value as ScoringRules["drsScope"])}
            className={`${numCls} w-40`}
          >
            <option value="race">Solo Gara</option>
            <option value="race_sprint">Gara + Sprint</option>
          </select>
        </label>
        <Field label="DRS disponibili a stagione" k="drsPerSeason" />
      </section>

      <section className="panel rounded-xl p-4 space-y-3">
        <p className={labelCls}>Asta</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-bone">Budget squadra (M$)</span>
          <input
            type="number"
            value={r.auction.budget}
            onChange={(e) => setR((p) => ({ ...p, auction: { ...p.auction, budget: Number(e.target.value) } }))}
            className={`${numCls} w-24`}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-bone">Rilancio minimo</span>
          <input
            type="number"
            value={r.auction.minIncrement}
            onChange={(e) => setR((p) => ({ ...p, auction: { ...p.auction, minIncrement: Number(e.target.value) } }))}
            className={`${numCls} w-20`}
          />
        </label>
      </section>

      <p className="font-[family-name:var(--font-mono)] text-[10px] leading-relaxed tracking-wider text-bone-dim">
        Pole, Team Manager, Sponsor, Benzina e DRS si applicano <span className="text-bone">subito a tutta la stagione</span>.
        La scala punti FIA vale per i risultati inseriti d&apos;ora in poi; per applicarla a round già inseriti, riaprili
        da «Inserisci» e risalvali.
      </p>

      <StickyBar>
        <Btn onClick={save} disabled={saving} size="lg" full>
          {saving ? "Salvataggio…" : "Salva matrice"}
        </Btn>
        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
      </StickyBar>
    </div>
  );
}
