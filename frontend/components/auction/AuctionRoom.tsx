"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Empty, Label, Note, fieldCls } from "@/components/ui";
import type { AuctionSlot, AuctionState } from "@/lib/types";
import { AuctionBoard } from "./AuctionBoard";
import { CheckIcon, FlagIcon, XIcon } from "@/components/icons";

const SLOT_LABEL: Record<AuctionSlot, string> = {
  telaio: "Telaio",
  motore: "Motore",
  pilota1: "Pilota 1",
  pilota2: "Pilota 2",
  sponsor: "Sponsor",
  benzina: "Benzina",
};

export function AuctionRoom() {
  const [state, setState] = useState<AuctionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  // Form registrazione biglietto
  const [selTeam, setSelTeam] = useState("");
  const [selComp, setSelComp] = useState("");
  const [amount, setAmount] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await clientFetch<{ state: AuctionState | null }>("/auction/state");
      setState(res.state);
    } catch {
      /* ignora blip di rete durante il polling */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  async function act<T = { state: AuctionState | null }>(path: string, body?: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
      const s = (res as { state?: AuctionState | null }).state;
      if (s !== undefined) setState(s);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const round = state?.round ?? null;
  const tie = round?.mode === "tiebreak";
  const byId = new Map((state?.components ?? []).map((c) => [c.id, c]));
  const teamName = (id: string) => state?.participants.find((p) => p.teamId === id)?.personName ?? id;

  const activeIds = tie ? round?.tieTeamIds ?? [] : round?.activeTeamIds ?? [];
  const teamsToBid = activeIds.filter((id) => !round?.slips.some((s) => s.teamId === id));
  const compOptions = (() => {
    if (!round) return [];
    if (tie) return round.tieComponentId ? [byId.get(round.tieComponentId)!].filter(Boolean) : [];
    const restricted = new Set(selTeam ? state?.restricted[selTeam] ?? [] : []);
    return round.availableComponentIds.map((id) => byId.get(id)!).filter((c) => c && !restricted.has(c.id));
  })();

  async function register() {
    const comp = tie ? round?.tieComponentId : selComp;
    if (!selTeam || !comp || !amount) {
      setError("Compila squadra, componente e cifra.");
      return;
    }
    const r = await act("/auction/bid", { teamId: selTeam, componentId: comp, amount: Number(amount) });
    if (r) {
      setSelTeam("");
      setSelComp("");
      setAmount("");
    }
  }

  async function resolve() {
    const r = await act<{ state: AuctionState | null; outcome: { tiebreak: unknown; categoryComplete: boolean; subRound: boolean } }>(
      "/auction/resolve"
    );
    if (r?.outcome) {
      const o = r.outcome;
      setMsg(o.tiebreak ? "Pareggio: ribattuta!" : o.categoryComplete ? "Categoria completata" : o.subRound ? "Sub-round: mancano dei garage" : "Assegnato");
      setTimeout(() => setMsg(null), 2500);
    }
  }

  async function commit() {
    if (!confirm("Concludere l'asta e scrivere i roster (from_round=1)?")) return;
    const r = await act<{ ok: boolean; assignments: number }>("/auction/commit");
    if (r?.ok) {
      setCommitted(true);
      setMsg(`Roster scritti (${r.assignments})`);
    }
  }

  const field = `${fieldCls} px-2 text-sm`;

  if (!loaded) {
    return <p className="label mt-10 text-center text-xs">Caricamento…</p>;
  }

  // ── Nessuna sessione: avvia ──
  if (!state) {
    return (
      <Empty
        title="L'asta non è ancora avviata"
        action={
          <Btn onClick={() => act("/auction/start")} disabled={busy}>
            {busy ? "…" : "Avvia asta"}
          </Btn>
        }
      >
        Prepara il tabellone coi 6 garage: le offerte si scrivono su carta, qui si compone il puzzle.
        {error && <Note tone="err">{error}</Note>}
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <AuctionBoard state={state} />

      {/* Console banditore */}
      <Card accent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-acid">Console banditore</Label>
          <button
            onClick={() => { if (confirm("Azzerare l'asta?")) act("/auction/reset").then(() => setState(null)); }}
            className="label transition-colors hover:text-red"
            style={{ transitionDuration: "var(--dur-1)" }}
          >
            Ricomincia
          </button>
        </div>

        {/* Lobby / scelta categoria */}
        {!round && !state.allFull && (
          <div className="grid grid-cols-2 gap-2">
            {state.phaseOrder.map((slot) => {
              const missing = state.participants.filter((p) => !p.garage[slot]).length;
              return (
                <Btn key={slot} onClick={() => act("/auction/category", { slot })} disabled={busy || missing === 0} variant="quiet">
                  {missing === 0 ? (<><CheckIcon className="mr-1 inline h-3 w-3 align-[-1px]" />{SLOT_LABEL[slot]}</>) : `Avvia ${SLOT_LABEL[slot]}`}
                </Btn>
              );
            })}
          </div>
        )}

        {/* Round attivo */}
        {round && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="num text-xs uppercase tracking-widest text-bone">
                {tie ? "Ribattuta" : SLOT_LABEL[round.slot]}
                {round.roundNumber > 1 && !tie ? ` · sub-round ${round.roundNumber}` : ""}
              </span>
              <span className="num text-[10px] text-bone-dim">
                {round.slips.length}/{activeIds.length} biglietti
              </span>
            </div>
            {tie && round.tieComponentId && (
              <p className="num text-[11px] text-acid">
                Pareggio su {byId.get(round.tieComponentId)?.name} tra {round.tieTeamIds.map(teamName).join(", ")}
              </p>
            )}

            {/* Form registrazione */}
            <div className="grid grid-cols-[1fr_1fr_70px] gap-2">
              <select value={selTeam} onChange={(e) => { setSelTeam(e.target.value); setSelComp(""); }} className={field}>
                <option value="">Squadra…</option>
                {activeIds.map((id) => (
                  <option key={id} value={id}>
                    {teamName(id)}{round.slips.some((s) => s.teamId === id) ? " ·" : ""}
                  </option>
                ))}
              </select>
              {tie ? (
                <div className={`${field} flex items-center text-bone-dim`}>{round.tieComponentId ? byId.get(round.tieComponentId)?.name : "—"}</div>
              ) : (
                <select value={selComp} onChange={(e) => setSelComp(e.target.value)} disabled={!selTeam} className={`${field} disabled:opacity-50`}>
                  <option value="">Componente…</option>
                  {compOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.basePrice ? ` (${c.basePrice})` : ""}</option>
                  ))}
                </select>
              )}
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="M$" className={field} />
            </div>
            <Btn onClick={register} disabled={busy} full>Registra biglietto</Btn>

            {/* Biglietti registrati */}
            {round.slips.length > 0 && (
              <ul className="space-y-1">
                {round.slips.map((s) => (
                  <li key={s.teamId} className="flex items-center justify-between rounded-lg bg-carbon-950/60 px-3 py-1.5 text-sm">
                    <span className="text-bone"><span className="text-acid">{teamName(s.teamId)}</span> → {byId.get(s.componentId)?.name}</span>
                    <span className="num flex items-center gap-2 text-xs text-bone-dim">
                      {s.amount}
                      <button onClick={() => act("/auction/unbid", { teamId: s.teamId })} className="text-bone-dim hover:text-red" aria-label="Rimuovi"><XIcon className="h-3.5 w-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Btn onClick={resolve} disabled={busy} full>
              {teamsToBid.length > 0 ? `Risolvi (mancano ${teamsToBid.length})` : "Risolvi"}
            </Btn>
          </div>
        )}

        {/* Asta completa */}
        {state.allFull && !round && (
          <div className="space-y-2 text-center">
            <Label className="text-acid">
              <FlagIcon className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
              Tutti i garage sono pieni
            </Label>
            {committed ? (
              <Note tone="ok">Roster scritti. L&apos;asta è conclusa.</Note>
            ) : (
              <Btn onClick={commit} disabled={busy}>Concludi asta → scrivi i roster</Btn>
            )}
          </div>
        )}

        <Note tone="ok">{msg}</Note>
        <Note tone="err">{error}</Note>
      </Card>
    </div>
  );
}
