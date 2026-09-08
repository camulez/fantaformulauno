"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Label, Note, fieldCls } from "@/components/ui";
import type { Art2Aperto, Art2Caso, Art2Round } from "@/lib/types";

/**
 * ART. II — il Pilota non scende in pista.
 *
 * Il lavoro vero non è registrare la sostituzione: è capire A CHE COSA si ha diritto. Davanti a
 * «Hadjar non ha corso» il Team Manager dovrebbe ricostruire da solo che al suo posto è andato
 * Lawson, che Lawson è di Pio, che quindi scatta l'Art. II.d e che la possibilità 2 gli dà
 * diritto al pilota che ha sostituito Lawson, cioè Tsunoda. Tutti i dati per dedurlo l'app ce
 * li ha già: qui li usa e mostra la catena, invece di lasciarla nella testa di chi compila.
 *
 * ⚠️ Propone, non decide: l'Art. II.d e l'Art. II.e dicono «a sua discrezione».
 *
 * Non si vede quando non serve: se nessun pilota posseduto è rimasto a terra, questo blocco
 * non compare affatto.
 */
const SLOT_LABEL: Record<string, string> = { pilota1: "Pilota 1", pilota2: "Pilota 2" };

const TITOLO_CASO: Record<string, string> = {
  "II.bc": "Il sostituto entra nella tua squadra",
  "II.d": "Il sostituto è di un altro Team",
  "II.e": "Nessuno lo ha sostituito",
};

export function Art2Panel({ roundNo }: { roundNo: number }) {
  const router = useRouter();
  const [data, setData] = useState<Art2Round | null>(null);
  const [scelta, setScelta] = useState<Record<string, string>>({});
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carica = useCallback(async () => {
    try {
      setData(await clientFetch<Art2Round>(`/lineups/round/${roundNo}/art2`));
    } catch {
      // Un guasto qui non deve impedire di inserire i risultati: il blocco resta invisibile.
      setData(null);
    }
  }, [roundNo]);

  useEffect(() => {
    setMsg(null);
    setError(null);
    carica();
  }, [carica]);

  async function registra(c: Art2Aperto, driverId: string, nome: string) {
    const chiave = c.teamId + c.slot;
    setInCorso(chiave);
    setMsg(null);
    setError(null);
    try {
      await clientFetch(`/roster/team/${c.teamId}/substitute`, {
        method: "POST",
        body: JSON.stringify({ slot: c.slot, driverId, fromRound: roundNo, toRound: roundNo }),
      });
      setMsg(`${nome} occupa ${SLOT_LABEL[c.slot] ?? c.slot} di ${c.teamName} per questo round.`);
      await carica();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco a registrare la sostituzione");
    } finally {
      setInCorso(null);
    }
  }

  async function annulla(c: Art2Caso) {
    const chiave = c.teamId + c.slot;
    setInCorso(chiave);
    setMsg(null);
    setError(null);
    try {
      await clientFetch(`/roster/team/${c.teamId}/return`, {
        method: "POST",
        body: JSON.stringify({ slot: c.slot, fromRound: roundNo }),
      });
      setMsg(`${c.assente.name} torna titolare da R${roundNo}.`);
      await carica();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco ad annullare");
    } finally {
      setInCorso(null);
    }
  }

  // Nel 95% dei GP non c'è niente da decidere: allora questo blocco non esiste.
  if (!data || data.casi.length === 0) return null;

  return (
    <Card accent chamfer className="p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <Label>Art. II · piloti che non hanno corso</Label>
        <span className="note">
          {data.casi.length} {data.casi.length === 1 ? "caso" : "casi"}
        </span>
      </div>

      <div className="space-y-3">
        {data.casi.map((c) => {
          const chiave = c.teamId + c.slot;
          const occupato = inCorso === chiave;

          if (c.stato === "risolto") {
            return (
              <div key={chiave} className="rounded-lg border border-acid/40 bg-acid/5 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-bone">
                    <strong>{c.teamName}</strong> · {SLOT_LABEL[c.slot] ?? c.slot}
                  </span>
                  <Label className="text-acid">sistemato</Label>
                </div>
                <p className="note mt-1">
                  {c.assente.name} non ha corso · al suo posto <strong>{c.sostituto.name}</strong>
                  {" · "}
                  {c.race + c.sprint} pt in questo round
                  {c.sprint > 0 ? ` (Gara ${c.race} + Sprint ${c.sprint})` : ""}
                </p>
                <div className="mt-2">
                  <Btn variant="quiet" onClick={() => annulla(c)} disabled={occupato}>
                    {occupato ? "…" : "Annulla, torna il titolare"}
                  </Btn>
                </div>
              </div>
            );
          }

          const scelto = scelta[chiave] ?? c.spettante?.id ?? "";
          const nomeScelto =
            c.candidati.find((x) => x.id === scelto)?.name ?? c.spettante?.name ?? "";

          return (
            <div key={chiave} className="rounded-lg border border-amber/50 bg-amber/5 px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-bone">
                  <strong>{c.teamName}</strong> · {SLOT_LABEL[c.slot] ?? c.slot}
                </span>
                <Label className="text-amber">Art. {c.caso === "II.bc" ? "II.b / II.c" : c.caso}</Label>
              </div>

              <p className="note mt-1">{TITOLO_CASO[c.caso]}</p>

              {/* La catena è il motivo per cui questo pannello esiste. */}
              {c.percorso.length > 1 && (
                <p className="mt-2 font-mono text-2xs text-bone">
                  {c.percorso.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && <span className="text-bone-dim"> → </span>}
                      <span className={i === c.percorso.length - 1 ? "text-acid" : ""}>{p.name}</span>
                    </span>
                  ))}
                </p>
              )}

              {c.bloccatoDa && (
                <p className="note mt-1">
                  Il sostituto diretto è di <strong>{c.bloccatoDa}</strong>: resti privo del pilota, e la
                  possibilità 2 ti dà il pilota che ha preso il suo posto.
                </p>
              )}

              {c.ambiguo && (
                <p className="note mt-1">
                  Dalla stessa scuderia sono usciti in più: chi ha sostituito chi non si deduce dai dati,
                  scegli tu.
                </p>
              )}

              {c.spettante || c.candidati.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.ambiguo && c.candidati.length > 1 && (
                    <select
                      className={`${fieldCls} sm:w-auto`}
                      value={scelto}
                      onChange={(e) => setScelta({ ...scelta, [chiave]: e.target.value })}
                    >
                      <option value="">scegli il sostituto…</option>
                      {c.candidati.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Btn
                    onClick={() => registra(c, scelto, nomeScelto)}
                    disabled={occupato || !scelto}
                  >
                    {occupato ? "…" : `Fai entrare ${nomeScelto || "il sostituto"}`}
                  </Btn>
                  {c.spettante && (
                    <span className="note">
                      ha fatto {c.spettante.race + c.spettante.sprint} pt FIA in questo round
                    </span>
                  )}
                </div>
              ) : (
                <p className="note mt-1">
                  Non c&apos;è nessun sostituto libero da prendere. Resta la possibilità 1 dell&apos;Art. II.d:
                  comprare un pilota dal mercato, dalla pagina della squadra.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="note mt-3">
        Il punteggio mostrato è quello che il sostituto ha fatto in pista: il totale della squadra può
        muoversi anche di Team Manager o Punto Pole, che dipendono da chi va a punti. Se l&apos;assenza è
        una squalifica FIA, l&apos;Art. II.a non consente sostituzioni e lo slot resta a zero.
      </p>

      {msg && <Note tone="ok">{msg}</Note>}
      {error && <Note tone="err">{error}</Note>}
    </Card>
  );
}
