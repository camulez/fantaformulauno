import { BottomNav } from "@/components/BottomNav";

export function ComingSoon({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-acid-deep">
          FantaFormula1
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold uppercase tracking-wide text-bone">
          {title}
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="rise panel accent-bar w-full rounded-xl px-6 py-10">
          <p className="font-[family-name:var(--font-mono)] text-5xl font-bold text-acid digit-glow">
            {phase}
          </p>
          <p className="mt-4 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-bone-dim">
            Sezione in costruzione
          </p>
          {children && <div className="mt-4 text-sm text-bone-dim">{children}</div>}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
