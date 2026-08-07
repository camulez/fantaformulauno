import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { Screen, Main, PageHeader, Card, Label, Empty, Btn } from "@/components/ui";
import { TrophyIcon } from "@/components/icons";
import type { HistoryData, Me } from "@/lib/types";

export default async function StoricoPage() {
  await serverFetch<Me>("/auth/me");
  const { albo, titoli } = await serverFetch<HistoryData>("/history");

  const empty = albo.length === 0 && titoli.length === 0;

  return (
    <Screen>
      <PageHeader
        kicker="FantaFormula1"
        title="Albo d'oro"
        subtitle="Vent'anni di campioni"
        size="lg"
        action={
          <Btn href="/storico/gestione" variant="outline">
            Gestisci
          </Btn>
        }
      />

      <Main width="md" className="space-y-5">
        {empty ? (
          <Empty
            icon={<TrophyIcon className="h-8 w-8" />}
            title="Nessuna stagione in archivio"
            action={<Btn href="/storico/gestione">+ Aggiungi stagione</Btn>}
          >
            Aggiungi i campioni delle stagioni passate — campione e Coppa Team Manager.
          </Empty>
        ) : (
          <>
            <section>
              <Label>Stagioni</Label>
              <ul className="ignite mt-2 space-y-1.5">
                {albo.map((r) => (
                  <li key={r.year} className="panel flex items-center gap-3 rounded-lg px-4 py-3">
                    <span className="num w-12 shrink-0 text-lg font-bold text-acid">{r.year}</span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm text-bone">
                        <span className="text-acid-deep">Campione:</span> {r.champion ?? "—"}
                      </p>
                      <p className="note truncate">Coppa TM: {r.tmCup ?? "—"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <Label>Titoli &amp; bacheca</Label>
              <Card className="mt-2 px-4 py-2">
                {/* Tabella di dati: numeri incolonnati, l'acid solo sui titoli. */}
                <table className="num w-full text-xs">
                  <thead>
                    <tr className="label">
                      <th className="py-1.5 text-left font-normal">Persona</th>
                      <th className="py-1.5 text-right font-normal">Titoli</th>
                      <th className="py-1.5 text-right font-normal">Coppe TM</th>
                      <th className="py-1.5 text-right font-normal">Stagioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titoli.map((t) => (
                      <tr key={t.name} className="border-t border-line/50">
                        <td className="py-2 text-left text-bone">{t.name}</td>
                        <td className="py-2 text-right font-bold text-acid">{t.championships}</td>
                        <td className="py-2 text-right text-bone">{t.tmCups}</td>
                        <td className="py-2 text-right text-bone-dim">{t.participations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
      </Main>

      <BottomNav />
    </Screen>
  );
}
