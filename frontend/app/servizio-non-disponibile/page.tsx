import { Screen, Main, Card, Label, Btn } from "@/components/ui";
import { RiprovaAutomatica } from "@/components/RiprovaAutomatica";

/**
 * Dove si finisce quando l'app non riesce a parlare col backend o col database.
 * Esiste per un motivo preciso: «qualcosa si è rotto» non distingue un bug del codice da
 * un servizio gratuito che si è addormentato, e le due cose si risolvono in modi opposti.
 */
export default async function ServizioNonDisponibilePage({
  searchParams,
}: {
  searchParams: Promise<{ causa?: string }>;
}) {
  const { causa } = await searchParams;
  const dbSospeso = causa === "database";

  return (
    <Screen>
      <Main width="md" className="flex flex-col justify-center">
        <Card tone="hi" accent chamfer className="rise px-6 py-8">
          <Label className="text-amber">{dbSospeso ? "Database sospeso" : "Server in avvio"}</Label>
          <h1
            className="mt-1 font-semibold uppercase leading-[1.05] tracking-wide text-bone"
            style={{ fontSize: "var(--text-2xl)" }}
          >
            {dbSospeso ? "L'archivio è in pausa" : "Sto accendendo il server"}
          </h1>

          {dbSospeso ? (
            <>
              <p className="note mt-3">
                Il database va in pausa da solo dopo <span className="text-bone">7 giorni</span> che
                nessuno apre l&apos;app: è una regola del piano gratuito di Supabase, non un guasto.
                I dati non si perdono, ma finché è sospeso l&apos;app non vede nulla — e alcune
                schermate mostrano numeri vuoti o sbagliati.
              </p>
              <div className="mt-4 border-t border-line/60 pt-4">
                <Label className="text-acid-deep">Come riattivarlo</Label>
                <ol className="note mt-2 space-y-1.5">
                  <li>1 · Apri supabase.com/dashboard</li>
                  <li>2 · Scegli il progetto di FantaFormula1</li>
                  <li>
                    3 · Premi <span className="text-bone">Restore project</span> e aspetta un paio
                    di minuti
                  </li>
                </ol>
              </div>
            </>
          ) : (
            <p className="note mt-3">
              Il server va in letargo dopo <span className="text-bone">15 minuti</span> che nessuno lo
              usa, sempre per via del piano gratuito. Si sveglia da solo:{" "}
              <span className="text-bone">ci vuole circa un minuto</span>, e succede una volta sola.
              Non serve fare niente.
            </p>
          )}

          <RiprovaAutomatica />

          <div className="mt-5 flex flex-wrap gap-2">
            <Btn href="/">Riprova adesso</Btn>
            <Btn href="/simulatore?r=0" variant="quiet">
              Intanto vai in pista
            </Btn>
          </div>
          <p className="note mt-3">
            Il simulatore sulla pista prova funziona anche così: gira tutto nel telefono, non gli
            serve il database.
          </p>
        </Card>
      </Main>
    </Screen>
  );
}
