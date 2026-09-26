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
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import {
  archiveMessages,
  fetchInboxMessagesOrNull,
  fetchUnreadCount,
  markMessageRead,
  markMessagesRead,
  markMessagesUnread,
  subscribeToInboxMessages,
} from "@/lib/inbox";
import {
  fetchMyChannels,
  isAccountStreamHealthy,
  markChannelRead,
  subscribeToMyChannels,
} from "@/lib/discuss";
import { getActiveDiscussChannel } from "@/lib/discuss-active-store";
import { getCurrentAccountIdSync, useCurrentAccount } from "@/lib/identity";
import { readWarmBellFeed, writeWarmBellFeed } from "@/lib/inbox-warm";
import { activityAllowed, inQuietHours } from "@/lib/notification-activity";
import { useTranslation } from "@/lib/i18n";
import { useSkin } from "@/lib/appearance";
import { hubT } from "@/lib/translations/hub";
import { notifUiT } from "@/lib/translations/notif-ui";
import { publishInboxUnread } from "@/lib/inbox-unread-store";
import { setIconBadge } from "@/lib/app-icon-badge";
import { NotificationSections, NotificationSkeleton, notifTimeAgo, type ListActions } from "@/components/layout/NotificationList";
import PushNudge from "@/components/layout/PushNudge";
import { peekPushNudge, preparePushNudge, type PushNudge as Nudge } from "@/lib/push-nudge";
import { desktopToast, inboxToastText, type Toast } from "@/lib/desktop-toast";
import { inTab, isSecurity, type BellTab } from "@/lib/notification-view";
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

/* One slim fetch covers the whole feed (rows are ~250B without avatars):
   every tab's count is exact and nothing hides behind a "show more".
   Server caps at 300. */
const FEED_LIMIT = 300;

type TFn = (key: string, fallback?: string) => string;

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
  const { t, lang } = useTranslation(hubT);
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;

  const accountIdRef = useRef<string | null>(accountId);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);
  /* Live view of the per-activity notification switches. A ref rather than a
     closure capture: the realtime subscription below re-subscribes only when
     accountId changes, and must still see preference edits made mid-session.
     Synced in an effect (refs must not be written during render); the ref is
     only read from subscription / event callbacks, which run after commit, so
     they always see the latest committed preferences — same as before. */
  const notifPrefs = (account?.preferences as { notifications?: Record<string, unknown> } | null | undefined)?.notifications ?? undefined;
  const notifPrefsRef = useRef<Record<string, unknown> | undefined>(notifPrefs);
  useEffect(() => {
    notifPrefsRef.current = notifPrefs;
  }, [notifPrefs]);

  const [open, setOpen] = useState(defaultOpen);
  const [inboxUnread, setInboxUnread] = useState(0);
  /* Painted from the last answer (inbox-warm): the panel opens with rows,
     not a spinner, and the refresh below replaces them. Read synchronously,
     here, so nothing shifts after the first frame. */
  const [messages, setMessages] = useState<InboxMessageWithSender[]>(
    () => readWarmBellFeed(getCurrentAccountIdSync()) ?? [],
  );
  /* Starts true when the panel mounts open for a signed-in account with
     nothing painted yet: the open-effect below fetches straight away. */
  const [loadingInbox, setLoadingInbox] = useState(() => defaultOpen && !!accountId && messages.length === 0);
  /* Keep the stored list in step with the screen — every path that changes
     `messages` (refresh, realtime, mark read) lands here once. Only after a
     real answer has arrived, so an empty first frame never erases a good
     list. */
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) writeWarmBellFeed(accountId, messages);
  }, [messages, accountId]);
  /* All (the work) · Needs you · Security (lib/notification-view). */
  const [tab, setTab] = useState<BellTab>("all");
  const { t: tUi } = useTranslation(notifUiT);
  /* Dual skin: Aurora marks the selected tab with kx-seg-on; Core keeps the
     inverted pill. */
  const aurora = useSkin() === "aurora";

  const [discussChannels, setDiscussChannels] = useState<
    DiscussChannelWithState[]
  >([]);

  /* Transitions of the account and of the panel, applied DURING render (the
     React "adjust state when a prop changes" pattern) instead of as a
     synchronous setState inside the effects that react to them — which made
     every sign-out / open / close cost an extra cascading render (and tripped
     react-hooks/set-state-in-effect). Same outcomes as before:
       · signed out → inbox count, Discuss rows and the feed are cleared;
       · panel opened (or the account changed while open) → the feed shows its
         spinner until the open-effect's fetch lands;
       · panel closed → the tab resets to All so a tab left behind cannot
         hide fresh notifications on the next open.
     The async fetches themselves stay in the effects below. */
  /* The offer to turn push on here (lib/push-nudge): taken as the panel
     opens and fixed for that open, so it is there on the first frame or not
     at all — never pushed in above the rows a moment later. */
  const [nudge, setNudge] = useState<Nudge>(() => (defaultOpen ? peekPushNudge(accountId) : null));
  const [seen, setSeen] = useState({ accountId, open });
  if (seen.accountId !== accountId || seen.open !== open) {
    const accountChanged = seen.accountId !== accountId;
    const opened = open && !seen.open;
    const closed = !open && seen.open;
    setSeen({ accountId, open });
    if (accountChanged && !accountId) {
      setInboxUnread(0);
      setDiscussChannels([]);
      setMessages([]);
    }
    if (closed) setTab("all");
    if (opened || accountChanged) setNudge(open ? peekPushNudge(accountId) : null);
    /* A spinner only over an empty panel — rows painted from the last
       answer stay put while the refresh runs. */
    if (open && accountId && (opened || accountChanged)) setLoadingInbox(messages.length === 0);
  }
  /* Worked out again while the panel is shut, for the next open: permission
     or a subscription may have changed meanwhile (Settings, another tab). */
  useEffect(() => {
    if (!open) void preparePushNudge(accountId);
  }, [open, accountId]);
  /* Latest list for the realtime handler (per-channel mute check). */
  const discussChannelsRef = useRef<DiscussChannelWithState[]>([]);
  useEffect(() => {
    discussChannelsRef.current = discussChannels;
  }, [discussChannels]);
  const wrapRef = useRef<HTMLDivElement>(null);
  /* What a desktop notification needs when it is shown or clicked — the
     latest language, words and handlers. The realtime callbacks subscribe
     once per account, so they read these through a ref (synced after each
     commit, below the handlers it points at). */
  const toastRef = useRef<{
    lang: typeof lang; t: TFn; many: (n: number) => Toast;
    openRow: (m: InboxMessageWithSender) => void; openChannel: (id: string) => void;
  } | null>(null);

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

  /* The installed app's icon carries the number this bell shows. Only once
     both halves have been read: both start at 0 here, and a mount must not
     wipe the number the Gate already put on the icon. */
  const [iconKnown, setIconKnown] = useState({ inbox: false, discuss: false });
  useEffect(() => {
    if (!accountId || !iconKnown.inbox || !iconKnown.discuss) return;
    setIconBadge(inboxUnread, discussUnread);
  }, [accountId, iconKnown, inboxUnread, discussUnread]);

  /* ── Discuss: seed channel list ──────────────────────────────────── */
  const recountDiscuss = useCallback(async (): Promise<DiscussChannelWithState[] | null> => {
    const aid = accountIdRef.current;
    /* Signed out: the render-time transition above already emptied the list. */
    if (!aid) return null;
    try {
      const rows = await fetchMyChannels(aid);
      setDiscussChannels(rows);
      setIconKnown((k) => (k.discuss ? k : { ...k, discuss: true }));
      return rows;
    } catch {
      /* Leave prior list in place. */
      return null;
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
        /* …and never for a conversation the user muted (or set to
           "Nothing"), the same per-channel rule push and DiscussApp follow. */
        const ch = discussChannelsRef.current.find((c) => c.id === msg.channel_id);
        const silenced = !!ch && (ch.muted || ch.notification_pref === "none");
        const heard = !silenced && !window.location.pathname.startsWith("/discuss") && !inQuietHours((notifPrefsRef.current as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours);
        if (heard) playAppSound("message");
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
        void recountDiscuss().then((rows) => {
          /* The desktop app with its window not in front: a system
             notification too (lib/desktop-toast), under the chime's rules.
             Never for a "mentions only" conversation — this ping carries ids
             only, so a mention can't be told from any other message. */
          const c = rows?.find((x) => x.id === msg.channel_id);
          if (!heard || !c || c.muted || c.notification_pref === "none" || c.notification_pref === "mentions") return;
          const r = toastRef.current;
          if (!r) return;
          const preview = c.last_message?.body?.trim() || r.t("notif.newMessage");
          const author = c.last_message?.author_username;
          desktopToast({
            key: `discuss:${c.id}`,
            title: channelLabel(c, r.t),
            body: author ? `${author}: ${preview}` : preview,
            open: () => r.openChannel(c.id),
          }, r.many);
        });
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
    function onDiscussChange(e: Event) {
      /* DiscussApp says exactly what changed (channel + new unread state):
         patch that row locally instead of re-reading every channel. Only an
         event without a detail falls back to the full recount. */
      const d = (e as CustomEvent<{ channelId?: string; unread?: number; markedUnread?: boolean } | undefined>).detail;
      if (d?.channelId) {
        setDiscussChannels((prev) =>
          prev.map((c) =>
            c.id === d.channelId
              ? {
                  ...c,
                  ...(typeof d.unread === "number" ? { unread_count: d.unread } : {}),
                  ...(typeof d.markedUnread === "boolean" ? { marked_unread: d.markedUnread } : {}),
                }
              : c,
          ),
        );
        return;
      }
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
        /* Only conversations that are allowed to make a sound count toward
           "did something new arrive" — a muted chat must not chime. */
        const audibleUnread = (list: DiscussChannelWithState[]) =>
          list.reduce(
            (s, c) => s + (c.muted || c.notification_pref === "none" ? 0 : c.unread_count ?? 0),
            0,
          );
        const newTotal = audibleUnread(rows);
        setDiscussChannels((prev) => {
          const oldTotal = audibleUnread(prev);
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
    /* Signed out: the render-time transition above already zeroed the count. */
    if (!accountId) return;
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
      setIconKnown((k) => (k.inbox ? k : { ...k, inbox: true }));
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
        /* The desktop app with its window not in front: a system
           notification too (lib/desktop-toast) — the same switches decide. */
        const r = toastRef.current;
        if (r) desktopToast({ key: `inbox:${msg.id}`, ...inboxToastText(msg, r.lang), open: () => r.openRow(msg as unknown as InboxMessageWithSender) }, r.many);
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

  const loadInbox = useCallback(() => {
    /* Signed out: the feed was cleared by the render-time transition above.
       The profile (accountId) can still be loading on a fresh tab while the
       id in localStorage is already there — the request is session-scoped,
       so it goes out on either. State is written only in the continuation
       (never synchronously in the effect that calls this). */
    const aid = accountId ?? getCurrentAccountIdSync();
    if (!aid) return;
    /* List and count leave together (the count used to wait for the list).
       A FAILED list keeps what is shown — null, not [] — because a blink in
       the network used to empty the panel and announce "You're all caught
       up", and would now also overwrite the stored list with nothing. */
    return Promise.all([
      fetchInboxMessagesOrNull({ limit: FEED_LIMIT, slim: true }),
      fetchUnreadCount(aid),
    ]).then(([rows, n]) => {
      if (rows) {
        loadedRef.current = true;
        setMessages(rows);
      }
      setLoadingInbox(false);
      setInboxUnread(n);
    });
  }, [accountId]);

  useEffect(() => {
    /* Closing (filter reset) is handled by the render-time transition above. */
    if (!open) return;
    void loadInbox();
    void recountDiscuss();
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

  /* Optimistic, then one request for the lot (a row, a folded group, a
     tab). The server count follows the rows that actually changed. */
  function setRowsRead(rows: InboxMessageWithSender[], read: boolean) {
    const change = rows.filter((m) => !!m.read_at !== read);
    if (change.length === 0) return;
    const ids = new Set(change.map((m) => m.id));
    const nowIso = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, read_at: read ? nowIso : null } : m)));
    setInboxUnread((n) => Math.max(0, n + (read ? -change.length : change.length)));
    void (read ? markMessagesRead([...ids]) : markMessagesUnread([...ids]));
  }

  function archiveRows(rows: InboxMessageWithSender[]) {
    if (rows.length === 0) return;
    const ids = new Set(rows.map((m) => m.id));
    const unread = rows.filter((m) => !m.read_at).length;
    setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
    if (unread) setInboxUnread((n) => Math.max(0, n - unread));
    void archiveMessages([...ids]);
  }

  const listActions: ListActions<InboxMessageWithSender> = {
    onOpen: (m) => void handleInboxRowClick(m),
    onSetRead: setRowsRead,
    onArchive: archiveRows,
    /* Decided on the row: its work is done — it leaves the list. */
    onDecided: (m) => archiveRows([m]),
  };

  /* The desktop notification's latest words and handlers (toastRef). */
  useEffect(() => {
    toastRef.current = {
      lang,
      t,
      many: (n) => ({ key: "inbox:many", title: t("notif.title"), body: tUi("toast.many").replace("{n}", String(n)), open: () => setOpen(true) }),
      openRow: (m) => void handleInboxRowClick(m),
      openChannel: (id) => handleDiscussRowClick(id),
    };
  });

  /* Discuss section: only channels that actually have unread, sorted
     by the most recent activity so the freshest pings are at the top. */
  const allDiscussRows = discussChannels
    /* Same predicate as the badge sum above. Filtering on unread_count alone
       hid manually-marked-unread conversations: the badge said "1" while the
       dropdown said "all caught up" — a phantom notification you could never
       find. Badge and rows must always agree. */
    .filter((c) => (c.unread_count ?? 0) > 0 || c.marked_unread)
    .sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bt - at;
    });
  const discussRows = allDiscussRows.slice(0, 6);

  /* The tabs. A count is things needing attention (unread), one convention
     everywhere a number appears on this panel. Security appears only for
     someone who has security rows — Super Admins. */
  const tabRows = messages.filter((m) => inTab(m, tab));
  const workUnread = messages.filter((m) => !m.read_at && !isSecurity(m.metadata)).length;
  const actionCount = messages.filter((m) => inTab(m, "action")).length;
  const securityAll = messages.filter((m) => isSecurity(m.metadata));
  const securityUnread = securityAll.filter((m) => !m.read_at).length;
  const tabs: Array<{ key: BellTab; label: string; count: number }> = [
    { key: "all", label: tUi("tab.all"), count: workUnread + allDiscussRows.length },
    { key: "action", label: tUi("tab.action"), count: actionCount },
    ...(securityAll.length > 0 || tab === "security"
      ? [{ key: "security" as const, label: tUi("tab.security"), count: securityUnread }]
      : []),
  ];
  const showDiscuss = tab === "all" && discussRows.length > 0;
  const tabUnread = tab === "all" ? workUnread + allDiscussRows.length : tabRows.filter((m) => !m.read_at).length;

  /* Mark read — what the reader is looking at: this tab's rows (and, on
     All, the unread chats). One request for the rows, one per chat. */
  async function handleMarkAllRead() {
    const aid = accountIdRef.current;
    if (!aid || tabUnread === 0) return;
    setRowsRead(tabRows.filter((m) => !m.read_at), true);
    if (tab === "all" && allDiscussRows.length > 0) {
      /* Include channels the user manually "marked as unread" (dot, count 0):
         they contribute to the badge, so leaving them out let the badge stay
         red after "Mark all read" — the server's markRead clears the flag. */
      const toClear = allDiscussRows;
      setDiscussChannels((prev) => prev.map((c) => ({ ...c, unread_count: 0, marked_unread: false })));
      await Promise.all(toClear.map((c) => markChannelRead(c.id, aid).catch(() => false)));
      window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
    }
  }

  const emptyText =
    tab === "action" ? tUi("empty.action") : tab === "security" ? tUi("empty.security") : t("notif.caughtUp");

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
        className="kx-drop-in kx-pop-sheet kx-pop-clear w-auto md:w-[400px] md:max-w-[92vw]">
          {/* Header: the title, what this tab still holds, mark read, and the
              way to everything (the notification center). */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("notif.title")}</span>
            <span className="ms-auto flex items-center gap-1">
              <button
                type="button"
                data-kx-keep-hover
                onClick={handleMarkAllRead}
                disabled={tabUnread === 0}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                <CheckCheckIcon size={12} />
                {t("notif.markAllRead")}
              </button>
              <button
                type="button"
                data-kx-keep-hover
                onClick={() => { setOpen(false); router.push("/inbox"); }}
                className="flex h-7 items-center rounded-md px-2 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                {tUi("seeAll")}
              </button>
            </span>
          </div>

          {nudge && accountId && (
            <PushNudge nudge={nudge} accountId={accountId} tUi={tUi} onClose={() => setNudge(null)} />
          )}

          {/* Tabs: All (the work) · Needs you · Security (Super Admins). */}
          <div role="tablist" aria-label={t("notif.title")} className="mx-3 mb-1 flex gap-1 rounded-lg bg-[var(--bg-surface-subtle)] p-0.5">
            {tabs.map((x) => {
              const active = tab === x.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(x.key)}
                  className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium transition-colors ${
                    active
                      ? aurora
                        ? "kx-seg-on text-[var(--text-primary)]"
                        : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {x.label}
                  {x.count > 0 && (
                    <span className={`min-w-[16px] rounded-full px-1 text-[9.5px] font-bold tabular-nums ${
                      x.key === "security" ? "bg-red-500/15 text-red-500" : active && !aurora ? "bg-[var(--text-inverted)]/20" : "bg-[#567FB2]/15 text-[#567FB2]"
                    }`}>
                      {x.count > 99 ? "99+" : x.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Body — on mobile the sheet may be taller than is useful; cap to
              the space under the header instead. */}
          <div className="max-h-[calc(100dvh-var(--kx-header-h)-150px)] md:max-h-[480px] overflow-y-auto pb-1">
            {showDiscuss && (
              <section aria-label={t("notif.discuss")}>
                <h3 className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                  {t("notif.discuss")}
                </h3>
                <ul>
                  {discussRows.map((channel) => {
                    const label = channelLabel(channel, t);
                    const preview =
                      channel.last_message?.body?.trim() ||
                      ((channel.unread_count ?? 0) > 0 ? t("notif.newMessage") : t("notif.markedUnread"));
                    const author = channel.last_message?.author_username || null;
                    return (
                      <li key={channel.id}>
                        <button
                          type="button"
                          onClick={() => handleDiscussRowClick(channel.id)}
                          className="relative flex w-full gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--bg-surface-hover)]"
                        >
                          <span aria-hidden className="absolute start-1.5 top-[18px] h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                            <MessageSquareIcon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{label}</span>
                              <span className="shrink-0 rounded-full bg-[#567FB2]/15 px-1.5 text-[10px] font-bold tabular-nums text-[#567FB2]">
                                {(channel.unread_count ?? 0) > 0 ? channel.unread_count : "•"}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-dim)]">
                              {author ? `${author}: ${preview}` : preview}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {tabRows.length > 0 && (
              <NotificationSections
                rows={tabRows}
                lang={lang}
                tHub={t}
                tUi={tUi}
                time={(iso) => notifTimeAgo(iso, t)}
                actions={listActions}
              />
            )}

            {/* Never an empty box while the first answer is on its way. */}
            {loadingInbox && messages.length === 0 && !showDiscuss && <NotificationSkeleton />}

            {!loadingInbox && tabRows.length === 0 && !showDiscuss && (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]">
                  <BellIcon size={18} />
                </div>
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">{emptyText}</p>
                {tab === "all" && <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("notif.caughtUpHint")}</p>}
              </div>
            )}
          </div>
      </PopoverPanel>
    </div>
  );
}
