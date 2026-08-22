import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Card, Label, Btn } from "@/components/ui";
import type { Me, RoundDetail } from "@/lib/types";

export default async function RoundPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  await serverFetch<Me>("/auth/me");

  let data: RoundDetail;
  try {
    data = await serverFetch<RoundDetail>(`/standings/round/${n}`);
  } catch (err) {
    // `redirect()` di Next funziona LANCIANDO: senza questo, una sessione scaduta o un
    // servizio giù finirebbero qui e mostrerebbero la pagina sbagliata.
    unstable_rethrow(err);
    notFound();
  }

  const top = data!.teams[0]?.roundPoints ?? 0;

  return (
    <Screen>
      <PageHeader
        back="/"
        backLabel="Home"
        kicker="GP fantasy"
        title={`R${data!.round.round_no} · ${data!.round.code}`}
        action={
          <Btn href={`/report/${data!.round.round_no}`} variant="outline">
            Il mio report
          </Btn>
        }
      />

      <Main width="md">
        <Label>Punti fatti in questo round</Label>
        {/* Accensione a cascata: la graduatoria del round si popola come una torre dei tempi. */}
        <ol className="ignite mt-2 space-y-1.5">
          {data!.teams.map((t, i) => {
            const isTop = i === 0 && top > 0;
            return (
              <li key={t.teamId}>
                <Link href={`/squadra/${t.teamId}`} className="panel flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <span className={`num w-6 text-center text-lg font-bold ${isTop ? "digit-glow text-acid" : "text-bone-dim"}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold uppercase tracking-wide ${isTop ? "text-acid" : "text-bone"}`}>
                      {t.name}
                    </p>
                    <p className="num text-[10px] uppercase tracking-widest text-bone-dim">totale {t.cumulative}</p>
                  </div>
                  <p className={`num text-lg font-bold ${isTop ? "text-acid" : "text-bone"}`}>+{t.roundPoints}</p>
                </Link>
              </li>
            );
          })}
        </ol>

        {data!.teams.length === 0 && (
          <Card tone="hi" chamfer className="mt-4 px-5 py-8 text-center">
            <p className="label leading-relaxed">Nessun punteggio registrato per questo round.</p>
          </Card>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
