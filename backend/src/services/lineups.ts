// Formazione di gara: chi è sceso in pista per ogni scuderia in UN round.
//
// Serve per le sostituzioni: quando un pilota corre per una scuderia diversa dalla sua
// (Lawson in Red Bull al posto di Hadjar, GP d'Olanda 2026), i suoi punti devono contare
// per il costruttore che lo ha schierato. I punti che prende COME PILOTA non passano di qui:
// vanno sempre a chi lo possiede, qualunque macchina guidi.
//
// Modulo PURO: niente database, così le due regole importanti si collaudano da riga di comando.

/** Organico di una scuderia: id scuderia → id piloti. */
export type Lineup = Record<string, string[]>;

export interface LineupRow {
  fia_team_id: string;
  driver_id: string;
}

/**
 * Organico effettivo del round: si parte da quello di anagrafica e si sovrascrivono SOLO
 * le scuderie davvero modificate.
 *
 * ⚠️ Prima qui c'era un `if (righe.length) {...} else {...}`: bastava scrivere l'organico di
 * una scuderia perché tutte le altre restassero senza piloti — e quindi con zero punti
 * costruttore in quella gara, in silenzio. Il merge per scuderia è il motivo di questo file.
 */
export function mergeLineups(predefiniti: Lineup, scritti: LineupRow[]): Lineup {
  if (scritti.length === 0) return { ...predefiniti };

  const modificate: Lineup = {};
  for (const r of scritti) (modificate[r.fia_team_id] ??= []).push(r.driver_id);

  return { ...predefiniti, ...modificate };
}

export interface ProblemaFormazione {
  tipo: 'pilota-doppio' | 'troppi-piloti';
  messaggio: string;
}

/**
 * Controlli su una formazione prima di salvarla.
 * Il primo è quello che protegge il punteggio: se lo stesso pilota risulta in due scuderie,
 * i suoi punti finirebbero a due costruttori diversi.
 */
export function validaFormazione(scritti: LineupRow[], maxPerScuderia = 2): ProblemaFormazione | null {
  const scuderieDi = new Map<string, string[]>();
  const perScuderia = new Map<string, number>();

  for (const r of scritti) {
    const s = scuderieDi.get(r.driver_id) ?? [];
    if (!s.includes(r.fia_team_id)) s.push(r.fia_team_id);
    scuderieDi.set(r.driver_id, s);
    perScuderia.set(r.fia_team_id, (perScuderia.get(r.fia_team_id) ?? 0) + 1);
  }

  for (const [driverId, scuderie] of scuderieDi) {
    if (scuderie.length > 1) {
      return {
        tipo: 'pilota-doppio',
        messaggio: `Lo stesso pilota (${driverId}) risulta in due scuderie: i suoi punti finirebbero a due costruttori.`,
      };
    }
  }
  for (const [teamId, n] of perScuderia) {
    if (n > maxPerScuderia) {
      return {
        tipo: 'troppi-piloti',
        messaggio: `Una scuderia (${teamId}) ha ${n} piloti: il massimo è ${maxPerScuderia}.`,
      };
    }
  }
  return null;
}

/** Le scuderie che in questo round differiscono dall'anagrafica. */
export function scuderieModificate(predefiniti: Lineup, effettivi: Lineup): string[] {
  const uguali = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  return Object.keys(effettivi).filter((t) => !uguali(predefiniti[t], effettivi[t]));
}
