"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/api";
import type { PersonPublic } from "@/lib/types";

type Mode = "select" | "pin";

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
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-12">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.35em] text-acid-deep">
          FantaFormula1 · 2026
        </p>
        <h1 className="mt-1 text-5xl font-bold uppercase leading-none tracking-tight text-bone">
          Griglia di<br />
          <span className="text-acid digit-glow">partenza</span>
        </h1>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-bone-dim">
          Seleziona il tuo box
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {people.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p);
                setMode("pin");
              }}
              className="panel accent-bar group flex items-center gap-3 rounded-xl px-4 py-5 text-left transition-colors hover:border-acid"
            >
              <span className="font-[family-name:var(--font-mono)] text-xs text-bone-dim">
                P{i + 1}
              </span>
              <span className="text-xl font-semibold uppercase tracking-wide text-bone group-hover:text-acid">
                {p.name}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 font-[family-name:var(--font-mono)] text-sm text-red">{error}</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-5 py-12">
      <button
        onClick={reset}
        className="self-start font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-bone-dim hover:text-acid"
      >
        ← Cambia box
      </button>

      <h1 className="mt-8 text-4xl font-bold uppercase tracking-tight text-bone">
        Ciao, <span className="text-acid">{selected?.name}</span>
      </h1>
      <p className="mt-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-bone-dim">
        Inserisci il PIN
      </p>

      <PinDots length={pin.length} />

      {error && (
        <p className="mt-4 font-[family-name:var(--font-mono)] text-sm text-red">{error}</p>
      )}
      {loading && (
        <p className="mt-4 font-[family-name:var(--font-mono)] text-sm text-bone-dim">Verifica…</p>
      )}

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
            className="flex h-16 w-16 items-center justify-center rounded-full border border-line font-[family-name:var(--font-mono)] text-2xl text-bone transition-colors hover:border-acid hover:text-acid active:scale-95 disabled:opacity-40"
          >
            {d}
          </button>
        )
      )}
    </div>
  );
}
