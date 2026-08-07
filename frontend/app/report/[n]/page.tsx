import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, Card, Label, DataRow, Btn } from "@/components/ui";
import type { Me, ReportRow, RoundReport } from "@/lib/types";

/**
 * IL MOMENTO dell'app (vedi DESIGN.md): la schermata che si mostra agli altri dopo un GP.
 * Qui si concentra il budget espressivo — composizione non lineare, elevazione piena,
 * l'accensione a cascata sulle voci.
 */

/** Spiegazione di come nascono i punti di un pezzo. */
function Spiegazione({ row }: { row: ReportRow }) {
  const cls = "label mt-1 block normal-case leading-relaxed tracking-wider";

  switch (row.slot) {
    case "telaio":
    case "motore":
      return (
        <span className={cls}>
          {row.scuderia}
          {row.drivers.length > 0 && " · "}
          {row.drivers.map((d, i) => {
            const penalizzato = d.raceDeduction !== "none" || d.sprintDeduction !== "none";
            return (
              <span key={i}>
                {i > 0 && " + "}
                {d.name} <span className="num">{d.counted}</span>
                {penalizzato && <span className="text-red"> (penalizzato)</span>}
              </span>
            );
          })}
        </span>
      );
    case "pilota1":
    case "pilota2":
      return (
        <span className={cls}>
          Gara <span className="num">{row.race}</span>
          {row.sprint > 0 && (
            <>
              {" + Sprint "}
              <span className="num">{row.sprint}</span>
            </>
          )}
        </span>
      );
    default:
      return (
        <span className={cls}>
          {row.scuderia} · <span className="num">{row.carsScored}</span> a punti ×{" "}
          <span className="num">{row.perCar}</span>
        </span>
      );
  }
}

export default async function ReportRoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  await serverFetch<Me>("/auth/me");
  const { n } = await params;
  const { team: teamParam } = await searchParams;

  let teamId = teamParam;
  if (!teamId) {
    const mine = await serverFetch<{ teamId: string }>("/report/my-team");
    teamId = mine.teamId;
  }

  const rep = await serverFetch<RoundReport>(`/report/round/${n}/${teamId}`);
  const gap = rep.best - rep.total;

  // L'acid marca UN SOLO dato: il pezzo che ha reso di più.
  const migliore = rep.rows.reduce(
    (best, r) => (r.points > (best?.points ?? -1) ? r : best),
    undefined as ReportRow | undefined
  );

  const derived = rep.derived;
  const bonusTot = derived ? derived.pole.points + derived.teamManager.points + derived.drs.bonus : 0;

  return (
    <Screen>
      {/* ── testata a tutta larghezza: la sigla del circuito fa da fondale ── */}
      <header className="relative overflow-hidden border-b border-line/70">
        <span
          aria-hidden
          className="num pointer-events-none absolute -right-3 -top-5 select-none font-bold leading-none text-bone/[0.045]"
          style={{ fontSize: "var(--text-5xl)" }}
        >
          {rep.round.code ?? `R${rep.round.round_no}`}
        </span>
        <div className="relative px-5 pb-5 pt-4">
          <Link href={`/report?team=${teamId}`} className="label transition-colors hover:text-acid">
            ← Report
          </Link>
          <p className="label mt-3 text-acid-deep">
            Round {rep.round.round_no}
            {rep.round.name ? ` · ${rep.round.name}` : ""}
          </p>
          {/* Il nome squadra non deve rubare la scena al punteggio: resta un gradino sotto. */}
          <h1
            className="mt-1 font-semibold uppercase leading-[1.05] tracking-wide text-bone"
            style={{ fontSize: "var(--text-xl)" }}
          >
            {rep.team.name}
          </h1>
        </div>
      </header>

      <Main width="md" className="space-y-5">
        {/* ── il dato principale: composizione asimmetrica, non una card uguale alle altre ── */}
        <Card tone="hi" accent chamfer className="rise px-5 pb-5 pt-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Label>Punti nella gara</Label>
              <p
                className="num digit-glow font-bold leading-[0.85] text-acid"
                style={{ fontSize: "var(--text-5xl)" }}
              >
                {rep.total}
              </p>
            </div>
            <div className="pb-1 text-right">
              <p className="num font-bold leading-none text-bone" style={{ fontSize: "var(--text-2xl)" }}>
                {rep.position}
                <span className="text-bone-dim">°</span>
              </p>
              <p className="label mt-1 tracking-wider">nel round</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-line/60 pt-3">
            <Label>{gap > 0 ? "dal migliore" : "miglior punteggio"}</Label>
            <span className="num text-sm text-bone-dim">
              {gap > 0 ? `−${gap}` : "—"}
            </span>
            {bonusTot > 0 && (
              <span className="num ml-auto text-sm text-bone-dim">
                bonus +{bonusTot}
              </span>
            )}
          </div>
        </Card>

        {rep.incomplete ? (
          <p className="label py-6 text-center">Roster incompleto per questa gara.</p>
        ) : (
          <>
            {/* ── i sei pezzi: accensione a cascata ── */}
            <section>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <Label>I tuoi pezzi</Label>
                <Label>punti</Label>
              </div>
              <Card className="px-4 py-1">
                <ul className="ignite">
                  {rep.rows.map((row) => {
                    const top = migliore && row.slot === migliore.slot && row.points > 0;
                    return (
                      <DataRow key={row.slot}>
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <Label>{row.label}</Label>
                            <p className="truncate font-semibold text-bone" style={{ fontSize: "var(--text-base)" }}>
                              {row.componentName}
                            </p>
                          </div>
                          <span
                            className={`num shrink-0 font-bold leading-none ${
                              top ? "text-acid" : row.points > 0 ? "text-bone" : "text-bone-dim/50"
                            }`}
                            style={{ fontSize: "var(--text-xl)" }}
                          >
                            {row.points}
                          </span>
                        </div>
                        <Spiegazione row={row} />
                      </DataRow>
                    );
                  })}
                </ul>
              </Card>
            </section>

            {/* ── bonus ── */}
            {derived && (
              <section>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <Label>Bonus</Label>
                  <Label>punti</Label>
                </div>
                <Card className="px-4 py-1">
                  <ul className="ignite">
                    {[
                      {
                        k: "pole",
                        nome: "Pole",
                        pt: derived.pole.points,
                        det: derived.pole.driverName
                          ? derived.pole.owned
                            ? `${derived.pole.driverName}, un tuo pilota`
                            : `${derived.pole.driverName}, non tuo`
                          : "nessuna pole registrata",
                      },
                      {
                        k: "tm",
                        nome: "Team Manager",
                        pt: derived.teamManager.points,
                        det:
                          derived.teamManager.p1Scored && derived.teamManager.p2Scored
                            ? "entrambi i tuoi piloti a punti"
                            : derived.teamManager.p1Scored || derived.teamManager.p2Scored
                              ? "solo uno dei tuoi piloti a punti"
                              : "nessuno dei tuoi piloti a punti",
                      },
                      {
                        k: "drs",
                        nome: "DRS",
                        pt: derived.drs.bonus,
                        det: derived.drs.slot
                          ? `sul ${derived.drs.slotLabel}${
                              derived.drs.componentName ? ` (${derived.drs.componentName})` : ""
                            } · ×${derived.drs.multiplier} sui punti ${
                              derived.drs.scope === "race" ? "Gara" : "Gara e Sprint"
                            }`
                          : "non giocato in questa gara",
                      },
                    ].map((b) => (
                      <DataRow key={b.k}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-semibold text-bone" style={{ fontSize: "var(--text-base)" }}>
                            {b.nome}
                          </p>
                          <span
                            className={`num shrink-0 font-bold leading-none ${
                              b.pt > 0 ? "text-bone" : "text-bone-dim/50"
                            }`}
                            style={{ fontSize: "var(--text-xl)" }}
                          >
                            {b.pt > 0 ? `+${b.pt}` : 0}
                          </span>
                        </div>
                        <span className="label mt-1 block normal-case leading-relaxed tracking-wider">{b.det}</span>
                      </DataRow>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            <div className="flex gap-2 pt-1">
              <Btn href={`/report?team=${teamId}`} variant="outline" className="flex-1">
                Tutta la stagione
              </Btn>
              <Btn href={`/round/${rep.round.round_no}`} variant="quiet" className="flex-1">
                Gli altri
              </Btn>
            </div>
          </>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
