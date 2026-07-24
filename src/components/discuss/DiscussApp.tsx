"use client";

/* ---------------------------------------------------------------------------
   DiscussApp — the main Koleex team chat UI.

   Pattern mirrors /inbox/page.tsx so the app feels native inside the hub:
     · Three-column flexbox (sidebar / thread / details)
     · Mobile column swap via `mobileView` state
     · pinned 14px top chrome with back arrow + title + new-chat button
     · `flex-1 min-h-0` fills below the global MainHeader

   Functionality shipped in Phase A:
     · Channels + Direct Messages sidebar with unread counts + last-message preview
     · Message thread with realtime inserts via Supabase postgres_changes
     · Composer with text + file/photo/video attachments + product mentions + @mentions + emoji
     · Create-channel and start-DM modals
     · Channel details pane (members, files, pinned preview)
     · Mark-read on focus, auto-scroll to bottom on new messages
     · Typing indicator broadcast via Realtime presence
     · Read cursor persisted to discuss_members.last_read_at

   Functionality deferred to later phases (see the PLAN in claudemd):
     · Reactions UI, edit/delete, threading
     · Voice messages, desktop push, mute/DND
     · External customer chat, shared team inbox
   --------------------------------------------------------------------------- */

import { useScrollLock } from "@/hooks/useScrollLock";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import BellOffIcon from "@/components/icons/ui/BellOffIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import MessageSquarePlusIcon from "@/components/icons/ui/MessageSquarePlusIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import PinOffIcon from "@/components/icons/ui/PinOffIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";
import ReplyIcon from "@/components/icons/ui/ReplyIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CheckCheckIcon from "@/components/icons/ui/CheckCheckIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import ImageIcon from "@/components/icons/ui/PictureIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import KoleexOrb from "@/components/ai/KoleexOrb";
import DiscussAiChat from "@/components/discuss/DiscussAiChat";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import MicIcon from "@/components/icons/ui/MicIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import SmileIcon from "@/components/icons/ui/SmileIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import DiscussIcon from "@/components/icons/DiscussIcon";
import {
  addMembers,
  createChannel,
  deleteDiscussMessage,
  editDiscussMessage,
  fetchChannelMembers,
  fetchChannelMessages,
  getLastPingAt,
  isChannelStreamHealthy,
  connectDiscussStream,
  isDiscussStreamHealthy,
  fetchLinkedContact,
  fetchMyChannels,
  findOrCreateDirectChannel,
  markChannelRead,
  setChannelPinned,
  hideChannel,
  markChannelUnread,
  deleteConversation,
  openPresenceChannel,
  pinMessage,
  saveDraft,
  fetchDraft,
  clearDraft,
  sendDiscussMessage,
  setChannelMuted,
  setNotificationPref,
  subscribeToChannel,
  subscribeToMyChannels,
  toggleReaction,
  toggleStar,
  unpinMessage,
  uploadDiscussAttachment,
  uploadDiscussVoice,
  fetchMessageableAccounts,
} from "@/lib/discuss";
import { setActiveDiscussChannel } from "@/lib/discuss-active-store";
import { discussAttachmentUrl } from "@/lib/discuss-attachments";
import {
  createPreviewUrl,
  previewUrlsFor,
  rekeyPreviewUrls,
  releasePreviewUrls,
  releaseAllPreviewUrls,
} from "@/lib/discuss-object-urls";
import {
  DISCUSS_ACCEPT_ATTR,
  DISCUSS_MEDIA_MAX_BYTES,
  mb,
} from "@/lib/discuss-upload-policy";
import { record as perfRecord, event as perfEvent, count as perfCount } from "@/lib/perf/client";
import PerfPanelGate from "@/components/perf/PerfPanelGate";
import { TranslatableBody } from "./TranslatableBody";
import {
  TRANSLATE_LANGS,
  loadTranslatePrefs,
  saveTranslatePrefs,
  prefetchTranslations,
  isTranslateEngaged,
  registerOnEngage,
  type TranslatePrefs,
} from "@/lib/discuss-translate";
import { useDiscussNotifications } from "./useDiscussNotifications";
import VoiceRecorder, { VoicePlaybackBubble } from "./VoiceRecorder";
import {
  CustomerChatModal,
  CustomerContactCard,
} from "./CustomerChatModal";
import { ThreadPane } from "./ThreadPane";
import { SearchPanel } from "./SearchPanel";
import { fetchProductsSlim, fetchProductMainImages } from "@/lib/products-admin";
import { initialsOf } from "@/lib/discuss/initials";
import { useCurrentAccount } from "@/lib/identity";
import { useTranslation } from "@/lib/i18n";
import { discussT } from "@/lib/translations/discuss";
import type {
  DiscussAttachment,
  DiscussChannelKind,
  DiscussChannelWithState,
  DiscussLinkedContact,
  DiscussMemberRow,
  DiscussMention,
  DiscussMessageKind,
  DiscussMessageMetadata,
  DiscussMediaPublic,
  DiscussMessageRow,
  DiscussMessageWithAuthor,
  DiscussNotificationPref,
  DiscussProductRef,
  DiscussAuthor,
  ProductRow,
} from "@/types/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   Small helpers — shared by multiple subsections of the file
   ═══════════════════════════════════════════════════════════════════════════ */

type Recipient = {
  id: string;
  username: string;
  full_name: string | null;
  name_alt: string | null;
  avatar_url: string | null;
  role_name: string | null;
};

/** Native/alternate name (e.g. Chinese) to show muted beneath the primary
 *  name — only when it exists and differs from the primary. */
function nativeAltOf(
  primary: string | null | undefined,
  alt: string | null | undefined,
): string | null {
  const a = (alt ?? "").trim();
  return a && a !== (primary ?? "").trim() ? a : null;
}

/** Time formatter that matches WhatsApp / Slack style:
 *    Today      → "14:03"
 *    Yesterday  → "Yesterday"
 *    This week  → "Mon"
 *    Older      → "Jan 12"                                                  */
function formatSidebarTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / 86_400_000,
  );
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full timestamp shown in the thread header or on message hover.
 *  Uses the browser locale so it respects the user's region.           */
function formatFullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Friendly "day separator" label for grouping messages in the thread. */
function formatDaySeparator(iso: string, todayText: string, yesterdayText: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return todayText;
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 1) return yesterdayText;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/* Monochrome-first brand: fallback avatars are grayscale, told apart by
   initials + name rather than colour. Eight neutral steps (light → dark) give
   just enough separation between adjacent rows without introducing any hue. */
const AVATAR_GRADIENTS = [
  "from-neutral-400 to-neutral-500",
  "from-neutral-500 to-neutral-600",
  "from-neutral-600 to-neutral-700",
  "from-neutral-300 to-neutral-500",
  "from-neutral-500 to-neutral-700",
  "from-neutral-400 to-neutral-600",
  "from-neutral-600 to-neutral-800",
  "from-neutral-300 to-neutral-600",
];

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable display for a channel row — falls back to the other
 *  member's full_name for DMs, or the channel.name for groups/channels. */
/* The other party's native/alternate name (people.name_alt, e.g. Chinese),
   for the muted second line under the English name. Direct chats only. */
function altNameFor(c: DiscussChannelWithState): string | null {
  const alt = (c.other?.name_alt ?? "").trim();
  if (!alt) return null;
  return alt === (c.other?.full_name ?? "").trim() ? null : alt;
}

function displayNameFor(c: DiscussChannelWithState): string {
  if (c.kind === "direct") {
    return c.other?.full_name || c.other?.username || "Direct message";
  }
  return c.name || "Untitled channel";
}

/** Short preview for the last message (used in the sidebar). Collapses
 *  whitespace and caps length so long messages don't break the layout. */
function previewMessage(
  preview: DiscussChannelWithState["last_message"],
): string {
  if (!preview) return "";
  if (preview.kind === "image") return "📷 Photo";
  if (preview.kind === "file") return "📎 File";
  if (preview.kind === "voice") return "Voice message";
  if (preview.kind === "system") return preview.body ?? "";
  return (preview.body ?? "").replace(/\s+/g, " ").slice(0, 80);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Avatar primitive — gradient circle with initials fallback
   ═══════════════════════════════════════════════════════════════════════════ */

function Avatar({
  name,
  url,
  size = 36,
  icon,
  ring = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  icon?: React.ReactNode;
  ring?: boolean;
}) {
  const classes = `relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${gradientFor(name)} flex items-center justify-center text-white font-semibold ${ring ? "ring-2 ring-[var(--border-focus)]" : ""}`;
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  } as React.CSSProperties;
  if (url) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <div className={classes} style={style} aria-hidden>
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={classes} style={style} aria-hidden>
      {icon ?? initialsOf(name)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/* Memoised list + bubble. MessageList and MessageBubble are function
   declarations (hoisted), so wrapping them here is safe. This is the big
   smoothness win: composer typing lives in DiscussApp state, so without memo
   every keystroke re-rendered the entire thread. With MessageList memoised the
   list is skipped while typing (its props are all stable / useCallback), and
   with MessageBubble memoised a new or changed message only re-renders its own
   bubble instead of every bubble. */
const MemoMessageList = memo(MessageList);
const MemoMessageBubble = memo(MessageBubble);

export default function DiscussApp() {
  const { t } = useTranslation(discussT);
  const { account, loading: accountLoading } = useCurrentAccount();
  const accountId = account?.id ?? null;
  const accountUsername = account?.username ?? "me";
  const accountDisplayName =
    account?.person?.full_name || account?.username || "Me";

  /* ── Sidebar state ─────────────────────────────────────────────── */
  const [channels, setChannels] = useState<DiscussChannelWithState[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "unread">("all");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );

  /* ── Thread state ─────────────────────────────────────────────── */
  const [messages, setMessages] = useState<DiscussMessageWithAuthor[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [members, setMembers] = useState<
    Array<DiscussMemberRow & { author: DiscussAuthor }>
  >([]);

  /* ── Composer state ───────────────────────────────────────────── */
  const [composerBody, setComposerBody] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<
    DiscussAttachment[]
  >([]);
  const [composerProducts, setComposerProducts] = useState<DiscussProductRef[]>(
    [],
  );
  const [composerMentions, setComposerMentions] = useState<DiscussMention[]>(
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  /* Synchronous mirror of `sending`. React state updates are async, so two
     Enter presses in one tick would both see `sending === false`; a ref flips
     immediately and is the real double-send guard. (Discuss stabilization P1.) */
  const sendingRef = useRef(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /* Composer draft key: owns preview object URLs for files attached BEFORE a
     send exists. Handed to the message's clientMsgId at send (rekeyPreviewUrls)
     so one key owns the previews for the whole pending lifetime. Created lazily
     in an event handler, never during render. */
  const pendingKeyRef = useRef<string | null>(null);
  const ensurePendingKey = useCallback(() => {
    if (!pendingKeyRef.current) pendingKeyRef.current = crypto.randomUUID();
    return pendingKeyRef.current;
  }, []);

  /* Unmount / logout / account switch: release EVERY tracked object URL.
     On those transitions no pending message may survive, so holding a Blob
     would keep one user's bytes alive across a session boundary. Safe to call
     repeatedly — releaseAllPreviewUrls() is idempotent. */
  useEffect(() => releaseAllPreviewUrls, []);

  /* ── Mobile column swap ───────────────────────────────────────── */
  const [mobileView, setMobileView] = useState<"list" | "thread" | "details">(
    "list",
  );
  /* "Koleex AI" is a pinned pseudo-conversation at the top of the list. When
     open it takes over the thread column and renders <DiscussAiChat>; it is
     mutually exclusive with a real selected channel. */
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const openAiChat = useCallback(() => {
    setAiChatOpen(true);
    setSelectedChannelId(null);
    setMobileView("thread");
  }, []);

  /* ── Modals ───────────────────────────────────────────────────── */
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [customerChatOpen, setCustomerChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  /* ── Translation ──────────────────────────────────────────────────
     Multi-national teams: a sender writes in their own language and the
     receiver reads it in theirs. `auto` renders every incoming message in
     `lang` automatically; when off, each message still has a per-message
     Translate toggle. Preference is per-device (localStorage). */
  const [translatePrefs, setTranslatePrefs] = useState<TranslatePrefs>({
    auto: false,
    lang: "en",
  });
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  /* Bumped the first time the user translates a message, so the pre-warm
     effect below fires immediately (not just on the next message change). */
  const [translateTick, setTranslateTick] = useState(0);
  /* Hydrate from localStorage after mount (avoids SSR mismatch). */
  useEffect(() => {
    setTranslatePrefs(loadTranslatePrefs());
  }, []);
  useEffect(() => {
    registerOnEngage(() => setTranslateTick((n) => n + 1));
    return () => registerOnEngage(null);
  }, []);
  const updateTranslatePrefs = useCallback((patch: Partial<TranslatePrefs>) => {
    setTranslatePrefs((prev) => {
      const next = { ...prev, ...patch };
      saveTranslatePrefs(next);
      return next;
    });
  }, []);

  /* ── Phase B: message-level state ─────────────────────────────── */
  /** Message id currently being edited inline. Null when nothing is
   *  being edited. Only the author of a message can edit it. */
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  /** Reply target for the composer — shows a reply-preview banner at
   *  the top of the composer and attaches reply_to_message_id on send. */
  const [replyTarget, setReplyTarget] = useState<DiscussMessageWithAuthor | null>(
    null,
  );
  /** Parent message for the thread pane overlay. When non-null the
   *  ThreadPane drawer replaces the details column. */
  const [threadTarget, setThreadTarget] = useState<DiscussMessageWithAuthor | null>(
    null,
  );
  /** Transient toast at the bottom of the thread — used for "Link
   *  copied!", "Pinned", etc. Auto-clears after 2 seconds. */
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /** Voice recorder panel toggle. Shown inline inside the composer
   *  when the user clicks the mic button. */
  const [voiceOpen, setVoiceOpen] = useState(false);
  /** Pinned-panel toggle inside the details pane. */
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  /** Customer contact card cache keyed by channel id — avoids refetch
   *  every time the details pane opens. */
  const [linkedContacts, setLinkedContacts] = useState<
    Record<string, DiscussLinkedContact | null>
  >({});

  /* ── Phase D: notifications ───────────────────────────────────── */
  const notifApi = useDiscussNotifications();

  /* ── Product catalog cache (for product picker) ─────────────── */
  const [productCatalog, setProductCatalog] = useState<ProductRow[]>([]);
  const [productImages, setProductImages] = useState<Record<string, string>>(
    {},
  );

  /* ── Recipient catalog (for DM picker + mention picker) ─────── */
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  /* ── Presence / typing ────────────────────────────────────────── */
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());

  /* ── Refs for auto-scroll + focus ─────────────────────────────── */
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  /* Focus the composer when a conversation opens: opening one is a statement of
     intent to type. Written to yield rather than win — it stands down while any
     modal/picker owns focus, and when the operator is already in a text control.
     A channel row is a plain button, so the ordinary path still focuses.
     Precise pointers only: on touch this would raise the virtual keyboard over
     the conversation just opened. Focus after SENDING is handled in handleSend. */
  useEffect(() => {
    if (!selectedChannelId) return;
    if (
      newChannelOpen || newDmOpen || productPickerOpen ||
      mentionPickerOpen || emojiPickerOpen || voiceOpen
    ) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const el = composerRef.current;
    if (!el) return;
    const active = document.activeElement as HTMLElement | null;
    if (
      active && active !== el &&
      active.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]',
      )
    ) return;
    el.focus();
  }, [
    selectedChannelId, newChannelOpen, newDmOpen,
    productPickerOpen, mentionPickerOpen, emojiPickerOpen, voiceOpen,
  ]);

  /* ── Latest-value refs ────────────────────────────────────────────
     The realtime subscribe effect used to list `channels`, `members`,
     `notifApi`, `t`, `accountUsername`, `accountDisplayName` in its
     dep array. Every one of those changes all the time during normal
     use (a new message bumps `channels`, a pref change bumps
     `notifApi`, etc.), which meant the effect kept tearing down the
     Supabase Realtime channel and recreating it. In practice that
     window-of-instability was big enough to drop incoming messages —
     the "I have to refresh to see new messages" symptom.

     The fix: stash the latest values in refs, read them from inside
     the subscription handlers, and leave the effect depending only
     on the two things that actually imply "teardown + resubscribe":
     `selectedChannelId` and `accountId`. */
  const channelsRef = useRef<DiscussChannelWithState[]>(channels);
  const membersRef = useRef(members);
  const notifApiRef = useRef(notifApi);
  const accountRef = useRef(account);
  const selectedChannelIdRef = useRef<string | null>(selectedChannelId);
  const tRef = useRef(t);
  /* Live mirror of `messages` (for reading the current thread inside effect
     cleanups) + a per-channel snapshot cache so re-opening a conversation
     paints instantly instead of blanking to a spinner while it refetches. */
  const messagesRef = useRef<DiscussMessageWithAuthor[]>(messages);
  const messagesCacheRef = useRef<Map<string, DiscussMessageWithAuthor[]>>(
    new Map(),
  );

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);
  useEffect(() => {
    notifApiRef.current = notifApi;
  }, [notifApi]);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ═══════════════════════════════════════════════════════════════════════
     DATA LOADING
     ═══════════════════════════════════════════════════════════════════════ */

  const loadChannels = useCallback(
    async (silent = false) => {
      if (!accountId) {
        setChannels([]);
        setLoadingChannels(false);
        return;
      }
      /* Only show the sidebar spinner on the very first load. Every
         subsequent refresh (optimistic refreshes after send, realtime
         repairs, etc.) runs silently in the background so the sidebar
         doesn't flash every time something happens. */
      if (!silent) setLoadingChannels(true);
      const rows = await fetchMyChannels(accountId);
      setChannels(rows);
      setLoadingChannels(false);
    },
    [accountId],
  );

  const loadMessages = useCallback(
    async (channelId: string, silent = false) => {
      if (!accountId) return;
      if (!silent) setLoadingMessages(true);
      const rows = await fetchChannelMessages(channelId, {
        currentAccountId: accountId,
        limit: 120,
      });

      /* ── Stale-response guard (the "wrong conversation flashes" bug) ──
         setMessages used to run whenever the network answered, even if the
         user had ALREADY switched to another chat. With quick switches, a slow
         response for chat A landed after chat B was opened and overwrote B's
         thread with A's messages — the UI visibly flip-flopped between
         conversations with no user action, and the leave-snapshot could then
         cache A's messages under B's key (poisoning the cache so the wrong
         thread kept coming back). A response may only touch the UI if its
         channel is STILL the selected one; otherwise it just refreshes that
         channel's snapshot cache so the fetch isn't wasted. */
      if (selectedChannelIdRef.current !== channelId) {
        if (rows.length > 0) messagesCacheRef.current.set(channelId, rows);
        return;
      }

      setMessages((prev) => {
        /* Silent refreshes should never blow away in-flight optimistic
           state: only replace if the server returned a *newer* set than
           what we already have. Concretely, we diff by message count and
           the latest id — if either changed, swap in the server rows,
           otherwise keep the existing array reference so React doesn't
           re-render unnecessarily.

           Guard: if the fetch returned an empty array but we already have
           messages, it's almost certainly a transient network/DB error —
           keep the existing state instead of blowing away the chat. */
        if (!silent) return rows;
        if (rows.length === 0 && prev.length > 0) return prev;
        if (rows.length !== prev.length) return rows;
        const lastNew = rows[rows.length - 1]?.id;
        const lastOld = prev[prev.length - 1]?.id;
        if (lastNew !== lastOld) return rows;
        return prev;
      });
      /* Keep the snapshot cache in sync with the freshest server truth. */
      if (rows.length > 0) messagesCacheRef.current.set(channelId, rows);
      if (!silent) setLoadingMessages(false);
    },
    [accountId],
  );

  const loadMembers = useCallback(async (channelId: string) => {
    const rows = await fetchChannelMembers(channelId);
    setMembers(rows);
  }, []);

  /* ── Prefetch: the deep fix for "still loading when I swipe to another
     conversation". The per-channel snapshot cache only helps on RE-open; the
     first open of a chat still hit the network. Now we warm the cache ahead of
     the tap: (1) a throttled background sweep loads every conversation's recent
     messages shortly after the list appears, and (2) hovering / pressing a row
     kicks that channel's fetch immediately. By the time the row is tapped its
     messages are already in the cache, so the switch effect paints instantly
     with no spinner. fetchChannelMessages returns newest-last, so a 50-message
     prefetch is plenty for the first paint; opening then refreshes to the full
     120 silently. */
  const prefetchingRef = useRef<Set<string>>(new Set());
  const prefetchChannel = useCallback(
    async (channelId: string) => {
      if (!accountId) return;
      if (messagesCacheRef.current.has(channelId)) return; // already warm
      if (prefetchingRef.current.has(channelId)) return; // already in flight
      prefetchingRef.current.add(channelId);
      try {
        const rows = await fetchChannelMessages(channelId, {
          currentAccountId: accountId,
          limit: 50,
        });
        if (rows.length > 0 && !messagesCacheRef.current.has(channelId)) {
          messagesCacheRef.current.set(channelId, rows);
        }
      } catch {
        /* Prefetch is best-effort — a failure just means the real open fetches. */
      } finally {
        prefetchingRef.current.delete(channelId);
      }
    },
    [accountId],
  );

  /* Background sweep — warm every conversation once, shortly after the sidebar
     loads, throttled to a few concurrent fetches so it never competes with the
     open channel or janks the UI. Runs on idle time. */
  const bulkPrefetchedRef = useRef(false);
  useEffect(() => {
    if (!accountId || channels.length === 0 || bulkPrefetchedRef.current) return;
    bulkPrefetchedRef.current = true;

    const ids = channels
      .map((c) => c.id)
      .filter((id) => id !== selectedChannelIdRef.current);
    let cursor = 0;
    const CONCURRENCY = 3;
    const pump = () => {
      if (cursor >= ids.length) return;
      const id = ids[cursor++];
      void prefetchChannel(id).finally(pump);
    };
    const start = () => {
      for (let k = 0; k < CONCURRENCY; k++) pump();
    };
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (ric) ric(start, { timeout: 1500 });
    else window.setTimeout(start, 300);
  }, [accountId, channels, prefetchChannel]);

  /* Initial loads. */
  useEffect(() => {
    if (!accountLoading) void loadChannels();
  }, [accountLoading, loadChannels]);

  /* Recipient directory once (2 KB). The product catalog is deliberately
     NOT loaded here anymore: the old eager fetchProducts() pulled the FULL
     80-column catalog (~1.3 MB — measured ×4 on one /discuss open, ~5 MB)
     for a picker most sessions never open, and that burst was a big part of
     "Discuss is slow". It now lazy-loads the slim ?view=list projection on
     first picker open (see openProductPicker). */
  useEffect(() => {
    void fetchMessageableAccounts().then(setRecipients);
  }, []);

  /* Lazy product catalog: fetched once, on first open of the product picker.
     productCatalogLoadedRef guards re-entry; state stays warm for the rest
     of the session. */
  const productCatalogLoadedRef = useRef(false);
  const [productCatalogLoading, setProductCatalogLoading] = useState(false);
  const openProductPicker = useCallback(() => {
    setProductPickerOpen(true);
    if (productCatalogLoadedRef.current) return;
    productCatalogLoadedRef.current = true;
    setProductCatalogLoading(true);
    void Promise.all([fetchProductsSlim(), fetchProductMainImages()])
      .then(([prods, imgs]) => {
        setProductCatalog(prods);
        setProductImages(imgs);
      })
      .catch(() => { productCatalogLoadedRef.current = false; })
      .finally(() => setProductCatalogLoading(false));
  }, []);

  /* Keep sidebar in sync in real-time. Previously we refetched the
     entire `fetchMyChannels` (which costs 6 DB round-trips) on every
     single message insert anywhere in the workspace. That caused the
     sidebar to "flash" constantly and was the main reason the app
     felt slow. Now:
       · onMessageInsert → patch the affected channel row in place
         (bump last_message_at, increment unread, move to top). Zero
         DB round-trips. Instant.
       · onChannelChange → a new channel or archive. Refetch silently
         in the background so the sidebar doesn't flash. */
  useEffect(() => {
    if (!accountId) return;
    let pending = false;
    const scheduleChannelRefresh = () => {
      if (pending) return;
      pending = true;
      window.setTimeout(() => {
        pending = false;
        void loadChannels(true);
      }, 800);
    };
    return subscribeToMyChannels({
      onMessageInsert: (msg) => {
        const isSelected = selectedChannelIdRef.current === msg.channel_id;
        const isMine = msg.author_account_id === accountId;
        setChannels((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.channel_id);
          if (idx === -1) {
            /* Message in a channel we're not (yet) a member of, or the
               channel list hasn't loaded yet. Kick a silent refetch so
               the new channel appears without flashing. */
            scheduleChannelRefresh();
            return prev;
          }
          const existing = prev[idx];
          /* The realtime ping is a minimal synthetic row (ids only, body null
             — content never travels over broadcast). Overwriting the preview
             with it used to blank the row ("—") until the debounced refetch
             landed. Keep the previous preview text and just bump the clock /
             unread; the silent refetch brings the real snippet ~1s later. */
          const next: DiscussChannelWithState = {
            ...existing,
            last_message_at: msg.created_at,
            last_message:
              msg.body === null && existing.last_message
                ? { ...existing.last_message, created_at: msg.created_at }
                : {
                    id: msg.id,
                    body: msg.body,
                    kind: msg.kind,
                    author_username:
                      existing.last_message?.author_username ?? null,
                    created_at: msg.created_at,
                  },
            unread_count:
              isSelected || isMine
                ? existing.unread_count
                : existing.unread_count + 1,
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [next, ...rest];
        });
      },
      onChannelChange: scheduleChannelRefresh,
    });
  }, [accountId, loadChannels]);

  /* ── First-party SSE delivery (the China-proof fast path) ──────────────
     Production telemetry showed the Supabase websocket NEVER connects for our
     users (0 SUBSCRIBED, 333 CHANNEL_ERROR in 6h) — *.supabase.co is blocked
     from the mainland, so every message limped in via the 5–10s fallback
     poll. This stream arrives on OUR origin and carries the FULL message row,
     so the receiver renders it the moment the frame lands — no refetch RTT.
     Everything here is idempotent with the broadcast/refetch paths: dedupe is
     by message id, and my own messages are ignored (the optimistic bubble +
     send response already own that path). */
  useEffect(() => {
    if (!accountId) return;
    return connectDiscussStream((m) => {
      if (!m?.id || !m.channel_id) return;
      const isMine = m.author_account_id === accountId;

      /* Warm the per-channel snapshot cache so switching to that chat shows
         the new message even before its silent refresh lands. */
      const cached = messagesCacheRef.current.get(m.channel_id);
      if (cached && !cached.some((x) => x.id === m.id)) {
        messagesCacheRef.current.set(m.channel_id, [...cached, m]);
      }

      /* Open conversation → append instantly (skip own messages). */
      if (!isMine && selectedChannelIdRef.current === m.channel_id) {
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
      }

      /* Sidebar → bump the row in place with the REAL preview (the stream
         has content, unlike broadcast pings), move to top, count unread. */
      setChannels((prev) => {
        const idx = prev.findIndex((c) => c.id === m.channel_id);
        if (idx === -1) return prev; // membership refetch paths cover new channels
        const existing = prev[idx];
        if (existing.last_message?.id === m.id) return prev; // already applied
        const next: DiscussChannelWithState = {
          ...existing,
          last_message_at: m.created_at,
          last_message: {
            id: m.id,
            body: m.body,
            kind: m.kind,
            author_username: m.author?.username ?? null,
            created_at: m.created_at,
          },
          unread_count:
            isMine || selectedChannelIdRef.current === m.channel_id
              ? existing.unread_count
              : existing.unread_count + 1,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [next, ...rest];
      });
    });
  }, [accountId]);

  /* Load messages + members when a channel is selected, and subscribe to
     that channel's realtime stream. Cleanup tears down both subscriptions
     and clears typing state so we don't leak between channels. */
  useEffect(() => {
    if (!selectedChannelId || !accountId) return;

    /* Instant switch: if we have a snapshot of this conversation from a prior
       visit, paint it immediately and refresh silently in the background — no
       spinner, no blank thread. Only a never-opened channel shows the loading
       state. This is what makes swiping between chats feel instant. */
    const cached = messagesCacheRef.current.get(selectedChannelId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
      void loadMessages(selectedChannelId, true);
    } else {
      setMessages([]);
      void loadMessages(selectedChannelId);
    }
    void loadMembers(selectedChannelId);

    const unsubChannel = subscribeToChannel(selectedChannelId, {
      onMessageInsert: async (row) => {
        /* Read the latest state from refs so we don't have to list
           `channels`, `members`, `account*` in the effect deps (which
           would cause the subscription to tear down on every change
           and drop incoming messages). */
        const curMembers = membersRef.current;
        const curAccount = accountRef.current;
        const curChannels = channelsRef.current;
        const curNotifApi = notifApiRef.current;
        const curT = tRef.current;
        const curUsername = curAccount?.username ?? "me";
        const curDisplayName =
          curAccount?.person?.full_name || curAccount?.username || "Me";

        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          const selfMatch = row.author_account_id === accountId;
          const member = curMembers.find(
            (m) => m.author.id === row.author_account_id,
          );
          const author: DiscussAuthor | null = selfMatch
            ? {
                id: accountId,
                username: curUsername,
                avatar_url: curAccount?.avatar_url ?? null,
                full_name: curDisplayName,
              }
            : member?.author ?? null;
          return [
            ...prev,
            {
              ...row,
              author,
              reactions: [],
            },
          ];
        });

        /* kx-perf: broadcast ping -> message visible on screen. */
        {
          const pingAt = getLastPingAt(selectedChannelId);
          if (pingAt) requestAnimationFrame(() => perfRecord("discuss.recv.visible_ms", performance.now() - pingAt));
        }

        /* Phase D: raise a desktop notification + sound for inbound
           messages in the currently-open channel when the tab isn't
           focused. For muted / DND / "mentions-only" channels the
           notify() helper will short-circuit internally. */
        if (row.author_account_id !== accountId) {
          const selfChannel = curChannels.find(
            (c) => c.id === selectedChannelId,
          );
          const body = row.body ?? "";
          const mentionedMe = Array.isArray(row.metadata?.mentions)
            ? (row.metadata.mentions as DiscussMention[]).some(
                (m) => m.account_id === accountId,
              )
            : false;
          curNotifApi.notify(
            {
              title: selfChannel?.name
                ? `#${selfChannel.name}`
                : curT("notif.newMessage", "New message"),
              body: body.slice(0, 140),
              channelId: selectedChannelId,
            },
            {
              muted: selfChannel?.muted ?? false,
              pref: (selfChannel?.notification_pref ?? "all") as
                | "all"
                | "mentions"
                | "none",
              mentionsMe: mentionedMe,
            },
          );
        }
      },
      onMessageUpdate: (row) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === row.id
              ? { ...m, body: row.body, edited_at: row.edited_at, deleted_at: row.deleted_at, metadata: row.metadata }
              : m,
          ),
        );
      },
      onReactionInsert: (rx) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== rx.message_id) return m;
            const existing = m.reactions.find((r) => r.emoji === rx.emoji);
            if (existing) {
              if (existing.account_ids.includes(rx.account_id)) return m;
              return {
                ...m,
                reactions: m.reactions.map((r) =>
                  r.emoji === rx.emoji
                    ? {
                        ...r,
                        count: r.count + 1,
                        account_ids: [...r.account_ids, rx.account_id],
                        reacted_by_me:
                          r.reacted_by_me || rx.account_id === accountId,
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
                  emoji: rx.emoji,
                  count: 1,
                  account_ids: [rx.account_id],
                  reacted_by_me: rx.account_id === accountId,
                },
              ],
            };
          }),
        );
      },
      onReactionDelete: (rx) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== rx.message_id) return m;
            const existing = m.reactions.find((r) => r.emoji === rx.emoji);
            if (!existing) return m;
            const nextCount = existing.count - 1;
            if (nextCount <= 0) {
              return {
                ...m,
                reactions: m.reactions.filter((r) => r.emoji !== rx.emoji),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === rx.emoji
                  ? {
                      ...r,
                      count: nextCount,
                      account_ids: r.account_ids.filter(
                        (id) => id !== rx.account_id,
                      ),
                      reacted_by_me:
                        r.reacted_by_me && rx.account_id !== accountId,
                    }
                  : r,
              ),
            };
          }),
        );
      },
    });

    return () => {
      /* Snapshot this channel's thread (including realtime messages received
         while it was open) so re-opening it paints instantly from cache.
         selectedChannelId here is the channel being left. Verify the rows
         actually belong to it before writing — during a fast switch the state
         can briefly hold another chat's messages, and snapshotting those here
         would poison the cache with the wrong conversation. */
      const leaving = messagesRef.current;
      const last = leaving[leaving.length - 1] as
        | { channel_id?: string }
        | undefined;
      if (last && last.channel_id === selectedChannelId) {
        messagesCacheRef.current.set(selectedChannelId, leaving);
      }
      unsubChannel();
    };
    /* Critical: only depend on the two things that actually mean
       "teardown + resubscribe". Everything else (channels, members,
       notifApi, t, account*) is read via refs above. If we re-added
       any of those here the subscription would flap constantly and
       drop realtime messages. */
  }, [selectedChannelId, accountId, loadMessages, loadMembers]);

  /* Connection-aware reconciliation (Phase 3C).

     Realtime broadcast pings are the PRIMARY delivery path (a ping triggers a
     small incremental fetch in subscribeToChannel). This effect replaces the
     old every-5s full-page refetch with a decision tick that only touches the
     network when something justifies it:

       · realtime healthy + pings arrived since the last full pass → ONE full
         reconcile (edits / deletions / reactions, which the incremental
         cursor can't see) at most every ~30s, jittered;
       · realtime healthy + quiet → nothing (a 5-minute safety pass is the
         only exception, as cheap insurance against a silently wedged stream);
       · realtime unhealthy for >8s (real drop, not a reconnect blip) → full
         fallback polling with backoff (10s → 20s → 40s cap, jittered);
       · the moment health returns → immediate catch-up reconcile.

     Lifecycle events (focus / visibility / browser-online) always trigger a
     full refresh — those are the moments a backgrounded tab misses events.
     Exactly one loop exists per open channel; the effect cleans up on channel
     switch and unmount. */
  useEffect(() => {
    if (!selectedChannelId || !accountId) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const visible = () =>
      !cancelled && document.visibilityState !== "hidden";

    const refreshAll = () => {
      if (!visible()) return;
      void loadMessages(selectedChannelId, true);
      void loadChannels(true);
    };
    const onFocus = () => refreshAll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshAll();
    };
    const onOnline = () => refreshAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    const HEALTHY_GAP = 30_000;   // dirty reconcile cadence while healthy
    const SAFETY_GAP = 300_000;   // quiet-stream insurance pass
    /* Fallback is now a SHORT bridge, not a way of life: subscribeBroadcast
       self-heals dead channels (rejoin + backoff + online/visible kicks), so
       unhealthy windows last seconds. While one is open, a chat app must still
       FEEL live — poll the open conversation every ~5s (server cost ~150 ms)
       instead of the old 10s→40s backoff that made messages appear a minute
       late whenever realtime dropped. */
    const GRACE = 3_000;          // unhealthy blips shorter than this: no storm
    const FB_BASE = 5_000;        // fallback poll base interval
    const FB_MAX = 10_000;        // fallback backoff cap
    const jitter = () => 0.8 + Math.random() * 0.4;

    let lastFull = performance.now();
    let lastFallback = 0;
    let unhealthySince: number | null = null;
    let wasUnhealthy = false;

    const fullReconcile = (reason: string) => {
      lastFull = performance.now();
      perfCount("discuss.poll.tick");
      perfEvent("discuss.reconcile", { reason });
      void loadMessages(selectedChannelId, true);
    };

    const tick = () => {
      if (!visible()) { perfCount("discuss.poll.hidden_skip"); return; }
      const now = performance.now();
      /* The first-party SSE stream counts as a healthy live path: with the
         Supabase websocket blocked (mainland China), SSE is the PRIMARY
         delivery and the fallback poll must not run alongside it. New
         messages arrive over SSE; the dirty/safety reconciles below still
         pick up edits / deletions / reactions. */
      if (isChannelStreamHealthy(selectedChannelId) || isDiscussStreamHealthy()) {
        if (wasUnhealthy) {
          /* Recovery: realtime is back — catch up on anything missed. */
          wasUnhealthy = false;
          unhealthySince = null;
          fullReconcile("recovered");
          return;
        }
        unhealthySince = null;
        const dirty = (getLastPingAt(selectedChannelId) ?? -1) > lastFull;
        if (dirty && now - lastFull >= HEALTHY_GAP * jitter()) { fullReconcile("dirty"); return; }
        if (now - lastFull >= SAFETY_GAP * jitter()) { fullReconcile("safety"); return; }
        perfCount("discuss.poll.skipped");
        return;
      }
      /* Unhealthy stream. */
      if (unhealthySince == null) {
        unhealthySince = now;
        wasUnhealthy = true;
        perfEvent("discuss.rt.fallback");
      }
      if (now - unhealthySince < GRACE) return;
      const level = Math.min(2, Math.floor((now - unhealthySince) / 60_000));
      const backoff = Math.min(FB_BASE * 2 ** level, FB_MAX);
      if (now - lastFallback >= backoff * jitter()) {
        lastFallback = now;
        fullReconcile("fallback");
      }
    };

    /* The 5s tick is a local decision only — it performs NO network work
       unless one of the rules above fires. */
    const pollId = window.setInterval(tick, 5_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.clearInterval(pollId);
    };
  }, [selectedChannelId, accountId, loadMessages, loadChannels]);

  /* Pre-warm translations so the per-message "Translate" click (and
     Auto-translate) resolve instantly from cache instead of waiting on a
     provider round-trip. Runs only once the user shows intent — Auto-translate
     on, or after their first manual translate (translateTick) — so a reader who
     never translates costs zero AI calls. One batched request per change;
     already-cached messages are skipped, so a quiet channel sends nothing. */
  useEffect(() => {
    if (!accountId) return;
    if (!translatePrefs.auto && !isTranslateEngaged()) return;
    const bodies = messages
      .filter((m) => m.author_account_id !== accountId && !m.deleted_at && m.body)
      .slice(-30)
      .map((m) => m.body as string);
    if (bodies.length > 0) void prefetchTranslations(bodies, translatePrefs.lang);
  }, [messages, translatePrefs.auto, translatePrefs.lang, translateTick, accountId]);

  /* Presence + typing. Fresh channel each time the selection changes. */
  useEffect(() => {
    if (!selectedChannelId || !accountId) return;
    const presence = openPresenceChannel({
      channelId: selectedChannelId,
      accountId,
      username: accountUsername,
      onTyping: (fromId, username) => {
        if (fromId === accountId) return;
        setTypingUsers((prev) =>
          prev.includes(username) ? prev : [...prev, username],
        );
        /* Clear after 4s of silence, Slack-style. */
        const existing = typingTimeoutsRef.current.get(username);
        if (existing) window.clearTimeout(existing);
        const id = window.setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== username));
          typingTimeoutsRef.current.delete(username);
        }, 4000);
        typingTimeoutsRef.current.set(username, id);
      },
    });

    return () => {
      presence.close();
      /* Clear all typing timers so the next channel starts clean. */
      for (const id of typingTimeoutsRef.current.values()) {
        window.clearTimeout(id);
      }
      typingTimeoutsRef.current.clear();
      setTypingUsers([]);
    };
  }, [selectedChannelId, accountId, accountUsername]);

  /* Auto-scroll. The old version jumped to the bottom on `selectedChannelId`
     change — but that fires BEFORE the channel's messages have loaded, so it
     scrolled an empty list and left the user stuck at the top (they had to
     scroll down to see the latest). Now we wait until the loaded messages
     actually belong to the open channel, then jump to the newest ONCE; after
     that we only auto-follow if the user is already near the bottom. */
  const initialScrolledChannelRef = useRef<string | null>(null);
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el || !selectedChannelId) return;
    const last = messages[messages.length - 1] as
      | { channel_id?: string }
      | undefined;
    const belongsToChannel = !!last && last.channel_id === selectedChannelId;
    if (!belongsToChannel) return;

    if (initialScrolledChannelRef.current !== selectedChannelId) {
      /* First render of this channel's messages → snap to the newest. A single
         rAF measured scrollHeight BEFORE avatars / images / dynamic bubble
         content finished laying out, so it landed in the middle of the thread
         and the user had to scroll down. Snap now and again over the next few
         frames until the height has settled, instantly (no animation) so the
         chat opens already pinned to the latest message like WhatsApp. */
      initialScrolledChannelRef.current = selectedChannelId;
      const snap = () => {
        const e = threadScrollRef.current;
        if (e) e.scrollTop = e.scrollHeight;
      };
      snap();
      requestAnimationFrame(() => {
        snap();
        requestAnimationFrame(snap);
      });
      window.setTimeout(snap, 80);
      window.setTimeout(snap, 200);
      window.setTimeout(snap, 400);
      return;
    }
    const nearBottom =
      el.scrollHeight - (el.scrollTop + el.clientHeight) < 200;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, selectedChannelId]);

  /* Mark the selected channel read whenever we render its latest message.
     Debounced so a burst of realtime inserts only triggers one write.
     Also dispatches `discuss:unread-changed` so the global bell in
     MainHeader drops its badge count immediately. */
  useEffect(() => {
    if (!selectedChannelId || !accountId || messages.length === 0) return;
    const id = window.setTimeout(() => {
      void markChannelRead(selectedChannelId, accountId).then(() => {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedChannelId ? { ...c, unread_count: 0 } : c,
          ),
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
        }
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [selectedChannelId, accountId, messages.length]);

  /* Publish the conversation the user is ACTIVELY viewing (open + tab in the
     foreground) so the notification bell can skip counting a message that
     arrives in the chat you're already looking at — you can see it, the chime
     is enough (WeChat behaviour). Cleared when Discuss is backgrounded or
     unmounted. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const publish = () =>
      setActiveDiscussChannel(
        document.visibilityState === "visible" ? selectedChannelId : null,
      );
    publish();
    document.addEventListener("visibilitychange", publish);
    return () => {
      document.removeEventListener("visibilitychange", publish);
      setActiveDiscussChannel(null);
    };
  }, [selectedChannelId]);

  /* Drafts: load a saved draft when switching channels, save on change
     (debounced), clear on send. */
  useEffect(() => {
    if (!selectedChannelId || !accountId) return;
    void fetchDraft(accountId, selectedChannelId).then((draft) => {
      if (draft) setComposerBody(draft.body ?? "");
      else setComposerBody("");
      /* Reset side-payloads since drafts currently store text only. */
      setComposerAttachments([]);
      setComposerProducts([]);
      setComposerMentions([]);
    });
  }, [selectedChannelId, accountId]);

  useEffect(() => {
    if (!selectedChannelId || !accountId) return;
    const id = window.setTimeout(() => {
      if (composerBody.trim()) {
        void saveDraft({
          accountId,
          channelId: selectedChannelId,
          body: composerBody,
        });
      } else {
        void clearDraft(accountId, selectedChannelId);
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [composerBody, selectedChannelId, accountId]);

  /* ═══════════════════════════════════════════════════════════════════════
     FILTERING / DERIVED STATE
     ═══════════════════════════════════════════════════════════════════════ */

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (sidebarFilter === "unread") {
      list = list.filter((c) => c.unread_count > 0);
    }
    const q = sidebarSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => displayNameFor(c).toLowerCase().includes(q));
    }
    return list;
  }, [channels, sidebarFilter, sidebarSearch]);

  const groupedChannels = useMemo(() => {
    const dms: DiscussChannelWithState[] = [];
    const groups: DiscussChannelWithState[] = [];
    for (const c of filteredChannels) {
      if (c.kind === "direct") dms.push(c);
      else groups.push(c);
    }
    /* Pinned conversations float to the top of their group so an optimistic
       pin reorders instantly (the server also sorts pinned-first). Stable:
       non-pinned keep their existing last-message order. */
    const pinnedFirst = (a: DiscussChannelWithState, b: DiscussChannelWithState) =>
      a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1;
    dms.sort(pinnedFirst);
    groups.sort(pinnedFirst);
    return { dms, groups };
  }, [filteredChannels]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  /* Total unread across all channels — used for the sidebar header badge. */
  const totalUnread = useMemo(
    () => channels.reduce((acc, c) => acc + c.unread_count, 0),
    [channels],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     HANDLERS
     ═══════════════════════════════════════════════════════════════════════ */

  const showToast = useCallback((text: string) => {
    setToastMessage(text);
    window.setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const handleSelectChannel = useCallback((channelId: string) => {
    /* Switching conversations tears down every pending bubble in the old one,
       so their previews have no reader left. Releasing here is what stops
       object URLs accumulating for the whole session as the user browses. */
    releaseAllPreviewUrls();
    setAiChatOpen(false); // redesign: close the AI panel when changing chats
    setSelectedChannelId(channelId);
    setMobileView("thread");
    setProductPickerOpen(false);
    setMentionPickerOpen(false);
    setEmojiPickerOpen(false);
  }, []);

  const handleStartDirect = useCallback(
    async (otherId: string) => {
      if (!accountId) return;
      const id = await findOrCreateDirectChannel(accountId, otherId);
      if (!id) return;
      setNewDmOpen(false);
      await loadChannels(true);
      handleSelectChannel(id);
    },
    [accountId, loadChannels, handleSelectChannel],
  );

  const handleCreateChannel = useCallback(
    async (input: {
      name: string;
      description?: string;
      kind: "group" | "channel";
      memberIds: string[];
    }) => {
      if (!accountId) return;
      const row = await createChannel({
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        createdBy: accountId,
        memberIds: input.memberIds,
      });
      if (!row) {
        /* Keep the modal open so the user doesn't think "nothing
           happened", and surface a toast explaining the most common
           cause: the Discuss migration hasn't been applied to
           Supabase yet. Check the console for the precise DB error. */
        showToast(
          t(
            "new.channel.failed",
            "Couldn't create the channel. Check your Supabase Discuss migration.",
          ),
        );
        return;
      }
      setNewChannelOpen(false);
      await loadChannels(true);
      handleSelectChannel(row.id);
    },
    [accountId, loadChannels, handleSelectChannel, showToast, t],
  );

  const handleFilePick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      const uploaded: DiscussAttachment[] = [];
      /* Unit 2: uploads can now be REFUSED (unsupported type / over 50MB) by
         the client preflight, the API, or the bucket itself. The old code did
         `if (rec) uploaded.push(rec)` — a rejected file just disappeared with
         no explanation. Surface the first reason instead; the filename is
         deliberately not echoed into the toast. */
      let rejection: "type" | "size" | "failed" | null = null;
      const previewKey = ensurePendingKey();
      for (const f of Array.from(files)) {
        const res = await uploadDiscussAttachment(f);
        if (res.ok) {
          /* Bind a sender-local preview to the slot this file will occupy in
             the canonical media list. `composerAttachments.length + uploaded
             .length` is that slot: the composer holds attachments only, so
             they map to indexes 0..n-1 exactly like discussMediaList(). The
             URL lives ONLY in the manager — it is never put on the attachment
             record, so it cannot reach the API payload or another user. */
          const slot = composerAttachments.length + uploaded.length;
          createPreviewUrl(previewKey, slot, f);
          uploaded.push(res.attachment);
        } else if (!rejection) rejection = res.reason;
      }
      if (uploaded.length) setComposerAttachments((prev) => [...prev, ...uploaded]);
      if (rejection === "type") showToast(t("upload.rejectedType", "That file type isn't supported"));
      else if (rejection === "size")
        showToast(
          t("upload.rejectedSize", "File is too large (max {max}MB)").replace(
            "{max}",
            mb(DISCUSS_MEDIA_MAX_BYTES),
          ),
        );
      else if (rejection === "failed") showToast(t("upload.failed", "Upload failed. Please try again"));
      setUploading(false);
      /* Reset the input so the same file can be re-picked. */
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [showToast, t, composerAttachments.length, ensurePendingKey],
  );

  const handleSend = useCallback(async () => {
    if (!accountId || !selectedChannelId) return;
    /* Re-entrancy guard: the button is disabled while sending, but the Enter
       key path bypasses the button entirely. Without this, two Enters inside
       one render tick both read the stale composer closure and insert two
       rows. (Discuss stabilization P1.) */
    if (sendingRef.current) return;
    const trimmed = composerBody.trim();
    if (!trimmed && composerAttachments.length === 0 && composerProducts.length === 0) {
      return;
    }
    sendingRef.current = true;
    setSending(true);
    const kxT0 = performance.now(); /* kx-perf: send lifecycle starts at the press */

    /* Decide kind from attachments — single image → "image", any other file
       → "file", text only → "text". Keeps sidebar previews smart. */
    let kind: DiscussMessageKind = "text";
    if (composerAttachments.length === 1 && composerAttachments[0].type.startsWith("image/")) {
      kind = "image";
    } else if (composerAttachments.length > 0) {
      kind = "file";
    }

    /* WIRE payload — what the server persists. `attachments` carries the
       private file_path so the row can locate its objects. This shape goes UP
       only; it is never what we render. */
    const metadata: DiscussMessageMetadata = {};
    if (composerAttachments.length > 0) metadata.attachments = composerAttachments;
    if (composerProducts.length > 0) metadata.products = composerProducts;
    if (composerMentions.length > 0) metadata.mentions = composerMentions;

    /* DISPLAY payload — what the optimistic bubble renders. Built to the SAME
       client-safe contract the server returns (metadata.media, canonical
       indexes), so the renderer has exactly one media shape to understand and
       never parses a storage shape. Indexes mirror discussMediaList(): the
       composer holds attachments only, so they occupy 0..n-1. */
    const optimisticMedia = composerAttachments.map((a, index) => ({
      index,
      name: a.name,
      type: a.type,
      size: a.size,
      kind: "attachment" as const,
    }));

    /* Optimistic append — the realtime subscription will dedupe this
       once the server round-trip finishes. Keeps the thread feeling
       instant even on slow connections. */
    /* One UUID per logical send. It is BOTH the optimistic bubble's local id
       and the server-side idempotency key, so a retry of this same pending
       message can never create a second row (unique index on
       discuss_messages(channel_id, client_msg_id)). `temp_${Date.now()}`
       previously collided for two sends inside the same millisecond. */
    const clientMsgId = crypto.randomUUID();
    const tempId = `temp_${clientMsgId}`;
    /* Hand the composer's previews to this send. From here the clientMsgId is
       the sole owner, so reconcile/discard release exactly what they created. */
    if (pendingKeyRef.current) {
      rekeyPreviewUrls(pendingKeyRef.current, clientMsgId);
      pendingKeyRef.current = null;
    }
    const replyToId = replyTarget?.id ?? null;
    const replyPreview = replyTarget
      ? {
          id: replyTarget.id,
          body: replyTarget.body,
          author_username: replyTarget.author?.username ?? null,
          author_full_name: replyTarget.author?.full_name ?? null,
          kind: replyTarget.kind,
          deleted_at: replyTarget.deleted_at,
        }
      : null;
    const optimistic: DiscussMessageWithAuthor = {
      id: tempId,
      channel_id: selectedChannelId,
      author_account_id: accountId,
      reply_to_message_id: replyToId,
      kind,
      body: trimmed || null,
      body_html: null,
      /* Render from the safe contract, not the wire payload: the optimistic
         bubble gets `media` (display fields + canonical index) exactly like a
         server-returned row. The wire `metadata` above is passed separately to
         sendDiscussMessage(). */
      metadata: { media: optimisticMedia },
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      /* The optimistic bubble carries the same key it will be persisted with,
         so it can be matched to the canonical row by client_msg_id rather than
         by temp id alone. */
      client_msg_id: clientMsgId,
      author: {
        id: accountId,
        username: accountUsername,
        avatar_url: account?.avatar_url ?? null,
        full_name: accountDisplayName,
      },
      reactions: [],
      reply_preview: replyPreview,
    };
    setMessages((prev) => [...prev, optimistic]);
    /* kx-perf: press -> optimistic bubble painted (next frame). */
    requestAnimationFrame(() => perfRecord("discuss.send.optimistic_ms", performance.now() - kxT0));
    setComposerBody("");
    setComposerAttachments([]);
    setComposerProducts([]);
    setComposerMentions([]);
    setReplyTarget(null);

    const kxReq = performance.now(); /* kx-perf: HTTP round-trip start */
    const saved = await sendDiscussMessage({
      channelId: selectedChannelId,
      authorId: accountId,
      body: trimmed,
      kind,
      metadata,
      replyToMessageId: replyToId,
      clientMsgId,
    });

    if (saved) {
      /* kx-perf: server acknowledgement + full-lifecycle timings. */
      perfRecord("discuss.send.ack_ms", performance.now() - kxReq);
      perfRecord("discuss.send.total_ms", performance.now() - kxT0);
      requestAnimationFrame(() => perfRecord("discuss.send.reconcile_ms", performance.now() - kxT0));
      /* Replace the optimistic row with the real one so its id matches
         the realtime INSERT event we'll get, and the dedupe logic
         works. */
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: saved.id,
                created_at: saved.created_at,
                /* Adopt the SERVER's media projection. The optimistic bubble
                   was rendering locally-derived media against a temp id, which
                   discussAttachmentUrl() refuses; once reconciled the message
                   has a canonical id, so its media must come from the canonical
                   response for the first-party URLs to resolve. */
                metadata: saved.metadata ?? m.metadata,
              }
            : m,
        ),
      );
      /* Canonical media is now live, so the local previews have no reader.
         Releasing here — and only here — frees the Blobs at the exact moment
         they stop being displayed. */
      releasePreviewUrls(clientMsgId);
      void clearDraft(accountId, selectedChannelId);
      /* Silent refresh so the sidebar reflects the new last_message_at
         — the realtime handler will also patch it in place, this is
         just a safety net. No spinner. */
      void loadChannels(true);
    } else {
      perfEvent("discuss.send.failed"); /* kx-perf: no content, just the fact */
      /* Restore the body so the user can retry without re-typing. */
      setComposerBody(trimmed);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      /* Today a failed send DISCARDS the optimistic bubble, so nothing renders
         its previews any more and holding the Blobs would leak. Unit 3 will
         keep the bubble in a failed-pending state for retry/discard; when it
         does, this release moves to the discard branch only. */
      releasePreviewUrls(clientMsgId);
    }
    sendingRef.current = false;
    setSending(false);
    composerRef.current?.focus();
  }, [
    accountId,
    selectedChannelId,
    composerBody,
    composerAttachments,
    composerProducts,
    composerMentions,
    accountUsername,
    account?.avatar_url,
    accountDisplayName,
    loadChannels,
    replyTarget,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      /* IME guard (Discuss stabilization P1): while a Chinese/Japanese/Korean
         input method is composing, Enter CONFIRMS the candidate — it does not
         mean "send". Sending here would fire a half-composed buffer and make
         the composer unusable for CJK. `isComposing` is the standard signal;
         keyCode 229 is the legacy fallback some IMEs still report. */
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleComposerChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setComposerBody(e.target.value);
    },
    [],
  );

  const handleAddProduct = useCallback((p: ProductRow) => {
    const ref: DiscussProductRef = {
      id: p.id,
      name: p.product_name,
      slug: p.slug,
      image: productImages[p.id] ?? null,
    };
    setComposerProducts((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [...prev, ref],
    );
    setProductPickerOpen(false);
  }, [productImages]);

  const handleAddMention = useCallback(
    (r: Recipient) => {
      const token = `@${r.username} `;
      const offset = composerBody.length;
      setComposerBody((prev) => prev + token);
      setComposerMentions((prev) => [
        ...prev,
        {
          account_id: r.id,
          username: r.username,
          offset,
          length: token.length - 1,
        },
      ]);
      setMentionPickerOpen(false);
      composerRef.current?.focus();
    },
    [composerBody],
  );

  const handleAddEmoji = useCallback((emoji: string) => {
    setComposerBody((prev) => prev + emoji);
    setEmojiPickerOpen(false);
    composerRef.current?.focus();
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE B — MESSAGE ACTIONS
     Optimistic where safe, refetch where the server is source of truth.
     ═══════════════════════════════════════════════════════════════════════ */

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!accountId) return;
      /* Optimistic flip. Realtime callbacks may also fire, but our
         dedupe keeps the list consistent. */
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            const nextCount = existing.count + (existing.reacted_by_me ? -1 : 1);
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
                      reacted_by_me: !r.reacted_by_me,
                      account_ids: r.reacted_by_me
                        ? r.account_ids.filter((id) => id !== accountId)
                        : [...r.account_ids, accountId],
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
                account_ids: [accountId],
                reacted_by_me: true,
              },
            ],
          };
        }),
      );
      await toggleReaction(messageId, accountId, emoji);
    },
    [accountId],
  );

  const handleStartEdit = useCallback((msg: DiscussMessageWithAuthor) => {
    setEditingMessageId(msg.id);
    setEditingDraft(msg.body ?? "");
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingDraft("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId) return;
    const trimmed = editingDraft.trim();
    if (!trimmed) {
      handleCancelEdit();
      return;
    }
    const ok = await editDiscussMessage(editingMessageId, trimmed);
    if (ok) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessageId
            ? { ...m, body: trimmed, edited_at: new Date().toISOString() }
            : m,
        ),
      );
      handleCancelEdit();
    }
  }, [editingMessageId, editingDraft, handleCancelEdit]);

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!window.confirm(t("msg.deleteConfirm", "Delete this message?"))) return;
      const ok = await deleteDiscussMessage(messageId);
      if (ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, deleted_at: new Date().toISOString(), body: null }
              : m,
          ),
        );
      }
    },
    [t],
  );

  const handlePin = useCallback(
    async (messageId: string) => {
      if (!selectedChannelId || !accountId) return;
      const ok = await pinMessage(selectedChannelId, messageId, accountId);
      if (ok) showToast(t("msg.pinned", "Pinned to channel"));
    },
    [selectedChannelId, accountId, showToast, t],
  );

  const handleUnpin = useCallback(
    async (messageId: string) => {
      if (!selectedChannelId) return;
      const ok = await unpinMessage(selectedChannelId, messageId);
      if (ok) showToast(t("msg.unpinned", "Unpinned"));
    },
    [selectedChannelId, showToast, t],
  );

  const handleStar = useCallback(
    async (messageId: string) => {
      if (!accountId) return;
      const isNow = await toggleStar(messageId, accountId);
      showToast(
        isNow
          ? t("msg.starred", "Saved for later")
          : t("msg.unstarred", "Removed from saved"),
      );
    },
    [accountId, showToast, t],
  );

  const handleCopyLink = useCallback(
    async (messageId: string) => {
      if (!selectedChannelId) return;
      const url = `${window.location.origin}/discuss/${selectedChannelId}#${messageId}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t("link.copied", "Link copied"));
      } catch {
        /* Some browsers block clipboard access without a gesture. */
      }
    },
    [selectedChannelId, showToast, t],
  );

  const handleStartReply = useCallback(
    (msg: DiscussMessageWithAuthor) => {
      setReplyTarget(msg);
      composerRef.current?.focus();
    },
    [],
  );

  const handleOpenThread = useCallback(
    (msg: DiscussMessageWithAuthor) => {
      setThreadTarget(msg);
      setDetailsOpen(false);
    },
    [],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE D — Mute / DND / Voice
     ═══════════════════════════════════════════════════════════════════════ */

  const handleToggleMute = useCallback(async () => {
    if (!selectedChannelId || !accountId) return;
    const ch = channels.find((c) => c.id === selectedChannelId);
    if (!ch) return;
    const next = !ch.muted;
    setChannels((prev) =>
      prev.map((c) => (c.id === selectedChannelId ? { ...c, muted: next } : c)),
    );
    await setChannelMuted(selectedChannelId, accountId, next);
    showToast(
      next
        ? t("notif.muted", "Channel muted")
        : t("notif.unmuted", "Channel unmuted"),
    );
  }, [selectedChannelId, accountId, channels, showToast, t]);

  const handleSetNotificationPref = useCallback(
    async (pref: DiscussNotificationPref) => {
      if (!selectedChannelId || !accountId) return;
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedChannelId ? { ...c, notification_pref: pref } : c,
        ),
      );
      await setNotificationPref(selectedChannelId, accountId, pref);
    },
    [selectedChannelId, accountId],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     Conversation row context menu (WeChat-style: right-click / long-press).
     Every action is optimistic on the sidebar, then persisted + silently
     re-synced so the badge/order match the server.
     ═══════════════════════════════════════════════════════════════════════ */
  const [convMenu, setConvMenu] = useState<{
    channel: DiscussChannelWithState;
    x: number;
    y: number;
  } | null>(null);
  const closeConvMenu = useCallback(() => setConvMenu(null), []);

  const handleToggleConvPin = useCallback(
    async (ch: DiscussChannelWithState) => {
      const next = !ch.pinned;
      const stamp = new Date().toISOString();
      setChannels((prev) =>
        prev.map((c) =>
          c.id === ch.id ? { ...c, pinned: next, pinned_at: next ? stamp : null } : c,
        ),
      );
      await setChannelPinned(ch.id, next);
      void loadChannels(true);
      showToast(next ? t("conv.pinned", "Pinned to top") : t("conv.unpinned", "Unpinned"));
    },
    [loadChannels, showToast, t],
  );

  const handleSetConvMuted = useCallback(
    async (ch: DiscussChannelWithState) => {
      if (!accountId) return;
      const next = !ch.muted;
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, muted: next } : c)));
      await setChannelMuted(ch.id, accountId, next);
      showToast(next ? t("conv.muted", "Muted") : t("conv.unmuted", "Unmuted"));
    },
    [accountId, showToast, t],
  );

  const handleToggleConvUnread = useCallback(
    async (ch: DiscussChannelWithState) => {
      if (!accountId) return;
      const isUnread = ch.unread_count > 0 || ch.marked_unread === true;
      if (isUnread) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === ch.id ? { ...c, unread_count: 0, marked_unread: false } : c,
          ),
        );
        await markChannelRead(ch.id, accountId);
        window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
      } else {
        setChannels((prev) =>
          prev.map((c) => (c.id === ch.id ? { ...c, marked_unread: true } : c)),
        );
        await markChannelUnread(ch.id);
        /* Light up the home-tile badge + bell immediately, same as mark-read. */
        window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
      }
      void loadChannels(true);
    },
    [accountId, loadChannels],
  );

  const handleHideConversation = useCallback(
    async (ch: DiscussChannelWithState) => {
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      if (selectedChannelIdRef.current === ch.id) setSelectedChannelId(null);
      await hideChannel(ch.id);
      void loadChannels(true);
      showToast(t("conv.hidden", "Removed from list"));
    },
    [loadChannels, showToast, t],
  );

  const handleDeleteConversation = useCallback(
    async (ch: DiscussChannelWithState) => {
      if (
        !window.confirm(
          t("conv.deleteConfirm", "Delete this conversation? It will be removed from your list."),
        )
      )
        return;
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      if (selectedChannelIdRef.current === ch.id) setSelectedChannelId(null);
      await deleteConversation(ch.id);
      void loadChannels(true);
      showToast(t("conv.deleted", "Conversation deleted"));
    },
    [loadChannels, showToast, t],
  );

  /* Close the conversation menu on outside-click / Escape / scroll. */
  useEffect(() => {
    if (!convMenu) return;
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById("kx-conv-menu");
      if (el && !el.contains(e.target as Node)) closeConvMenu();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeConvMenu();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeConvMenu, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeConvMenu, true);
    };
  }, [convMenu, closeConvMenu]);

  const handleSendVoice = useCallback(
    async (input: { blob: Blob; durationMs: number; waveform: number[] }) => {
      if (!accountId || !selectedChannelId) return;
      const uploaded = await uploadDiscussVoice({
        blob: input.blob,
        durationMs: input.durationMs,
        waveform: input.waveform,
      });
      if (!uploaded) {
        showToast(t("voice.uploadFailed", "Voice upload failed"));
        return;
      }
      await sendDiscussMessage({
        channelId: selectedChannelId,
        authorId: accountId,
        body: "",
        kind: "voice",
        metadata: { voice: uploaded },
      });
      setVoiceOpen(false);
      void loadChannels(true);
    },
    [accountId, selectedChannelId, showToast, t, loadChannels],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE E — Customer chat
     ═══════════════════════════════════════════════════════════════════════ */

  const handleCustomerCreated = useCallback(
    async (channelId: string) => {
      setCustomerChatOpen(false);
      await loadChannels(true);
      handleSelectChannel(channelId);
    },
    [loadChannels, handleSelectChannel],
  );

  /* Fetch the linked contact when a customer channel is selected.
     Reads `channels` through the ref so we don't re-fire every time
     the sidebar patches in a new last-message. */
  useEffect(() => {
    if (!selectedChannelId) return;
    const channel = channelsRef.current.find(
      (c) => c.id === selectedChannelId,
    );
    if (!channel || channel.kind !== "customer") return;
    if (linkedContacts[selectedChannelId] !== undefined) return;
    void fetchLinkedContact(selectedChannelId).then((contact) => {
      setLinkedContacts((prev) => ({
        ...prev,
        [selectedChannelId]: contact,
      }));
    });
  }, [selectedChannelId, linkedContacts]);

  /* ═══════════════════════════════════════════════════════════════════════
     EARLY RETURNS / LOADING STATES
     ═══════════════════════════════════════════════════════════════════════ */

  if (accountLoading) {
    return (
      <div className="flex-1 min-h-0 bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  if (!accountId) {
    return (
      <div className="flex-1 min-h-0 bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
          <DiscussIcon size={20} className="text-[var(--text-dim)]" />
        </div>
        <p className="text-[13px] text-[var(--text-muted)]">
          You need to sign in to use Discuss.
        </p>
        <Link
          href="/"
          className="text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
        >
          {t("back")}
        </Link>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    /* Lock the chat surface to viewport-height-minus-MainHeader so the
       composer at the bottom always stays pinned and only the message
       list scrolls. We can't rely on the body flex chain here because
       layout.tsx uses `min-h-full` on body (so ordinary pages scroll
       naturally) — that lets the message list grow and push the
       composer below the fold. `100dvh` is the dynamic viewport
       height, which on mobile Safari shrinks/expands with the URL bar
       and the on-screen keyboard, so the composer follows the visible
       area instead of getting hidden under the keyboard. 3.5rem = 56px
       = `h-14` on MainHeader. */
    <div
      className="flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* ═══ Top bar ═══
          On mobile the bar shrinks to a WeChat-style "[back] [chat
          name]" header once the user opens a chat (mobileView !==
          "list"). In list mode it still shows "Discuss". On desktop
          we always show the full bar.                               */}

      {/* ═══ Three-column body ═══ */}
      <div className="flex-1 min-h-0 flex">
        {/* ── Column 1: Channels + DMs list ────────────────────────── */}
        <aside
          className={`shrink-0 md:w-[300px] md:border-e border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col min-h-0 ${
            mobileView === "list" ? "flex w-full" : "hidden md:flex"
          }`}
        >
          {/* Search + filter */}
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[var(--border-subtle)]">
            {/* Back to Hub + the single New action. These are the only two
                controls the old app bar contributed that belong on this screen
                permanently; everything else moved into the conversation header
                or its overflow. */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/"
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                aria-label={t("back")}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <div className="flex-1" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNewMenuOpen((v) => !v)}
                  className="h-8 px-2.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  aria-haspopup="menu"
                  aria-expanded={newMenuOpen}
                >
                  <MessageSquarePlusIcon className="h-3.5 w-3.5" />
                  <span>{t("sidebar.new", "New")}</span>
                </button>
                {newMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setNewMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute end-0 top-9 z-30 w-52 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setNewMenuOpen(false); setNewChannelOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 h-9 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <MessageSquarePlusIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                        {t("sidebar.newChannel")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setNewMenuOpen(false); setNewDmOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 h-9 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <AtSignIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                        {t("sidebar.newDirect")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setNewMenuOpen(false); setCustomerChatOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 h-9 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <UserPlusIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                        {t("customer.newChat", "Start customer chat")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors mb-2">
              <SearchIcon size={14} className="text-[var(--text-dim)] shrink-0" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={t("sidebar.search")}
                className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none min-w-0"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarSearch("")}
                  className="p-0.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  <CrossIcon size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSidebarFilter(f)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                    sidebarFilter === f
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f === "all" ? t("sidebar.filter.all") : t("sidebar.filter.unread")}
                  {f === "unread" && totalUnread > 0 && (
                    <span className="ms-1 tabular-nums">· {totalUnread}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Channel list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Pinned "Koleex AI" conversation — always at the very top, above
                loading/empty states, so the assistant is reachable like a DM. */}
            <button
              type="button"
              onClick={openAiChat}
              className={`relative w-[calc(100%-16px)] mx-2 my-0.5 text-left px-3 py-2.5 flex items-center gap-3 rounded-xl transition-colors ${
                aiChatOpen
                  ? "bg-[var(--bg-inverted)]"
                  : "hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              <div className="h-10 w-10 shrink-0 flex items-center justify-center">
                <KoleexOrb state="idle" size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] font-semibold truncate ${
                    aiChatOpen ? "text-[var(--text-inverted)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {t("ai.title", "Koleex AI")}
                </div>
                <div
                  className={`text-[11.5px] truncate ${
                    aiChatOpen ? "text-[var(--text-inverted)]/70" : "text-[var(--text-dim)]"
                  }`}
                >
                  {t("ai.subtitle", "Ask me anything")}
                </div>
              </div>
            </button>
            {loadingChannels ? (
              <div className="h-full flex items-center justify-center">
                <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                  <DiscussIcon size={20} className="text-[var(--text-ghost)]" />
                </div>
                <p className="text-[12.5px] text-[var(--text-faint)] font-medium">
                  {t("sidebar.empty")}
                </p>
                <p className="text-[11px] text-[var(--text-dim)] max-w-[220px]">
                  {t("sidebar.emptyHint")}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChannelOpen(true)}
                    className="h-8 px-3 rounded-lg bg-[var(--bg-surface-active)] text-[var(--text-secondary)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {t("sidebar.newChannel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDmOpen(true)}
                    className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <AtSignIcon className="h-3.5 w-3.5" />
                    {t("sidebar.newDirect")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {groupedChannels.groups.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                      {t("sidebar.channels")}
                    </div>
                    <ul>
                      {groupedChannels.groups.map((c) => (
                        <ChannelRow
                          key={c.id}
                          channel={c}
                          selected={c.id === selectedChannelId}
                          onSelect={() => handleSelectChannel(c.id)}
                          onPrefetch={() => void prefetchChannel(c.id)}
                          onMenu={(x, y) => setConvMenu({ channel: c, x, y })}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                {/* Directs — header always carries a "+ New" so a 1-to-1 DM is
                    reachable on every screen (the header button is desktop-only,
                    and this list IS the mobile view). */}
                <div>
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                      {t("sidebar.directs")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewDmOpen(true)}
                      title={t("sidebar.newDirect")}
                      aria-label={t("sidebar.newDirect")}
                      className="h-6 w-6 -me-1 inline-flex items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {groupedChannels.dms.length > 0 ? (
                    <ul>
                      {groupedChannels.dms.map((c) => (
                        <ChannelRow
                          key={c.id}
                          channel={c}
                          selected={c.id === selectedChannelId}
                          onSelect={() => handleSelectChannel(c.id)}
                          onPrefetch={() => void prefetchChannel(c.id)}
                          onMenu={(x, y) => setConvMenu({ channel: c, x, y })}
                        />
                      ))}
                    </ul>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNewDmOpen(true)}
                      className="mx-2 mb-1 w-[calc(100%-1rem)] h-9 px-3 rounded-lg flex items-center gap-2 text-[12px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <AtSignIcon className="h-3.5 w-3.5" />
                      {t("sidebar.newDirect")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── Column 2: Thread ─────────────────────────────────────── */}
        <section
          className={`flex-1 min-h-0 bg-[var(--bg-primary)] flex flex-col ${
            mobileView === "thread" ? "flex w-full" : "hidden md:flex"
          }`}
        >
          {aiChatOpen ? (
            <DiscussAiChat
              onBack={() => {
                setAiChatOpen(false);
                setMobileView("list");
              }}
              labels={{
                title: t("ai.title", "Koleex AI"),
                subtitle: t("ai.subtitle", "Your assistant · always here"),
                placeholder: t("ai.placeholder", "Ask Koleex AI anything…"),
                empty: t("ai.empty", "Ask me anything — I can help across the Hub."),
              }}
            />
          ) : !selectedChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                <DiscussIcon size={24} className="text-[var(--text-ghost)]" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-muted)]">
                  {t("thread.select")}
                </div>
                <div className="text-[12px] text-[var(--text-dim)] mt-1">
                  {t("sidebar.emptyHint")}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="shrink-0 h-14 px-4 flex items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                {/* Mobile back to the conversation list. This is the ONLY place
                    it now lives — the app bar that used to host it is gone. */}
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="md:hidden -ms-2 h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                  aria-label={t("mobile.list")}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                {selectedChannel.kind === "direct" ? (
                  <Avatar
                    name={displayNameFor(selectedChannel)}
                    url={selectedChannel.other?.avatar_url}
                    size={34}
                  />
                ) : (
                  <div className="h-[34px] w-[34px] shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                    {selectedChannel.kind === "channel" ? (
                      <HashtagIcon className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <UsersIcon className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                    {displayNameFor(selectedChannel)}
                    {altNameFor(selectedChannel) && (
                      <span lang="zh" className="ms-1.5 text-[12px] font-normal text-[var(--text-dim)]">
                        {altNameFor(selectedChannel)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] truncate">
                    {selectedChannel.kind === "direct"
                      ? selectedChannel.other?.username
                        ? `@${selectedChannel.other.username}`
                        : ""
                      : selectedChannel.description ||
                        t("header.memberCount").replace(
                          "{count}",
                          String(members.length),
                        )}
                  </div>
                </div>
                <TranslateControl
                  prefs={translatePrefs}
                  open={translateMenuOpen}
                  onOpenChange={setTranslateMenuOpen}
                  onChange={updateTranslatePrefs}
                  t={t}
                />
                <button
                  type="button"
                  onClick={() => void handleToggleMute()}
                  className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                    selectedChannel.muted
                      ? "text-red-300 hover:bg-red-500/10"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  }`}
                  title={
                    selectedChannel.muted
                      ? t("header.unmute", "Unmute")
                      : t("header.mute", "Mute")
                  }
                >
                  {selectedChannel.muted ? (
                    <BellOffIcon className="h-4 w-4" />
                  ) : (
                    <BellIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsOpen((v) => !v);
                    setMobileView("details");
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                  title={t("header.details")}
                >
                  <InfoIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Message list */}
              <div
                ref={threadScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
              >
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <ThreadEmptyState
                    channel={selectedChannel}
                    t={t}
                  />
                ) : (
                  <MemoMessageList
                    messages={messages}
                    currentAccountId={accountId}
                    channelKind={selectedChannel.kind}
                    channelLastRead={selectedChannel.last_read_at}
                    todayText={t("thread.today")}
                    yesterdayText={t("thread.yesterday")}
                    editedText={t("thread.edited")}
                    deletedText={t("thread.deleted")}
                    unreadMarkerText={t("thread.new", "New messages")}
                    editingMessageId={editingMessageId}
                    editingDraft={editingDraft}
                    onEditDraftChange={setEditingDraft}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onStar={handleStar}
                    onCopyLink={handleCopyLink}
                    onReply={handleStartReply}
                    onOpenThread={handleOpenThread}
                    onToggleReaction={handleToggleReaction}
                    autoTranslate={translatePrefs.auto}
                    targetLang={translatePrefs.lang}
                    t={t}
                  />
                )}
                {typingUsers.length > 0 && (
                  <div className="px-2 pt-2 text-[11.5px] text-[var(--text-dim)] italic">
                    {typingUsers.length === 1
                      ? t("thread.typing.one").replace("{name}", typingUsers[0])
                      : typingUsers.length === 2
                        ? t("thread.typing.two")
                            .replace("{a}", typingUsers[0])
                            .replace("{b}", typingUsers[1])
                        : t("thread.typing.many")}
                  </div>
                )}
              </div>

              {/* Composer */}
              <Composer
                body={composerBody}
                onChange={handleComposerChange}
                onKeyDown={handleKeyDown}
                attachments={composerAttachments}
                products={composerProducts}
                onRemoveAttachment={(i) =>
                  setComposerAttachments((prev) =>
                    prev.filter((_, idx) => idx !== i),
                  )
                }
                onRemoveProduct={(i) =>
                  setComposerProducts((prev) =>
                    prev.filter((_, idx) => idx !== i),
                  )
                }
                replyTarget={replyTarget}
                onCancelReply={() => setReplyTarget(null)}
                voiceOpen={voiceOpen}
                onOpenVoice={() => setVoiceOpen(true)}
                onCloseVoice={() => setVoiceOpen(false)}
                onSendVoice={(v) => void handleSendVoice(v)}
                uploading={uploading}
                sending={sending}
                onSend={handleSend}
                onPickFile={() => fileInputRef.current?.click()}
                onOpenProductPicker={openProductPicker}
                onOpenMentionPicker={() => setMentionPickerOpen(true)}
                onOpenEmojiPicker={() => setEmojiPickerOpen(true)}
                placeholder={
                  selectedChannel.kind === "direct"
                    ? t("composer.placeholderDm").replace(
                        "{name}",
                        displayNameFor(selectedChannel),
                      )
                    : selectedChannel.name
                      ? t("composer.placeholder").replace(
                          "{channel}",
                          selectedChannel.name,
                        )
                      : t("composer.placeholderGeneric")
                }
                hintText={t("composer.enterToSend")}
                sendLabel={t("composer.send")}
                composerRef={composerRef}
                t={t}
              />
              {/* `accept` is UX only — it steers the OS picker toward supported
                  types. The real gates are /api/storage/upload and the private
                  bucket's own MIME allowlist, which a bypassed picker cannot
                  evade. See src/lib/discuss-upload-policy.ts. */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={DISCUSS_ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => void handleFilePick(e.target.files)}
              />
            </>
          )}
        </section>

        {/* ── Column 3: Details (closed when Thread pane is open) ─── */}
        {detailsOpen && selectedChannel && !threadTarget && (
          <aside
            className={`shrink-0 md:w-[320px] md:border-s border-[var(--border-color)] bg-[var(--bg-secondary)] min-h-0 overflow-y-auto ${
              mobileView === "details" ? "flex flex-col w-full" : "hidden md:flex md:flex-col"
            }`}
          >
            <DetailsPane
              channel={selectedChannel}
              members={members}
              linkedContact={linkedContacts[selectedChannel.id] ?? null}
              notificationPref={selectedChannel.notification_pref}
              onSetNotificationPref={handleSetNotificationPref}
              onClose={() => {
                setDetailsOpen(false);
                setMobileView("thread");
              }}
              t={t}
            />
          </aside>
        )}

        {/* Thread pane (Phase B) — replaces the details column */}
        {threadTarget && selectedChannel && accountId && (
          <aside className="shrink-0 md:w-[360px] min-h-0 flex">
            <ThreadPane
              parent={threadTarget}
              currentAccountId={accountId}
              channelId={selectedChannel.id}
              onClose={() => setThreadTarget(null)}
              autoTranslate={translatePrefs.auto}
              targetLang={translatePrefs.lang}
              t={t}
            />
          </aside>
        )}
      </div>

      {/* Search panel (Phase C) — full overlay on the right column */}
      {searchOpen && accountId && (
        <div className="absolute top-14 bottom-0 end-0 w-full md:w-[420px] z-40">
          <SearchPanel
            currentAccountId={accountId}
            onClose={() => setSearchOpen(false)}
            onJump={(channelId, messageId) => {
              handleSelectChannel(channelId);
              /* Scroll to the message after the channel switches. */
              window.setTimeout(() => {
                const el = document.getElementById(`msg-${messageId}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 500);
            }}
            t={t}
          />
        </div>
      )}

      {/* Customer chat modal (Phase E) */}
      {customerChatOpen && accountId && (
        <CustomerChatModal
          currentAccountId={accountId}
          onCreated={(id) => void handleCustomerCreated(id)}
          onCancel={() => setCustomerChatOpen(false)}
          t={t}
        />
      )}

      {/* Toast (Phase B-C) */}
      {toastMessage && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-medium shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* ═══ Conversation context menu (WeChat-style right-click / long-press) ═══ */}
      {convMenu &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const W = 220;
            const EST_H = 250;
            const M = 8;
            const left = Math.max(M, Math.min(convMenu.x, window.innerWidth - W - M));
            const openUp = convMenu.y + EST_H > window.innerHeight;
            const style: React.CSSProperties = openUp
              ? { left, bottom: Math.max(M, window.innerHeight - convMenu.y) }
              : { left, top: convMenu.y };
            const ch = convMenu.channel;
            const isUnread = ch.unread_count > 0 || ch.marked_unread === true;
            return (
              <div
                id="kx-conv-menu"
                role="menu"
                style={style}
                className="fixed z-[100] min-w-[220px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl p-1.5"
              >
                <MessageMenuItem
                  icon={ch.pinned ? <PinOffIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
                  label={ch.pinned ? t("conv.unpin", "Unpin") : t("conv.pin", "Sticky on top")}
                  onClick={() => {
                    void handleToggleConvPin(ch);
                    closeConvMenu();
                  }}
                />
                <MessageMenuItem
                  icon={isUnread ? <CheckCheckIcon className="h-4 w-4" /> : <CircleDotIcon className="h-4 w-4" />}
                  label={isUnread ? t("conv.markRead", "Mark as read") : t("conv.markUnread", "Mark as unread")}
                  onClick={() => {
                    void handleToggleConvUnread(ch);
                    closeConvMenu();
                  }}
                />
                <MessageMenuItem
                  icon={ch.muted ? <BellIcon className="h-4 w-4" /> : <BellOffIcon className="h-4 w-4" />}
                  label={ch.muted ? t("conv.unmute", "Unmute notifications") : t("conv.mute", "Mute notifications")}
                  onClick={() => {
                    void handleSetConvMuted(ch);
                    closeConvMenu();
                  }}
                />
                <MessageMenuItem
                  icon={<EyeOffIcon className="h-4 w-4" />}
                  label={t("conv.hide", "Remove from list")}
                  onClick={() => {
                    void handleHideConversation(ch);
                    closeConvMenu();
                  }}
                />
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                <MessageMenuItem
                  icon={<TrashIcon className="h-4 w-4" />}
                  label={t("conv.delete", "Delete")}
                  danger
                  onClick={() => {
                    void handleDeleteConversation(ch);
                    closeConvMenu();
                  }}
                />
              </div>
            );
          })(),
          document.body,
        )}

      {/* ═══ Modals / pickers ═══ */}
      {newChannelOpen && (
        <NewChannelModal
          recipients={recipients}
          currentAccountId={accountId}
          onCancel={() => setNewChannelOpen(false)}
          onCreate={handleCreateChannel}
          t={t}
        />
      )}
      {newDmOpen && (
        <NewDmModal
          recipients={recipients.filter((r) => r.id !== accountId)}
          onCancel={() => setNewDmOpen(false)}
          onSelect={(id) => void handleStartDirect(id)}
          t={t}
        />
      )}
      {productPickerOpen && (
        <ProductPicker
          products={productCatalog}
          images={productImages}
          loading={productCatalogLoading}
          onCancel={() => setProductPickerOpen(false)}
          onSelect={handleAddProduct}
          t={t}
        />
      )}
      {mentionPickerOpen && (
        <MentionPicker
          recipients={recipients.filter((r) => r.id !== accountId)}
          onCancel={() => setMentionPickerOpen(false)}
          onSelect={handleAddMention}
          t={t}
        />
      )}
      {emojiPickerOpen && (
        <EmojiPicker
          onCancel={() => setEmojiPickerOpen(false)}
          onSelect={handleAddEmoji}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHANNEL ROW — sidebar item
   ═══════════════════════════════════════════════════════════════════════════ */

function ChannelRow({
  channel,
  selected,
  onSelect,
  onPrefetch,
  onMenu,
}: {
  channel: DiscussChannelWithState;
  selected: boolean;
  onSelect: () => void;
  /** Warm this conversation's messages on hover/press so the open is instant. */
  onPrefetch?: () => void;
  /** Open the WeChat-style conversation menu at the given viewport point
   *  (right-click on desktop, ~450ms long-press on touch). */
  onMenu?: (x: number, y: number) => void;
}) {
  const name = displayNameFor(channel);
  const altName = channel.kind === "direct" ? altNameFor(channel) : null;
  const preview = previewMessage(channel.last_message);
  const time = channel.last_message?.created_at
    ? formatSidebarTime(channel.last_message.created_at)
    : "";
  const isDm = channel.kind === "direct";
  const showUnreadDot = channel.unread_count === 0 && channel.marked_unread === true;
  const longPressRef = useRef<number | null>(null);
  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onPrefetch}
        onPointerDown={onPrefetch}
        onFocus={onPrefetch}
        onContextMenu={
          onMenu
            ? (e) => {
                e.preventDefault();
                onMenu(e.clientX, e.clientY);
              }
            : undefined
        }
        onTouchStart={
          onMenu
            ? (e) => {
                const t0 = e.touches[0];
                if (!t0) return;
                const { clientX, clientY } = t0;
                clearLongPress();
                longPressRef.current = window.setTimeout(() => onMenu(clientX, clientY), 450);
              }
            : undefined
        }
        onTouchEnd={onMenu ? clearLongPress : undefined}
        onTouchMove={onMenu ? clearLongPress : undefined}
        className={`relative w-[calc(100%-16px)] mx-2 my-0.5 text-left px-3 py-2.5 rounded-xl transition-colors ${
          /* Selected row = SOLID --bg-inverted fill (real white in dark, real
             black in light) so the open chat is unmistakable — a translucent
             wash over near-black only ever reads as gray. Every text token below
             flips to --text-inverted / its opacity steps so nothing goes
             white-on-white. Inset + rounded-xl (no full-bleed, no divider) makes
             the selection/hover read as a soft pill rather than a sharp band. */
          selected
            ? "bg-[var(--bg-inverted)]"
            : "hover:bg-[var(--bg-surface-hover)]"
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {isDm ? (
            <Avatar name={name} url={channel.other?.avatar_url} size={40} />
          ) : (
            <div className={`h-10 w-10 shrink-0 rounded-full border flex items-center justify-center ${
              selected
                ? "bg-[var(--text-inverted)]/10 border-[var(--text-inverted)]/15"
                : "bg-[var(--bg-surface)] border-[var(--border-subtle)]"
            }`}>
              {channel.kind === "channel" ? (
                <HashtagIcon className={`h-4 w-4 ${selected ? "text-[var(--text-inverted)]/70" : "text-[var(--text-muted)]"}`} />
              ) : (
                <UsersIcon className={`h-4 w-4 ${selected ? "text-[var(--text-inverted)]/70" : "text-[var(--text-muted)]"}`} />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[13px] truncate ${
                  selected
                    ? "font-semibold text-[var(--text-inverted)]"
                    : channel.unread_count > 0
                    ? "font-semibold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-muted)]"
                }`}
              >
                {name}
                {altName && (
                  <span
                    lang="zh"
                    className={`ms-1 text-[0.85em] font-normal ${
                      selected ? "text-[var(--text-inverted)]/55" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {altName}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {channel.pinned && (
                  <PinIcon className="h-3 w-3 text-amber-400" aria-label="Pinned" />
                )}
                {time && (
                  <span className={`text-[10px] tabular-nums ${selected ? "text-[var(--text-inverted)]/50" : "text-[var(--text-dim)]"}`}>
                    {time}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[11.5px] truncate flex-1 ${
                  selected
                    ? "text-[var(--text-inverted)]/75"
                    : channel.unread_count > 0
                    ? "text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-dim)]"
                }`}
              >
                {channel.last_message?.kind === "voice" && (
                  <MicIcon className="inline-block h-3 w-3 me-1 -mt-px align-text-bottom" />
                )}
                {channel.last_message?.author_username && !isDm ? (
                  <>
                    <span className={selected ? "text-[var(--text-inverted)]/60" : "text-[var(--text-muted)]"}>
                      {channel.last_message.author_username}:{" "}
                    </span>
                    {preview}
                  </>
                ) : (
                  preview || "—"
                )}
              </span>
              {channel.unread_count > 0 ? (
                <span className={`h-[18px] min-w-[18px] px-1.5 rounded-full text-[10.5px] font-bold tabular-nums flex items-center justify-center ${
                  selected ? "bg-[var(--text-inverted)] text-[var(--bg-inverted)]" : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                }`}>
                  {channel.unread_count > 99 ? "99+" : channel.unread_count}
                </span>
              ) : showUnreadDot ? (
                /* Manually "marked as unread" — a WeChat-style dot with no count. */
                <span
                  title="Unread"
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    selected ? "bg-[var(--text-inverted)]" : "bg-[var(--bg-inverted)]"
                  }`}
                />
              ) : null}
              {channel.muted && (
                <BellOffIcon className="h-3 w-3 shrink-0 text-red-500" aria-label="Muted" />
              )}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE LIST — day separators, grouped bubbles, attachments, products
   ═══════════════════════════════════════════════════════════════════════════ */

type MessageListProps = {
  messages: DiscussMessageWithAuthor[];
  currentAccountId: string;
  channelKind: DiscussChannelKind;
  channelLastRead: string | null;
  todayText: string;
  yesterdayText: string;
  editedText: string;
  deletedText: string;
  unreadMarkerText: string;
  editingMessageId: string | null;
  editingDraft: string;
  onEditDraftChange: (value: string) => void;
  onStartEdit: (msg: DiscussMessageWithAuthor) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onStar: (messageId: string) => void;
  onCopyLink: (messageId: string) => void;
  onReply: (msg: DiscussMessageWithAuthor) => void;
  onOpenThread: (msg: DiscussMessageWithAuthor) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  autoTranslate: boolean;
  targetLang: string;
  t: (key: string, fallback?: string) => string;
};

function MessageList(props: MessageListProps) {
  const {
    messages,
    currentAccountId,
    channelLastRead,
    todayText,
    yesterdayText,
    editedText,
    deletedText,
    unreadMarkerText,
  } = props;

  /* Pre-compute day groupings once per render. Messages already sorted
     ASC by created_at from the data layer. Also compute the last-read
     boundary so we can drop a "New messages" divider before the first
     unread message.  */
  const withSeparators = useMemo(() => {
    const out: Array<
      | { kind: "sep"; key: string; label: string }
      | { kind: "unread"; key: string }
      | { kind: "msg"; key: string; msg: DiscussMessageWithAuthor; showAuthor: boolean }
    > = [];
    let lastDay = "";
    let lastAuthor = "";
    let lastTime = 0;
    /* Determine the first message that's after the last_read_at so we
       can insert a single unread marker. Skip if channel has never been
       read (showing the marker at the top is noisy). */
    const lastReadTs = channelLastRead ? Date.parse(channelLastRead) : 0;
    let unreadInserted = false;
    for (const m of messages) {
      const d = new Date(m.created_at);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dayKey !== lastDay) {
        out.push({
          kind: "sep",
          key: `sep-${dayKey}`,
          label: formatDaySeparator(m.created_at, todayText, yesterdayText),
        });
        lastDay = dayKey;
        lastAuthor = "";
        lastTime = 0;
      }
      /* Unread divider: insert before the first message authored by
         someone else that's newer than last_read_at. */
      if (
        !unreadInserted &&
        lastReadTs > 0 &&
        m.author_account_id !== currentAccountId &&
        d.getTime() > lastReadTs
      ) {
        out.push({ kind: "unread", key: `unread-${m.id}` });
        unreadInserted = true;
        lastAuthor = "";
        lastTime = 0;
      }
      const thisTime = d.getTime();
      /* Group consecutive messages from the same author within 5 minutes
         into a single bubble cluster — Slack style. */
      const showAuthor =
        lastAuthor !== (m.author_account_id ?? "") ||
        thisTime - lastTime > 5 * 60_000;
      out.push({ kind: "msg", key: m.id, msg: m, showAuthor });
      lastAuthor = m.author_account_id ?? "";
      lastTime = thisTime;
    }
    return out;
  }, [messages, todayText, yesterdayText, channelLastRead, currentAccountId]);

  return (
    <div className="flex flex-col gap-1">
      {withSeparators.map((row) => {
        if (row.kind === "sep") {
          return (
            <div key={row.key} className="flex items-center my-3">
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              <div className="px-3 text-[10.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                {row.label}
              </div>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>
          );
        }
        if (row.kind === "unread") {
          return (
            <div key={row.key} className="flex items-center my-2">
              <div className="flex-1 h-px bg-red-500/40" />
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">
                {unreadMarkerText}
              </div>
              <div className="flex-1 h-px bg-red-500/40" />
            </div>
          );
        }
        return (
          <MemoMessageBubble
            key={row.key}
            msg={row.msg}
            showAuthor={row.showAuthor}
            isSelf={row.msg.author_account_id === currentAccountId}
            editedText={editedText}
            deletedText={deletedText}
            isEditing={props.editingMessageId === row.msg.id}
            editingDraft={props.editingDraft}
            onEditDraftChange={props.onEditDraftChange}
            onStartEdit={props.onStartEdit}
            onCancelEdit={props.onCancelEdit}
            onSaveEdit={props.onSaveEdit}
            onDelete={props.onDelete}
            onPin={props.onPin}
            onUnpin={props.onUnpin}
            onStar={props.onStar}
            onCopyLink={props.onCopyLink}
            onReply={props.onReply}
            onOpenThread={props.onOpenThread}
            onToggleReaction={props.onToggleReaction}
            autoTranslate={props.autoTranslate}
            targetLang={props.targetLang}
            t={props.t}
          />
        );
      })}
    </div>
  );
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

/* Header control: turn Auto-translate on/off and pick the language every
   incoming message is rendered in. Monochrome, matches the mute/info icons. */
function TranslateControl({
  prefs,
  open,
  onOpenChange,
  onChange,
  t,
}: {
  prefs: TranslatePrefs;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<TranslatePrefs>) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`h-8 px-2 rounded-md flex items-center gap-1.5 transition-colors ${
          prefs.auto
            ? "text-[var(--text-secondary)] bg-[var(--bg-surface-active)] hover:bg-[var(--bg-surface-active)]"
            : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
        }`}
        title={t("translate.title", "Translation")}
      >
        <LanguagesIcon className="h-4 w-4" />
        <span className="text-[10.5px] font-semibold uppercase tracking-wide">
          {prefs.lang}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1.5 z-30 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                {t("translate.auto", "Auto-translate")}
              </div>
              <div className="text-[10.5px] text-[var(--text-dim)] leading-snug">
                {t(
                  "translate.autoHint",
                  "Show every incoming message in your language.",
                )}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.auto}
              onClick={() => onChange({ auto: !prefs.auto })}
              className={`shrink-0 h-5 w-9 rounded-full transition-colors relative ${
                prefs.auto ? "bg-emerald-500" : "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  prefs.auto ? "start-[18px]" : "start-0.5"
                }`}
              />
            </button>
          </div>
          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t("translate.language", "Translate to")}
            </label>
            <select
              value={prefs.lang}
              onChange={(e) => onChange({ lang: e.target.value })}
              className="mt-1 w-full h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            >
              {TRANSLATE_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

type MessageBubbleProps = {
  msg: DiscussMessageWithAuthor;
  showAuthor: boolean;
  isSelf: boolean;
  editedText: string;
  deletedText: string;
  isEditing: boolean;
  editingDraft: string;
  onEditDraftChange: (value: string) => void;
  onStartEdit: (msg: DiscussMessageWithAuthor) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onStar: (messageId: string) => void;
  onCopyLink: (messageId: string) => void;
  onReply: (msg: DiscussMessageWithAuthor) => void;
  onOpenThread: (msg: DiscussMessageWithAuthor) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  autoTranslate: boolean;
  targetLang: string;
  t: (key: string, fallback?: string) => string;
};

/* Presentation-only shell for a message body. Renders `children` unchanged and
   adds exactly two things: the 62ch reading measure (both directions), and the
   T2 surface panel (own messages only). No state, no handlers, no data.

   Alignment is deliberately a single shared left rail: own and other sit on the
   same baseline and the same measure, and "mine" is carried by the surface, not
   by position. Right-aligning own messages would be a bubble layout, which is
   out of scope by decision, and the Koleex grid wants one alignment, not two.

   Mine (isSelf) uses a SOLID elevated tone, not one of the palette washes. Every
   wash here was built for hover states and tops out at ~1.77:1 over --bg-primary
   in dark (1.45 in light) — enough to hint, not enough to read as a distinct
   "my messages" colour. So own bubbles are `color-mix(--bg-primary + a slice of
   --text-primary)`: an OPAQUE colour (a real light-gray-in-dark / dark-gray-in-
   light), the strongest monochrome way to separate mine from incoming without
   inverting the bubble (which would force every inner token — translate pill,
   reactions, thread chip, edited label — to flip too). Incoming stays on the
   faint --bg-surface wash so the asymmetry itself reads as direction. Keep the
   inner text on --text-primary: the mix is deliberately kept dark-in-dark /
   light-in-light so it stays readable.

   text-[13px] is NOT styling and must not be "cleaned up": `ch` resolves against
   the element's own font-size, so a 62ch cap on a container inheriting 16px
   silently yields ~76 characters of 13px body text. Pinning the shell to the body
   size is what makes 62ch mean 62 characters; it matches the body size already in
   use, so inheritance is a no-op for children. */
function MessageSurface({
  isSelf,
  children,
}: {
  isSelf: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "inline-block text-start max-w-[min(78%,62ch)] text-[13px] px-3 py-2 " +
        "rounded-2xl border " +
        (isSelf
          /* Mine: a clean Apple-style card — white in light / neutral elevated
             gray in dark (--discuss-bubble-self) — that lifts off the canvas via
             the hub border + a soft shadow, with a squared corner on the side the
             bubble grows from (the WeChat/WhatsApp tail, done with radius instead
             of an SVG so it costs nothing to render). */
          ? "bg-[var(--discuss-bubble-self)] border-[var(--border-color)] rounded-ee-md shadow-sm"
          /* Theirs: a real card — bg-secondary differs from the thread canvas
             (bg-primary) in BOTH themes, and a crisp --border-color edge, so it
             reads like every other card in the hub instead of washing into the
             white thread in light mode. */
          : "bg-[var(--bg-secondary)] border-[var(--border-color)] rounded-es-md")
      }
    >
      {children}
    </div>
  );
}

function MessageBubble({
  msg,
  showAuthor,
  isSelf,
  editedText,
  deletedText,
  isEditing,
  editingDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onPin,
  onUnpin,
  onStar,
  onCopyLink,
  onReply,
  onOpenThread,
  onToggleReaction,
  autoTranslate,
  targetLang,
  t,
}: MessageBubbleProps) {
  const author = msg.author;
  const authorName = author?.full_name || author?.username || "Unknown";
  const authorAlt = (() => {
    const a = (author?.name_alt ?? "").trim();
    return a && a !== (author?.full_name ?? "").trim() ? a : null;
  })();
  const time = formatFullTime(msg.created_at);
  const isDeleted = !!msg.deleted_at;
  const meta = msg.metadata ?? {};
  /* THE client-side media contract: one array, canonical indexes, display
     fields only. The server guarantees it (serializeDiscussMessageForClient);
     the optimistic bubble builds the same shape locally. There is deliberately
     no fallback to metadata.attachments / metadata.voice — those keys no
     longer reach the browser, and re-adding a fallback would resurrect the
     legacy storage shape the client must not understand. */
  const media: DiscussMediaPublic[] = Array.isArray(meta.media) ? meta.media : [];
  /* Sender-local previews for a message that has no canonical id yet. Owned by
     discuss-object-urls and keyed by the same clientMsgId used for idempotency;
     an empty map for every received message, since a recipient must never be
     handed an object: URL. */
  const localPreviews = previewUrlsFor(msg.client_msg_id);
  const attachmentMedia = media.filter((m) => m.kind === "attachment");
  const voiceMedia = media.find((m) => m.kind === "voice") ?? null;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  /* WeChat-style context menu: right-click (desktop) or long-press (mobile)
     opens an actions menu next to the message instead of a hover bar that
     covered the neighbouring message. Rendered in a portal so it's never
     clipped by the thread's scroll box, and auto-flips upward near the bottom
     edge. Closes on outside click / Escape / scroll. */
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressRef = useRef<number | null>(null);
  const closeMenu = useCallback(() => setMenuPos(null), []);
  const openMenu = useCallback(
    (x: number, y: number) => {
      if (isDeleted) return;
      setMenuPos({ x, y });
    },
    [isDeleted],
  );
  useEffect(() => {
    if (!menuPos) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuPos, closeMenu]);

  const menuStyle: React.CSSProperties | undefined = menuPos
    ? (() => {
        const W = 200;
        const EST_H = 340;
        const M = 8;
        const left = Math.max(M, Math.min(menuPos.x, window.innerWidth - W - M));
        const openUp = menuPos.y + EST_H > window.innerHeight;
        return openUp
          ? { left, bottom: Math.max(M, window.innerHeight - menuPos.y) }
          : { left, top: menuPos.y };
      })()
    : undefined;

  return (
    <div
      id={`msg-${msg.id}`}
      onContextMenu={(e) => {
        if (isDeleted) return;
        e.preventDefault();
        openMenu(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if (isDeleted) return;
        const touch = e.touches[0];
        const { clientX, clientY } = touch;
        longPressRef.current = window.setTimeout(
          () => openMenu(clientX, clientY),
          450,
        );
      }}
      onTouchEnd={() => {
        if (longPressRef.current) {
          clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
      }}
      onTouchMove={() => {
        if (longPressRef.current) {
          clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
      }}
      className={`group relative flex gap-2 px-2 -mx-2 rounded-lg ${
        isSelf ? "flex-row-reverse" : ""
      } ${showAuthor ? "mt-3" : "mt-0.5"}`}
    >
      {showAuthor ? (
        <Avatar
          name={authorName}
          url={author?.avatar_url ?? null}
          size={32}
        />
      ) : (
        <div className="w-8 shrink-0 flex items-start justify-center pt-1">
          <span className="text-[9px] text-transparent group-hover:text-[var(--text-dim)] tabular-nums transition-colors">
            {time}
          </span>
        </div>
      )}
      {/* min-w-0 keeps long words wrapping; the flex column aligns the bubble
          to the correct edge so mine hug the right like WeChat. */}
      <div className={`flex-1 min-w-0 flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
        {showAuthor && (
          <div className={`flex items-baseline gap-2 mb-1 px-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
            {/* My own name is noise — the bubble side already says it's mine.
                WeChat shows no name on your own messages either. */}
            {!isSelf && (
              <span className="text-[12.5px] font-semibold text-[var(--text-secondary)]">
                {authorName}
                {authorAlt && (
                  <span lang="zh" className="ms-1 font-normal text-[var(--text-dim)]">
                    {authorAlt}
                  </span>
                )}
              </span>
            )}
            <span className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
              {time}
            </span>
            {/* The "You" badge is gone: the author name already says who wrote
                this, and the surface panel below now carries "mine" without
                colour. At 4.10:1 in dark theme it was also the lowest-contrast
                element carrying the outgoing signal alone. */}
          </div>
        )}

        {/* T2 surface — own messages only. The author header stays OUTSIDE it:
            the panel marks the utterance, not the attribution. */}
        <MessageSurface isSelf={isSelf}>
        {/* Reply-to preview — shown before the body when this msg quotes another */}
        {msg.reply_preview && !isDeleted && (
          <ReplyPreviewPill preview={msg.reply_preview} t={t} />
        )}

        {isDeleted ? (
          <div className="text-[12.5px] italic text-[var(--text-dim)]">
            {deletedText}
          </div>
        ) : isEditing ? (
          <div className="mt-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-focus)]">
            <textarea
              autoFocus
              value={editingDraft}
              onChange={(e) => onEditDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSaveEdit();
                }
              }}
              rows={2}
              className="w-full bg-transparent resize-none px-3 pt-2 pb-1 text-[13px] text-[var(--text-primary)] outline-none"
            />
            <div className="flex items-center justify-end gap-2 px-2 pb-2 text-[10px]">
              <span className="text-[var(--text-dim)]">
                {t("edit.saveHint", "Cmd+Enter to save · Esc to cancel")}
              </span>
              <button
                type="button"
                onClick={onCancelEdit}
                className="h-6 px-2 rounded-md text-[10.5px] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
              >
                {t("btn.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
                className="h-6 px-2 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10.5px] font-semibold hover:bg-[var(--bg-inverted-hover)]"
              >
                {t("edit.save", "Save")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {msg.kind === "voice" && voiceMedia ? (
              <div className="mt-1">
                {/* The server already decided this item's canonical index; the
                    client does not recompute it. No url/bucket/path exists in
                    the payload — the audio element fetches the authorized
                    first-party route, which re-checks membership on every Range
                    request while seeking. */}
                <VoicePlaybackBubble
                  src={discussAttachmentUrl(msg.id, voiceMedia.index)}
                  durationMs={voiceMedia.duration_ms ?? 0}
                  waveform={voiceMedia.waveform ?? []}
                />
              </div>
            ) : (
              msg.body && (
                <TranslatableBody
                  body={msg.body}
                  messageId={msg.id}
                  mentions={meta.mentions ?? []}
                  autoTranslate={autoTranslate && !isSelf}
                  targetLang={targetLang}
                  t={t}
                />
              )
            )}

            {/* Attachments — driven by the server's canonical media list.
                `m.index` is the authority (voice may share the list), so we
                pass it through rather than the array position. */}
            {attachmentMedia.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {attachmentMedia.map((m) => (
                  <AttachmentChip
                    key={`${msg.id}-a-${m.index}`}
                    attachment={m}
                    messageId={msg.id}
                    index={m.index}
                    localPreviewUrl={localPreviews?.[m.index] ?? null}
                  />
                ))}
              </div>
            )}

            {/* Product refs */}
            {meta.products && meta.products.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {meta.products.map((p, i) => (
                  <ProductChip key={`${msg.id}-p-${i}`} product={p} />
                ))}
              </div>
            )}

            {msg.edited_at && !isDeleted && (
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5 italic">
                ({editedText})
              </div>
            )}

            {/* Reactions row — clickable to toggle */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {msg.reactions.map((rx) => (
                  <button
                    key={rx.emoji}
                    type="button"
                    onClick={() => onToggleReaction(msg.id, rx.emoji)}
                    className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-full border text-[11px] tabular-nums transition-colors ${
                      rx.reacted_by_me
                        ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-secondary)]"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    <span>{rx.emoji}</span>
                    <span className="font-semibold">{rx.count}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={(e) => openMenu(e.clientX, e.clientY)}
                  className="inline-flex items-center h-6 w-6 justify-center rounded-full border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <SmileIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Thread indicator chip */}
            {msg.thread && msg.thread.reply_count > 0 && (
              <button
                type="button"
                onClick={() => onOpenThread(msg)}
                className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--bg-surface-active)] border border-[var(--border-color)] text-[var(--text-secondary)] text-[10.5px] font-semibold hover:bg-[var(--bg-surface-active)] transition-colors"
              >
                <MessageSquareIcon className="h-3 w-3" />
                {msg.thread.reply_count === 1
                  ? t("thread.replyCount.one", "1 reply")
                  : t("thread.replyCount.many", "{count} replies").replace(
                      "{count}",
                      String(msg.thread.reply_count),
                    )}
              </button>
            )}
          </>
        )}
        </MessageSurface>
      </div>

      {/* Right-click / long-press context menu (WeChat-style). Portaled to
          <body> and positioned at the pointer so it never covers the next
          message or gets clipped by the scroll box. */}
      {menuPos &&
        !isDeleted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="fixed z-[100] min-w-[200px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl p-1.5"
          >
            {/* Quick reactions row */}
            {!isEditing && (
              <div className="flex items-center gap-1 px-1 pb-1.5 mb-1 border-b border-[var(--border-subtle)]">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(msg.id, emoji);
                      closeMenu();
                    }}
                    className="h-8 w-8 rounded-lg text-[16px] hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <MessageMenuItem
              icon={<ReplyIcon className="h-4 w-4" />}
              label={t("msg.reply", "Reply")}
              onClick={() => {
                onReply(msg);
                closeMenu();
              }}
            />
            <MessageMenuItem
              icon={<MessageSquareIcon className="h-4 w-4" />}
              label={t("msg.replyInThread", "Reply in thread")}
              onClick={() => {
                onOpenThread(msg);
                closeMenu();
              }}
            />
            <MessageMenuItem
              icon={<StarIcon className="h-4 w-4" />}
              label={t("msg.star", "Save for later")}
              onClick={() => {
                onStar(msg.id);
                closeMenu();
              }}
            />
            <MessageMenuItem
              icon={<PinIcon className="h-4 w-4" />}
              label={t("msg.pin", "Pin")}
              onClick={() => {
                onPin(msg.id);
                closeMenu();
              }}
            />
            <MessageMenuItem
              icon={<LinkIcon className="h-4 w-4" />}
              label={t("msg.copyLink", "Copy link")}
              onClick={() => {
                onCopyLink(msg.id);
                closeMenu();
              }}
            />
            {isSelf && (
              <>
                <MessageMenuItem
                  icon={<Edit3Icon className="h-4 w-4" />}
                  label={t("msg.edit", "Edit")}
                  onClick={() => {
                    onStartEdit(msg);
                    closeMenu();
                  }}
                />
                <MessageMenuItem
                  icon={<TrashIcon className="h-4 w-4" />}
                  label={t("msg.delete", "Delete")}
                  danger
                  onClick={() => {
                    onDelete(msg.id);
                    closeMenu();
                  }}
                />
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function MessageMenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium text-start transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className={danger ? "text-red-400" : "text-[var(--text-dim)]"}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function ReplyPreviewPill({
  preview,
  t,
}: {
  preview: NonNullable<DiscussMessageWithAuthor["reply_preview"]>;
  t: (key: string, fallback?: string) => string;
}) {
  const author =
    preview.author_full_name || preview.author_username || "Unknown";
  const body = preview.deleted_at
    ? t("reply.deletedParent", "Original message deleted")
    : (preview.body ?? "").slice(0, 120);
  return (
    <div className="mb-1 flex items-stretch gap-2 max-w-[480px]">
      <div className="w-[3px] rounded-full bg-[var(--text-dim)] shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-[var(--text-secondary)]">
          {t("reply.replyingTo", "Replying to")} {author}
        </div>
        <div className="text-[11px] text-[var(--text-dim)] truncate italic">
          {body}
        </div>
      </div>
    </div>
  );
}

/* Attachments are delivered ONLY through the authorized first-party route —
   never from the public Supabase URL in `attachment.url`. The URL is derived
   from (messageId, index) by discussAttachmentUrl(); the server re-checks auth
   + active channel membership on every request, so access dies the moment the
   user is removed from the channel or signs out.

   `localPreviewUrl` is a sender-only object: URL for a message that has not been
   acknowledged yet (no canonical id ⇒ the protected route cannot resolve it).
   It is never persisted and never reaches another user. When neither URL is
   available the chip renders non-interactive rather than falling back to the
   public URL. (Discuss Stabilization Unit 2 — P0.) */
function AttachmentChip({
  attachment,
  messageId,
  index,
  localPreviewUrl,
}: {
  /** Client-safe media item — display fields + canonical index. Never a
   *  storage record: it has no url, no path and no bucket to leak. */
  attachment: DiscussMediaPublic;
  messageId: string;
  index: number;
  localPreviewUrl?: string | null;
}) {
  const isImage = attachment.type.startsWith("image/");
  const href = discussAttachmentUrl(messageId, index);
  const downloadHref = discussAttachmentUrl(messageId, index, { download: true });
  const imgSrc = href ?? localPreviewUrl ?? null;

  if (isImage) {
    const img = (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imgSrc ?? undefined}
        alt={attachment.name}
        className="w-full h-auto max-h-[260px] object-cover"
      />
    );
    const cls =
      "block max-w-[320px] rounded-lg overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors";
    /* Pending (local preview only): show the image but do not link — the
       protected URL does not exist yet and we will not link to the public one. */
    if (!href) return <div className={cls}>{imgSrc ? img : null}</div>;
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {img}
      </a>
    );
  }

  const fileCls =
    "flex items-center gap-2 h-12 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors max-w-[280px]";
  const inner = (
    <>
      <div className="h-8 w-8 shrink-0 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
        <DocumentIcon className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
          {attachment.name}
        </div>
        <div className="text-[10.5px] text-[var(--text-dim)]">
          {formatBytes(attachment.size)}
        </div>
      </div>
    </>
  );
  if (!downloadHref) return <div className={fileCls}>{inner}</div>;
  return (
    <a
      href={downloadHref}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={fileCls}
    >
      {inner}
    </a>
  );
}

function ProductChip({ product }: { product: DiscussProductRef }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="flex items-center gap-2 h-12 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-colors max-w-[280px]"
    >
      <div className="h-8 w-8 shrink-0 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
        {product.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <PackageIcon className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {product.name}
        </div>
        <div className="text-[10.5px] text-[var(--text-secondary)] truncate">
          {product.slug}
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE — shown for a channel that has zero messages
   ═══════════════════════════════════════════════════════════════════════════ */

function ThreadEmptyState({
  channel,
  t,
}: {
  channel: DiscussChannelWithState;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
      <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
        {channel.kind === "direct" ? (
          <Avatar
            name={displayNameFor(channel)}
            url={channel.other?.avatar_url}
            size={44}
          />
        ) : (
          <HashtagIcon className="h-5 w-5 text-[var(--text-dim)]" />
        )}
      </div>
      <div>
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">
          {t("thread.empty.title")}
        </div>
        <div className="text-[12px] text-[var(--text-dim)] mt-1 max-w-[280px]">
          {channel.kind === "direct"
            ? t("thread.empty.direct").replace(
                "{name}",
                displayNameFor(channel),
              )
            : t("thread.empty.channel").replace(
                "{name}",
                channel.name ?? "channel",
              )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSER
   ═══════════════════════════════════════════════════════════════════════════ */

function Composer({
  body,
  onChange,
  onKeyDown,
  attachments,
  products,
  onRemoveAttachment,
  onRemoveProduct,
  replyTarget,
  onCancelReply,
  voiceOpen,
  onOpenVoice,
  onCloseVoice,
  onSendVoice,
  uploading,
  sending,
  onSend,
  onPickFile,
  onOpenProductPicker,
  onOpenMentionPicker,
  onOpenEmojiPicker,
  placeholder,
  hintText,
  sendLabel,
  composerRef,
  t,
}: {
  body: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  attachments: DiscussAttachment[];
  products: DiscussProductRef[];
  onRemoveAttachment: (index: number) => void;
  onRemoveProduct: (index: number) => void;
  replyTarget: DiscussMessageWithAuthor | null;
  onCancelReply: () => void;
  voiceOpen: boolean;
  onOpenVoice: () => void;
  onCloseVoice: () => void;
  onSendVoice: (input: {
    blob: Blob;
    durationMs: number;
    waveform: number[];
  }) => void;
  uploading: boolean;
  sending: boolean;
  onSend: () => void;
  onPickFile: () => void;
  onOpenProductPicker: () => void;
  onOpenMentionPicker: () => void;
  onOpenEmojiPicker: () => void;
  placeholder: string;
  hintText: string;
  sendLabel: string;
  composerRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  t: (key: string, fallback?: string) => string;
}) {
  const canSend =
    !sending &&
    !uploading &&
    (body.trim().length > 0 || attachments.length > 0 || products.length > 0);

  return (
    <div
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
      style={{
        /* Respect the iPhone home-indicator so the composer sits above
           the rounded bottom edge instead of being partially hidden. */
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Reply-to banner */}
      {replyTarget && (
        <div className="mb-2 flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-surface-active)] border border-[var(--border-color)]">
          <div className="w-[3px] self-stretch rounded-full bg-[var(--text-primary)] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-[var(--text-secondary)]">
              {t("reply.replyingTo", "Replying to")}{" "}
              {replyTarget.author?.full_name ||
                replyTarget.author?.username ||
                "Unknown"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate">
              {(replyTarget.body ?? "").slice(0, 140) || "(no text)"}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
            aria-label={t("reply.cancel", "Cancel reply")}
          >
            <CrossIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Voice recorder overlay */}
      {voiceOpen && (
        <div className="mb-2">
          <VoiceRecorder
            onSend={(input) => {
              onSendVoice(input);
            }}
            onCancel={onCloseVoice}
            labels={{
              start: t("voice.start", "Start"),
              stop: t("voice.stop", "Stop"),
              cancel: t("voice.cancel", "Cancel"),
              send: t("voice.send", "Send"),
              preview: t("voice.preview", "Preview"),
              permissionDenied: t(
                "voice.permissionDenied",
                "Microphone permission denied",
              ),
              recording: t("voice.recording", "Recording…"),
            }}
          />
        </div>
      )}

      {/* Attached chips */}
      {(attachments.length > 0 || products.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a, i) => (
            <div
              key={`ca-${i}`}
              className="flex items-center gap-2 h-9 ps-2 pe-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            >
              {a.type.startsWith("image/") ? (
                <ImageIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              )}
              <span className="text-[11.5px] text-[var(--text-primary)] max-w-[180px] truncate">
                {a.name}
              </span>
              <span className="text-[10px] text-[var(--text-dim)] tabular-nums">
                {formatBytes(a.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
              >
                <CrossIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          {products.map((p, i) => (
            <div
              key={`cp-${i}`}
              className="flex items-center gap-2 h-9 ps-2 pe-1 rounded-lg bg-[var(--bg-surface-active)] border border-[var(--border-color)]"
            >
              <PackageIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span className="text-[11.5px] text-[var(--text-primary)] max-w-[180px] truncate font-medium">
                {p.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveProduct(i)}
                className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
              >
                <CrossIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea + action row */}
      <div className="rounded-xl border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] bg-[var(--bg-primary)] transition-colors">
        <textarea
          ref={composerRef}
          value={body}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={2}
          className="w-full bg-transparent resize-none px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <ComposerIconButton title="Attach file" onClick={onPickFile}>
            <PaperclipIcon className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Mention" onClick={onOpenMentionPicker}>
            <AtSignIcon className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Product" onClick={onOpenProductPicker}>
            <PackageIcon className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Emoji" onClick={onOpenEmojiPicker}>
            <SmileIcon className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton
            title={t("voice.record", "Record voice")}
            onClick={onOpenVoice}
          >
            <MicIcon className="h-4 w-4" />
          </ComposerIconButton>

          <div className="flex-1" />

          {uploading && (
            <span className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
              <SpinnerIcon className="h-3 w-3 animate-spin" />
              Uploading…
            </span>
          )}

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {sending ? (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PaperPlaneIcon className="h-3.5 w-3.5" />
            )}
            <span>{sendLabel}</span>
          </button>
        </div>
      </div>
      {/* Desktop-only: the hint names Enter and Shift+Enter, neither of which
          exists on a touch keyboard. */}
      <div className="mt-1 px-1 text-[10px] text-[var(--text-dim)] hidden md:block">
        {hintText}
      </div>
    </div>
  );
}

function ComposerIconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAILS PANE
   ═══════════════════════════════════════════════════════════════════════════ */

function DetailsPane({
  channel,
  members,
  linkedContact,
  notificationPref,
  onSetNotificationPref,
  onClose,
  t,
}: {
  channel: DiscussChannelWithState;
  members: Array<DiscussMemberRow & { author: DiscussAuthor }>;
  linkedContact: DiscussLinkedContact | null;
  notificationPref: DiscussNotificationPref;
  onSetNotificationPref: (pref: DiscussNotificationPref) => void;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const isCustomer = channel.kind === "customer";
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">
          {t("header.details")}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <CrossIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Channel heading */}
        <div className="flex flex-col items-center text-center gap-2">
          {channel.kind === "direct" ? (
            <Avatar
              name={displayNameFor(channel)}
              url={channel.other?.avatar_url}
              size={64}
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
              {channel.kind === "channel" ? (
                <HashtagIcon className="h-6 w-6 text-[var(--text-muted)]" />
              ) : isCustomer ? (
                <MessageSquareIcon className="h-6 w-6 text-[var(--text-muted)]" />
              ) : (
                <UsersIcon className="h-6 w-6 text-[var(--text-muted)]" />
              )}
            </div>
          )}
          <div className="text-[15px] font-bold text-[var(--text-primary)]">
            {displayNameFor(channel)}
          </div>
          {channel.kind === "direct" && altNameFor(channel) && (
            <div lang="zh" className="text-[12px] text-[var(--text-dim)] -mt-1">
              {altNameFor(channel)}
            </div>
          )}
          {channel.kind === "direct" && channel.other?.username && (
            <div className="text-[11px] text-[var(--text-dim)]">
              @{channel.other.username}
            </div>
          )}
          {channel.description && (
            <div className="text-[12px] text-[var(--text-muted)] max-w-[260px]">
              {channel.description}
            </div>
          )}
        </div>

        {/* Customer contact card — only for customer-chat channels with a
            linked CRM contact. Phase E. */}
        {isCustomer && linkedContact && (
          <section>
            <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
              {t("details.customer", "Customer")}
            </div>
            <CustomerContactCard contact={linkedContact} t={t} />
          </section>
        )}

        {/* Notification preferences — Phase D */}
        <section>
          <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
            {t("details.notifications", "Notifications")}
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <NotifPrefRow
              label={t("details.notif.all", "Everything")}
              active={notificationPref === "all"}
              onClick={() => onSetNotificationPref("all")}
            />
            <NotifPrefRow
              label={t("details.notif.mentions", "Mentions only")}
              active={notificationPref === "mentions"}
              onClick={() => onSetNotificationPref("mentions")}
            />
            <NotifPrefRow
              label={t("details.notif.none", "Nothing")}
              active={notificationPref === "none"}
              onClick={() => onSetNotificationPref("none")}
            />
          </div>
        </section>

        {/* Members section */}
        {channel.kind !== "direct" && !isCustomer && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                {t("details.members")}
              </div>
              <span className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
                {members.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <Avatar
                    name={m.author.full_name || m.author.username}
                    url={m.author.avatar_url}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                      {m.author.full_name || m.author.username}
                      {nativeAltOf(m.author.full_name, m.author.name_alt) && (
                        <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                          {nativeAltOf(m.author.full_name, m.author.name_alt)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] truncate">
                      @{m.author.username}
                      {m.role !== "member" && (
                        <span className="ms-1.5 text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                          {m.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick-actions stub */}
        <section>
          <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
            {t("details.more", "More")}
          </div>
          <div className="flex flex-col gap-1">
            <DetailsRow
              icon={<PinIcon className="h-3.5 w-3.5" />}
              label={t("details.pinned")}
            />
            <DetailsRow
              icon={<StarIcon className="h-3.5 w-3.5" />}
              label={t("sidebar.starred")}
            />
            <DetailsRow
              icon={<DocumentIcon className="h-3.5 w-3.5" />}
              label={t("details.files")}
            />
            <DetailsRow
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              label={t("details.photos")}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function NotifPrefRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 flex items-center gap-2 text-[12px] font-medium transition-colors text-start ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-secondary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
          active ? "border-[var(--border-strong)]" : "border-[var(--border-subtle)]"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function DetailsRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="h-9 px-2 rounded-md flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
    >
      <span className="text-[var(--text-dim)]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <MoreHorizontalIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL SHELL — shared dark-dimmed backdrop + centered card
   ═══════════════════════════════════════════════════════════════════════════ */

function ModalShell({
  title,
  onCancel,
  children,
  width = 480,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useScrollLock();
  /* Dismiss with Escape, and by clicking the dimmed backdrop (target ===
     currentTarget means the click landed on the overlay itself, not the panel
     or its contents). Previously the only way out was picking a person or
     finding the small X — clicking outside did nothing. */
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      {/* m-auto centres the panel both axes AND keeps it scrollable if it is
          ever taller than the viewport (items-center would clip the top). */}
      <div
        className="m-auto w-full rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
        style={{ maxWidth: width }}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NEW CHANNEL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function NewChannelModal({
  recipients,
  currentAccountId,
  onCancel,
  onCreate,
  t,
}: {
  recipients: Recipient[];
  currentAccountId: string;
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    kind: "group" | "channel";
    memberIds: string[];
  }) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"group" | "channel">("channel");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients
      .filter((r) => r.id !== currentAccountId)
      .filter(
        (r) =>
          !q ||
          r.username.toLowerCase().includes(q) ||
          (r.full_name ?? "").toLowerCase().includes(q),
      );
  }, [recipients, currentAccountId, search]);

  const canSubmit = name.trim().length > 0;

  return (
    <ModalShell title={t("new.channel.title")} onCancel={onCancel} width={520}>
      <div className="p-5 flex flex-col gap-4">
        {/* Kind toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("channel")}
            className={`p-3 rounded-lg border text-start transition-colors ${
              kind === "channel"
                ? "border-[var(--border-strong)] bg-[var(--bg-surface-active)]"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <HashtagIcon className="h-3.5 w-3.5" />
              {t("new.channel.public")}
            </div>
            <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">
              {t("new.channel.publicDesc")}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setKind("group")}
            className={`p-3 rounded-lg border text-start transition-colors ${
              kind === "group"
                ? "border-[var(--border-strong)] bg-[var(--bg-surface-active)]"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <LockIcon className="h-3.5 w-3.5" />
              {t("new.channel.private")}
            </div>
            <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">
              {t("new.channel.privateDesc")}
            </div>
          </button>
        </div>

        {/* Name + description */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("new.channel.name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("new.channel.namePh")}
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("new.channel.description")}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("new.channel.topicPh")}
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
          />
        </div>

        {/* Members picker */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("details.members")}
          </label>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-h-[240px] overflow-hidden flex flex-col">
            <div className="h-9 px-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
              <SearchIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("sidebar.search")}
                className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
              />
            </div>
            <div className="overflow-y-auto">
              {candidates.map((r) => {
                const isOn = selected.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (isOn) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                    className={`w-full px-3 py-2 flex items-center gap-2.5 text-start transition-colors ${
                      isOn ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    <Avatar
                      name={r.full_name || r.username}
                      url={r.avatar_url}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                        {r.full_name || r.username}
                        {nativeAltOf(r.full_name, r.name_alt) && (
                          <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                            {nativeAltOf(r.full_name, r.name_alt)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        @{r.username}
                        {r.role_name && (
                          <span className="ms-1.5">· {r.role_name}</span>
                        )}
                      </div>
                    </div>
                    {isOn && <CheckIcon className="h-4 w-4 text-[var(--text-secondary)]" />}
                  </button>
                );
              })}
              {candidates.length === 0 && (
                <div className="p-4 text-center text-[11px] text-[var(--text-dim)]">
                  {t("search.noResults")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 h-14 px-4 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          {t("btn.cancel")}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onCreate({
              name: name.trim(),
              description: description.trim() || undefined,
              kind,
              memberIds: Array.from(selected),
            })
          }
          className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {t("new.channel.create")}
        </button>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NEW DM MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function NewDmModal({
  recipients,
  onCancel,
  onSelect,
  t,
}: {
  recipients: Recipient[];
  onCancel: () => void;
  onSelect: (id: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        !q ||
        r.username.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q),
    );
  }, [recipients, search]);

  return (
    <ModalShell title={t("new.dm.title")} onCancel={onCancel} width={440}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon className="h-4 w-4 text-[var(--text-dim)]" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("new.dm.toPh")}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto flex flex-col gap-0.5">
          {filtered.length === 0 && (
            <div className="p-4 text-center text-[11px] text-[var(--text-dim)]">
              {t("search.noResults")}
            </div>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className="w-full px-3 py-2 flex items-center gap-2.5 text-start rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
            >
              <Avatar
                name={r.full_name || r.username}
                url={r.avatar_url}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {r.full_name || r.username}
                  {nativeAltOf(r.full_name, r.name_alt) && (
                    <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                      {nativeAltOf(r.full_name, r.name_alt)}
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-[var(--text-dim)] truncate">
                  @{r.username}
                  {r.role_name && <span className="ms-1.5">· {r.role_name}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT PICKER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function ProductPicker({
  products,
  images,
  loading = false,
  onCancel,
  onSelect,
  t,
}: {
  products: ProductRow[];
  images: Record<string, string>;
  /** True while the lazy catalog fetch (first open) is in flight. */
  loading?: boolean;
  onCancel: () => void;
  onSelect: (p: ProductRow) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [search, setSearch] = useState("");

  // Full-text haystack per product (built once): name, code, brand, the whole
  // classification path, tags, copy, compliance, specs — everything. Lets the
  // search match on any attribute, not just name/code/brand.
  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, buildProductHaystack(p));
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return products.slice(0, 60);
    // Every token must appear (AND) so multi-word queries narrow results.
    return products
      .filter((p) => {
        const h = haystacks.get(p.id) ?? "";
        return tokens.every((tok) => h.includes(tok));
      })
      .slice(0, 120);
  }, [products, search, haystacks]);

  return (
    <ModalShell title={t("composer.product")} onCancel={onCancel} width={640}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon className="h-4 w-4 text-[var(--text-dim)]" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("composer.productSearch", "Search by name, code, brand, category, tags…")}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-[var(--text-dim)]">
            {t("search.noResults")}
          </div>
        ) : (
          /* Grid of photo cards — same grammar as the To-do product picker:
             white photo area (object-contain so machines aren't cropped),
             model code first, product name beneath. */
          <div className="max-h-[420px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 p-0.5">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="group text-start rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)] bg-[var(--bg-surface)] overflow-hidden transition-all"
                title={stripHtmlText(p.product_name)}
              >
                <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden p-2">
                  {images[p.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={images[p.id]}
                      alt={stripHtmlText(p.product_name)}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <PackageIcon className="h-8 w-8 text-black/20" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate">
                    {p.slug}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-dim)] truncate">
                    {stripHtmlText(p.product_name)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* Some legacy product names carry raw HTML (e.g. "…with 2 iron<div>Table
   size…</div>" or "<b>With Air Trimmer</b>"). Strip tags so the picker shows
   clean text instead of leaking markup. */
function stripHtmlText(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Flatten every searchable field of a product into one lowercase string so the
   picker search matches on anything — identity, classification, copy, specs. */
function buildProductHaystack(p: ProductRow): string {
  const parts: Array<string | null | undefined> = [
    p.product_name,
    p.slug,
    p.brand,
    p.division_slug,
    p.category_slug,
    p.subcategory_slug,
    p.level,
    p.excerpt,
    p.description,
    p.hs_code,
    p.machine_dimensions,
    p.warranty,
    p.warranty_type,
    ...(p.tags ?? []),
    ...(p.highlights ?? []),
    ...(p.colors ?? []),
    ...(p.voltage ?? []),
    ...(p.plug_types ?? []),
  ];
  // Spec values (sizes, RPM, needle counts…) so they're searchable too.
  if (p.specs && typeof p.specs === "object") {
    for (const v of Object.values(p.specs)) {
      if (v != null && (typeof v === "string" || typeof v === "number")) parts.push(String(v));
    }
  }
  return parts
    .filter(Boolean)
    .map((s) => stripHtmlText(String(s)))
    .join(" ")
    .toLowerCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MENTION PICKER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function MentionPicker({
  recipients,
  onCancel,
  onSelect,
  t,
}: {
  recipients: Recipient[];
  onCancel: () => void;
  onSelect: (r: Recipient) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        !q ||
        r.username.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q),
    );
  }, [recipients, search]);

  return (
    <ModalShell title={t("composer.mention")} onCancel={onCancel} width={420}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <AtSignIcon className="h-4 w-4 text-[var(--text-dim)]" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("sidebar.search")}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto flex flex-col gap-0.5">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className="w-full px-3 py-2 flex items-center gap-2.5 text-start rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
            >
              <Avatar
                name={r.full_name || r.username}
                url={r.avatar_url}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {r.full_name || r.username}
                  {nativeAltOf(r.full_name, r.name_alt) && (
                    <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                      {nativeAltOf(r.full_name, r.name_alt)}
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-[var(--text-dim)] truncate">
                  @{r.username}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMOJI PICKER — compact static palette (full emoji search ships in Phase B)
   ═══════════════════════════════════════════════════════════════════════════ */

const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍",
  "🥰", "😘", "😗", "😎", "🤓", "🧐", "🤔", "😐", "😑", "😶",
  "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "🥱",
  "😴", "😌", "😛", "😜", "🤪", "😝", "🤤", "😒", "😓", "😔",
  "😕", "🙁", "☹️", "😖", "😞", "😟", "😤", "😢", "😭", "😦",
  "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
  "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
  "🔥", "✨", "🎉", "🎊", "💯", "✅", "❌", "⭐", "🌟", "💡",
  "🚀", "📦", "📩", "📅", "📈", "📉", "💼", "💰", "🎯", "🏆",
];

function EmojiPicker({
  onCancel,
  onSelect,
}: {
  onCancel: () => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <ModalShell title="Emoji" onCancel={onCancel} width={380}>
      <div className="p-4">
        <div className="grid grid-cols-10 gap-1">
          {EMOJI_PALETTE.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => onSelect(e)}
              className="h-9 w-9 rounded-md flex items-center justify-center text-[20px] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
