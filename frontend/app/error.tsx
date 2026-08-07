"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="label text-red">Bandiera rossa</p>
      <h1 className="font-semibold uppercase tracking-wide text-bone" style={{ fontSize: "var(--text-2xl)" }}>
        Qualcosa si è rotto
      </h1>
      <p className="label max-w-xs leading-relaxed">
        La pagina non è riuscita a caricare i dati. Di solito basta riprovare.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-acid px-6 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-carbon-950"
      >
        Riprova
      </button>
    </div>
  );
}
