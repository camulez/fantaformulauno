"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/api";
import { Btn, Card, Empty, Note, fieldCls } from "@/components/ui";
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
      <Card className="p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Scrivi un messaggio al gruppo…"
          className={`${fieldCls} resize-none bg-carbon-950 text-sm`}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="num text-[10px] text-bone-dim">{text.length}/500</span>
          <Btn onClick={post} disabled={posting || !text.trim()}>
            {posting ? "…" : "Invia"}
          </Btn>
        </div>
        <Note tone="err">{error}</Note>
      </Card>

      {messages.length === 0 ? (
        <Empty title="Ancora nessun messaggio">
          Il muretto è vuoto: scrivi la prima cosa che ti passa per la testa dopo l&apos;ultimo GP.
        </Empty>
      ) : (
        <ul className="ignite space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="panel accent-bar rounded-lg px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-acid">{m.author}</span>
                <span className="num shrink-0 text-[9px] text-bone-dim">{fmt(m.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-bone">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
