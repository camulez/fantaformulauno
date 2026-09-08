// Un componente non può appartenere a due Team nello stesso round.
//
// Perché esiste: l'Art. II.d del Regolamento dice che se il tuo pilota è sostituito da un pilota
// «già appartenente ad altro Team» tu resti privo del pilota — cioè NON puoi prendertelo. Fino a
// oggi l'app si limitava a colorare d'ambra un riquadro e ti lasciava salvare lo stesso, e il
// motore, che risolve la rosa slot per slot, avrebbe contato gli stessi punti a due squadre:
//
//     Pio   · pilota2 = 6      (proprietario legittimo di Lawson)
//     zippo · pilota2 = 6      (Lawson preso come sostituto)
//
// Vale per tutti gli slot, non solo per i piloti: anche telaio, motore, sponsor e benzina
// passano dalle stesse assegnazioni datate.
//
// Modulo PURO: niente database, così l'invariante si collauda da riga di comando.

export interface Assegnazione {
  fantasyTeamId: string;
  slot: string;
  componentId: string;
  from: number;
  /** null = ancora aperta, cioè fino a fine stagione. */
  to: number | null;
}

export interface Occupazione {
  fantasyTeamId: string;
  slot: string;
  from: number;
  to: number | null;
}

/** Estremo destro di un intervallo aperto. Le stagioni non arrivano a mille gare. */
const FINE_APERTA = 9999;

/** Due finestre di round si sovrappongono? */
export function siSovrappongono(
  aDa: number,
  aA: number | null,
  bDa: number,
  bA: number | null
): boolean {
  return Math.max(aDa, bDa) <= Math.min(aA ?? FINE_APERTA, bA ?? FINE_APERTA);
}

/**
 * Il componente è libero per `teamId` nella finestra [da, a]?
 *
 * Restituisce `null` se è libero, altrimenti **chi lo occupa** — così il messaggio d'errore può
 * dire di chi è, invece del solito «operazione non consentita».
 */
export function componenteLibero(
  assegnazioni: Assegnazione[],
  componentId: string,
  da: number,
  a: number | null,
  teamId: string
): Occupazione | null {
  for (const x of assegnazioni) {
    if (x.componentId !== componentId) continue;
    if (x.fantasyTeamId === teamId) continue; // spostarlo fra i propri slot non è furto
    if (!siSovrappongono(da, a, x.from, x.to)) continue;
    return { fantasyTeamId: x.fantasyTeamId, slot: x.slot, from: x.from, to: x.to };
  }
  return null;
}

/**
 * Chi possiede un componente a un dato round, o null se non è di nessuno.
 * È la funzione che serve alla catena dell'Art. II per sapere dove fermarsi.
 */
export function proprietarioAl(
  assegnazioni: Assegnazione[],
  componentId: string,
  round: number
): string | null {
  for (const x of assegnazioni) {
    if (x.componentId !== componentId) continue;
    if (x.from <= round && (x.to == null || x.to >= round)) return x.fantasyTeamId;
  }
  return null;
}
