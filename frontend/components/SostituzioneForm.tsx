"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Field, Label, Note, fieldCls } from "@/components/ui";
import type { ComponentRef, PrezzoComponente, Proprietari, RoundInfo } from "@/lib/types";

/**
 * ART. II del Regolamento Campionato — il Pilota non scende in pista.
 *
 * La difficoltà non è tecnica: è capire IN QUALE CASO si è. Il regolamento distingue in
 * base a chi sostituisce, e le conseguenze sono opposte (il sostituto entra in squadra,
 * oppure resti scoperto e devi comprare). Qui il caso lo riconosce l'app: scegli il
 * sostituto e ti dice quale articolo si applica e cosa comporta.
 */

const SLOT_LABEL: Record<string, string> = { pilota1: "Pilota 1", pilota2: "Pilota 2" };

export function SostituzioneForm({
  teamId,
  components,
  rounds,
  rosterAttuale,
}: {
  teamId: string;
  components: ComponentRef[];
  rounds: RoundInfo[];
  /** slot → componentId attualmente titolare. */
  rosterAttuale: Record<string, string>;
}) {
  const router = useRouter();
  const [prop, setProp] = useState<Proprietari | null>(null);
  const [slot, setSlot] = useState("");
  const [sostituto, setSostituto] = useState("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prezzi, setPrezzi] = useState<{ esce: PrezzoComponente; entra: PrezzoComponente } | null>(null);

  useEffect(() => {
    clientFetch<Proprietari>("/roster/proprietari").then(setProp).catch(() => setProp(null));
  }, []);

  const piloti = useMemo(() => components.filter((c) => c.kind === "pilota"), [components]);
  const titolare = slot ? components.find((c) => c.id === rosterAttuale[slot]) : undefined;
  const roundOpts = rounds.filter((r) => r.round_no >= 2).sort((a, b) => a.round_no - b.round_no);

  /** Il caso del regolamento, dedotto da chi è il sostituto. */
  const caso = useMemo(() => {
    if (!sostituto || !prop) return null;
    const p = prop.di[sostituto];
    if (!p) {
      return {
        art: "II.b / II.c",
        titolo: "Il sostituto entra temporaneamente nella tua squadra",
        testo:
          "Il sostituto non appartiene a nessun altro Team, quindi diviene temporaneamente parte del tuo. Il tuo pilota rientra al suo ritorno, indipendentemente dalla scuderia in cui rientra.",
        grave: false,
      };
    }
    if (p.teamId === teamId) {
      return {
        art: "—",
        titolo: "È già un tuo pilota",
        testo: "Non puoi usare come sostituto un pilota che occupa già un tuo slot.",
        grave: true,
      };
    }
    return {
      art: "II.d",
      titolo: `Attenzione: questo pilota è di ${p.teamName}`,
      testo:
        "Resti effettivamente privo del pilota. Hai due possibilità: comprare un nuovo pilota dal mercato (possibilità 1, il tuo pilota si considera venduto definitivamente), oppure prendere il pilota che a sua volta ha sostituito questo (possibilità 2).",
      grave: true,
    };
  }, [sostituto, prop, teamId]);

  /** Art. II.d possibilità 1: quanto incassi e quanto paghi. */
  async function calcolaPrezzi() {
    if (!titolare || !sostituto) return;
    setError(null);
    try {
      const [esce, entra] = await Promise.all([
        clientFetch<PrezzoComponente>(`/roster/prezzo/${titolare.id}`),
        clientFetch<PrezzoComponente>(`/roster/prezzo/${sostituto}`),
      ]);
      setPrezzi({ esce, entra });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco a calcolare i prezzi");
    }
  }

  async function sostituisci() {
    if (saving) return;
    if (!slot || !sostituto || !dal) {
      setError("Scegli slot, sostituto e round di uscita.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const r = await clientFetch<{ rientroProgrammato: boolean }>(`/roster/team/${teamId}/substitute`, {
        method: "POST",
        body: JSON.stringify({
          slot,
          componentId: sostituto,
          fromRound: Number(dal),
          toRound: al ? Number(al) : null,
        }),
      });
      setMsg(
        r.rientroProgrammato
          ? `Sostituzione registrata da R${dal} a R${al} · il titolare rientra da R${Number(al) + 1}`
          : `Sostituzione registrata da R${dal} · registra il rientro quando torna`
      );
      setSostituto("");
      setDal("");
      setAl("");
      setPrezzi(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nella sostituzione");
    } finally {
      setSaving(false);
    }
  }

  async function rientro() {
    if (saving || !slot || !dal) {
      setError("Scegli lo slot e il round di rientro.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await clientFetch(`/roster/team/${teamId}/return`, {
        method: "POST",
        body: JSON.stringify({ slot, fromRound: Number(dal) }),
      });
      setMsg(`Rientro registrato da R${dal}`);
      setDal("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel rientro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card accent className="p-4">
      <Label className="text-acid">Il pilota non corre · Art. II</Label>
      <p className="note mt-1">
        Se un tuo pilota salta una gara, cosa succede dipende da{" "}
        <span className="text-bone">chi lo sostituisce</span>. Scegli il sostituto e l&apos;app ti dice
        in quale caso sei. <Link href="/regolamento#campionato" className="text-acid-deep hover:text-acid">Leggi l&apos;articolo →</Link>
      </p>

      <div className="mt-3 space-y-3">
        <Field label="Quale tuo pilota non corre" tone="acid">
          <select
            value={slot}
            onChange={(e) => { setSlot(e.target.value); setSostituto(""); setPrezzi(null); }}
            className={`${fieldCls} text-sm`}
          >
            <option value="">— seleziona —</option>
            {["pilota1", "pilota2"].map((s) => {
              const c = components.find((x) => x.id === rosterAttuale[s]);
              return (
                <option key={s} value={s}>
                  {SLOT_LABEL[s]}{c ? ` · ${c.name}` : ""}
                </option>
              );
            })}
          </select>
        </Field>

        <Field label="Chi lo sostituisce in pista" tone="acid" hint="Lascia vuoto se è squalificato: in quel caso (Art. II.a) non si sostituisce e prende 0 punti.">
          <select
            value={sostituto}
            onChange={(e) => { setSostituto(e.target.value); setPrezzi(null); }}
            disabled={!slot}
            className={`${fieldCls} text-sm disabled:opacity-50`}
          >
            <option value="">— nessuno / squalificato —</option>
            {piloti
              .filter((c) => c.id !== rosterAttuale[slot])
              .map((c) => {
                const p = prop?.di[c.id];
                return (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {p ? ` — di ${p.teamName}` : ""}
                  </option>
                );
              })}
          </select>
        </Field>

        {/* Il caso del regolamento, riconosciuto dall'app */}
        {caso && (
          <div className={`rounded-lg border px-3 py-2 ${caso.grave ? "border-amber/50 bg-amber/5" : "border-acid/40 bg-acid/5"}`}>
            <Label className={caso.grave ? "text-amber" : "text-acid"}>Art. {caso.art}</Label>
            <p className="mt-0.5 text-sm font-semibold text-bone">{caso.titolo}</p>
            <p className="note mt-1">{caso.testo}</p>
            {caso.art === "II.d" && (
              <Btn onClick={calcolaPrezzi} variant="quiet" className="mt-2">
                Calcola i prezzi (possibilità 1)
              </Btn>
            )}
          </div>
        )}

        {prezzi && (
          <div className="rounded-lg border border-line/60 px-3 py-2">
            <Label className="text-acid-deep">Possibilità 1 · acquisto dal mercato</Label>
            <p className="note mt-1">
              Base d&apos;asta originaria più i punti FIA già realizzati. I Punti DRS non contano
              (nota ³ del regolamento).
            </p>
            <div className="mt-2 space-y-1">
              {[
                { et: `Ricevi per ${prezzi.esce.name}`, v: prezzi.esce },
                { et: `Costo di ${prezzi.entra.name}`, v: prezzi.entra },
              ].map((r) => (
                <div key={r.et} className="flex items-baseline justify-between gap-3">
                  <span className="note">{r.et}</span>
                  <span className="num shrink-0 text-xs text-bone">
                    {r.v.base} + {r.v.punti} = <span className="font-bold text-acid">{r.v.prezzo}</span> M$
                  </span>
                </div>
              ))}
            </div>
            <p className="note mt-2">
              Il saldo lo regolate voi: l&apos;app non tiene il conto del Capitale finché i prezzi
              base non arrivano dal rollover.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Dal round">
            <select value={dal} onChange={(e) => setDal(e.target.value)} className={`${fieldCls} text-sm`}>
              <option value="">—</option>
              {roundOpts.map((r) => (
                <option key={r.round_no} value={r.round_no}>
                  R{r.round_no}{r.code ? ` · ${r.code}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fino al round" hint="Vuoto = non si sa ancora quando rientra">
            <select value={al} onChange={(e) => setAl(e.target.value)} className={`${fieldCls} text-sm`}>
              <option value="">— fino al rientro —</option>
              {roundOpts.filter((r) => !dal || r.round_no >= Number(dal)).map((r) => (
                <option key={r.round_no} value={r.round_no}>
                  R{r.round_no}{r.code ? ` · ${r.code}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn onClick={sostituisci} disabled={saving || !sostituto} size="lg">
          {saving ? "…" : "Registra sostituzione"}
        </Btn>
        <Btn onClick={rientro} disabled={saving || !slot || !dal} variant="quiet" size="lg">
          Registra rientro
        </Btn>
      </div>
      <Note tone="ok">{msg}</Note>
      <Note tone="err">{error}</Note>
      <p className="note mt-2">
        «Registra rientro» riporta nello slot il titolare che c&apos;era prima del sostituto, dal round
        scelto. Serve quando al momento della sostituzione non si sapeva quando sarebbe tornato.
      </p>
    </Card>
  );
}
