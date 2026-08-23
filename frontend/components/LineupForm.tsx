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
 */
export function LineupForm({ roundNo }: { roundNo: number }) {
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
  }, [carica]);

  if (!data) return null;

  const nome = new Map(data.drivers.map((d) => [d.id, d.name]));
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const modificate = data.teams.filter((t) => !uguali(t.abituale, sel[t.fiaTeamId] ?? []));

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
          ? "Formazione riportata agli organici abituali"
          : `Salvato · ${r.scuderieModificate} ${r.scuderieModificate === 1 ? "scuderia modificata" : "scuderie modificate"}`
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
          <p className="note mt-0.5">
            {modificate.length === 0
              ? "Tutte le scuderie con l'organico abituale"
              : `${modificate.length} ${modificate.length === 1 ? "scuderia modificata" : "scuderie modificate"}: ${modificate.map((t) => t.name).join(", ")}`}
          </p>
        </div>
        <span className={`num shrink-0 text-xs ${modificate.length ? "text-acid" : "text-bone-dim"}`}>
          {aperta ? "chiudi" : "apri"}
        </span>
      </button>

      {aperta && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="note mb-3">
            Serve solo quando un pilota corre per una scuderia diversa dalla sua. I punti che prende
            come <span className="text-bone">pilota</span> restano comunque a chi lo possiede: qui
            si decide solo per quale <span className="text-bone">costruttore</span> contano.
            {data.round.hasSprint && " Vale per tutto il weekend, Sprint compreso."}
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
                    </p>
                    {cambiata && (
                      <button
                        onClick={() => setSel((p) => ({ ...p, [t.fiaTeamId]: [...t.abituale] }))}
                        className="label transition-colors hover:text-acid"
                      >
                        ripristina
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
