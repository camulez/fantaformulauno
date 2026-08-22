import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { Screen, Main, PageHeader, Card, Label, DataRow, Btn } from "@/components/ui";
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
  } catch (err) {
    // `redirect()` di Next funziona LANCIANDO: senza questo, una sessione scaduta o un
    // servizio giù finirebbero qui e mostrerebbero la pagina sbagliata.
    unstable_rethrow(err);
    notFound();
  }

  const rosterName = new Map(team!.roster.map((r) => [r.slot, r.name]));
  const rounds = team!.rounds.map((r) => `R${r.round_no}`);

  return (
    <Screen>
      <PageHeader
        back="/classifica"
        backLabel="Mondiale"
        kicker={`Posizione ${team!.position}`}
        title={team!.name}
        action={
          <p className="num digit-glow font-bold leading-none text-acid" style={{ fontSize: "var(--text-3xl)" }}>
            {team!.total}
          </p>
        }
      />

      <Main width="md" className="space-y-4">
        <Card className="p-3">
          <Label>Andamento</Label>
          <div className="mt-2">
            <CumulativeChart rounds={rounds} series={[{ name: team!.name, color: "#c6ff3a", values: team!.cumulative }]} />
          </div>
        </Card>

        <Card className="p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label>Roster · punti per componente</Label>
            <div className="flex shrink-0 gap-3">
              {[
                { href: `/squadra/${id}/drs`, label: "DRS" },
                { href: `/squadra/${id}/mercato`, label: "Mercato" },
                { href: `/squadra/${id}/modifica`, label: "Modifica →" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="label text-acid transition-colors hover:text-acid-deep"
                  style={{ transitionDuration: "var(--dur-1)" }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <ul className="ignite">
            {SLOTS.map((s) => (
              <DataRow key={s.key} className="flex items-center gap-3">
                <Label className="w-16 shrink-0 text-acid-deep">{s.label}</Label>
                <span className="min-w-0 flex-1 truncate text-sm text-bone">{rosterName.get(s.key) ?? "—"}</span>
                <span className="num text-sm font-bold text-bone">{team!.breakdown[s.key]}</span>
              </DataRow>
            ))}
            {/* Derivati: non si comprano, li calcola il motore */}
            <DerivedRow label="Pole" value={team!.breakdown.pole} />
            <DerivedRow label="Team Manager" value={team!.breakdown.teamManager} />
            {team!.breakdown.drsBonus > 0 && <DerivedRow label="DRS" value={team!.breakdown.drsBonus} />}
            {team!.breakdown.simulator > 0 && (
              <DerivedRow label="Simulatore" value={team!.breakdown.simulator} />
            )}
          </ul>
        </Card>

        <Btn href={`/report/${team!.rounds.at(-1)?.round_no ?? 1}`} variant="quiet" className="w-full">
          Report per gara
        </Btn>
      </Main>

      <BottomNav />
    </Screen>
  );
}

function DerivedRow({ label, value }: { label: string; value: number }) {
  return (
    <DataRow className="flex items-center gap-3">
      <Label className="w-16 shrink-0">{label}</Label>
      <span className="note min-w-0 flex-1 truncate">derivato</span>
      <span className="num text-sm font-bold text-bone">{value}</span>
    </DataRow>
  );
}
