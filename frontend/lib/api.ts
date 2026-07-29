import { API_URL } from "./api-url";

export { API_URL };

/**
 * Fetch da un Client Component: passa dal proxy same-origin /api (vedi next.config.ts)
 * così il cookie di sessione viene impostato sul dominio del frontend, non su quello
 * del backend — necessario perché i Server Component leggano la sessione via cookies().
 */
export async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Errore ${res.status}` }));
    throw new Error(body.error || `Errore ${res.status}`);
  }
  return res.json();
}
