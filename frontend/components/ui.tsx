// Primitive dell'interfaccia. Nascono per togliere di mezzo le stringhe di classi
// ripetute (erano 26, la più frequente 22 volte) e per rendere applicabile in un punto
// solo la direzione artistica descritta in DESIGN.md.
// Nessuna dipendenza aggiunta: sono componenti a proprietà, non un design system esterno.

import Link from "next/link";
import type { ReactNode } from "react";

const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(" ");

/** Impalcatura della schermata: occupa l'altezza piena e impila header/contenuto/nav. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col">{children}</div>;
}

/** Contenuto centrato. `width` decide il respiro: non tutte le schermate sono strette. */
export function Main({
  children,
  width = "md",
  className,
}: {
  children: ReactNode;
  width?: "md" | "lg" | "xl" | "full";
  className?: string;
}) {
  const w = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-none",
  }[width];
  return <main className={cx("mx-auto w-full flex-1 px-4 py-5", w, className)}>{children}</main>;
}

/** Etichetta tecnica da pannello di cronometraggio. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("label", className)}>{children}</span>;
}

/**
 * Testata di schermata: sopratitolo, titolo, sottotitolo, azione a destra.
 * Sostituisce il blocco header ripetuto in 16 pagine.
 */
export function PageHeader({
  kicker,
  title,
  subtitle,
  back,
  backLabel = "Indietro",
  action,
  size = "md",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  action?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <header className="border-b border-line/70 px-5 pb-4 pt-4">
      {back && (
        <Link
          href={back}
          className="label transition-colors hover:text-acid"
          style={{ transitionDuration: "var(--dur-1)" }}
        >
          ← {backLabel}
        </Link>
      )}
      <div className={cx("flex items-start justify-between gap-3", back && "mt-2")}>
        <div className="min-w-0">
          {kicker && <p className="label text-acid-deep">{kicker}</p>}
          <h1
            className="mt-0.5 font-semibold uppercase leading-[1.05] tracking-wide text-bone"
            style={{ fontSize: size === "lg" ? "var(--text-3xl)" : "var(--text-2xl)" }}
          >
            {title}
          </h1>
          {subtitle && <p className="note mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </header>
  );
}

/**
 * Superficie. `tone="hi"` è il livello di elevazione riservato al dato principale;
 * `chamfer` taglia l'angolo in alto a destra — la firma formale della direzione.
 */
export function Card({
  children,
  tone = "panel",
  accent = false,
  chamfer = false,
  className,
}: {
  children: ReactNode;
  tone?: "panel" | "hi";
  accent?: boolean;
  chamfer?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        tone === "hi" ? "panel-hi" : "panel",
        accent && "accent-bar",
        chamfer && "chamfer",
        "rounded-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Sezione titolata dentro una superficie. È il blocco «pannello + titoletto tecnico»
 * che compariva 12 volte a mano fra Dati, Squadra e Report.
 */
export function Section({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <Card className={cx(padded && "p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label>{title}</Label>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

/** Tabella di dati: numeri incolonnati, intestazioni in registro tecnico. */
export function DataTable({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="num w-full text-xs">
        <thead>
          <tr className="label">
            {head.map((h, i) => (
              <th key={i} className={cx("py-1.5 font-normal", i === 0 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Coppia etichetta + valore. I numeri passano sempre da `.num`. */
export function Stat({
  label,
  value,
  hint,
  tone = "bone",
  size = "md",
  align = "left",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "bone" | "acid" | "dim" | "red";
  size?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "right";
}) {
  const color = { bone: "text-bone", acid: "text-acid", dim: "text-bone-dim", red: "text-red" }[tone];
  const fs = {
    sm: "var(--text-lg)",
    md: "var(--text-xl)",
    lg: "var(--text-3xl)",
    xl: "var(--text-4xl)",
  }[size];
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <Label>{label}</Label>
      <p className={cx("num font-bold leading-none", color)} style={{ fontSize: fs }}>
        {value}
      </p>
      {hint && <p className="label mt-1 tracking-wider">{hint}</p>}
    </div>
  );
}

/**
 * Barra d'azione ancorata sopra la navigazione. Nei moduli lunghi il pulsante di
 * salvataggio deve restare raggiungibile senza tornare in cima.
 */
export function StickyBar({ children, width = "md" }: { children: ReactNode; width?: "md" | "lg" }) {
  return (
    <div
      className={cx("fixed inset-x-0 bottom-16 mx-auto px-4", width === "lg" ? "max-w-2xl" : "max-w-md")}
      style={{ zIndex: "var(--z-sticky)" }}
    >
      {children}
    </div>
  );
}

/** Pastiglia di stato. L'unica forma tonda ammessa dalla direzione. */
export function Chip({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: "acid" | "quiet" | "amber";
}) {
  const v = {
    acid: "border-acid/50 bg-acid/10 text-acid",
    quiet: "border-line text-bone-dim",
    amber: "border-amber/50 bg-amber/10 text-amber",
  }[tone];
  return <span className={cx("label rounded-full border px-3 py-1", v)}>{children}</span>;
}

/** Riga di una lista di dati, con separatore sottile. */
export function DataRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx("data-row py-2.5", className)}>{children}</li>;
}

/** Pulsante: primario acid, secondario contornato, silenzioso. */
export function Btn({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  full = false,
  className,
  type,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "outline" | "quiet";
  size?: "md" | "lg";
  full?: boolean;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-[family-name:var(--font-mono)] font-bold uppercase tracking-widest transition-colors";
  const s = size === "lg" ? "rounded-xl px-4 py-3 text-sm" : "rounded-lg px-4 py-2.5 text-xs";
  const v = {
    primary: "bg-acid text-carbon-950 hover:bg-acid-deep",
    outline: "border border-acid/40 bg-acid/5 text-acid hover:bg-acid/10",
    quiet: "border border-line text-bone-dim hover:border-acid hover:text-acid",
  }[variant];
  const cls = cx(base, s, v, full && "w-full", "disabled:opacity-50", className);
  if (href) {
    return (
      <Link href={href} className={cls} style={{ transitionDuration: "var(--dur-1)" }}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls} style={{ transitionDuration: "var(--dur-1)" }}>
      {children}
    </button>
  );
}

/**
 * Campo di modulo. Esportato anche come classe nuda perché alcuni moduli costruiscono
 * `select` e `input` dentro cicli e non possono avvolgerli.
 */
export const fieldCls =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-bone outline-none transition-colors focus:border-acid";

export function Field({
  label,
  tone = "dim",
  hint,
  children,
}: {
  label: ReactNode;
  tone?: "dim" | "acid" | "amber";
  hint?: ReactNode;
  children: ReactNode;
}) {
  const color = { dim: "", acid: "text-acid-deep", amber: "text-amber" }[tone];
  return (
    <label className="block">
      <Label className={color}>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <span className="note mt-1 block">{hint}</span>}
    </label>
  );
}

/**
 * Riscontro dopo un'azione: l'esito di un salvataggio. Compariva a mano in sette moduli,
 * ogni volta con una sfumatura diversa di rosso o di acid.
 */
export function Note({ tone, children }: { tone: "ok" | "err"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className={cx("num mt-2 text-center text-xs", tone === "ok" ? "text-acid" : "text-red")}>
      {children}
    </p>
  );
}

/** Stato vuoto: mai una frase grigia da sola, sempre con un'azione. */
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card tone="hi" chamfer className="mt-6 px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 h-8 w-8 text-acid-deep">{icon}</div>}
      <p className="font-semibold uppercase tracking-wide text-bone" style={{ fontSize: "var(--text-lg)" }}>
        {title}
      </p>
      {children && <p className="label mt-2 leading-relaxed">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
