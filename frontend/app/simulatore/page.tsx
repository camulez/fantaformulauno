import Link from "next/link";
import { serverFetch } from "@/lib/api.server";
import { BottomNav } from "@/components/BottomNav";
import { SimLoader } from "@/components/sim/SimLoader";
import { Screen, Main, PageHeader, Card, Label, Btn, Empty } from "@/components/ui";
import { SteeringIcon } from "@/components/icons";
import { TRACKS, TRAINING, buildGeometry, getTrack } from "@/lib/sim/track";
import { formatTime } from "@/lib/sim/physics";
import type { Me, SimTracksPayload } from "@/lib/types";

export default async function SimulatorePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  await serverFetch<Me>("/auth/me");
  const { r } = await searchParams;
  const roundNo = Number(r);

  // ── Pista prova: allenamento libero, nessun tentativo, nessun tempo salvato ──
  if (r !== undefined && roundNo === TRAINING.roundNo) {
    return (
      <Screen>
        <main className="flex-1">
          <SimLoader roundNo={TRAINING.roundNo} mode="training" />
        </main>
        <BottomNav />
      </Screen>
    );
  }

  // ── Un circuito del campionato: si guida solo se il GP non è ancora stato corso ──
  if (Number.isInteger(roundNo) && TRACKS.some((t) => t.roundNo === roundNo)) {
    const data = await serverFetch<SimTracksPayload>("/simulator/tracks");
    const info = data.tracks.find((t) => t.roundNo === roundNo);
    const def = getTrack(roundNo);

    if (!info) {
      return (
        <Screen>
          <PageHeader back="/simulatore" backLabel="Circuiti" kicker="Simulatore" title={def.name} />
          <Main width="md">
            <Empty title="Non in calendario" action={<Btn href="/simulatore">Torna ai circuiti</Btn>}>
              R{roundNo} non fa parte del calendario di questa stagione.
            </Empty>
          </Main>
          <BottomNav />
        </Screen>
      );
    }

    if (!info.open) {
      return (
        <Screen>
          <PageHeader back="/simulatore" backLabel="Circuiti" kicker="Simulatore" title={def.name} />
          <Main width="md">
            <Empty
              title="Circuito chiuso"
              action={<Btn href={`/simulatore/classifica/${roundNo}`}>Vedi la classifica</Btn>}
            >
              Il GP di {def.name} è già stato disputato: si gira in previsione della gara, non dopo.
            </Empty>
          </Main>
          <BottomNav />
        </Screen>
      );
    }

    if (info.attemptsLeft === 0) {
      return (
        <Screen>
          <PageHeader back="/simulatore" backLabel="Circuiti" kicker="Simulatore" title={def.name} />
          <Main width="md">
            <Empty
              title="Tentativi esauriti"
              action={<Btn href={`/simulatore/classifica/${roundNo}`}>Vedi la classifica</Btn>}
            >
              Hai usato tutti e {data.maxAttempts} i tentativi su questo circuito. Vale il tuo miglior
              tempo: <span className="num text-acid">{formatTime(info.myBest ?? 0)}</span>. Per continuare a
              guidare c&apos;è la pista prova.
            </Empty>
            <div className="mt-3 flex justify-center">
              <Btn href="/simulatore?r=0" variant="quiet">
                Vai alla pista prova
              </Btn>
            </div>
          </Main>
          <BottomNav />
        </Screen>
      );
    }

    return (
      <Screen>
        <main className="flex-1">
          <SimLoader roundNo={roundNo} mode="timed" attemptsLeft={info.attemptsLeft} />
        </main>
        <BottomNav />
      </Screen>
    );
  }

  // ── Scelta del circuito ──
  // Niente `.catch`: se lo stato dei circuiti non si può leggere, `serverFetch` porta alla
  // schermata che spiega perché. Inventare «tutti aperti, 3 tentativi» — come faceva prima —
  // costruiva una realtà credibile e falsa, ed è il difetto che ha ingannato l'utente.
  const data = await serverFetch<SimTracksPayload>("/simulator/tracks");
  const byRound = new Map(data.tracks.map((t) => [t.roundNo, t]));
  const maxAttempts = data.maxAttempts;

  const cards = TRACKS.map((t) => {
    const g = buildGeometry(t);
    const info = byRound.get(t.roundNo);
    return {
      roundNo: t.roundNo,
      code: t.code,
      name: t.name,
      km: (g.length / 1000).toFixed(2),
      // Un circuito non in calendario non è "aperto": è semplicemente ignoto.
      open: info?.open ?? false,
      attemptsLeft: info?.attemptsLeft ?? 0,
      myBest: info?.myBest ?? null,
      record: info?.record ?? null,
      inCalendario: info !== undefined,
    };
  });
  const aperti = cards.filter((c) => c.open).length;
  const trainingKm = (buildGeometry(TRAINING).length / 1000).toFixed(2);

  return (
    <Screen>
      <PageHeader
        kicker="Simulatore"
        title="Scegli il circuito"
        subtitle={`${aperti} circuiti aperti · ${maxAttempts} tentativi ciascuno`}
        size="lg"
      />

      <Main width="lg" className="space-y-5">
        {/* ── Pista prova: sempre aperta, senza conseguenze ── */}
        <Link href="/simulatore?r=0" className="block">
          <Card tone="hi" accent chamfer className="rise px-5 pb-4 pt-4">
            <div className="flex items-center gap-4">
              <SteeringIcon className="h-8 w-8 shrink-0 text-acid" />
              <div className="min-w-0 flex-1">
                <Label className="text-acid">Pista prova · allenamento libero</Label>
                <p
                  className="mt-0.5 font-semibold uppercase tracking-wide text-bone"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  {TRAINING.name}
                </p>
                <p className="note mt-1">
                  {trainingKm} km · giri illimitati, niente tentativi, niente classifica. Qui si sbaglia
                  gratis.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        {/* ── I circuiti del campionato ── */}
        <section>
          <Label>Circuiti del campionato</Label>
          <p className="note mt-1">
            Si gira <span className="text-bone">prima</span> del GP: appena la gara viene disputata, il
            circuito si chiude. Uscire di pista costa <span className="text-red">3 s</span> di penalità.
          </p>

          <div className="ignite mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((c) => {
              const esauriti = c.open && c.attemptsLeft === 0;
              const href = c.open
                ? esauriti
                  ? `/simulatore/classifica/${c.roundNo}`
                  : `/simulatore?r=${c.roundNo}`
                : `/simulatore/classifica/${c.roundNo}`;

              const inner = (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className={`num text-lg font-bold ${c.open ? "text-acid" : "text-bone-dim"}`}>
                      {c.code}
                    </span>
                    <span className="label">R{c.roundNo}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-bone">{c.name}</p>

                  {c.open ? (
                    <>
                      {/* tentativi: pieni quelli usati, vuoti quelli che restano */}
                      <div className="mt-1.5 flex items-center gap-1">
                        {Array.from({ length: maxAttempts }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${
                              i < maxAttempts - c.attemptsLeft ? "bg-acid" : "bg-line"
                            }`}
                          />
                        ))}
                        <span className="label ml-1">
                          {esauriti ? "esauriti" : `${c.attemptsLeft} rimasti`}
                        </span>
                      </div>
                      <p className="num mt-1 text-[10px] text-bone-dim">
                        {c.myBest !== null ? (
                          <span className="text-bone">{formatTime(c.myBest)}</span>
                        ) : (
                          `${c.km} km`
                        )}
                        {c.record && <span className="ml-1">· rec {c.record.person}</span>}
                      </p>
                    </>
                  ) : (
                    <p className="label mt-2">
                      {c.inCalendario ? "Già corso · chiuso" : "Non in calendario"}
                    </p>
                  )}
                </>
              );

              // I circuiti chiusi restano leggibili ma spenti: si vede che ci sono e perché
              // non si possono più girare. Portano comunque alla classifica.
              return (
                <Link
                  key={c.roundNo}
                  href={href}
                  className={`panel rounded-xl p-3 transition-colors ${
                    c.open ? "hover:border-acid/50" : "opacity-45 hover:opacity-70"
                  }`}
                  style={{ transitionDuration: "var(--dur-1)" }}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      </Main>

      <BottomNav />
    </Screen>
  );
}
