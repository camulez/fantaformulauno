// Intensità del tassello ∝ prezzo base del componente (valore intrinseco).
// Con prezzi base tutti a 0 la scala è piatta: si "accende" da sola coi valori reali.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// t in [0,1] dall'intensità relativa (0 = scarso, 1 = campione).
export function intensityFactor(basePrice: number, maxBasePrice: number): number {
  if (maxBasePrice <= 0) return 0.55; // scala piatta finché i prezzi base sono 0
  return Math.max(0, Math.min(1, basePrice / maxBasePrice));
}

// Stile di un tassello pieno: colore squadra con alpha ∝ valore + leggero glow sui pezzi forti.
export function tileStyle(colorHex: string, basePrice: number, maxBasePrice: number): React.CSSProperties {
  const t = intensityFactor(basePrice, maxBasePrice);
  const [r, g, b] = hexToRgb(colorHex);
  const alpha = 0.28 + 0.72 * t; // da smorto a vivido
  const glow = t > 0.6 ? `0 0 ${Math.round(6 + 14 * t)}px rgba(${r},${g},${b},${0.25 * t})` : "none";
  return {
    backgroundColor: `rgba(${r},${g},${b},${alpha})`,
    borderColor: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.15)})`,
    boxShadow: glow,
  };
}
