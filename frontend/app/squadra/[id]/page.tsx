import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { CumulativeChart } from "@/components/charts/CumulativeChart";
import type { Me, TeamDetail } from "@/lib/types";

const SLOTS: { key: keyof TeamDetail["breakdown"]; label: string }[] = [
  { key: "telaio", label: "Telaio" },
  { key: "motore", label: "Motore" },
  { key: "pilota1", label: "Pilota 1" },
  { key: "pilota2", label: "Pilota 2" },
  { key: "sponsor", label: "Sponsor" },
  { key: "benzina", label: "Benzina" },
];

export default async function SquadraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await serverFetch<Me>("/auth/me");

  let team: TeamDetail;
  try {
    team = await serverFetch<TeamDetail>(`/standings/team/${id}`);
  } catch {
    notFound();
  }

  const rosterName = new Map(team!.roster.map((r) => [r.slot, r.name]));
  const rounds = team!.rounds.map((r) => `R${r.round_no}`);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <Link href="/classifica" className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid">
          ← Mondiale
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
              Posizione {team!.position}
            </p>
            <h1 className="mt-0.5 truncate text-2xl font-semibold uppercase tracking-wide text-bone">
              {team!.name}
            </h1>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-3xl font-bold text-acid digit-glow">
            {team!.total}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-5">
        <section className="panel rounded-lg p-3">
          <h2 className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
            Andamento
          </h2>
          <CumulativeChart rounds={rounds} series={[{ name: team!.name, color: "#c6ff3a", values: team!.cumulative }]} />
        </section>

        <section className="panel rounded-lg p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-bone-dim">
              Roster · punti per componente
            </h2>
            <div className="flex gap-3">
              <Link
                href={`/squadra/${id}/drs`}
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid transition-colors hover:text-acid-deep"
              >
                DRS
              </Link>
              <Link
                href={`/squadra/${id}/mercato`}
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid transition-colors hover:text-acid-deep"
              >
                Mercato
              </Link>
              <Link
                href={`/squadra/${id}/modifica`}
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-acid transition-colors hover:text-acid-deep"
              >
                Modifica →
              </Link>
            </div>
          </div>
          <ul className="divide-y divide-line/50">
            {SLOTS.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2">
                <span className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-acid-deep">
                  {s.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-bone">{rosterName.get(s.key) ?? "—"}</span>
                <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-bone">
                  {team!.breakdown[s.key]}
                </span>
              </li>
            ))}
            {/* Derivati */}
            <DerivedRow label="Pole" value={team!.breakdown.pole} />
            <DerivedRow label="Team Manager" value={team!.breakdown.teamManager} />
            {team!.breakdown.drsBonus > 0 && <DerivedRow label="DRS" value={team!.breakdown.drsBonus} />}
          </ul>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

function DerivedRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-bone-dim">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-bone-dim">
        derivato
      </span>
      <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-bone">{value}</span>
    </li>
  );
}
