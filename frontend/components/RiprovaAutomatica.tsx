"use client";

import { useEffect, useState } from "react";

/**
 * Interroga il backend finché il database non risponde, poi ricarica la pagina da cui
 * si veniva. Serve al risveglio di Render (~1 minuto sul piano gratuito): l'attesa resta,
 * ma smette di sembrare un guasto e non tocca all'utente ricaricare a mano.
 */
export function RiprovaAutomatica({ tornaA = "/" }: { tornaA?: string }) {
  const [tentativi, setTentativi] = useState(0);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const id = setInterval(async () => {
      if (!vivo) return;
      setTentativi((n) => n + 1);
      try {
        const r = await fetch("/api/health/db", { cache: "no-store" });
        if (r.ok && vivo) {
          setPronto(true);
          clearInterval(id);
          // Un attimo per far leggere l'esito, poi si riparte.
          setTimeout(() => window.location.replace(tornaA), 700);
        }
      } catch {
        /* ancora giù: si riprova al giro dopo */
      }
    }, 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [tornaA]);

  return (
    <p className="note mt-4" role="status" aria-live="polite">
      {pronto ? (
        <span className="text-acid">È tornato su. Ti riporto all&apos;app…</span>
      ) : (
        <>
          Controllo da solo ogni 5 secondi
          {tentativi > 0 && <> · {tentativi} tentativ{tentativi === 1 ? "o" : "i"}</>}
        </>
      )}
    </p>
  );
}
