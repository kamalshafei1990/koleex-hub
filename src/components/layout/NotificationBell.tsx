"use client";

/* ---------------------------------------------------------------------------
   NotificationBell — system-wide notifications dropdown in MainHeader.

   Aggregates notifications from every app in Koleex Hub. Today that
   means two sources, with room to grow:

     1. Discuss — unread chat messages, surfaced as one row per
        channel with the unread count and a snippet of the last
        message. Real-time: a Supabase channel subscription bumps the
        badge and plays the notification chime the instant a new
        message arrives, on every page in the app.

     2. Inbox — system notifications and direct messages stored in
        `inbox_messages` (membership requests, alerts, broadcasts).
        Loaded lazily when the dropdown opens. The helpers in
        `lib/inbox.ts` fall back to empty when the table hasn't been
        migrated yet, so this section silently degrades to "all caught
        up" in environments where the inbox feature isn't deployed.

   Behavior contract:
     · Clicking the bell opens a dropdown — never auto-navigates.
     · Clicking a Discuss row → /discuss.
     · Clicking an inbox row → its `link` if present, otherwise no-op
       (inbox page doesn't ship until the migration lands).
     · "Mark all read" clears unread on whichever sections have any.
     · The badge sums Discuss + Inbox unread.
     · The chime fires on inbound Discuss messages from someone else,
       regardless of which page the user is on.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BellIcon from "@/components/icons/ui/BellIcon";
import CheckCheckIcon from "@/components/icons/ui/CheckCheckIcon";
import InboxRawIcon from "@/components/icons/ui/InboxRawIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import {
  fetchInboxMessages,
  fetchUnreadCount,
  markAllRead,
  markMessageRead,
  subscribeToInboxMessages,
} from "@/lib/inbox";
import {
  fetchMyChannels,
  markChannelRead,
  subscribeToMyChannels,
} from "@/lib/discuss";
import { useCurrentAccount } from "@/lib/identity";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";
import type {
  DiscussChannelWithState,
  InboxMessageWithSender,
} from "@/types/supabase";

/* Refresh inbox unread count every 60s while the tab is open. Discuss
   updates piggy-back off the realtime subscription so they stay live
   without polling. */
const POLL_INTERVAL_MS = 60_000;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function categoryStyle(
  category: InboxMessageWithSender["category"],
  dk: boolean,
): { label: string; className: string } {
  switch (category) {
    case "membership_request":
      return {
        label: "Request",
        className: dk
          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
          : "bg-amber-100 text-amber-700 border-amber-200",
      };
    case "system":
      return {
        label: "System",
        className: dk
          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
          : "bg-sky-100 text-sky-700 border-sky-200",
      };
    case "alert":
      return {
        label: "Alert",
        className: dk
          ? "bg-red-500/15 text-red-300 border-red-500/30"
          : "bg-red-100 text-red-700 border-red-200",
      };
    case "task":
      return {
        label: "Task",
        className: dk
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          : "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    default:
      return {
        label: "Message",
        className: dk
          ? "bg-white/[0.06] text-white/70 border-white/[0.1]"
          : "bg-black/[0.04] text-black/70 border-black/[0.1]",
      };
  }
}

/** Resolve the best label for a Discuss channel row, mirroring the
 *  same fallback chain the sidebar uses: explicit name → DM partner's
 *  full name/username → linked CRM contact → "Untitled". */
function channelLabel(channel: DiscussChannelWithState): string {
  if (channel.name && channel.name.trim().length > 0) return channel.name;
  if (channel.other) {
    return (
      channel.other.full_name ||
      channel.other.username ||
      "Direct message"
    );
  }
  if (channel.linked_contact) {
    return channel.linked_contact.display_name;
  }
  return "Untitled";
}

export default function NotificationBell({ dk }: { dk: boolean }) {
  const router = useRouter();
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;

  const accountIdRef = useRef<string | null>(accountId);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  const [open, setOpen] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [messages, setMessages] = useState<InboxMessageWithSender[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  const [discussChannels, setDiscussChannels] = useState<
    DiscussChannelWithState[]
  >([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  /** Grace-period tracking: after a realtime bump, protect the optimistic
   *  `inboxUnread` from being overwritten by a stale poll result. */
  const lastRealtimeBumpRef = useRef(0);

  /* Discuss unread is derived from the channel list so it stays in
     sync with the dropdown rows the user actually sees. */
  const discussUnread = discussChannels.reduce(
    (acc, c) => acc + (c.unread_count ?? 0),
    0,
  );
  const totalUnread = discussUnread + inboxUnread;

  /* ── Discuss: seed channel list ──────────────────────────────────── */
  const recountDiscuss = useCallback(async () => {
    const aid = accountIdRef.current;
    if (!aid) {
      setDiscussChannels([]);
      return;
    }
    try {
      const rows = await fetchMyChannels(aid);
      setDiscussChannels(rows);
    } catch {
      /* Leave prior list in place. */
    }
  }, []);

  useEffect(() => {
    void recountDiscuss();
  }, [accountId, recountDiscuss]);

  /* Prime the chime AudioContext on mount so the first user gesture
     anywhere unlocks playback. After that, playNotificationSound()
     called from a realtime callback works without further gestures. */
  useEffect(() => {
    primeNotificationSound();
  }, []);

  /* ── Discuss: realtime subscription ──────────────────────────────── */
  useEffect(() => {
    if (!accountId) return;
    return subscribeToMyChannels({
      onMessageInsert: (msg) => {
        const myId = accountIdRef.current;
        if (!myId) return;
        if (msg.author_account_id === myId) return;
        /* Optimistic bump on the matching channel so the badge updates
           before the recount round-trip lands. recountDiscuss() then
           reconciles with the real DB state. */
        setDiscussChannels((prev) =>
          prev.map((c) =>
            c.id === msg.channel_id
              ? { ...c, unread_count: (c.unread_count ?? 0) + 1 }
              : c,
          ),
        );
        void recountDiscuss();
        /* Chime fires for every inbound message from someone else,
           regardless of which page we're on. */
        playNotificationSound();
      },
      onChannelChange: () => {
        void recountDiscuss();
      },
    });
  }, [accountId, recountDiscuss]);

  /* Recount inbox helper — used by focus / force-recount events. */
  const recountInbox = useCallback(async () => {
    const aid = accountIdRef.current;
    if (!aid) return;
    const n = await fetchUnreadCount(aid);
    setInboxUnread((prev) => Math.max(prev, n));
  }, []);

  /* React to "discuss:unread-changed" (DiscussApp marked a channel as
     read), "focus" (long idle session resyncs on return), and
     "inbox:force-recount" (todo-admin / other code that inserts
     into inbox_messages and wants the bell to update now). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onDiscussChange() {
      void recountDiscuss();
    }
    function onFocus() {
      void recountDiscuss();
      void recountInbox();
    }
    function onForceRecount() {
      lastRealtimeBumpRef.current = Date.now();
      void recountInbox();
    }
    window.addEventListener("discuss:unread-changed", onDiscussChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("inbox:force-recount", onForceRecount);
    return () => {
      window.removeEventListener("discuss:unread-changed", onDiscussChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("inbox:force-recount", onForceRecount);
    };
  }, [recountDiscuss, recountInbox]);

  /* ── Inbox: poll unread count + fetch on open ────────────────────── */
  useEffect(() => {
    if (!accountId) {
      setInboxUnread(0);
      return;
    }
    let cancelled = false;
    async function tick() {
      const aid = accountIdRef.current;
      if (!aid) return;
      const n = await fetchUnreadCount(aid);
      if (cancelled) return;
      /* If we received a realtime bump within the last 5 seconds, don't
         overwrite it with a potentially stale DB count — use whichever
         value is higher so the badge never flickers backwards. */
      const withinGrace = Date.now() - lastRealtimeBumpRef.current < 5000;
      if (withinGrace) {
        setInboxUnread((prev) => Math.max(prev, n));
      } else {
        setInboxUnread(n);
      }
    }
    void tick();
    const t = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [accountId]);

  /* ── Inbox: realtime subscription ───────────────────────────────────
     Listens for INSERTs on inbox_messages filtered to my recipient_id,
     so a new mail (or system notification, or an inserted external
     email row) bumps the bell instantly without waiting on the 60s
     poll. The poll is still useful as a reconciliation safety net. */
  useEffect(() => {
    if (!accountId) return;
    return subscribeToInboxMessages(accountId, (msg) => {
      /* If the row landed already-read (e.g. an admin marked it read on
         insert), don't bump. Otherwise treat it like a fresh inbound. */
      if (msg.read_at) return;
      lastRealtimeBumpRef.current = Date.now();
      setInboxUnread((n) => n + 1);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        /* Prepend with an empty sender object — the next loadInbox()
           round-trip will hydrate the avatar / username. */
        return [{ ...msg, sender: null } as InboxMessageWithSender, ...prev];
      });
      playNotificationSound();

      /* Verification fetch: after a short delay, reconcile with the DB
         to ensure the count is accurate once replication has settled. */
      const aid = accountIdRef.current;
      if (aid) {
        setTimeout(async () => {
          const fresh = await fetchUnreadCount(aid);
          setInboxUnread((prev) => Math.max(prev, fresh));
        }, 2000);
      }
    });
  }, [accountId]);

  const loadInbox = useCallback(async () => {
    if (!accountId) {
      setMessages([]);
      return;
    }
    setLoadingInbox(true);
    const rows = await fetchInboxMessages(accountId, { limit: 8 });
    setMessages(rows);
    setLoadingInbox(false);
    const n = await fetchUnreadCount(accountId);
    setInboxUnread(n);
  }, [accountId]);

  useEffect(() => {
    if (open) {
      void loadInbox();
      void recountDiscuss();
    }
  }, [open, loadInbox, recountDiscuss]);

  /* Close on outside click. */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleDiscussRowClick(channelId: string) {
    setOpen(false);
    /* Optimistic clear so the badge drops before the navigation. The
       Discuss app will mark-read on its own once the channel opens. */
    setDiscussChannels((prev) =>
      prev.map((c) =>
        c.id === channelId ? { ...c, unread_count: 0 } : c,
      ),
    );
    router.push(`/discuss?channel=${channelId}`);
  }

  async function handleInboxRowClick(msg: InboxMessageWithSender) {
    setOpen(false);
    if (!msg.read_at) {
      setInboxUnread((n) => Math.max(0, n - 1));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m,
        ),
      );
      await markMessageRead(msg.id);
    }
    if (msg.link) {
      router.push(msg.link);
    }
  }

  async function handleMarkAllRead() {
    if (totalUnread === 0) return;
    const aid = accountIdRef.current;
    if (!aid) return;

    /* Optimistic local clear. */
    if (inboxUnread > 0) {
      setInboxUnread(0);
      setMessages((prev) =>
        prev.map((m) =>
          m.read_at ? m : { ...m, read_at: new Date().toISOString() },
        ),
      );
      void markAllRead(aid);
    }
    if (discussUnread > 0) {
      const toClear = discussChannels.filter((c) => (c.unread_count ?? 0) > 0);
      setDiscussChannels((prev) =>
        prev.map((c) => ({ ...c, unread_count: 0 })),
      );
      /* Fan out one mark-read per unread channel. Errors are
         swallowed — the next recount will reconcile. */
      await Promise.all(
        toClear.map((c) => markChannelRead(c.id, aid).catch(() => false)),
      );
      window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
    }
  }

  /* Discuss section: only channels that actually have unread, sorted
     by the most recent activity so the freshest pings are at the top. */
  const discussRows = discussChannels
    .filter((c) => (c.unread_count ?? 0) > 0)
    .sort((a, b) => {
      const at = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;
      const bt = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;
      return bt - at;
    })
    .slice(0, 6);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={
          totalUnread > 0
            ? `Notifications (${totalUnread} unread)`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border transition-all ${
          dk
            ? "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
            : "border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
        } ${open ? (dk ? "text-white bg-white/[0.06]" : "text-black bg-black/[0.06]") : ""}`}
      >
        <BellIcon size={15} className="md:w-4 md:h-4" />
        {totalUnread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -end-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-primary)]"
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full end-0 mt-2 w-[360px] max-w-[92vw] rounded-xl border shadow-2xl overflow-hidden z-50 ${
            dk
              ? "border-white/[0.08] bg-[#0f0f0f]"
              : "border-black/[0.08] bg-white"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b ${
              dk ? "border-white/[0.06]" : "border-black/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2">
              <BellIcon
                size={14}
                className={dk ? "text-white/60" : "text-black/60"}
              />
              <span
                className={`text-[13px] font-semibold ${
                  dk ? "text-white" : "text-black"
                }`}
              >
                Notifications
              </span>
              {totalUnread > 0 && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    dk
                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : "bg-red-100 text-red-700 border-red-200"
                  }`}
                >
                  {totalUnread} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={totalUnread === 0}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                dk
                  ? "text-white/60 hover:text-white"
                  : "text-black/60 hover:text-black"
              }`}
            >
              <CheckCheckIcon size={12} />
              Mark all read
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[460px] overflow-y-auto">
            {/* Discuss section */}
            {discussRows.length > 0 && (
              <div>
                <div
                  className={`px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    dk ? "text-white/40" : "text-black/40"
                  }`}
                >
                  <MessageSquareIcon size={11} />
                  Discuss
                </div>
                <ul className="pb-1">
                  {discussRows.map((channel) => {
                    const label = channelLabel(channel);
                    const preview =
                      channel.last_message?.body?.trim() || "New message";
                    const author =
                      channel.last_message?.author_username || null;
                    return (
                      <li key={channel.id}>
                        <button
                          type="button"
                          onClick={() => handleDiscussRowClick(channel.id)}
                          className={`w-full text-left px-4 py-2.5 transition-colors flex gap-3 ${
                            dk
                              ? "hover:bg-white/[0.04]"
                              : "hover:bg-black/[0.03]"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2 w-2 rounded-full shrink-0 bg-red-500`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span
                                className={`text-[12.5px] font-semibold truncate ${
                                  dk ? "text-white" : "text-black"
                                }`}
                              >
                                {label}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  dk
                                    ? "bg-red-500/15 text-red-300"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {channel.unread_count}
                              </span>
                            </div>
                            <div
                              className={`text-[11.5px] truncate ${
                                dk ? "text-white/55" : "text-black/55"
                              }`}
                            >
                              {author ? `${author}: ${preview}` : preview}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Inbox section */}
            {messages.length > 0 && (
              <div
                className={
                  discussRows.length > 0
                    ? `border-t ${dk ? "border-white/[0.06]" : "border-black/[0.06]"}`
                    : ""
                }
              >
                <div
                  className={`px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    dk ? "text-white/40" : "text-black/40"
                  }`}
                >
                  <InboxRawIcon size={11} />
                  Inbox
                </div>
                <ul className="py-1">
                  {messages.map((msg) => {
                    const cat = categoryStyle(msg.category, dk);
                    const senderName =
                      msg.sender?.full_name ||
                      msg.sender?.username ||
                      (msg.sender_account_id === null
                        ? "Koleex System"
                        : "Unknown");
                    const isUnread = !msg.read_at;
                    return (
                      <li key={msg.id}>
                        <button
                          type="button"
                          onClick={() => handleInboxRowClick(msg)}
                          className={`w-full text-left px-4 py-3 transition-colors flex gap-3 ${
                            dk
                              ? "hover:bg-white/[0.04]"
                              : "hover:bg-black/[0.03]"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                              isUnread
                                ? "bg-red-500"
                                : dk
                                  ? "bg-white/[0.12]"
                                  : "bg-black/[0.15]"
                            }`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cat.className}`}
                              >
                                {cat.label}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  dk ? "text-white/40" : "text-black/40"
                                }`}
                              >
                                {timeAgo(msg.created_at)}
                              </span>
                            </div>
                            <div
                              className={`text-[12.5px] font-semibold truncate ${
                                dk ? "text-white" : "text-black"
                              }`}
                            >
                              {msg.subject}
                            </div>
                            {msg.body && (
                              <div
                                className={`text-[11.5px] mt-0.5 line-clamp-2 ${
                                  dk ? "text-white/55" : "text-black/55"
                                }`}
                              >
                                {msg.body}
                              </div>
                            )}
                            <div
                              className={`text-[10.5px] mt-1 ${
                                dk ? "text-white/40" : "text-black/40"
                              }`}
                            >
                              From {senderName}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Empty state — show only when both sections have nothing
                AND we're not still loading the inbox fetch. */}
            {discussRows.length === 0 &&
              messages.length === 0 &&
              !loadingInbox && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${
                      dk ? "bg-white/[0.04]" : "bg-black/[0.04]"
                    }`}
                  >
                    <BellIcon
                      size={18}
                      className={dk ? "text-white/40" : "text-black/40"}
                    />
                  </div>
                  <p
                    className={`text-[12px] font-medium ${
                      dk ? "text-white/60" : "text-black/60"
                    }`}
                  >
                    You&apos;re all caught up
                  </p>
                  <p
                    className={`text-[11px] mt-1 ${
                      dk ? "text-white/35" : "text-black/35"
                    }`}
                  >
                    New notifications from any app will appear here.
                  </p>
                </div>
              )}

            {loadingInbox &&
              discussRows.length === 0 &&
              messages.length === 0 && (
                <div className="flex items-center justify-center py-10">
                  <SpinnerIcon
                    className={`h-4 w-4 animate-spin ${
                      dk ? "text-white/40" : "text-black/40"
                    }`}
                  />
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
