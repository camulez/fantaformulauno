import { BottomNav } from "@/components/BottomNav";
import { Screen, PageHeader, Card, Label } from "@/components/ui";

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
    <Screen>
      <PageHeader kicker="FantaFormula1" title={title} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <Card accent chamfer className="rise w-full px-6 py-10">
          <p className="num digit-glow font-bold text-acid" style={{ fontSize: "var(--text-5xl)" }}>
            {phase}
          </p>
          <Label className="mt-4 block text-xs">Sezione in costruzione</Label>
          {children && <div className="note mt-4 text-sm">{children}</div>}
        </Card>
      </main>

      <BottomNav />
    </Screen>
  );
}
