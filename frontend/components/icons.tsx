import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Griglia — bandiera a scacchi
export function FlagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 21V4" />
      <path d="M5 5h13v8H5z" />
      <path d="M5 9h13M11.5 5v8" />
      <path d="M5 5h6.5v4H5zM11.5 9H18v4h-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Mondiale — trofeo
export function TrophyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}

// Asta — martelletto
export function GavelIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </Svg>
  );
}

// Dati — grafico a barre
export function ChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </Svg>
  );
}

// Albo — medaglia
export function AwardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </Svg>
  );
}

// Logout — power
export function PowerIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2v10" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </Svg>
  );
}

// Simulatore — volante
export function SteeringIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3.5 10.5h5.2M15.3 10.5h5.2M12 15v5.8" />
    </Svg>
  );
}
