import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="num font-bold leading-none text-bone/10" style={{ fontSize: "var(--text-5xl)" }}>
        404
      </p>
      <h1 className="font-semibold uppercase tracking-wide text-bone" style={{ fontSize: "var(--text-2xl)" }}>
        Fuori pista
      </h1>
      <p className="label max-w-xs leading-relaxed">Questa pagina non esiste.</p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-acid/40 bg-acid/5 px-6 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-acid"
      >
        Torna ai box
      </Link>
    </div>
  );
}
