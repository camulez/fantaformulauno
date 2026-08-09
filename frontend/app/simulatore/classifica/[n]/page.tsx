import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Card, Label, Empty, Btn, Chip } from "@/components/ui";
import { formatTime } from "@/lib/sim/physics";
import { getTrack } from "@/lib/sim/track";
import type { Me, SimLeaderboard } from "@/lib/types";

export default async function SimClassificaPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const roundNo = Number(n);
  await serverFetch<Me>("/auth/me");

  const data = await serverFetch<SimLeaderboard>(`/simulator/leaderboard/${roundNo}`).catch(() => null);
  const def = getTrack(roundNo);
  const rows = data?.rows ?? [];
  const best = rows[0]?.timeMs ?? 0;

  return (
    <Screen>
      <PageHeader
        back="/simulatore"
        backLabel="Circuiti"
        kicker={`Simulatore · R${roundNo}`}
        title={def.name}
        subtitle={data?.open ? "Circuito aperto" : "GP disputato · circuito chiuso"}
        action={data?.open ? <Btn href={`/simulatore?r=${roundNo}`} variant="outline">Gira</Btn> : undefined}
      />

      <Main width="md">
        {rows.length === 0 ? (
          <Empty
            title="Nessun tempo registrato"
            action={
              data?.open ? (
                <Btn href={`/simulatore?r=${roundNo}`}>Sii il primo</Btn>
              ) : (
                <Btn href="/simulatore?r=0" variant="quiet">Vai alla pista prova</Btn>
              )
            }
          >
            {data?.open
              ? "Nessuno ha ancora girato su questo circuito."
              : "Il GP è stato disputato senza che nessuno registrasse un tempo."}
          </Empty>
        ) : (
          <ol className="ignite space-y-1.5">
            {rows.map((r, i) => (
              <li key={r.person}>
                <Card className={i === 0 ? "accent-bar px-3 py-2.5" : "px-3 py-2.5"}>
                  <div className="flex items-center gap-3">
                    <span className={`num w-6 text-center text-lg font-bold ${i === 0 ? "text-acid" : "text-bone-dim"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold uppercase tracking-wide text-bone">
                        {r.person}
                      </p>
                      <p className="note mt-0.5">
                        {r.attempts} {r.attempts === 1 ? "tentativo" : "tentativi"} · frenata{" "}
                        {r.brakeAssist ? "assistita" : "manuale"}
                        {r.penaltyMs > 0 && (
                          <span className="text-red">
                            {" "}
                            · {r.violations} {r.violations === 1 ? "infrazione" : "infrazioni"} +
                            {(r.penaltyMs / 1000).toFixed(0)} s
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`num text-base font-bold leading-none ${i === 0 ? "digit-glow text-acid" : "text-bone"}`}>
                        {formatTime(r.timeMs)}
                      </p>
                      {i > 0 && (
                        <p className="num mt-1 text-[10px] text-bone-dim">
                          +{((r.timeMs - best) / 1000).toFixed(3)}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}

        {rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Chip tone={data?.open ? "acid" : "quiet"}>{data?.open ? "● Aperto" : "○ Chiuso"}</Chip>
            <p className="note">Vale il miglior tempo di ogni pilota.</p>
          </div>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
