import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Card, Label, Chip } from "@/components/ui";
import { REGOLAMENTO, PREAMBOLO, NOTE, FIRMA, type ValoreCitato } from "@/lib/regolamento";
import type { Me, ScoringRules } from "@/lib/types";

/**
 * IL REGOLAMENTO — documento costituzionale del campionato, firmato dai sei.
 *
 * Registro strumento nel senso di DESIGN.md: è un testo da leggere e da citare durante una
 * discussione, quindi il budget va tutto sulla gerarchia e sulla leggibilità. Niente
 * decorazione: numerazione romana in evidenza, testo a misura d'occhio, note in fondo.
 *
 * Il valore aggiunto sta in due cose che un PDF non può fare: ogni articolo porta alla
 * schermata che lo applica, e dove la regola cita una cifra si vede accanto quella davvero
 * impostata. In questo progetto lo scarto fra regola scritta e regola applicata ha già
 * morso due volte.
 */

function Confronto({ v, rules }: { v: ValoreCitato; rules: ScoringRules | null }) {
  if (!rules) return null;
  const applicato = v.applicato(rules);
  const combacia = String(applicato) === String(v.atteso);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="note">{v.etichetta}</span>
      <span className="num shrink-0 text-xs">
        {combacia ? (
          <span className="text-acid">{String(applicato)} ✓</span>
        ) : (
          <>
            <span className="text-red">{String(applicato)}</span>
            <span className="text-bone-dim"> · regola: {String(v.atteso)}</span>
          </>
        )}
      </span>
    </div>
  );
}

export default async function RegolamentoPage() {
  await serverFetch<Me>("/auth/me");
  // Se la configurazione non si legge, il regolamento resta comunque consultabile:
  // è un documento, non dipende dai dati di stagione.
  const cfg = await serverFetch<{ config: ScoringRules }>("/season/rules").catch(() => null);
  const rules = cfg?.config ?? null;

  const divergenze = rules
    ? REGOLAMENTO.flatMap((t) => t.articoli).flatMap((a) => a.valori ?? [])
        .filter((v) => String(v.applicato(rules)) !== String(v.atteso)).length
    : 0;

  return (
    <Screen>
      <PageHeader
        kicker="World Championship fantaformulauno 2026"
        title="Regolamento"
        subtitle={`${FIRMA.luogo}, ${FIRMA.data}`}
        size="lg"
      />

      <Main width="lg" className="space-y-6">
        <Card accent className="px-4 py-3">
          <p className="note">{PREAMBOLO}</p>
          {rules && (
            <div className="mt-3 border-t border-line/60 pt-3">
              <Chip tone={divergenze === 0 ? "acid" : "amber"}>
                {divergenze === 0
                  ? "● L'app applica il regolamento"
                  : `○ ${divergenze} ${divergenze === 1 ? "valore diverso" : "valori diversi"} da quanto scritto`}
              </Chip>
              <p className="note mt-2">
                Dove il regolamento cita una cifra, qui sotto trovi accanto quella davvero impostata
                nella <Link href="/impostazioni" className="text-acid-deep hover:text-acid">matrice punteggi</Link>.
              </p>
            </div>
          )}
        </Card>

        {/* ── indice ── */}
        <nav className="flex flex-wrap gap-2">
          {REGOLAMENTO.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="label rounded-full border border-line px-3 py-1.5 transition-colors hover:border-acid hover:text-acid"
              style={{ transitionDuration: "var(--dur-1)" }}
            >
              {t.titolo}
            </a>
          ))}
        </nav>

        {REGOLAMENTO.map((t) => (
          <section key={t.id} id={t.id} className="scroll-mt-4">
            <h2
              className="font-semibold uppercase leading-tight tracking-wide text-bone"
              style={{ fontSize: "var(--text-xl)" }}
            >
              {t.titolo}
            </h2>
            {t.intro && <p className="note mt-1">{t.intro}</p>}

            <div className="mt-3 space-y-2">
              {t.articoli.map((a) => (
                <Card key={a.n} className="px-4 py-3">
                  <div className="flex gap-3">
                    {/* La numerazione romana è la struttura del documento: si cita «Art. VIII»,
                        quindi deve saltare all'occhio. */}
                    <span className="num w-10 shrink-0 text-sm font-bold text-acid">{a.n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-bone">{a.testo}</p>

                      {a.sub && (
                        <div className="mt-2 space-y-2 border-l border-line/60 pl-3">
                          {a.sub.map((s) => (
                            <div key={s.n} className="flex gap-2">
                              <span className="num w-10 shrink-0 text-xs font-bold text-acid-deep">{s.n}</span>
                              <p className="note flex-1">{s.testo}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {a.valori && (
                        <div className="mt-2 rounded-lg border border-line/60 px-3 py-1.5">
                          <Label className="text-acid-deep">Come è impostata l&apos;app</Label>
                          <div className="mt-1">
                            {a.valori.map((v) => (
                              <Confronto key={v.etichetta} v={v} rules={rules} />
                            ))}
                          </div>
                        </div>
                      )}

                      {a.applica && (
                        <Link
                          href={a.applica.href}
                          className="label mt-2 inline-block text-acid transition-colors hover:text-acid-deep"
                          style={{ transitionDuration: "var(--dur-1)" }}
                        >
                          {a.applica.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {/* ── note ── */}
        <section>
          <Label>Note</Label>
          <Card className="mt-2 px-4 py-3">
            <ol className="space-y-1.5">
              {Object.entries(NOTE).map(([n, testo]) => (
                <li key={n} className="flex gap-2">
                  <span className="num shrink-0 text-xs text-acid-deep">{n}</span>
                  <span className="note flex-1">{testo}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        {/* ── firma: è un documento, e si vede da come finisce ── */}
        <Card tone="hi" chamfer className="px-5 py-5 text-center">
          <p className="note">
            {FIRMA.luogo}, {FIRMA.data}
          </p>
          <ul className="mt-3 space-y-0.5">
            {FIRMA.team.map((t) => (
              <li key={t} className="text-sm font-semibold uppercase tracking-wide text-bone">
                {t}
              </li>
            ))}
          </ul>
          <p className="note mt-4">Consiglio Mondiale fantaformulauno</p>
        </Card>
      </Main>

      <BottomNav />
    </Screen>
  );
}
