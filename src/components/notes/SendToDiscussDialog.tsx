"use client";

/* ---------------------------------------------------------------------------
   SendToDiscussDialog — post a link to the open note into one of the user's
   Discuss conversations. Reads the conversation list and sends through the
   Discuss client helpers (src/lib/discuss.ts: fetchMyChannels /
   sendDiscussMessage — the same gated /api/discuss routes Discuss uses),
   loaded on demand so the Notes bundle does not carry Discuss.

   The message is plain text + the /notes?id= link; the dialog says plainly
   that only people the note is shared with can open it (sending a link
   grants nothing).
   --------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import type { DiscussChannelWithState } from "@/types/supabase";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";

type T = (k: string) => string;

function channelLabel(c: DiscussChannelWithState, t: T): string {
  if (c.kind === "direct") return (c.other?.full_name || c.other?.username || t("discuss.direct")).trim();
  return (c.name || t("discuss.channel")).trim();
}

export default function SendToDiscussDialog({
  open,
  note,
  meId,
  onClose,
  notify,
  t,
}: {
  open: boolean;
  note: { id: string; title: string } | null;
  meId: string | null;
  onClose: () => void;
  notify: (msg: string, kind?: "success" | "error" | "info") => void;
  t: T;
}) {
  const titleId = useId();
  const [channels, setChannels] = useState<DiscussChannelWithState[] | null>(null);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChannels(null);
    setQ("");
    void import("@/lib/discuss")
      .then((m) => m.fetchMyChannels(meId ?? ""))
      .then((rows) => {
        if (cancelled) return;
        setChannels(
          rows
            .filter((c) => !c.archived_at && c.kind !== "customer" && !c.linked_contact_id)
            .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.last_message_at.localeCompare(a.last_message_at)),
        );
      })
      .catch(() => { if (!cancelled) setChannels([]); });
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => { cancelled = true; clearTimeout(id); };
  }, [open, meId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = channels ?? [];
    return needle ? rows.filter((c) => channelLabel(c, t).toLowerCase().includes(needle)) : rows;
  }, [channels, q, t]);

  if (!open || !note) return null;

  const send = async (c: DiscussChannelWithState) => {
    if (!meId || sending) return;
    setSending(c.id);
    try {
      const { sendDiscussMessage } = await import("@/lib/discuss");
      const url = `${window.location.origin}/notes?id=${note.id}`;
      const title = note.title.trim() || t("untitled");
      const row = await sendDiscussMessage({
        channelId: c.id,
        authorId: meId,
        body: `${t("discuss.message")}: ${title}\n${url}`,
        clientMsgId: crypto.randomUUID(),
      });
      if (!row) { notify(t("error.generic"), "error"); return; }
      notify(t("discuss.sent"), "success");
      onClose();
    } catch {
      notify(t("error.generic"), "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="kx-glass-pop w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)]">{t("discuss.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("dialog.close")} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)]">
            <CrossIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)]">
            <SearchIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            <input
              ref={inputRef}
              type="search"
              dir="auto"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("discuss.search")}
              aria-label={t("discuss.search")}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
            />
          </div>
          <div className="max-h-[46vh] overflow-y-auto -mx-1">
            {channels === null ? (
              <div className="py-8 flex items-center justify-center gap-2 text-[12px] text-[var(--text-dim)]" role="status">
                <SpinnerIcon className="h-4 w-4" /> {t("list.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-[var(--text-muted)]">{t("discuss.empty")}</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!!sending}
                      onClick={() => { void send(c); }}
                      aria-label={`${t("discuss.send")} — ${channelLabel(c, t)}`}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-start hover:bg-[var(--bg-surface)] disabled:opacity-60"
                    >
                      <span className="h-8 w-8 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                        {c.kind === "direct" ? <MessageSquareIcon className="h-3.5 w-3.5" /> : <UsersIcon className="h-3.5 w-3.5" />}
                      </span>
                      <span dir="auto" className="flex-1 min-w-0 truncate text-[13px] text-[var(--text-primary)]">{channelLabel(c, t)}</span>
                      {sending === c.id ? <SpinnerIcon className="h-3.5 w-3.5" /> : <PaperPlaneIcon className="h-3.5 w-3.5 text-[var(--text-dim)] rtl:-scale-x-100" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-dim)]">{t("discuss.accessNote")}</p>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
