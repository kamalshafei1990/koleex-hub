"use client";

/* ---------------------------------------------------------------------------
   components/ai/CallsPanel — the caller's past calls, each by its summary.

   Roadmap D2. A list, newest first: when the call was, which chat it lives
   in, and the summary Koleex AI wrote when it ended (voice/summary.ts) — the
   points and the numbers, not the transcript. One action per call: open the
   chat, where the words themselves are. The list comes from GET
   /api/ai/calls, owner-scoped on the server; this draws what it is given.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import MessageMarkdown from "@/components/ai/MessageMarkdown";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { type Lang } from "@/lib/i18n";

export type CallEntry = {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  summary: string;
  created_at: string;
};

export const CALLS_PATH = "/api/ai/calls";

type Copy = { calls: string; callsEmpty: string; openChat: string };

const LOCALE: Record<Lang, string> = { en: "en-GB", zh: "zh-CN", ar: "ar-EG" };

/** When the call was, for a person: date and time in their locale. Pure. */
export function formatCallTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export default function CallsPanel({
  copy,
  lang,
  onOpenConversation,
  fetchFn = fetch,
}: {
  copy: Copy;
  lang: Lang;
  onOpenConversation: (id: string) => void;
  fetchFn?: typeof fetch;
}) {
  const [items, setItems] = useState<CallEntry[] | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetchFn(CALLS_PATH, { credentials: "include", signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { items?: CallEntry[] }) => {
        if (ctl.signal.aborted) return;
        setItems(Array.isArray(body.items) ? body.items : []);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setItems([]);
      });
    return () => ctl.abort();
  }, [fetchFn]);

  return (
    <section aria-label={copy.calls} className="max-w-[820px] mx-auto px-4 md:px-6 py-6">
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">{copy.calls}</h2>
      {items === null ? (
        <div className="flex items-center justify-center py-20">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-[var(--text-dim)]" data-calls-empty>
          {copy.callsEmpty}
        </p>
      ) : (
        <ul className="space-y-3" data-calls-list>
          {items.map((it) => (
            <li key={it.message_id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[12px] text-[var(--text-dim)]">{formatCallTime(it.created_at, lang)}</div>
                {it.conversation_title && (
                  <div className="text-[12px] text-[var(--text-secondary)] truncate">{it.conversation_title}</div>
                )}
              </div>
              <div className="mt-2 text-[13px] text-[var(--text-primary)]">
                <MessageMarkdown content={it.summary} />
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onOpenConversation(it.conversation_id)}
                  className="h-8 px-3 rounded-full text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] active:scale-95 transition-transform"
                >
                  {copy.openChat}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
