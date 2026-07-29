"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/api";
import type { Message } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function MessageBoard({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      await clientFetch("/messages", { method: "POST", body: JSON.stringify({ body }) });
      setText("");
      const fresh = await clientFetch<{ messages: Message[] }>("/messages");
      setMessages(fresh.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-lg p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Scrivi un messaggio al gruppo…"
          className="w-full resize-none rounded-lg border border-line bg-carbon-950 px-3 py-2 text-sm text-bone outline-none focus:border-acid"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-bone-dim">{text.length}/500</span>
          <button
            onClick={post}
            disabled={posting || !text.trim()}
            className="rounded-lg bg-acid px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-carbon-950 transition-opacity disabled:opacity-40"
          >
            {posting ? "…" : "Invia"}
          </button>
        </div>
        {error && <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-red">{error}</p>}
      </div>

      {messages.length === 0 ? (
        <p className="text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-bone-dim">
          Ancora nessun messaggio.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="panel accent-bar rounded-lg px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-acid">{m.author}</span>
                <span className="font-[family-name:var(--font-mono)] text-[9px] text-bone-dim">{fmt(m.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-bone">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
