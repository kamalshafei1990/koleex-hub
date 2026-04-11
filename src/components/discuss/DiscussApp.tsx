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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AtSign,
  Check,
  CheckCheck,
  File as FileIcon,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Package,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  addMembers,
  createChannel,
  fetchChannelMembers,
  fetchChannelMessages,
  fetchMyChannels,
  findOrCreateDirectChannel,
  markChannelRead,
  openPresenceChannel,
  saveDraft,
  fetchDraft,
  clearDraft,
  sendDiscussMessage,
  subscribeToChannel,
  subscribeToMyChannels,
  uploadDiscussAttachment,
} from "@/lib/discuss";
import { fetchMessageableAccounts } from "@/lib/inbox";
import { fetchProducts, fetchProductMainImages } from "@/lib/products-admin";
import { useCurrentAccount } from "@/lib/identity";
import { useTranslation } from "@/lib/i18n";
import { discussT } from "@/lib/translations/discuss";
import type {
  DiscussAttachment,
  DiscussChannelKind,
  DiscussChannelWithState,
  DiscussMemberRow,
  DiscussMention,
  DiscussMessageKind,
  DiscussMessageMetadata,
  DiscussMessageRow,
  DiscussMessageWithAuthor,
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
  avatar_url: string | null;
  role_name: string | null;
};

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

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-sky-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-purple-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-emerald-600",
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
  if (preview.kind === "voice") return "🎤 Voice message";
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
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Mobile column swap ───────────────────────────────────────── */
  const [mobileView, setMobileView] = useState<"list" | "thread" | "details">(
    "list",
  );

  /* ── Modals ───────────────────────────────────────────────────── */
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  /* ═══════════════════════════════════════════════════════════════════════
     DATA LOADING
     ═══════════════════════════════════════════════════════════════════════ */

  const loadChannels = useCallback(async () => {
    if (!accountId) {
      setChannels([]);
      setLoadingChannels(false);
      return;
    }
    setLoadingChannels(true);
    const rows = await fetchMyChannels(accountId);
    setChannels(rows);
    setLoadingChannels(false);
  }, [accountId]);

  const loadMessages = useCallback(
    async (channelId: string) => {
      if (!accountId) return;
      setLoadingMessages(true);
      const rows = await fetchChannelMessages(channelId, {
        currentAccountId: accountId,
        limit: 120,
      });
      setMessages(rows);
      setLoadingMessages(false);
    },
    [accountId],
  );

  const loadMembers = useCallback(async (channelId: string) => {
    const rows = await fetchChannelMembers(channelId);
    setMembers(rows);
  }, []);

  /* Initial loads. */
  useEffect(() => {
    if (!accountLoading) void loadChannels();
  }, [accountLoading, loadChannels]);

  /* Cache the product catalog + recipient directory once — small tables
     that rarely change, avoids a spinner every time the user opens the
     product/mention/DM picker. */
  useEffect(() => {
    void fetchProducts().then(setProductCatalog);
    void fetchProductMainImages().then(setProductImages);
    void fetchMessageableAccounts().then(setRecipients);
  }, []);

  /* Keep sidebar in sync in real-time. Any insert in discuss_messages or
     discuss_channels triggers a lightweight re-fetch. We debounce via a
     micro-timer so a burst of inserts doesn't thrash the DB. */
  useEffect(() => {
    if (!accountId) return;
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      window.setTimeout(() => {
        pending = false;
        void loadChannels();
      }, 400);
    };
    return subscribeToMyChannels(schedule);
  }, [accountId, loadChannels]);

  /* Load messages + members when a channel is selected, and subscribe to
     that channel's realtime stream. Cleanup tears down both subscriptions
     and clears typing state so we don't leak between channels. */
  useEffect(() => {
    if (!selectedChannelId || !accountId) return;

    void loadMessages(selectedChannelId);
    void loadMembers(selectedChannelId);

    const unsubChannel = subscribeToChannel(selectedChannelId, {
      onMessageInsert: async (row) => {
        /* Need author info joined in — we re-fetch the single row. In the
           common case where the insert came from ourselves, the optimistic
           send path already added the message, so the dedupe below prevents
           duplicate rendering. */
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          /* Find author from the cached recipients / members list so we can
             show it immediately without a round-trip. If it's us, use the
             current account data. */
          const selfMatch = row.author_account_id === accountId;
          const member = members.find(
            (m) => m.author.id === row.author_account_id,
          );
          const author: DiscussAuthor | null = selfMatch
            ? {
                id: accountId,
                username: accountUsername,
                avatar_url: account?.avatar_url ?? null,
                full_name: accountDisplayName,
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
    });

    return () => {
      unsubChannel();
    };
    /* We intentionally omit `members` from the deps — it's read only inside
       the message-insert handler as a best-effort lookup, and re-subscribing
       on every members mutation would cause flicker. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedChannelId,
    accountId,
    loadMessages,
    loadMembers,
    accountUsername,
    accountDisplayName,
  ]);

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

  /* Auto-scroll to bottom when new messages arrive (or when the user
     switches channels). We jump instantly on channel switch but smooth
     on realtime inserts so the animation feels natural. */
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    /* Snap instantly after a channel switch, smooth for subsequent adds. */
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [selectedChannelId]);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const shouldStickToBottom =
      el.scrollHeight - (el.scrollTop + el.clientHeight) < 200;
    if (shouldStickToBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  /* Mark the selected channel read whenever we render its latest message.
     Debounced so a burst of realtime inserts only triggers one write. */
  useEffect(() => {
    if (!selectedChannelId || !accountId || messages.length === 0) return;
    const id = window.setTimeout(() => {
      void markChannelRead(selectedChannelId, accountId).then(() => {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedChannelId ? { ...c, unread_count: 0 } : c,
          ),
        );
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [selectedChannelId, accountId, messages.length]);

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

  const handleSelectChannel = useCallback((channelId: string) => {
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
      await loadChannels();
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
      setNewChannelOpen(false);
      if (row) {
        await loadChannels();
        handleSelectChannel(row.id);
      }
    },
    [accountId, loadChannels, handleSelectChannel],
  );

  const handleFilePick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      const uploaded: DiscussAttachment[] = [];
      for (const f of Array.from(files)) {
        const rec = await uploadDiscussAttachment(f);
        if (rec) uploaded.push(rec);
      }
      setComposerAttachments((prev) => [...prev, ...uploaded]);
      setUploading(false);
      /* Reset the input so the same file can be re-picked. */
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (!accountId || !selectedChannelId) return;
    const trimmed = composerBody.trim();
    if (!trimmed && composerAttachments.length === 0 && composerProducts.length === 0) {
      return;
    }
    setSending(true);

    /* Decide kind from attachments — single image → "image", any other file
       → "file", text only → "text". Keeps sidebar previews smart. */
    let kind: DiscussMessageKind = "text";
    if (composerAttachments.length === 1 && composerAttachments[0].type.startsWith("image/")) {
      kind = "image";
    } else if (composerAttachments.length > 0) {
      kind = "file";
    }

    const metadata: DiscussMessageMetadata = {};
    if (composerAttachments.length > 0) metadata.attachments = composerAttachments;
    if (composerProducts.length > 0) metadata.products = composerProducts;
    if (composerMentions.length > 0) metadata.mentions = composerMentions;

    /* Optimistic append — the realtime subscription will dedupe this
       once the server round-trip finishes. Keeps the thread feeling
       instant even on slow connections. */
    const tempId = `temp_${Date.now()}`;
    const optimistic: DiscussMessageWithAuthor = {
      id: tempId,
      channel_id: selectedChannelId,
      author_account_id: accountId,
      reply_to_message_id: null,
      kind,
      body: trimmed || null,
      body_html: null,
      metadata,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      author: {
        id: accountId,
        username: accountUsername,
        avatar_url: account?.avatar_url ?? null,
        full_name: accountDisplayName,
      },
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    setComposerBody("");
    setComposerAttachments([]);
    setComposerProducts([]);
    setComposerMentions([]);

    const saved = await sendDiscussMessage({
      channelId: selectedChannelId,
      authorId: accountId,
      body: trimmed,
      kind,
      metadata,
    });

    if (saved) {
      /* Replace the optimistic row with the real one so its id matches
         the realtime INSERT event we'll get, and the dedupe logic
         works. */
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: saved.id, created_at: saved.created_at }
            : m,
        ),
      );
      void clearDraft(accountId, selectedChannelId);
      /* Force the sidebar to reflect the new last_message_at — also
         gives us a clean unread reset since we sent the message. */
      void loadChannels();
    } else {
      /* Restore the body so the user can retry without re-typing. */
      setComposerBody(trimmed);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
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
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
     EARLY RETURNS / LOADING STATES
     ═══════════════════════════════════════════════════════════════════════ */

  if (accountLoading) {
    return (
      <div className="flex-1 min-h-0 bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  if (!accountId) {
    return (
      <div className="flex-1 min-h-0 bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
        <p className="text-[13px] text-[var(--text-muted)]">
          You need to sign in to use Discuss.
        </p>
        <Link
          href="/"
          className="text-[12px] font-semibold text-blue-400 hover:text-blue-300"
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
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      {/* ═══ Top bar ═══ */}
      <header className="shrink-0 h-14 flex items-center gap-2 px-3 md:px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <Link
          href="/"
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {mobileView !== "list" && (
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="md:hidden h-8 px-2 flex items-center gap-1 rounded-lg text-[12px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("mobile.list")}
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
          <h1 className="text-[15px] md:text-[16px] font-semibold tracking-tight truncate">
            {t("title")}
          </h1>
          {totalUnread > 0 && (
            <span className="hidden md:inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-blue-500 text-white text-[10.5px] font-bold tabular-nums">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setNewDmOpen(true)}
          className="hidden md:flex h-8 px-3 rounded-lg hover:bg-[var(--bg-surface)] text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors items-center gap-1.5"
          title={t("sidebar.newDirect")}
        >
          <AtSign className="h-3.5 w-3.5" />
          {t("sidebar.newDirect")}
        </button>
        <button
          type="button"
          onClick={() => setNewChannelOpen(true)}
          className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t("sidebar.newChannel")}</span>
        </button>
      </header>

      {/* ═══ Three-column body ═══ */}
      <div className="flex-1 min-h-0 flex">
        {/* ── Column 1: Channels + DMs list ────────────────────────── */}
        <aside
          className={`shrink-0 md:w-[300px] md:border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col min-h-0 ${
            mobileView === "list" ? "flex w-full" : "hidden md:flex"
          }`}
        >
          {/* Search + filter */}
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors mb-2">
              <Search size={14} className="text-[var(--text-dim)] shrink-0" />
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
                  <X size={14} />
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
                      ? "bg-blue-500/15 text-blue-300"
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
            {loadingChannels ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-[var(--text-ghost)]" />
                </div>
                <p className="text-[12.5px] text-[var(--text-faint)] font-medium">
                  {t("sidebar.empty")}
                </p>
                <p className="text-[11px] text-[var(--text-dim)] max-w-[220px]">
                  {t("sidebar.emptyHint")}
                </p>
                <button
                  type="button"
                  onClick={() => setNewChannelOpen(true)}
                  className="mt-1 h-8 px-3 rounded-lg bg-blue-500/15 text-blue-300 text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-blue-500/25 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("sidebar.newChannel")}
                </button>
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
                        />
                      ))}
                    </ul>
                  </div>
                )}
                {groupedChannels.dms.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                      {t("sidebar.directs")}
                    </div>
                    <ul>
                      {groupedChannels.dms.map((c) => (
                        <ChannelRow
                          key={c.id}
                          channel={c}
                          selected={c.id === selectedChannelId}
                          onSelect={() => handleSelectChannel(c.id)}
                        />
                      ))}
                    </ul>
                  </div>
                )}
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
          {!selectedChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-[var(--text-ghost)]" />
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
              <div className="shrink-0 h-14 px-4 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                {selectedChannel.kind === "direct" ? (
                  <Avatar
                    name={displayNameFor(selectedChannel)}
                    url={selectedChannel.other?.avatar_url}
                    size={34}
                  />
                ) : (
                  <div className="h-[34px] w-[34px] shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                    {selectedChannel.kind === "channel" ? (
                      <Hash className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <Users className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                    {displayNameFor(selectedChannel)}
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
                <button
                  type="button"
                  onClick={() => {
                    setDetailsOpen((v) => !v);
                    setMobileView("details");
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                  title={t("header.details")}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>

              {/* Message list */}
              <div
                ref={threadScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
              >
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <ThreadEmptyState
                    channel={selectedChannel}
                    t={t}
                  />
                ) : (
                  <MessageList
                    messages={messages}
                    currentAccountId={accountId}
                    todayText={t("thread.today")}
                    yesterdayText={t("thread.yesterday")}
                    editedText={t("thread.edited")}
                    deletedText={t("thread.deleted")}
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
                uploading={uploading}
                sending={sending}
                onSend={handleSend}
                onPickFile={() => fileInputRef.current?.click()}
                onOpenProductPicker={() => setProductPickerOpen(true)}
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
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFilePick(e.target.files)}
              />
            </>
          )}
        </section>

        {/* ── Column 3: Details ────────────────────────────────────── */}
        {detailsOpen && selectedChannel && (
          <aside
            className={`shrink-0 md:w-[300px] md:border-s border-[var(--border-subtle)] bg-[var(--bg-secondary)] min-h-0 overflow-y-auto ${
              mobileView === "details" ? "flex flex-col w-full" : "hidden md:flex md:flex-col"
            }`}
          >
            <DetailsPane
              channel={selectedChannel}
              members={members}
              onClose={() => {
                setDetailsOpen(false);
                setMobileView("thread");
              }}
              t={t}
            />
          </aside>
        )}
      </div>

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
}: {
  channel: DiscussChannelWithState;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = displayNameFor(channel);
  const preview = previewMessage(channel.last_message);
  const time = channel.last_message?.created_at
    ? formatSidebarTime(channel.last_message.created_at)
    : "";
  const isDm = channel.kind === "direct";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`relative w-full text-left px-3 py-2.5 transition-colors border-b border-[var(--border-subtle)]/50 ${
          selected ? "bg-blue-500/10" : "hover:bg-white/[0.03]"
        }`}
      >
        {selected && (
          <span
            className="absolute inset-y-0 start-0 w-[3px] bg-blue-500"
            aria-hidden
          />
        )}
        <div className="flex items-start gap-3 min-w-0">
          {isDm ? (
            <Avatar name={name} url={channel.other?.avatar_url} size={40} />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
              {channel.kind === "channel" ? (
                <Hash className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <Users className="h-4 w-4 text-[var(--text-muted)]" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[13px] truncate ${
                  channel.unread_count > 0
                    ? "font-semibold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-muted)]"
                }`}
              >
                {name}
              </span>
              {time && (
                <span className="text-[10px] text-[var(--text-dim)] shrink-0 tabular-nums">
                  {time}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[11.5px] truncate flex-1 ${
                  channel.unread_count > 0
                    ? "text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-dim)]"
                }`}
              >
                {channel.last_message?.author_username && !isDm ? (
                  <>
                    <span className="text-[var(--text-muted)]">
                      {channel.last_message.author_username}:{" "}
                    </span>
                    {preview}
                  </>
                ) : (
                  preview || "—"
                )}
              </span>
              {channel.unread_count > 0 && (
                <span className="h-[18px] min-w-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10.5px] font-bold tabular-nums flex items-center justify-center">
                  {channel.unread_count > 99 ? "99+" : channel.unread_count}
                </span>
              )}
              {channel.muted && (
                <span className="text-[var(--text-dim)]" title="Muted">
                  🔕
                </span>
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

function MessageList({
  messages,
  currentAccountId,
  todayText,
  yesterdayText,
  editedText,
  deletedText,
}: {
  messages: DiscussMessageWithAuthor[];
  currentAccountId: string;
  todayText: string;
  yesterdayText: string;
  editedText: string;
  deletedText: string;
}) {
  /* Pre-compute day groupings once per render. Messages already sorted
     ASC by created_at from the data layer. */
  const withSeparators = useMemo(() => {
    const out: Array<
      | { kind: "sep"; key: string; label: string }
      | { kind: "msg"; key: string; msg: DiscussMessageWithAuthor; showAuthor: boolean }
    > = [];
    let lastDay = "";
    let lastAuthor = "";
    let lastTime = 0;
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
  }, [messages, todayText, yesterdayText]);

  return (
    <div className="flex flex-col gap-1">
      {withSeparators.map((row) =>
        row.kind === "sep" ? (
          <div key={row.key} className="flex items-center my-3">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <div className="px-3 text-[10.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
              {row.label}
            </div>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>
        ) : (
          <MessageBubble
            key={row.key}
            msg={row.msg}
            showAuthor={row.showAuthor}
            isSelf={row.msg.author_account_id === currentAccountId}
            editedText={editedText}
            deletedText={deletedText}
          />
        ),
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  showAuthor,
  isSelf,
  editedText,
  deletedText,
}: {
  msg: DiscussMessageWithAuthor;
  showAuthor: boolean;
  isSelf: boolean;
  editedText: string;
  deletedText: string;
}) {
  const author = msg.author;
  const authorName = author?.full_name || author?.username || "Unknown";
  const time = formatFullTime(msg.created_at);
  const isDeleted = !!msg.deleted_at;
  const meta = msg.metadata ?? {};

  return (
    <div className={`group flex gap-3 ${showAuthor ? "mt-2" : ""}`}>
      {showAuthor ? (
        <Avatar
          name={authorName}
          url={author?.avatar_url ?? null}
          size={36}
        />
      ) : (
        <div className="w-9 shrink-0 flex items-start justify-center pt-1">
          <span className="text-[9px] text-transparent group-hover:text-[var(--text-dim)] tabular-nums transition-colors">
            {time}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {showAuthor && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
              {authorName}
            </span>
            <span className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
              {time}
            </span>
            {isSelf && (
              <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider">
                You
              </span>
            )}
          </div>
        )}

        {isDeleted ? (
          <div className="text-[12.5px] italic text-[var(--text-dim)]">
            {deletedText}
          </div>
        ) : (
          <>
            {msg.body && (
              <div className="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
                {renderMessageBody(msg.body, meta.mentions ?? [])}
              </div>
            )}

            {/* Attachments */}
            {meta.attachments && meta.attachments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {meta.attachments.map((a, i) => (
                  <AttachmentChip key={`${msg.id}-a-${i}`} attachment={a} />
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

            {/* Reactions row */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {msg.reactions.map((rx) => (
                  <span
                    key={rx.emoji}
                    className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-full border text-[11px] tabular-nums transition-colors ${
                      rx.reacted_by_me
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    <span>{rx.emoji}</span>
                    <span className="font-semibold">{rx.count}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Render a message body with inline @mentions highlighted. Mentions
 *  are pre-computed server-side as offset ranges so we don't need to
 *  re-parse the text. Falls back to plain text on any shape mismatch. */
function renderMessageBody(body: string, mentions: DiscussMention[]) {
  if (!mentions || mentions.length === 0) return body;
  /* Sort by offset to build a safe token stream. */
  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.offset < cursor || m.offset > body.length) continue;
    if (m.offset > cursor) parts.push(body.slice(cursor, m.offset));
    const end = Math.min(m.offset + m.length, body.length);
    parts.push(
      <span
        key={`m-${m.offset}`}
        className="inline-flex items-center px-1 rounded bg-blue-500/15 text-blue-300 font-semibold"
      >
        @{m.username}
      </span>,
    );
    cursor = end;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

function AttachmentChip({ attachment }: { attachment: DiscussAttachment }) {
  const isImage = attachment.type.startsWith("image/");
  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="block max-w-[320px] rounded-lg overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="w-full h-auto max-h-[260px] object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 h-12 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors max-w-[280px]"
    >
      <div className="h-8 w-8 shrink-0 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
        <FileText className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
          {attachment.name}
        </div>
        <div className="text-[10.5px] text-[var(--text-dim)]">
          {formatBytes(attachment.size)}
        </div>
      </div>
    </a>
  );
}

function ProductChip({ product }: { product: DiscussProductRef }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="flex items-center gap-2 h-12 px-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors max-w-[280px]"
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
          <Package className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {product.name}
        </div>
        <div className="text-[10.5px] text-blue-300 truncate">
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
          <Hash className="h-5 w-5 text-[var(--text-dim)]" />
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
}: {
  body: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  attachments: DiscussAttachment[];
  products: DiscussProductRef[];
  onRemoveAttachment: (index: number) => void;
  onRemoveProduct: (index: number) => void;
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
}) {
  const canSend =
    !sending &&
    !uploading &&
    (body.trim().length > 0 || attachments.length > 0 || products.length > 0);

  return (
    <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
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
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {products.map((p, i) => (
            <div
              key={`cp-${i}`}
              className="flex items-center gap-2 h-9 ps-2 pe-1 rounded-lg bg-blue-500/10 border border-blue-500/30"
            >
              <Package className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-[11.5px] text-[var(--text-primary)] max-w-[180px] truncate font-medium">
                {p.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveProduct(i)}
                className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3" />
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
            <Paperclip className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Mention" onClick={onOpenMentionPicker}>
            <AtSign className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Product" onClick={onOpenProductPicker}>
            <Package className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Emoji" onClick={onOpenEmojiPicker}>
            <Smile className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton title="Voice" onClick={() => undefined} disabled>
            <Mic className="h-4 w-4" />
          </ComposerIconButton>

          <div className="flex-1" />

          {uploading && (
            <span className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading…
            </span>
          )}

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="h-8 px-3 rounded-lg bg-blue-500 text-white text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{sendLabel}</span>
          </button>
        </div>
      </div>
      <div className="mt-1 px-1 text-[10px] text-[var(--text-dim)]">
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
  onClose,
  t,
}: {
  channel: DiscussChannelWithState;
  members: Array<DiscussMemberRow & { author: DiscussAuthor }>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) {
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
          <X className="h-4 w-4" />
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
                <Hash className="h-6 w-6 text-[var(--text-muted)]" />
              ) : (
                <Users className="h-6 w-6 text-[var(--text-muted)]" />
              )}
            </div>
          )}
          <div className="text-[15px] font-bold text-[var(--text-primary)]">
            {displayNameFor(channel)}
          </div>
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

        {/* Members section */}
        {channel.kind !== "direct" && (
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
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] truncate">
                      @{m.author.username}
                      {m.role !== "member" && (
                        <span className="ms-1.5 text-blue-300 font-semibold uppercase tracking-wider">
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

        {/* Quick-actions stub — detailed features ship in Phase B/C/D */}
        <section>
          <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
            {t("details.notifications")}
          </div>
          <div className="flex flex-col gap-1">
            <DetailsRow
              icon={<Pin className="h-3.5 w-3.5" />}
              label={t("details.pinned")}
            />
            <DetailsRow
              icon={<Star className="h-3.5 w-3.5" />}
              label={t("sidebar.starred")}
            />
            <DetailsRow
              icon={<FileText className="h-3.5 w-3.5" />}
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
      <MoreHorizontal className="h-3.5 w-3.5 text-[var(--text-dim)]" />
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
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div
        className="w-full rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
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
            <X className="h-4 w-4" />
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
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <Hash className="h-3.5 w-3.5" />
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
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <Lock className="h-3.5 w-3.5" />
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
              <Search className="h-3.5 w-3.5 text-[var(--text-dim)]" />
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
                      isOn ? "bg-blue-500/10" : "hover:bg-[var(--bg-primary)]"
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
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        @{r.username}
                        {r.role_name && (
                          <span className="ms-1.5">· {r.role_name}</span>
                        )}
                      </div>
                    </div>
                    {isOn && <Check className="h-4 w-4 text-blue-400" />}
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
          className="h-8 px-3 rounded-lg bg-blue-500 text-white text-[11.5px] font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
          <Search className="h-4 w-4 text-[var(--text-dim)]" />
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
  onCancel,
  onSelect,
  t,
}: {
  products: ProductRow[];
  images: Record<string, string>;
  onCancel: () => void;
  onSelect: (p: ProductRow) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [products, search]);

  return (
    <ModalShell title={t("composer.product")} onCancel={onCancel} width={520}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <Search className="h-4 w-4 text-[var(--text-dim)]" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("sidebar.search")}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto flex flex-col gap-0.5">
          {filtered.length === 0 && (
            <div className="p-4 text-center text-[11px] text-[var(--text-dim)]">
              {t("search.noResults")}
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full px-3 py-2 flex items-center gap-3 text-start rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="h-10 w-10 shrink-0 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                {images[p.id] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={images[p.id]}
                    alt={p.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-4 w-4 text-[var(--text-muted)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {p.product_name}
                </div>
                <div className="text-[10.5px] text-[var(--text-dim)] truncate">
                  {p.brand ? `${p.brand} · ` : ""}
                  {p.slug}
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
          <AtSign className="h-4 w-4 text-[var(--text-dim)]" />
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
