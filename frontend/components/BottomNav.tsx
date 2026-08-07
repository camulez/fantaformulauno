"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AwardIcon,
  ChartIcon,
  FlagIcon,
  GavelIcon,
  SteeringIcon,
  TrophyIcon,
} from "@/components/icons";

const ITEMS = [
  { href: "/", label: "Griglia", Icon: FlagIcon },
  { href: "/classifica", label: "Mondiale", Icon: TrophyIcon },
  { href: "/simulatore", label: "Sim", Icon: SteeringIcon },
  { href: "/asta", label: "Asta", Icon: GavelIcon },
  { href: "/statistiche", label: "Dati", Icon: ChartIcon },
  { href: "/storico", label: "Albo", Icon: AwardIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-line/70 bg-carbon-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-tight transition-colors ${
                active ? "text-acid" : "text-bone-dim hover:text-bone"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
              {label}
              {active && <span className="h-0.5 w-6 rounded-full bg-acid" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
