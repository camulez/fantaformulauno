// Linea del tempo di UNO slot del roster: chi lo occupa, da quale round a quale.
//
// Modulo PURO. Esiste perché scrivere le assegnazioni "a mano" — chiudi qui, apri là — è
// fragile: durante il collaudo delle sostituzioni si sono prodotti un intervallo capovolto
// (R14–13) e due assegnazioni aperte sullo stesso slot. Due righe che si sovrappongono
// rendono la rosa NON DETERMINISTICA, perché chi la risolve prende l'ultima che incontra e
// l'ordine non è garantito: il punteggio dipenderebbe dal caso.
//
// Qui l'operazione è una sola e ben definita: applicare un intervallo sopra la linea del
// tempo, tagliando ciò che copre. L'invariante è che al più UN componente occupa lo slot
// in ogni round.

export interface Intervallo {
  /** Chiave di riga quando arriva dal database (per capire cosa cancellare). */
  id?: string;
  componentId: string;
  from: number;
  /** null = fino a fine stagione. */
  to: number | null;
}

const finisce = (i: Intervallo) => i.to ?? Number.POSITIVE_INFINITY;

/**
 * Sovrappone `nuovo` alla linea del tempo, tagliando gli intervalli che copre.
 * Chi resta parzialmente scoperto viene accorciato; chi viene coperto per intero sparisce;
 * chi viene bucato in mezzo si divide in due.
 */
export function applicaIntervallo(timeline: Intervallo[], nuovo: Intervallo): Intervallo[] {
  const fineNuovo = finisce(nuovo);
  const out: Intervallo[] = [];

  for (const i of timeline) {
    const fineI = finisce(i);
    // nessuna sovrapposizione
    if (fineI < nuovo.from || i.from > fineNuovo) {
      out.push(i);
      continue;
    }
    // coperto per intero: sparisce
    if (i.from >= nuovo.from && fineI <= fineNuovo) continue;
    // bucato in mezzo: resta un pezzo prima e uno dopo
    if (i.from < nuovo.from && fineI > fineNuovo) {
      out.push({ componentId: i.componentId, from: i.from, to: nuovo.from - 1 });
      out.push({ componentId: i.componentId, from: (nuovo.to as number) + 1, to: i.to });
      continue;
    }
    // accorciato a sinistra o a destra
    if (i.from < nuovo.from) out.push({ componentId: i.componentId, from: i.from, to: nuovo.from - 1 });
    else out.push({ componentId: i.componentId, from: fineNuovo + 1, to: i.to });
  }

  out.push({ componentId: nuovo.componentId, from: nuovo.from, to: nuovo.to });
  const puliti = out
    .filter((i) => finisce(i) >= i.from) // via gli intervalli vuoti
    .sort((a, b) => a.from - b.from);
  return fondiContigui(puliti);
}

/**
 * Due tratti attaccati dello stesso componente sono un tratto solo. Senza questo lo storico
 * si legge male («Hadjar R1–13 · Hadjar R14–fine») pur essendo corretto.
 */
export function fondiContigui(timeline: Intervallo[]): Intervallo[] {
  const out: Intervallo[] = [];
  for (const i of timeline) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.componentId === i.componentId && ultimo.to != null && ultimo.to + 1 === i.from) {
      ultimo.to = i.to;
    } else {
      out.push({ ...i });
    }
  }
  return out;
}

/** Chi occupa lo slot a un dato round (o null). */
export function occupanteAl(timeline: Intervallo[], round: number): string | null {
  const i = timeline.find((x) => x.from <= round && finisce(x) >= round);
  return i ? i.componentId : null;
}

/** Il componente che occupava lo slot PRIMA di quello attuale: è lui che rientra. */
export function titolarePrecedente(timeline: Intervallo[], round: number): string | null {
  const corrente = timeline.find((x) => x.from <= round && finisce(x) >= round);
  if (!corrente) return null;
  const prima = timeline
    .filter((x) => finisce(x) < corrente.from && x.componentId !== corrente.componentId)
    .sort((a, b) => finisce(b) - finisce(a))[0];
  return prima ? prima.componentId : null;
}

/** Nessun round è occupato da due componenti. È l'invariante che protegge il punteggio. */
export function sovrapposizioni(timeline: Intervallo[]): string[] {
  const problemi: string[] = [];
  const ord = [...timeline].sort((a, b) => a.from - b.from);
  for (let i = 1; i < ord.length; i++) {
    if (ord[i].from <= finisce(ord[i - 1])) {
      problemi.push(
        `R${ord[i].from} è occupato sia da ${ord[i - 1].componentId} sia da ${ord[i].componentId}`
      );
    }
  }
  return problemi;
}
