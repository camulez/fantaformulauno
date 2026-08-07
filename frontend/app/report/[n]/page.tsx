import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import type { Me, ReportRow, RoundReport } from "@/lib/types";

const mono = "font-[family-name:var(--font-mono)]";

/** Spiegazione di come nascono i punti di un pezzo. */
function Spiegazione({ row }: { row: ReportRow }) {
  const dim = `${mono} text-[10px] leading-relaxed tracking-wider text-bone-dim`;

  switch (row.slot) {
    case "telaio":
    case "motore":
      return (
        <p className={dim}>
          {row.scuderia}
          {row.drivers.length > 0 && " · "}
          {row.drivers.map((d, i) => {
            const penalizzato = d.raceDeduction !== "none" || d.sprintDeduction !== "none";
            return (
              <span key={i}>
                {i > 0 && " + "}
                {d.name} {d.counted}
                {penalizzato && <span className="text-red"> (penalizzato)</span>}
              </span>
            );
          })}
        </p>
      );
    case "pilota1":
    case "pilota2":
      return (
        <p className={dim}>
          {row.pilota} · Gara {row.race}
          {row.sprint > 0 && ` + Sprint ${row.sprint}`}
        </p>
      );
    default:
      return (
        <p className={dim}>
          {row.scuderia} · {row.carsScored} {row.carsScored === 1 ? "monoposto" : "monoposto"} a punti × {row.perCar}
        </p>
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link
          href={`/report?team=${teamId}`}
          className={`${mono} text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid`}
        >
          ← Report
        </Link>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide text-bone">
          R{rep.round.round_no} · {rep.round.code ?? ""}
        </h1>
        <p className={`${mono} mt-1 text-[10px] uppercase tracking-widest text-bone-dim`}>
          {rep.team.name}
          {rep.round.name ? ` · ${rep.round.name}` : ""}
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-5">
        {/* riepilogo */}
        <div className="panel accent-bar flex items-end justify-between rounded-xl px-4 py-3">
          <div>
            <p className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>Punti nella gara</p>
            <p className={`${mono} text-3xl font-bold text-acid`}>{rep.total}</p>
          </div>
          <div className="text-right">
            <p className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>Posizione</p>
            <p className={`${mono} text-xl font-bold text-bone`}>{rep.position}°</p>
            {gap > 0 && <p className={`${mono} text-[10px] text-bone-dim`}>−{gap} dal migliore</p>}
          </div>
        </div>

        {rep.incomplete ? (
          <p className={`${mono} py-6 text-center text-[11px] uppercase tracking-widest text-bone-dim`}>
            Roster incompleto per questa gara.
          </p>
        ) : (
          <>
            {/* i sei pezzi */}
            <section className="panel rounded-xl p-3">
              <p className={`${mono} mb-2 text-[10px] uppercase tracking-[0.25em] text-acid-deep`}>I tuoi pezzi</p>
              <ul className="divide-y divide-line/40">
                {rep.rows.map((row) => (
                  <li key={row.slot} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>{row.label}</span>
                        <p className="truncate text-sm font-semibold text-bone">{row.componentName}</p>
                      </div>
                      <span className={`${mono} shrink-0 text-lg font-bold ${row.points > 0 ? "text-acid" : "text-bone-dim"}`}>
                        {row.points}
                      </span>
                    </div>
                    <Spiegazione row={row} />
                  </li>
                ))}
              </ul>
            </section>

            {/* voci derivate */}
            {rep.derived && (
              <section className="panel rounded-xl p-3">
                <p className={`${mono} mb-2 text-[10px] uppercase tracking-[0.25em] text-acid-deep`}>Bonus</p>
                <ul className="divide-y divide-line/40">
                  <li className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-bone">Pole</p>
                      <p className={`${mono} text-[10px] tracking-wider text-bone-dim`}>
                        {rep.derived.pole.driverName
                          ? rep.derived.pole.owned
                            ? `${rep.derived.pole.driverName}, un tuo pilota`
                            : `${rep.derived.pole.driverName}, non tuo`
                          : "nessuna pole registrata"}
                      </p>
                    </div>
                    <span className={`${mono} shrink-0 text-lg font-bold ${rep.derived.pole.points > 0 ? "text-acid" : "text-bone-dim"}`}>
                      {rep.derived.pole.points}
                    </span>
                  </li>

                  <li className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-bone">Team Manager</p>
                      <p className={`${mono} text-[10px] tracking-wider text-bone-dim`}>
                        {rep.derived.teamManager.p1Scored && rep.derived.teamManager.p2Scored
                          ? "entrambi i tuoi piloti a punti"
                          : rep.derived.teamManager.p1Scored || rep.derived.teamManager.p2Scored
                            ? "solo uno dei tuoi piloti a punti"
                            : "nessuno dei tuoi piloti a punti"}
                      </p>
                    </div>
                    <span className={`${mono} shrink-0 text-lg font-bold ${rep.derived.teamManager.points > 0 ? "text-acid" : "text-bone-dim"}`}>
                      {rep.derived.teamManager.points}
                    </span>
                  </li>

                  <li className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-bone">DRS</p>
                      <p className={`${mono} text-[10px] tracking-wider text-bone-dim`}>
                        {rep.derived.drs.slot
                          ? `giocato sul ${rep.derived.drs.slotLabel}${
                              rep.derived.drs.componentName ? ` (${rep.derived.drs.componentName})` : ""
                            } · ×${rep.derived.drs.multiplier} sui punti ${
                              rep.derived.drs.scope === "race" ? "Gara" : "Gara e Sprint"
                            }`
                          : "non giocato in questa gara"}
                      </p>
                    </div>
                    <span className={`${mono} shrink-0 text-lg font-bold ${rep.derived.drs.bonus > 0 ? "text-acid" : "text-bone-dim"}`}>
                      {rep.derived.drs.bonus > 0 ? `+${rep.derived.drs.bonus}` : 0}
                    </span>
                  </li>
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
