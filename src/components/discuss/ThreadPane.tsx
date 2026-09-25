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

   The composer here is intentionally minimal: plain text only.
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
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import SmileIcon from "@/components/icons/ui/SmileIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import {
  connectDiscussStream,
  fetchThreadMessages,
  sendDiscussMessage,
  toggleReaction,
  subscribeToChannel,
} from "@/lib/discuss";
import { discussTime } from "@/lib/discuss-time";
import { TranslatableBody } from "./TranslatableBody";
import { DiscussAvatar } from "./DiscussAvatar";
import type { DiscussMessageWithAuthor } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

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
  /** Auto-translate incoming replies into `targetLang` (mirrors the channel). */
  autoTranslate?: boolean;
  targetLang?: string;
  /** App language, for times. */
  lang?: string;
  /** i18n helper. */
  t: (key: string, fallback?: string) => string;
}

/* Replace-or-append by id, keeping chronological order. */
function upsertById(list: DiscussMessageWithAuthor[], m: DiscussMessageWithAuthor): DiscussMessageWithAuthor[] {
  const i = list.findIndex((x) => x.id === m.id);
  if (i === -1) return [...list, m].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const next = list.slice();
  /* The stream frame has no reactions — keep the ones we already know. */
  next[i] = { ...m, reactions: m.reactions?.length ? m.reactions : list[i].reactions };
  return next;
}

export function ThreadPane({
  parent,
  currentAccountId,
  channelId,
  onClose,
  autoTranslate = false,
  targetLang = "en",
  lang = "en",
  t,
}: ThreadPaneProps) {
  const [messages, setMessages] = useState<DiscussMessageWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /* Fetch the thread. Only the FIRST load (per parent) shows the spinner —
     every later refresh (a reply arrived, an edit, my own send) swaps the
     rows in silently instead of blanking the list to a spinner each time. */
  const loadSeq = useRef(0);
  const load = useCallback(async (silent = false) => {
    const seq = ++loadSeq.current;
    if (!silent) setLoading(true);
    const rows = await fetchThreadMessages(parent.id, currentAccountId);
    if (seq !== loadSeq.current) return; // a newer load superseded this one
    /* A failed silent refresh returns [] — never wipe a visible thread. */
    setMessages((prev) => (silent && rows.length === 0 && prev.length > 0 ? prev : rows));
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
  }, [messages.length]);

  /* Live updates, two paths (same as the main list):
       · broadcast ping (where the Supabase websocket works) → refetch;
       · first-party SSE stream (the China-proof path) → a reply to this
         parent is appended straight from the frame; an edit / delete /
         reaction in this channel triggers a silent refetch. */
  useEffect(() => {
    const cleanup = subscribeToChannel(channelId, {
      onMessageInsert: (row) => {
        if (row.reply_to_message_id !== parent.id) return;
        void load(true);
      },
      onMessageUpdate: (row) => {
        if (row.id === parent.id || row.reply_to_message_id === parent.id) {
          void load(true);
        }
      },
    });
    let changeTimer: number | null = null;
    const unsubStream = connectDiscussStream(
      (m) => {
        if (m.channel_id !== channelId) return;
        if (m.reply_to_message_id !== parent.id) return;
        setMessages((prev) => (prev.length === 0 ? prev : upsertById(prev, m)));
      },
      (changed) => {
        if (changed !== channelId) return;
        if (changeTimer != null) window.clearTimeout(changeTimer);
        changeTimer = window.setTimeout(() => void load(true), 400);
      },
    );
    return () => {
      cleanup();
      unsubStream();
      if (changeTimer != null) window.clearTimeout(changeTimer);
    };
  }, [channelId, parent.id, load]);

  const handleSend = useCallback(async () => {
    const body = composerBody.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(false);
    const row = await sendDiscussMessage({
      channelId,
      authorId: currentAccountId,
      body,
      kind: "text",
      replyToMessageId: parent.id,
      clientMsgId: crypto.randomUUID(),
    });
    setSending(false);
    if (row) {
      setComposerBody("");
      void load(true);
      /* Refocus composer so users can keep hammering replies. */
      textareaRef.current?.focus();
    } else {
      /* Keep the text so nothing typed is lost; say it failed. */
      setSendError(true);
    }
  }, [composerBody, sending, channelId, currentAccountId, parent.id, load]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      /* IME guard — same as the main composer: while a CJK input method is
         composing, Enter confirms the candidate; it must not send. */
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const applyReaction = useCallback(
    (messageId: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            const on = existing.reacted_by_me;
            const nextCount = existing.count + (on ? -1 : 1);
            if (nextCount <= 0) {
              return { ...m, reactions: m.reactions.filter((r) => r.emoji !== emoji) };
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
              { emoji, count: 1, account_ids: [currentAccountId], reacted_by_me: true },
            ],
          };
        }),
      );
    },
    [currentAccountId],
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      /* Optimistic flip; a failed write flips it straight back. */
      applyReaction(messageId, emoji);
      const res = await toggleReaction(messageId, currentAccountId, emoji);
      if (res === null) applyReaction(messageId, emoji);
    },
    [currentAccountId, applyReaction],
  );

  /* Count replies only (parent excluded). */
  const replyCount = useMemo(
    () => Math.max(0, messages.length - 1),
    [messages.length],
  );

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-primary)] border-s border-[var(--border-subtle)]">
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
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[var(--text-dim)]">
            <SpinnerIcon className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, idx) => (
              <ThreadMessage
                key={m.id}
                msg={m}
                isParent={idx === 0}
                currentAccountId={currentAccountId}
                onToggleReaction={(emoji) => void handleToggleReaction(m.id, emoji)}
                autoTranslate={autoTranslate}
                targetLang={targetLang}
                lang={lang}
                t={t}
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
        {sendError && (
          <div role="alert" className="mb-2 text-[11px] text-[var(--text-muted)]">
            {t("status.failed", "Failed to send")}
          </div>
        )}
        <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <textarea
            ref={textareaRef}
            value={composerBody}
            onChange={(e) => setComposerBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("thread.reply.placeholder", "Reply to thread…")}
            aria-label={t("thread.reply.placeholder", "Reply to thread…")}
            rows={2}
            className="w-full px-3 pt-2.5 pb-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none resize-none max-h-[140px]"
            disabled={sending}
          />
          <div className="px-2 pb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!composerBody.trim() || sending}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
            >
              {sending ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : (
                <PaperPlaneIcon className="h-3.5 w-3.5" />
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
  autoTranslate = false,
  targetLang = "en",
  lang = "en",
  t,
}: {
  msg: DiscussMessageWithAuthor;
  isParent: boolean;
  currentAccountId: string;
  onToggleReaction: (emoji: string) => void;
  autoTranslate?: boolean;
  targetLang?: string;
  lang?: string;
  t: (key: string, fallback?: string) => string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const authorName =
    msg.author?.full_name || msg.author?.username || t("channel.unknown", "Unknown");
  const authorAlt = (() => {
    const alt = (msg.author?.name_alt ?? "").trim();
    return alt && alt !== (msg.author?.full_name ?? "").trim() ? alt : null;
  })();
  const timeStr = discussTime(msg.created_at, lang);

  const body = msg.deleted_at ? null : msg.body ?? "";

  return (
    <div
      className={`group relative rounded-lg px-3 py-2 ${
        isParent
          ? "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          : "hover:bg-[var(--bg-surface)] focus-within:bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Same avatar as the main message list (grayscale + initials). */}
        <DiscussAvatar name={authorName} url={msg.author?.avatar_url ?? null} size={32} />

        {/* Body column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
              {authorName}
              {authorAlt && (
                <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                  {authorAlt}
                </span>
              )}
            </span>
            <span className="text-[9.5px] text-[var(--text-dim)] shrink-0 tabular-nums">
              {timeStr}
            </span>
            {msg.edited_at && !msg.deleted_at && (
              <span className="text-[9.5px] text-[var(--text-dim)] italic">
                ({t("thread.edited", "edited")})
              </span>
            )}
          </div>

          {/* Markdown body */}
          {msg.deleted_at ? (
            <div className="text-[11.5px] text-[var(--text-dim)] italic mt-0.5">
              {t("thread.deleted", "This message was deleted")}
            </div>
          ) : (
            <TranslatableBody
              body={body ?? ""}
              messageId={`tm-${msg.id}`}
              mentions={msg.metadata?.mentions ?? []}
              autoTranslate={
                autoTranslate && msg.author_account_id !== currentAccountId
              }
              targetLang={targetLang}
              t={t}
              className="text-[12.5px] text-[var(--text-primary)] leading-relaxed mt-0.5 whitespace-pre-wrap break-words"
            />
          )}

          {/* Reactions row — same look as the main list. */}
          {msg.reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {msg.reactions.map((rx) => (
                <button
                  key={rx.emoji}
                  type="button"
                  onClick={() => onToggleReaction(rx.emoji)}
                  aria-pressed={rx.reacted_by_me}
                  className={`h-6 px-1.5 inline-flex items-center gap-1 rounded-full border text-[11px] tabular-nums transition-colors ${
                    rx.reacted_by_me
                      ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-secondary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                  }`}
                >
                  <span>{rx.emoji}</span>
                  <span className="font-semibold">{rx.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover / focus actions — reaction picker */}
        {!msg.deleted_at && (
          <div className="relative shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
              aria-label={t("msg.react", "Add reaction")}
              aria-expanded={pickerOpen}
            >
              <SmileIcon className="h-3.5 w-3.5" />
            </button>
            {pickerOpen && (
              <div
                className="absolute end-0 top-7 z-10 flex items-center gap-0.5 p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-lg"
                onMouseLeave={() => setPickerOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPickerOpen(false);
                }}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={emoji}
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
        )}
      </div>
    </div>
  );
}
