// Stato di salute del database, in cache davanti a tutti i router.
//
// Perché esiste: quando il progetto Supabase è sospeso (il piano free lo fa dopo 7 giorni
// di inattività) ogni chiamata resta appesa ~7 secondi e poi fallisce con un 500 generico.
// Con più chiamate per pagina l'app sembra semplicemente «lenta e rotta», e non c'è modo di
// capire da fuori che il problema è il database. Qui si risolvono tutte e due le cose:
// si risponde SUBITO e si risponde con un codice che il frontend sa interpretare.
import { NextFunction, Request, Response } from 'express';
import { supabase } from '../db/supabase';

/** Quanto ci si fida di un esito positivo prima di ricontrollare. */
const TTL_SU = 30_000;
/** Quanto si aspetta prima di riprovare quando è giù: poco, così riparte da solo. */
const TTL_GIU = 5_000;
/** Oltre questo il database è da considerarsi irraggiungibile. */
const TIMEOUT_PING = 4_000;

let ultimo: { su: boolean; quando: number } | null = null;
let inCorso: Promise<boolean> | null = null;

/** Interroga il database con una query minima. Non lancia mai. */
export async function pingDb(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('seasons')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_PING));
    return !error;
  } catch {
    return false;
  }
}

/** Esito in cache. Le chiamate in parallelo condividono lo stesso ping. */
async function statoDb(): Promise<boolean> {
  const ora = Date.now();
  if (ultimo && ora - ultimo.quando < (ultimo.su ? TTL_SU : TTL_GIU)) return ultimo.su;
  if (inCorso) return inCorso;
  inCorso = pingDb()
    .then((su) => {
      ultimo = { su, quando: Date.now() };
      return su;
    })
    .finally(() => {
      inCorso = null;
    });
  return inCorso;
}

/** Da chiamare quando si sa già che il database risponde: evita un ping inutile. */
export function segnalaDbSu() {
  ultimo = { su: true, quando: Date.now() };
}

/**
 * Se il database non risponde, taglia corto con 503 e un codice riconoscibile.
 * Il frontend distingue così «database sospeso» da «bug nel codice».
 */
export async function requireDb(_req: Request, res: Response, next: NextFunction) {
  if (await statoDb()) {
    next();
    return;
  }
  res.status(503).json({
    code: 'DB_DOWN',
    error: 'Database non raggiungibile: il progetto Supabase è probabilmente sospeso.',
  });
}
