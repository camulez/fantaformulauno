"use client";

import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Field, Label, Note, fieldCls } from "@/components/ui";
import type { LineupDriver, RoundLineups } from "@/lib/types";

/**
 * Formazione della gara: chi è sceso in pista per ogni scuderia in QUESTO round.
 *
 * Serve per le sostituzioni. Esempio vero: al GP d'Olanda 2026 Lawson corre per Red Bull al
 * posto di Hadjar, e Tsunoda prende il posto di Lawson in Racing Bulls. I punti di Lawson
 * come PILOTA restano a chi lo possiede — quelli non passano di qui — ma come costruttore
 * devono contare per Red Bull, non per Racing Bulls.
 *
 * Chiusa di default: nel 95% dei GP non si tocca, e non deve rubare spazio ai risultati.
 *
 * ⚠️ La formazione SI PORTA AVANTI: vale dalla gara in cui la scrivi finché non la cambi. Prima valeva
 * una gara sola, e a Madrid (R16) — dove non era stata riscritta — Lawson era tornato in silenzio in
 * Racing Bulls. Per questo ogni scuderia dice da dove viene («come R15»), e l'avviso dei punti senza
 * scuderia resta visibile anche a sezione chiusa: è il segnale che un titolare è rientrato.
 */
export function LineupForm({ roundNo, versione = 0 }: { roundNo: number; versione?: number }) {
  const [data, setData] = useState<RoundLineups | null>(null);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [aperta, setAperta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // aggiunta pilota di riserva
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovaScuderia, setNuovaScuderia] = useState("");
  const [creando, setCreando] = useState(false);

  const carica = useCallback(async () => {
    try {
      const d = await clientFetch<RoundLineups>(`/lineups/round/${roundNo}`);
      setData(d);
      setSel(Object.fromEntries(d.teams.map((t) => [t.fiaTeamId, [...t.effettiva]])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco a leggere la formazione");
    }
  }, [roundNo]);

  useEffect(() => {
    setMsg(null);
    setError(null);
    carica();
  }, [carica, versione]);

  if (!data) return null;

  const nome = new Map(data.drivers.map((d) => [d.id, d.name]));
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const modificate = data.teams.filter((t) => !uguali(t.abituale, sel[t.fiaTeamId] ?? []));

  /** Da dove viene la formazione salvata di una scuderia; null se la si sta cambiando adesso. */
  const provenienza = (t: (typeof data.teams)[number]): string | null => {
    if (!uguali(t.effettiva, sel[t.fiaTeamId] ?? [])) return "da salvare";
    if (t.scrittaQui) return "scritta qui";
    if (t.ereditataDa !== null) return `come R${t.ereditataDa}`;
    return null;
  };
  const riassunto = (() => {
    if (modificate.length === 0) return "Tutte le scuderie con l'organico abituale";
    const gruppi = new Map<string, string[]>();
    for (const t of modificate) {
      const k = provenienza(t) ?? "";
      gruppi.set(k, [...(gruppi.get(k) ?? []), t.name]);
    }
    return [...gruppi.entries()].map(([k, nomi]) => `${nomi.join(", ")}${k ? ` · ${k}` : ""}`).join(" — ");
  })();

  /** Un pilota può correre per una sola scuderia: qui si tolgono le scelte in conflitto. */
  function scegli(teamId: string, indice: number, driverId: string) {
    setMsg(null);
    setError(null);
    setSel((p) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(p)) {
        next[k] = k === teamId ? [...v] : v.filter((d) => d !== driverId || !driverId);
      }
      // rimuovo il pilota da tutte le altre scuderie
      if (driverId) {
        for (const k of Object.keys(next)) {
          if (k !== teamId) next[k] = next[k].filter((d) => d !== driverId);
        }
      }
      const riga = [...(next[teamId] ?? [])];
      while (riga.length < 2) riga.push("");
      riga[indice] = driverId;
      next[teamId] = riga.filter(Boolean);
      return next;
    });
  }

  async function salva() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const r = await clientFetch<{ scuderieModificate: number }>(`/lineups/round/${roundNo}`, {
        method: "PUT",
        body: JSON.stringify({
          teams: Object.entries(sel).map(([fiaTeamId, driverIds]) => ({ fiaTeamId, driverIds })),
        }),
      });
      setMsg(
        r.scuderieModificate === 0
          ? "Nessuna differenza dalla gara prima: questa gara la eredita"
          : `Salvato · ${r.scuderieModificate} ${r.scuderieModificate === 1 ? "scuderia cambiata" : "scuderie cambiate"} da questa gara in poi`
      );
      await carica();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function creaPilota() {
    const n = nuovoNome.trim();
    if (!n || !nuovaScuderia || creando) return;
    setCreando(true);
    setError(null);
    try {
      const d = await clientFetch<LineupDriver>("/reference/driver", {
        method: "POST",
        body: JSON.stringify({ name: n, fiaTeamId: nuovaScuderia }),
      });
      setNuovoNome("");
      setData((p) => (p ? { ...p, drivers: [...p.drivers, d].sort((a, b) => a.name.localeCompare(b.name)) } : p));
      setMsg(`${d.name} aggiunto come riserva · ora è selezionabile`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non sono riuscito ad aggiungere il pilota");
    } finally {
      setCreando(false);
    }
  }

  return (
    <Card className="mt-4 px-4 py-3">
      <button onClick={() => setAperta((a) => !a)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <Label>Formazione della gara</Label>
          <p className="note mt-0.5">{riassunto}</p>
        </div>
        <span className={`num shrink-0 text-xs ${modificate.length ? "text-acid" : "text-bone-dim"}`}>
          {aperta ? "chiudi" : "apri"}
        </span>
      </button>

      {data.senzaScuderia.length > 0 && (
        <div className="mt-3 rounded-lg border border-red/50 bg-red/5 px-3 py-2">
          <Label className="text-red">Formazione da aggiornare</Label>
          {data.senzaScuderia.map((s) => (
            <p key={s.id} className="note mt-1">
              <span className="text-bone">{s.name}</span> ha fatto {s.punti} pt ma in questa formazione non corre
              per nessuna scuderia: i suoi punti costruttore non vanno a nessuno. Di solito vuol dire che è
              rientrato e si sta ancora ereditando il suo sostituto.
            </p>
          ))}
        </div>
      )}

      {aperta && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="note mb-3">
            Serve solo quando un pilota corre per una scuderia diversa dalla sua. I punti che prende
            come <span className="text-bone">pilota</span> restano comunque a chi lo possiede: qui
            si decide solo per quale <span className="text-bone">costruttore</span> contano.
            {data.round.hasSprint && " Vale per tutto il weekend, Sprint compreso."}
          </p>
          <p className="note mb-3">
            Una formazione <span className="text-bone">vale dalla gara in cui la scrivi finché non la cambi</span>:
            non va riscritta a ogni GP. Quando il titolare rientra, riporta la scuderia all&apos;abituale nella
            gara del rientro.
          </p>

          <div className="space-y-2">
            {data.teams.map((t) => {
              const riga = sel[t.fiaTeamId] ?? [];
              const cambiata = !uguali(t.abituale, riga);
              return (
                <div
                  key={t.fiaTeamId}
                  className={`rounded-lg border px-3 py-2 ${cambiata ? "border-acid/50 bg-acid/5" : "border-line/50"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${cambiata ? "text-acid" : "text-bone"}`}>
                      {t.name}
                      {cambiata && provenienza(t) && (
                        <span className="note ml-2 normal-case tracking-normal">{provenienza(t)}</span>
                      )}
                    </p>
                    {cambiata && (
                      <button
                        onClick={() => setSel((p) => ({ ...p, [t.fiaTeamId]: [...t.abituale] }))}
                        className="label transition-colors hover:text-acid"
                      >
                        torna all&apos;abituale
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <select
                        key={i}
                        value={riga[i] ?? ""}
                        onChange={(e) => scegli(t.fiaTeamId, i, e.target.value)}
                        className={`${fieldCls} px-2 py-1.5 text-sm`}
                      >
                        <option value="">— nessuno —</option>
                        {data.drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.isReserve ? " (ris.)" : ""}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  {cambiata && (
                    <p className="note mt-1.5">
                      abituale: {t.abituale.map((d) => nome.get(d) ?? "—").join(" + ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── pilota non in anagrafica ── */}
          <div className="mt-4 rounded-lg border border-line/60 p-3">
            <Label className="text-acid-deep">Manca un pilota?</Label>
            <p className="note mt-0.5">
              Chi corre da riserva spesso non è in anagrafica. Aggiungilo qui: sarà subito
              selezionabile e non entrerà fra i pezzi comprabili all&apos;asta.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={nuovoNome}
                onChange={(e) => setNuovoNome(e.target.value)}
                placeholder="Nome e cognome"
                className={`${fieldCls} text-sm`}
              />
              <select
                value={nuovaScuderia}
                onChange={(e) => setNuovaScuderia(e.target.value)}
                className={`${fieldCls} text-sm`}
              >
                <option value="">— scuderia —</option>
                {data.teams.map((t) => (
                  <option key={t.fiaTeamId} value={t.fiaTeamId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Btn onClick={creaPilota} disabled={creando || !nuovoNome.trim() || !nuovaScuderia} variant="quiet">
                {creando ? "…" : "Aggiungi"}
              </Btn>
            </div>
          </div>

          <Btn onClick={salva} disabled={saving} size="lg" full className="mt-4">
            {saving ? "Salvataggio…" : "Salva formazione"}
          </Btn>
          <Note tone="ok">{msg}</Note>
          <Note tone="err">{error}</Note>
        </div>
      )}
    </Card>
  );
}
