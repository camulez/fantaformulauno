import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api-url";

/**
 * Fetch da un Server Component: inoltra il cookie di sessione al backend Express.
 * Se il backend risponde 401, reindirizza al login.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: sessionCookie ? { Cookie: `session=${sessionCookie.value}` } : {},
  });

  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`Errore ${res.status} su ${path}`);
  return res.json();
}
