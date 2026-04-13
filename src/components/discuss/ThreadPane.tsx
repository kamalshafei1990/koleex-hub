"use client";

/* ---------------------------------------------------------------------------
   ThreadPane — Phase B threaded-replies drawer.

   Opens as an overlay on the right edge of the Discuss app when the
   user clicks "Reply in thread" on any message. It shows:

     [Parent message]
     ─ N replies ─
     [Reply 1]
     [Reply 2]
     ...
     [Composer for a new reply]

   The composer here is intentionally minimal: plain text + emoji only.
   Voice messages, file attachments, and product mentions stay in the
   main channel composer so threads feel focused on back-and-forth
   discussion, not side-channel file drops.
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import SmileIcon from "@/components/icons/ui/SmileIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import {
  fetchThreadMessages,
  sendDiscussMessage,
  toggleReaction,
  subscribeToChannel,
} from "@/lib/discuss";
import { renderDiscussMarkdown } from "./markdown";
import type { DiscussMessageWithAuthor } from "@/types/supabase";

/* Quick-pick reactions shown in the hover row — matches Slack defaults. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

export interface ThreadPaneProps {
  /** The parent message that owns the thread. */
  parent: DiscussMessageWithAuthor;
  /** Current user's account id for authoring replies + reaction toggle. */
  currentAccountId: string;
  /** The channel the parent message lives in. */
  channelId: string;
  /** Close the thread drawer. */
  onClose: () => void;
  /** Callback fired after a successful reply so the parent can refresh
   *  the thread indicator on the message bubble in the main channel. */
  onReplySent?: () => void;
  /** i18n helper. */
  t: (key: string, fallback?: string) => string;
}

export function ThreadPane({
  parent,
  currentAccountId,
  channelId,
  onClose,
  onReplySent,
  t,
}: ThreadPaneProps) {
  const [messages, setMessages] = useState<DiscussMessageWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /* Initial + refetch on parent change. */
  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchThreadMessages(parent.id, currentAccountId);
    setMessages(rows);
    setLoading(false);
  }, [parent.id, currentAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Autoscroll to the newest reply whenever the list grows. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* Subscribe to realtime inserts on the channel and pick up any new
     message whose reply_to_message_id matches the parent. The shared
     subscribeToChannel helper returns a cleanup function so we just
     hand it back from useEffect. */
  useEffect(() => {
    const cleanup = subscribeToChannel(channelId, {
      onMessageInsert: (row) => {
        if (row.reply_to_message_id !== parent.id) return;
        /* Refetch the thread — small enough that this is cheaper than
           trying to hand-merge a half-hydrated row. */
        void load();
      },
      onMessageUpdate: (row) => {
        /* Parent edits / deletes bubble through here. Only bother
           reloading when the update touches our parent or one of its
           children (we don't know children ids ahead of time, so we
           just reload for any reply_to hit). */
        if (row.id === parent.id || row.reply_to_message_id === parent.id) {
          void load();
        }
      },
    });
    return cleanup;
  }, [channelId, parent.id, load]);

  const handleSend = useCallback(async () => {
    const body = composerBody.trim();
    if (!body || sending) return;
    setSending(true);
    const row = await sendDiscussMessage({
      channelId,
      authorId: currentAccountId,
      body,
      kind: "text",
      replyToMessageId: parent.id,
    });
    setSending(false);
    if (row) {
      setComposerBody("");
      /* Optimistically reload immediately — realtime will also trigger
         but this feels more responsive. */
      void load();
      onReplySent?.();
      /* Refocus composer so users can keep hammering replies. */
      textareaRef.current?.focus();
    }
  }, [composerBody, sending, channelId, currentAccountId, parent.id, load, onReplySent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      /* Optimistic: flip reacted_by_me + count before the round-trip. */
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            const on = existing.reacted_by_me;
            const nextCount = existing.count + (on ? -1 : 1);
            if (nextCount <= 0) {
              return {
                ...m,
                reactions: m.reactions.filter((r) => r.emoji !== emoji),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: nextCount,
                      reacted_by_me: !on,
                      account_ids: on
                        ? r.account_ids.filter((id) => id !== currentAccountId)
                        : [...r.account_ids, currentAccountId],
                    }
                  : r,
              ),
            };
          }
          return {
            ...m,
            reactions: [
              ...m.reactions,
              {
                emoji,
                count: 1,
                account_ids: [currentAccountId],
                reacted_by_me: true,
              },
            ],
          };
        }),
      );
      await toggleReaction(messageId, currentAccountId, emoji);
    },
    [currentAccountId],
  );

  /* Count replies only (parent excluded). */
  const replyCount = useMemo(
    () => Math.max(0, messages.length - 1),
    [messages.length],
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] border-s border-[var(--border-subtle)]">
      {/* Header */}
      <div className="shrink-0 h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {t("thread.pane.title", "Thread")}
          </div>
          <div className="text-[10.5px] text-[var(--text-dim)] truncate">
            {replyCount === 0
              ? t("thread.pane.empty", "No replies yet")
              : replyCount === 1
                ? t("thread.replyCount.one", "1 reply")
                : t("thread.replyCount.many", "{count} replies").replace(
                    "{count}",
                    String(replyCount),
                  )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          aria-label={t("btn.close", "Close")}
        >
          <CrossIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Messages list */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[var(--text-dim)]">
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, idx) => (
              <ThreadMessage
                key={m.id}
                msg={m}
                isParent={idx === 0}
                currentAccountId={currentAccountId}
                onToggleReaction={(emoji) => handleToggleReaction(m.id, emoji)}
              />
            ))}
            {messages.length === 1 && (
              <div className="text-center py-6 text-[11px] text-[var(--text-dim)] italic">
                {t("thread.pane.empty", "No replies yet")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-3 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <textarea
            ref={textareaRef}
            value={composerBody}
            onChange={(e) => setComposerBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("thread.reply.placeholder", "Reply to thread…")}
            rows={2}
            className="w-full px-3 pt-2.5 pb-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none resize-none max-h-[140px]"
            disabled={sending}
          />
          <div className="px-2 pb-2 flex items-center justify-between">
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
              aria-label="Emoji"
              disabled
            >
              <SmileIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!composerBody.trim() || sending}
              className="h-7 px-3 rounded-md bg-blue-500 text-white text-[11px] font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
            >
              {sending ? (
                <SpinnerIcon className="h-3 w-3 animate-spin" />
              ) : (
                <PaperPlaneIcon className="h-3 w-3" />
              )}
              {t("thread.reply.send", "Reply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   ThreadMessage — a single row in the thread pane. Simpler than the
   main-channel MessageBubble because it only needs parent + replies
   (no pinned, no reply preview, no thread indicator).
   --------------------------------------------------------------------------- */

function ThreadMessage({
  msg,
  isParent,
  currentAccountId,
  onToggleReaction,
}: {
  msg: DiscussMessageWithAuthor;
  isParent: boolean;
  currentAccountId: string;
  onToggleReaction: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const authorName =
    msg.author?.full_name || msg.author?.username || "Unknown";
  const timeStr = new Date(msg.created_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = msg.deleted_at ? null : msg.body ?? "";

  return (
    <div
      className={`group relative rounded-lg px-3 py-2 ${
        isParent
          ? "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          : "hover:bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar bubble */}
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-[11px] font-semibold overflow-hidden">
          {msg.author?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={msg.author.avatar_url}
              alt={authorName}
              className="w-full h-full object-cover"
            />
          ) : (
            authorName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("")
          )}
        </div>

        {/* Body column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
              {authorName}
            </span>
            <span className="text-[9.5px] text-[var(--text-dim)] shrink-0">
              {timeStr}
            </span>
            {msg.edited_at && !msg.deleted_at && (
              <span className="text-[9.5px] text-[var(--text-dim)] italic">
                (edited)
              </span>
            )}
          </div>

          {/* Markdown body */}
          {msg.deleted_at ? (
            <div className="text-[11.5px] text-[var(--text-dim)] italic mt-0.5">
              This message was deleted
            </div>
          ) : (
            <div className="text-[12.5px] text-[var(--text-primary)] leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
              {renderDiscussMarkdown(
                body ?? "",
                msg.metadata?.mentions ?? [],
                `tm-${msg.id}`,
              )}
            </div>
          )}

          {/* Reactions row */}
          {msg.reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {msg.reactions.map((rx) => (
                <button
                  key={rx.emoji}
                  type="button"
                  onClick={() => onToggleReaction(rx.emoji)}
                  className={`h-5 px-1.5 inline-flex items-center gap-1 rounded-full border text-[10.5px] transition-colors ${
                    rx.reacted_by_me
                      ? "border-blue-500/50 bg-blue-500/15 text-blue-200"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                  }`}
                >
                  <span>{rx.emoji}</span>
                  <span className="tabular-nums">{rx.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions — reaction picker */}
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
            aria-label="React"
          >
            <SmileIcon className="h-3.5 w-3.5" />
          </button>
          {pickerOpen && (
            <div
              className="absolute right-0 top-7 z-10 flex items-center gap-0.5 p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-lg"
              onMouseLeave={() => setPickerOpen(false)}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(emoji);
                    setPickerOpen(false);
                  }}
                  className="h-7 w-7 rounded-md text-[14px] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
