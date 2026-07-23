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
  isAccountStreamHealthy,
  markChannelRead,
  subscribeToMyChannels,
} from "@/lib/discuss";
import { getActiveDiscussChannel } from "@/lib/discuss-active-store";
import { useCurrentAccount } from "@/lib/identity";
import { activityAllowed } from "@/lib/notification-activity";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import { publishInboxUnread } from "@/lib/inbox-unread-store";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import {
  classifyInboxActivity,
  playAppSound,
  primeNotificationSound,
} from "@/lib/notificationSound";
import type {
  DiscussChannelWithState,
  InboxMessageWithSender,
} from "@/types/supabase";

/* Refresh inbox unread count every 60s while the tab is open. Discuss
   also polls every 15s as a safety net since the WebSocket can drop
   silently on flaky networks or after mobile Safari kills the tab. */
const POLL_INTERVAL_MS = 60_000;

type TFn = (key: string, fallback?: string) => string;

function timeAgo(iso: string, t: TFn): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("notif.justNow");
  if (minutes < 60) return t("notif.minAgo").replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notif.hourAgo").replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7) return t("notif.dayAgo").replace("{n}", String(days));
  return new Date(iso).toLocaleDateString();
}

function categoryStyle(
  category: InboxMessageWithSender["category"],
  dk: boolean,
): { labelKey: string; className: string } {
  switch (category) {
    case "membership_request":
      return {
        labelKey: "notif.cat.request",
        className: dk
          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
          : "bg-amber-100 text-amber-700 border-amber-200",
      };
    case "system":
      return {
        labelKey: "notif.cat.system",
        className: dk
          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
          : "bg-sky-100 text-sky-700 border-sky-200",
      };
    case "alert":
      return {
        labelKey: "notif.cat.alert",
        className: dk
          ? "bg-red-500/15 text-red-300 border-red-500/30"
          : "bg-red-100 text-red-700 border-red-200",
      };
    case "task":
      return {
        labelKey: "notif.cat.task",
        className: dk
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          : "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    default:
      return {
        labelKey: "notif.cat.message",
        className: dk
          ? "bg-white/[0.06] text-white/70 border-white/[0.1]"
          : "bg-black/[0.04] text-black/70 border-black/[0.1]",
      };
  }
}

/** Resolve the best label for a Discuss channel row, mirroring the
 *  same fallback chain the sidebar uses: explicit name → DM partner's
 *  full name/username → linked CRM contact → "Untitled". */
function channelLabel(channel: DiscussChannelWithState, t: TFn): string {
  if (channel.name && channel.name.trim().length > 0) return channel.name;
  if (channel.other) {
    return (
      channel.other.full_name ||
      channel.other.username ||
      t("notif.dm")
    );
  }
  if (channel.linked_contact) {
    return channel.linked_contact.display_name;
  }
  return t("notif.untitled");
}

export default function NotificationBell({ dk }: { dk: boolean }) {
  const router = useRouter();
  const { t } = useTranslation(hubT);
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;

  const accountIdRef = useRef<string | null>(accountId);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);
  /* Live view of the per-activity notification switches. A ref (updated every
     render) rather than a closure capture: the realtime subscription below
     re-subscribes only when accountId changes, and must still see preference
     edits made mid-session. */
  const notifPrefsRef = useRef<Record<string, unknown> | undefined>(undefined);
  notifPrefsRef.current = (account?.preferences as { notifications?: Record<string, unknown> } | null | undefined)?.notifications ?? undefined;

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
  /** Set when the realtime insert handler ALREADY played the (per-activity)
   *  chime for a bump, so the count-watcher below doesn't play a second,
   *  generic one for the same event. */
  const lastRealtimeChimeRef = useRef(0);

  /* Discuss unread is derived from the channel list so it stays in
     sync with the dropdown rows the user actually sees. */
  const discussUnread = discussChannels.reduce(
    (acc, c) =>
      acc +
      (c.unread_count ?? 0) +
      /* Manually "marked as unread" (WeChat-style dot, no count) counts as 1
         so the bell stays in lock-step with the home-tile badge. */
      (c.marked_unread && !c.unread_count ? 1 : 0),
    0,
  );
  const totalUnread = discussUnread + inboxUnread;

  /* Notification chime for INBOX notifications (task assigned, reminders,
     approvals…) — mirrors the Discuss chime. Fires only when the unread
     count RISES after the first resolved value, so the initial load and
     mark-as-read never beep. */
  const prevInboxRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevInboxRef.current;
    prevInboxRef.current = inboxUnread;
    if (prev !== null && inboxUnread > prev) {
      /* The realtime handler plays the per-activity tone the moment the row
         arrives (it knows WHICH activity it is). Only chime here when the
         rise came from a poll — realtime missed it, activity unknown. */
      if (Date.now() - lastRealtimeChimeRef.current > 3000) playAppSound("notification");
    }
  }, [inboxUnread]);

  /* Publish the authoritative inbox count to the shared store so the
     UserMenu badge consumes it instead of running its own duplicate
     60 s poll. Additive only — the bell stays the single inbox poller
     and all its realtime / chime / grace logic below is unchanged. */
  useEffect(() => {
    publishInboxUnread(accountId ?? null, inboxUnread);
  }, [accountId, inboxUnread]);

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
        /* Chime fires for every inbound message from someone else —
           EXCEPT on /discuss, where DiscussApp raises its own sound with
           per-channel mute/mention rules for the same event. Both firing
           at once was the "two different sounds per message" bug. */
        if (!window.location.pathname.startsWith("/discuss")) playAppSound("message");
        /* But if the message landed in the conversation you're ACTIVELY
           viewing, you can already see it — don't add it to the bell badge
           (no phantom "1" to dismiss). DiscussApp is marking it read anyway.
           WeChat behaviour: sound yes, notification no. */
        if (getActiveDiscussChannel() === msg.channel_id) return;
        /* Otherwise optimistic bump on the matching channel so the badge
           updates before the recount round-trip lands. recountDiscuss() then
           reconciles with the real DB state. */
        setDiscussChannels((prev) =>
          prev.map((c) =>
            c.id === msg.channel_id
              ? { ...c, unread_count: (c.unread_count ?? 0) + 1 }
              : c,
          ),
        );
        void recountDiscuss();
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
    /* Inside the 5s realtime grace window, never step on an optimistic bump.
       Outside it, take the DB's word as-is — Math.max here pinned the badge
       HIGH after the user read notifications on another device, until the
       next poll happened to correct it. */
    const withinGrace = Date.now() - lastRealtimeBumpRef.current < 5000;
    setInboxUnread((prev) => (withinGrace ? Math.max(prev, n) : n));
  }, []);

  /* React to "discuss:unread-changed" (DiscussApp marked a channel as
     read), "focus" / "visibilitychange" (long idle / mobile-backgrounded
     session resyncs on return), and "inbox:force-recount" (todo-admin /
     other code that inserts into inbox_messages and wants the bell to
     update now).

     MOBILE-CRITICAL: mobile Safari and Chrome fire `visibilitychange`
     reliably but `focus` only sporadically. We listen to both so the
     badge / sound update the instant the user switches back to the app,
     regardless of browser. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onDiscussChange() {
      void recountDiscuss();
    }
    function onResume() {
      void recountDiscuss();
      void recountInbox();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") onResume();
    }
    function onForceRecount() {
      lastRealtimeBumpRef.current = Date.now();
      void recountInbox();
    }
    window.addEventListener("discuss:unread-changed", onDiscussChange);
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("inbox:force-recount", onForceRecount);
    return () => {
      window.removeEventListener("discuss:unread-changed", onDiscussChange);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("inbox:force-recount", onForceRecount);
    };
  }, [recountDiscuss, recountInbox]);

  /* ── Discuss: polling fallback ────────────────────────────────────
     Realtime may silently drop on flaky networks, WebSocket throttling,
     or mobile Safari background-kill. Poll every 10 s so the badge
     never goes stale for more than one interval.  The poll is cheap:
     fetchMyChannels is ~4 small queries and React only re-renders if
     the aggregate unread count actually changed.

     When the poll discovers new unreads that realtime missed, play the
     notification chime so the user has an audible alert even without
     a live WebSocket.

     On mobile browsers, setInterval is frozen while the tab is hidden.
     The visibilitychange handler above fires an immediate recount on
     resume, so the badge updates the instant the user returns. */
  useEffect(() => {
    if (!accountId) return;
    /* Phase 3D: realtime-first. subscribeToMyChannels already recounts on
       every account-topic ping, so while that stream is healthy this poll
       would only duplicate work against the most expensive read endpoint
       (myChannels). Keep it purely as insurance: every 60s tick, it runs
       only if the stream is unhealthy OR 5 minutes passed since the last
       forced pass (wedged-socket insurance). Focus/visibility handlers
       above still resync immediately on return. */
    let lastForced = Date.now();
    async function poll() {
      if (document.visibilityState !== "visible") return;
      const aid = accountIdRef.current;
      if (!aid) return;
      if (isAccountStreamHealthy(aid) && Date.now() - lastForced < 300_000) return;
      lastForced = Date.now();
      try {
        const rows = await fetchMyChannels(aid);
        const newTotal = rows.reduce(
          (s, c) => s + (c.unread_count ?? 0),
          0,
        );
        setDiscussChannels((prev) => {
          const oldTotal = prev.reduce(
            (s, c) => s + (c.unread_count ?? 0),
            0,
          );
          if (newTotal > oldTotal && !window.location.pathname.startsWith("/discuss")) {
            playAppSound("message");
          }
          return rows;
        });
      } catch {
        /* Leave prior list in place. */
      }
    }
    const id = window.setInterval(poll, 60_000);
    return () => window.clearInterval(id);
  }, [accountId]);

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
    const t = window.setInterval(() => {
      /* Skip background polling while the tab is hidden — the focus /
         visibilitychange handler above re-syncs the count on resume, so
         no update is missed. Mirrors the Discuss poll guard. */
      if (document.visibilityState !== "visible") return;
      void tick();
    }, POLL_INTERVAL_MS);
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
      /* Chime HERE, where the activity type is known, so Settings → Sounds
         per-activity tones apply (an approval can sound different from a
         task reminder). The count-watcher sees lastRealtimeChimeRef and
         stays quiet for this bump — one event, one chime, correct tone. */
      lastRealtimeChimeRef.current = Date.now();
      /* Per-activity mute: honour the Settings → Notifications "By activity"
         switches. The badge and the dropdown row still update — the user
         chose quiet, not blind. Same shared classifier gates the server-side
         push, so one switch controls both channels. */
      const activity = classifyInboxActivity((msg as { metadata?: unknown }).metadata);
      if (activityAllowed(notifPrefsRef.current, activity)) {
        playAppSound("notification", activity);
      }
      setInboxUnread((n) => n + 1);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        /* Prepend with an empty sender object — the next loadInbox()
           round-trip will hydrate the avatar / username. */
        return [{ ...msg, sender: null } as InboxMessageWithSender, ...prev];
      });
      /* NO chime here. setInboxUnread above raises the count, and the
         count-watcher effect ("inboxUnread > prev") already chimes for
         exactly that. Calling it here too made every single inbox
         notification play the sound TWICE — which is what a double-beep
         out of nowhere was. One event, one chime. */

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
    const rows = await fetchInboxMessages(accountId, { limit: 8, slim: true });
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
        c.id === channelId ? { ...c, unread_count: 0, marked_unread: false } : c,
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
      /* Include channels the user manually "marked as unread" (dot, count 0):
         they contribute to the badge, so leaving them out let the badge stay
         red after "Mark all read" — the server's markRead clears the flag. */
      const toClear = discussChannels.filter(
        (c) => (c.unread_count ?? 0) > 0 || c.marked_unread,
      );
      setDiscussChannels((prev) =>
        prev.map((c) => ({ ...c, unread_count: 0, marked_unread: false })),
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
    /* Same predicate as the badge sum above. Filtering on unread_count alone
       hid manually-marked-unread conversations: the badge said "1" while the
       dropdown said "all caught up" — a phantom notification you could never
       find. Badge and rows must always agree. */
    .filter((c) => (c.unread_count ?? 0) > 0 || c.marked_unread)
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
            ? `${t("notif.title")} (${totalUnread})`
            : t("notif.title")
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
                {t("notif.title")}
              </span>
              {totalUnread > 0 && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    dk
                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : "bg-red-100 text-red-700 border-red-200"
                  }`}
                >
                  {totalUnread} {t("notif.new")}
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
              {t("notif.markAllRead")}
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
                  {t("notif.discuss")}
                </div>
                <ul className="pb-1">
                  {discussRows.map((channel) => {
                    const label = channelLabel(channel, t);
                    const preview =
                      channel.last_message?.body?.trim() ||
                      ((channel.unread_count ?? 0) > 0
                        ? t("notif.newMessage")
                        : t("notif.markedUnread"));
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
                                {(channel.unread_count ?? 0) > 0 ? channel.unread_count : "•"}
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
                  {t("notif.inbox")}
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
                    const senderAlt = (() => {
                      const alt = (msg.sender?.name_alt ?? "").trim();
                      return alt && alt !== (msg.sender?.full_name ?? "").trim()
                        ? alt
                        : null;
                    })();
                    const isUnread = !msg.read_at;
                    return (
                      <li key={msg.id}>
                        {/* div, not <button>: the row body renders
                            AutoTranslatedText, whose inline "machine
                            translation" toggle is itself a <button>. Nested
                            buttons are invalid HTML and were breaking React
                            hydration on every open of the dropdown. */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleInboxRowClick(msg)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void handleInboxRowClick(msg);
                            }
                          }}
                          className={`w-full cursor-pointer text-left px-4 py-3 transition-colors flex gap-3 ${
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
                                {t(cat.labelKey)}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  dk ? "text-white/40" : "text-black/40"
                                }`}
                              >
                                {timeAgo(msg.created_at, t)}
                              </span>
                            </div>
                            {/* Auto-translate the notification into the reader's
                                language — a task assigned in English reaches an
                                Arabic/Chinese employee readable. */}
                            <div
                              className={`text-[12.5px] font-semibold truncate ${
                                dk ? "text-white" : "text-black"
                              }`}
                            >
                              <AutoTranslatedText text={msg.subject} />
                            </div>
                            {msg.body && (
                              <AutoTranslatedText
                                text={msg.body}
                                block
                                className={`text-[11.5px] mt-0.5 line-clamp-2 ${
                                  dk ? "text-white/55" : "text-black/55"
                                }`}
                              />
                            )}
                            <div
                              className={`text-[10.5px] mt-1 ${
                                dk ? "text-white/40" : "text-black/40"
                              }`}
                            >
                              {t("notif.from")} {senderName}
                              {senderAlt && (
                                <span lang="zh" className="ms-1">
                                  {senderAlt}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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
                    {t("notif.caughtUp")}
                  </p>
                  <p
                    className={`text-[11px] mt-1 ${
                      dk ? "text-white/35" : "text-black/35"
                    }`}
                  >
                    {t("notif.caughtUpHint")}
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
