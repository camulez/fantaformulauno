import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Card, Label, Btn, Chip } from "@/components/ui";
import type { DrsBoard, Me } from "@/lib/types";

const ETICHETTA: Record<string, string> = {
  telaio: "Telaio",
  motore: "Motore",
  pilota1: "Pilota 1",
  pilota2: "Pilota 2",
  sponsor: "Sponsor",
  benzina: "Benzina",
};

/**
 * TABELLONE DRS — pubblico di proposito.
 * Il DRS di uno cambia la classifica di tutti: chi lo gioca e su cosa non può essere
 * un'informazione privata sepolta nella propria pagina squadra. Qui si vede, sempre,
 * chi ha bruciato quale carta e su quale gara.
 */
export default async function DrsPage() {
  await serverFetch<Me>("/auth/me");
  const b = await serverFetch<DrsBoard>("/drs/season");

  const mia = b.teams.find((t) => t.isMine);
  const decisi = b.teams.filter((t) => t.onNext).length;

  return (
    <Screen>
      <PageHeader
        kicker="FantaFormula1"
        title="DRS"
        subtitle={`Moltiplica ×${b.multiplier} i punti ${b.scope === "race" ? "di Gara" : "di Gara e Sprint"} di un pezzo`}
        size="lg"
        action={mia ? <Btn href={`/squadra/${mia.teamId}/drs`} variant="outline">Gioca il tuo</Btn> : undefined}
      />

      <Main width="lg" className="space-y-5">
        {/* ── come funziona: due righe, perché è la cosa che si dimentica ── */}
        <Card accent className="px-4 py-3">
          <p className="note">
            Ognuno ha <span className="text-bone">{b.maxPerSeason} DRS</span> per tutta la stagione,
            <span className="text-bone"> uno per categoria</span>, ciascuno spendibile{" "}
            <span className="text-bone">una volta sola</span> e al massimo uno per gara. Non aggiunge
            punti: <span className="text-acid">moltiplica ×{b.multiplier}</span> quelli del pezzo su
            cui lo giochi.
          </p>
        </Card>

        {/* ── la prossima gara: chi ha già deciso ── */}
        {b.prossimoRound && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <Label>
                Prossima gara · R{b.prossimoRound.roundNo}
                {b.prossimoRound.code ? ` ${b.prossimoRound.code}` : ""}
              </Label>
              <Label>{decisi} su {b.teams.length} hanno deciso</Label>
            </div>
            <Card className="px-4 py-1">
              <ul className="ignite">
                {b.teams.map((t) => (
                  <li key={t.teamId} className="data-row flex items-center gap-3 py-2.5">
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide ${
                        t.isMine ? "text-acid" : "text-bone"
                      }`}
                    >
                      {t.name}
                      {t.isMine && <span className="label ml-2">tu</span>}
                    </span>
                    {t.onNext ? (
                      <Chip tone="acid">{ETICHETTA[t.onNext] ?? t.onNext}</Chip>
                    ) : (
                      <span className="label">non ancora</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* ── le carte di tutti: chi ha giocato che cosa ── */}
        <section>
          <Label>Carte giocate</Label>
          <p className="note mt-1">
            Ogni categoria si può usare una volta sola in tutta la stagione. Le caselle accese sono
            già bruciate.
          </p>

          <div className="mt-3 space-y-2">
            {b.teams.map((t) => {
              const perSlot = new Map(t.used.map((u) => [u.slot, u]));
              return (
                <Card key={t.teamId} accent={t.isMine} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`truncate text-sm font-semibold uppercase tracking-wide ${
                        t.isMine ? "text-acid" : "text-bone"
                      }`}
                    >
                      {t.name}
                    </p>
                    <span className="label shrink-0">
                      {t.used.length}/{b.maxPerSeason} usati · {t.left} rimasti
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {b.slots.map((s) => {
                      const u = perSlot.get(s);
                      return (
                        <div
                          key={s}
                          className={`rounded-lg border px-2 py-1.5 text-center ${
                            u ? "border-acid/50 bg-acid/10" : "border-line/60"
                          }`}
                        >
                          <p className={`label ${u ? "text-acid" : ""}`}>{ETICHETTA[s] ?? s}</p>
                          <p className={`num mt-0.5 text-xs font-bold ${u ? "text-bone" : "text-bone-dim/40"}`}>
                            {u ? (u.roundCode ?? `R${u.roundNo}`) : "—"}
                          </p>
                          {u && !u.scored && <p className="label mt-0.5 text-amber">in arrivo</p>}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {mia && (
          <div className="flex justify-center">
            <Btn href={`/squadra/${mia.teamId}/drs`} size="lg">
              Gioca i tuoi DRS ({mia.left} rimasti)
            </Btn>
          </div>
        )}

        <p className="note text-center">
          <Link href="/impostazioni" className="text-acid-deep hover:text-acid">
            Le regole del DRS si cambiano nella matrice punteggi
          </Link>
        </p>
      </Main>

      <BottomNav />
    </Screen>
  );
}
