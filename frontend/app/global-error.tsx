"use client";

// Cattura gli errori del layout radice, che `error.tsx` non vede: qui il documento
// va ricostruito da zero, html e body inclusi.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ background: "#08090a", color: "#eef3f1", fontFamily: "ui-sans-serif, system-ui" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ff2e43" }}>
            Bandiera rossa
          </p>
          <h1 style={{ fontSize: "1.6rem", textTransform: "uppercase", letterSpacing: "0.02em", margin: 0 }}>
            L&apos;app non è ripartita
          </h1>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#8a969c", maxWidth: 320, lineHeight: 1.6 }}>
            Errore nel guscio dell&apos;applicazione. Ricaricare di solito basta.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "0.65rem 1.5rem",
              borderRadius: 10,
              border: 0,
              background: "#c6ff3a",
              color: "#08090a",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
