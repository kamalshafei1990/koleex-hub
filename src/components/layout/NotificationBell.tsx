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
import PopoverPanel from "@/components/kds/PopoverPanel";
import { useRouter } from "next/navigation";
import BellIcon from "@/components/icons/ui/BellIcon";
import CheckCheckIcon from "@/components/icons/ui/CheckCheckIcon";
import InboxRawIcon from "@/components/icons/ui/InboxRawIcon";
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
import { activityAllowed, inQuietHours } from "@/lib/notification-activity";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
/* Filter-chip labels come from the SAME dictionary Settings uses for its
   "By activity" switches — one label per activity, everywhere. */
import { settingsT } from "@/lib/translations/settings";
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
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Refresh inbox unread count every 60s while the tab is open. Discuss
   also polls every 15s as a safety net since the WebSocket can drop
   silently on flaky networks or after mobile Safari kills the tab. */
const POLL_INTERVAL_MS = 60_000;

/* One slim fetch covers the whole feed (rows are ~250B without avatars),
   so the filter chips can carry accurate per-type counts and nothing is
   ever hidden behind a "show more". Server caps at 300. */
const FEED_LIMIT = 300;

/* Type-filter chips. `discuss` covers the chat section; the eight activity
   keys mirror classifyInboxActivity() exactly — same classifier that routes
   sounds and push, so a notification always lands under the same chip that
   its Settings switch controls. `other` catches unclassified system mail. */
type NotifFilter =
  | "all"
  | "discuss"
  | "mentions"
  | "approvals"
  | "assignments"
  | "tasks_due"
  | "calendar_events"
  | "projects_planning"
  | "quotation_activity"
  | "low_stock"
  | "inventory_activity"
  | "finance_activity"
  | "qa_reports"
  | "price_fx"
  | "hr_activity"
  | "discuss_messages"
  | "security_alerts"
  | "comments_activity"
  | "membership_requests"
  | "other";

const FILTER_CHIPS: Array<{ key: NotifFilter; hubKey?: string; settingsKey?: string }> = [
  { key: "all", hubKey: "notif.filter.all" },
  { key: "discuss", hubKey: "notif.discuss" },
  { key: "mentions", settingsKey: "act.mentions" },
  { key: "approvals", settingsKey: "act.approvals" },
  { key: "assignments", settingsKey: "act.assignments" },
  { key: "tasks_due", settingsKey: "act.tasksDue" },
  { key: "calendar_events", settingsKey: "act.calendar" },
  { key: "projects_planning", settingsKey: "act.projects" },
  { key: "quotation_activity", settingsKey: "act.quotation" },
  { key: "membership_requests", settingsKey: "act.membership" },
  { key: "low_stock", settingsKey: "act.lowStock" },
  { key: "inventory_activity", settingsKey: "act.inventory" },
  { key: "finance_activity", settingsKey: "act.finance" },
  { key: "qa_reports", settingsKey: "act.qa" },
  { key: "price_fx", settingsKey: "act.priceFx" },
  { key: "hr_activity", settingsKey: "act.hr" },
  { key: "discuss_messages", settingsKey: "act.discuss" },
  { key: "security_alerts", settingsKey: "act.security" },
  { key: "comments_activity", settingsKey: "act.comments" },
  { key: "other", hubKey: "notif.filter.other" },
];

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

export default function NotificationBell({ dk, defaultOpen = false }: { dk: boolean; defaultOpen?: boolean }) {
  /* defaultOpen: NotificationBellGate renders the resting bell without this
     component's code and only mounts it when the user clicks. The click has
     already happened by then, so the panel must come up open — otherwise the
     first tap would look like it did nothing. */
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

  const [open, setOpen] = useState(defaultOpen);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [messages, setMessages] = useState<InboxMessageWithSender[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [filter, setFilter] = useState<NotifFilter>("all");
  /* Chip labels for the eight activities live in the Settings dictionary. */
  const { t: tAct } = useTranslation(settingsT);

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
  const discussBaselineRef = useRef(false);
  useEffect(() => {
    const prev = prevInboxRef.current;
    prevInboxRef.current = inboxUnread;
    if (prev !== null && inboxUnread > prev) {
      /* The realtime handler plays the per-activity tone the moment the row
         arrives (it knows WHICH activity it is). Only chime here when the
         rise came from a poll — realtime missed it, activity unknown. */
      if (Date.now() - lastRealtimeChimeRef.current > 3000
          && !inQuietHours((notifPrefsRef.current as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours)) {
        playAppSound("notification");
      }
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
        if (!window.location.pathname.startsWith("/discuss") && !inQuietHours((notifPrefsRef.current as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours)) playAppSound("message");
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
          /* Baseline guard: the FIRST fetch compares against the empty
             initial list, so pre-existing unread used to chime (and spin
             up the AudioContext) on every page load. Only rises AFTER a
             baseline exists are new messages. */
          const hadBaseline = discussBaselineRef.current;
          discussBaselineRef.current = true;
          if (hadBaseline && newTotal > oldTotal && !window.location.pathname.startsWith("/discuss")
              && !inQuietHours((notifPrefsRef.current as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours)) {
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
      const qh = (notifPrefsRef.current as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours;
      if (activityAllowed(notifPrefsRef.current, activity) && !inQuietHours(qh)) {
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
    const rows = await fetchInboxMessages(accountId, { limit: FEED_LIMIT, slim: true });
    setMessages(rows);
    setLoadingInbox(false);
    const n = await fetchUnreadCount(accountId);
    setInboxUnread(n);
  }, [accountId]);

  useEffect(() => {
    if (open) {
      void loadInbox();
      void recountDiscuss();
    } else {
      /* Closing resets the filter so one left behind can't hide fresh
         notifications on the next open. */
      setFilter("all");
    }
  }, [open, loadInbox, recountDiscuss]);


  /* No outside-click listener here: the panel is PORTALLED to <body>, so it
     is NOT inside this wrapper — a mousedown on a row counted as "outside",
     closed the panel, and the click never reached the row. PopoverPanel
     owns this and tests the panel as well as the anchor. */

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

    /* SCOPED TO THE ACTIVE FILTER (owner request): standing on "Task
       reminders" and pressing the button clears task reminders — not the
       approvals you haven't looked at yet. On "All" it behaves exactly as
       before. Per-id marking for a filtered set (the sets are small once
       the lifecycle fixes landed); the one bulk call stays for "All". */
    if (filter !== "all" && filter !== "discuss") {
      const targets = messages.filter((m) => {
        if ((m as { read_at?: string | null }).read_at) return false;
        const a = classifyInboxActivity((m as { metadata?: unknown }).metadata);
        return filter === "other" ? a === null : a === filter;
      });
      if (targets.length === 0) return;
      const nowIso = new Date().toISOString();
      const ids = new Set(targets.map((m) => m.id));
      setInboxUnread((n) => Math.max(0, n - targets.length));
      setMessages((prev) =>
        prev.map((m) => (ids.has(m.id) ? { ...m, read_at: nowIso } : m)),
      );
      targets.forEach((m) => void markMessageRead(m.id));
      return;
    }

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
  const allDiscussRows = discussChannels
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
    });
  /* The 6-row cap only applies to the compact "All" view; the Discuss chip
     shows every unread channel. */
  const discussRows =
    filter === "discuss" ? allDiscussRows : allDiscussRows.slice(0, 6);
  const discussVisible = filter === "all" || filter === "discuss";

  /* Per-type counts over the WHOLE loaded feed — they drive which chips are
     shown (only types that actually have something) and the count badges. */
  /* UNREAD counts, deliberately — the chips counted EVERY loaded row while
     the badge and the header counted unread, so the owner's panel said
     "30 new" under a chip row shouting "All 99+ · Task reminders 64":
     three different truths for one bell. One convention now, everywhere
     a number appears on this panel: a count is things needing attention. */
  const typeCounts = new Map<NotifFilter, number>();
  for (const m of messages) {
    if ((m as { read_at?: string | null }).read_at) continue;
    const a =
      classifyInboxActivity((m as { metadata?: unknown }).metadata) ?? "other";
    typeCounts.set(a, (typeCounts.get(a) ?? 0) + 1);
  }
  const unreadInboxCount = messages.filter(
    (m) => !(m as { read_at?: string | null }).read_at,
  ).length;
  const chipCount = (key: NotifFilter): number =>
    key === "all"
      ? unreadInboxCount + allDiscussRows.length
      : key === "discuss"
        ? allDiscussRows.length
        : (typeCounts.get(key) ?? 0);
  /* A chip earns its place by having content — except "All", and except the
     currently-selected type (so the active chip can never vanish under you). */
  const visibleChips = FILTER_CHIPS.filter(
    (c) => c.key === "all" || c.key === filter || chipCount(c.key) > 0,
  );

  /* Inbox rows through the type filter. Same classifier as sounds/push. */
  const visibleMessages =
    filter === "all"
      ? messages
      : filter === "discuss"
        ? []
        : messages.filter((m) => {
            const a = classifyInboxActivity((m as { metadata?: unknown }).metadata);
            return filter === "other" ? a === null : a === filter;
          });

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
        className={`relative flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg border transition-all ${
          dk
            ? "kx-hover-glow border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
            : "kx-hover-glow border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
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

      {/* Portalled: the header pane's own backdrop-filter starved this
          panel's glass. mobileSheet keeps the phone behaviour — full width
          under the header — while md+ stays a dropdown anchored to the bell. */}
      <PopoverPanel anchorRef={wrapRef} open={open} onClose={() => setOpen(false)} align="end"
        matchAnchorWidth={false} mobileSheet maxHeight={620}
        className="kx-drop-in kx-pop-sheet kx-pop-clear w-auto md:w-[380px] md:max-w-[92vw]">
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

          {/* Type filter chips — only types that actually have items, each
              with its count, WRAPPING onto extra lines so nothing hides
              behind a horizontal scroll. Active chip inverts. */}
          <div
            className={`flex flex-wrap gap-1.5 px-3 py-2 border-b ${
              dk ? "border-white/[0.06]" : "border-black/[0.06]"
            }`}
          >
            {visibleChips.map((chip) => {
              const active = filter === chip.key;
              const label = chip.hubKey ? t(chip.hubKey) : tAct(chip.settingsKey!);
              const n = chipCount(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  className={`shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? dk
                        ? "kx-chip-on bg-white text-black border-white"
                        : "kx-chip-on bg-black text-white border-black"
                      : dk
                        ? "bg-white/[0.04] text-white/60 border-white/[0.1] hover:text-white"
                        : "bg-black/[0.03] text-black/60 border-black/[0.1] hover:text-black"
                  }`}
                >
                  {label}
                  {n > 0 && (
                    <span
                      className={`text-[9px] font-bold px-1 rounded-full ${
                        active
                          ? dk
                            ? "bg-black/15 text-black/70"
                            : "bg-white/25 text-white/90"
                          : dk
                            ? "bg-white/[0.1] text-white/50"
                            : "bg-black/[0.08] text-black/50"
                      }`}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Body — on mobile the sheet may be taller than 460px is useful
              for; cap to the space under the header instead. */}
          <div className="max-h-[calc(100dvh-var(--kx-header-h)-170px)] md:max-h-[460px] overflow-y-auto">
            {/* Discuss section */}
            {discussVisible && discussRows.length > 0 && (
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
            {visibleMessages.length > 0 && (
              <div
                className={
                  discussVisible && discussRows.length > 0
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
                  {visibleMessages.map((msg) => {
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

            {/* Filtered-empty state: this TYPE has nothing (the feed itself
                may not be empty — different message from "all caught up"). */}
            {filter !== "all" &&
              (discussVisible ? discussRows.length === 0 : true) &&
              visibleMessages.length === 0 &&
              !loadingInbox && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <p
                    className={`text-[12px] font-medium ${
                      dk ? "text-white/50" : "text-black/50"
                    }`}
                  >
                    {t("notif.noneOfType")}
                  </p>
                </div>
              )}

            {/* Empty state — show only when both sections have nothing
                AND we're not still loading the inbox fetch. */}
            {filter === "all" &&
              discussRows.length === 0 &&
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
                    className={`h-4 w-4 ${ dk ? "text-white/40" : "text-black/40" }`}
                  />
                </div>
              )}
          </div>
      </PopoverPanel>
    </div>
  );
}
