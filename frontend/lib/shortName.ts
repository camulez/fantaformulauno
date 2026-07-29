// Abbreviazione del nome squadra per etichette compatte (grafici, testa-a-testa).
// Di norma usa la prima parola ("Anzo Grand Prix International" → "Anzo"), ma salta
// un prefisso generico ("Scuderia", "Team") così "Scuderia Da Silva" → "Da Silva".
const SKIP_PREFIXES = new Set(["scuderia", "team"]);

export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && SKIP_PREFIXES.has(words[0].toLowerCase())) {
    return words.slice(1).join(" ");
  }
  return words[0] ?? name;
}
