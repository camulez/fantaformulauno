import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api-url";

/**
 * Oltre questo tempo si smette di aspettare e si passa alla schermata d'attesa.
 * Non è generoso quanto un risveglio di Render (~50 s) di proposito: la schermata
 * riprova da sola ogni pochi secondi, e mostrare subito «sto accendendo il server»
 * è molto meglio di mezzo minuto di pagina vuota.
 */
const TIMEOUT_MS = 12_000;

/**
 * Fetch da un Server Component: inoltra il cookie di sessione al backend Express.
 *
 * Tre esiti, tutti gestiti qui una volta sola per tutte e 20 le pagine:
 *  · 401                      → login;
 *  · database sospeso (503)   → schermata che spiega come riattivarlo;
 *  · backend irraggiungibile  → schermata d'attesa che ricarica da sola.
 *
 * Il reindirizzamento è lo stesso meccanismo già usato per il 401. ⚠️ `redirect()` funziona
 * LANCIANDO un errore di controllo di Next: chi avvolge `serverFetch` in un try/catch deve
 * chiamare `unstable_rethrow(err)` prima di gestire l'errore, altrimenti se lo mangia.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: sessionCookie ? { Cookie: `session=${sessionCookie.value}` } : {},
    });
  } catch {
    // Rete assente, timeout, backend addormentato: non è un bug dell'app.
    redirect("/servizio-non-disponibile?causa=avvio");
  }

  if (res.status === 401) redirect("/login");

  if (res.status === 503) {
    // Il nostro backend marca così il database sospeso; un 503 di Render significa
    // invece che il servizio si sta ancora avviando.
    const corpo = await res.json().catch(() => null);
    const causa = corpo?.code === "DB_DOWN" ? "database" : "avvio";
    redirect(`/servizio-non-disponibile?causa=${causa}`);
  }
  if (res.status === 502 || res.status === 504) {
    redirect("/servizio-non-disponibile?causa=avvio");
  }

  if (!res.ok) throw new Error(`Errore ${res.status} su ${path}`);
  return res.json();
}
