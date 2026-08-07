"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { Label } from "@/components/ui";
import type { PersonPublic } from "@/lib/types";

type Mode = "select" | "pin";

/**
 * Registro vetrina: prima impressione, zero dati. Il budget va sulla composizione —
 * titolo grande, i box che si accendono in cascata.
 */
export default function LoginPage() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonPublic[]>([]);
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<PersonPublic | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clientFetch<PersonPublic[]>("/auth/people")
      .then(setPeople)
      .catch(() => setError("Impossibile caricare i partecipanti"));
  }, []);

  function attemptLogin(fullPin: string) {
    if (!selected || loading) return;
    setLoading(true);
    clientFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ personId: selected.id, pin: fullPin }),
    })
      .then(() => router.push("/"))
      .catch((e) => {
        setError(e.message || "PIN errato");
        setPin("");
      })
      .finally(() => setLoading(false));
  }

  function pressDigit(d: string) {
    if (loading || pin.length >= 4) return;
    setError(null);
    const next = pin + d;
    setPin(next);
    if (next.length === 4) attemptLogin(next);
  }

  function backspace() {
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  function reset() {
    setMode("select");
    setSelected(null);
    setPin("");
    setError(null);
  }

  if (mode === "select") {
    return (
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden px-5 py-12">
        {/* Filigrana dell'anno: profondità senza aggiungere un elemento da leggere. */}
        <span
          aria-hidden
          className="num pointer-events-none absolute -right-6 top-4 select-none font-bold leading-none text-bone/[0.035]"
          style={{ fontSize: "var(--text-5xl)" }}
        >
          2026
        </span>

        <Label className="relative text-acid-deep">FantaFormula1 · 2026</Label>
        <h1
          className="relative mt-1 font-bold uppercase leading-[0.9] tracking-tight text-bone"
          style={{ fontSize: "var(--text-5xl)" }}
        >
          Griglia di
          <br />
          <span className="digit-glow text-acid">partenza</span>
        </h1>
        <Label className="relative mt-3 text-xs">Seleziona il tuo box</Label>

        <div className="ignite relative mt-8 grid grid-cols-2 gap-3">
          {people.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p);
                setMode("pin");
              }}
              className="panel accent-bar group flex items-center gap-3 rounded-xl px-4 py-5 text-left transition-colors hover:border-acid"
              style={{ transitionDuration: "var(--dur-1)" }}
            >
              <span className="num text-xs text-bone-dim">P{i + 1}</span>
              <span
                className="font-semibold uppercase tracking-wide text-bone group-hover:text-acid"
                style={{ fontSize: "var(--text-xl)" }}
              >
                {p.name}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="num relative mt-6 text-sm text-red">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-5 py-12">
      <button
        onClick={reset}
        className="label self-start transition-colors hover:text-acid"
        style={{ transitionDuration: "var(--dur-1)" }}
      >
        ← Cambia box
      </button>

      <h1 className="mt-8 font-bold uppercase tracking-tight text-bone" style={{ fontSize: "var(--text-4xl)" }}>
        Ciao, <span className="text-acid">{selected?.name}</span>
      </h1>
      <Label className="mt-2 text-xs">Inserisci il PIN</Label>

      <PinDots length={pin.length} />

      {error && <p className="num mt-4 text-sm text-red">{error}</p>}
      {loading && <p className="num mt-4 text-sm text-bone-dim">Verifica…</p>}

      <PinPad disabled={loading} onDigit={pressDigit} onBackspace={backspace} />
    </main>
  );
}

function PinDots({ length }: { length: number }) {
  return (
    <div className="mt-8 flex gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition-colors ${
            i < length ? "border-acid bg-acid" : "border-line bg-transparent"
          }`}
          style={{ transitionDuration: "var(--dur-1)" }}
        />
      ))}
    </div>
  );
}

function PinPad({
  disabled,
  onDigit,
  onBackspace,
}: {
  disabled: boolean;
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="mt-10 grid grid-cols-3 gap-4">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
        d === "" ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            disabled={disabled}
            onClick={() => (d === "⌫" ? onBackspace() : onDigit(d))}
            className="num flex h-16 w-16 items-center justify-center rounded-full border border-line text-2xl text-bone transition-colors hover:border-acid hover:text-acid active:scale-95 disabled:opacity-40"
            style={{ transitionDuration: "var(--dur-1)" }}
          >
            {d}
          </button>
        )
      )}
    </div>
  );
}
