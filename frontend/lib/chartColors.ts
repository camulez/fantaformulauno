// Palette categorica per i grafici (distinta e leggibile sul carbonio scuro).
export const TEAM_COLORS = [
  "#c6ff3a", // acid-lime
  "#3ad6ff", // cyan
  "#ff5cf0", // magenta
  "#ffa23a", // orange
  "#9b8cff", // violet
  "#ff5a5a", // red
  "#5affa8", // mint
  "#ffe14d", // yellow
];

export function teamColor(i: number): string {
  return TEAM_COLORS[i % TEAM_COLORS.length];
}
