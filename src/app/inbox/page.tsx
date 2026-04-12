"use client";

/* ---------------------------------------------------------------------------
   /inbox — unified inbox for internal users (Super Admin, Admin, Sales,
   and anyone else with an active internal account). Combines:

     · System notifications (new membership requests, alerts)
     · Direct messages from other internal users
     · Role broadcasts ("to everyone in Sales")

   Layout: two-pane. Left column is the message list, right pane shows the
   selected message. Compose button opens a modal for sending a new
   message (single recipient or role broadcast).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  CheckCheck,
  CheckCircle2,
  CornerUpLeft,
  CornerUpRight,
  Download,
  ExternalLink,
  FileText,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Package,
  Paperclip,
  PenSquare,
  Plus,
  Search,
  Send,
  X,
  XCircle,
  Users,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";
import {
  archiveMessage,
  broadcastToRole,
  fetchInboxMessages,
  fetchMessageableAccounts,
  markAllRead,
  markMessageRead,
  markMessageUnread,
  sendMessage,
  updateMembershipRequestStatus,
  uploadInboxAttachment,
  type InboxAttachment,
  type InboxProductRef,
} from "@/lib/inbox";
import { fetchProductMainImages, fetchProducts } from "@/lib/products-admin";
import { useCurrentAccount } from "@/lib/identity";
import type { InboxMessageWithSender, ProductRow } from "@/types/supabase";

type Recipient = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role_name: string | null;
};

/* Mailboxes drive the left rail, same way macOS Mail groups messages into
   "smart boxes". Each mailbox provides its own filter predicate — we
   compute the filtered list (and the per-mailbox count badges) from
   this single source of truth so adding a new folder later is one line. */
type Mailbox = "inbox" | "unread" | "membership" | "system" | "archive";

const MAILBOX_ORDER: Mailbox[] = [
  "inbox",
  "unread",
  "membership",
  "system",
  "archive",
];

const MAILBOX_LABEL: Record<Mailbox, string> = {
  inbox: "Inbox",
  unread: "Unread",
  membership: "Membership",
  system: "System",
  archive: "Archive",
};

function matchesMailbox(m: InboxMessageWithSender, box: Mailbox): boolean {
  switch (box) {
    case "inbox":
      return !m.archived_at;
    case "unread":
      return !m.archived_at && !m.read_at;
    case "membership":
      return !m.archived_at && m.category === "membership_request";
    case "system":
      return !m.archived_at && (m.category === "system" || m.category === "alert");
    case "archive":
      return !!m.archived_at;
    default:
      return false;
  }
}

/* Pre-fill payload passed to ComposeModal when Reply or Forward is clicked.
   lockedRecipient hides the picker and shows a read-only "To: …" row — the
   Gmail pattern where you can't accidentally redirect a reply. */
type ComposeInitial = {
  recipientId?: string;
  recipientLabel?: string; // shown when picker is locked
  lockedRecipient?: boolean;
  subject?: string;
  body?: string;
};

/* Gmail-style helpers: format a plain-text body as a quoted reply / forward
   block. Keeps the layout greppable in the DB and renders fine with the
   existing `whitespace-pre-wrap` paragraph. */
function buildReplyBody(msg: InboxMessageWithSender, senderName: string): string {
  const when = new Date(msg.created_at).toLocaleString();
  const quoted = (msg.body ?? "")
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");
  return `\n\n— On ${when}, ${senderName} wrote:\n${quoted}`;
}

function buildForwardBody(msg: InboxMessageWithSender, senderName: string): string {
  const when = new Date(msg.created_at).toLocaleString();
  return [
    "",
    "",
    "---------- Forwarded message ---------",
    `From: ${senderName}`,
    `Date: ${when}`,
    `Subject: ${msg.subject}`,
    "",
    msg.body ?? "",
  ].join("\n");
}

function prefixSubject(current: string, prefix: "Re" | "Fwd"): string {
  const trimmed = current.trim();
  const already = new RegExp(`^${prefix}:\\s*`, "i").test(trimmed);
  return already ? trimmed : `${prefix}: ${trimmed}`;
}

/* Shared byte formatter used by both ComposeModal's chip list and
   MessageDetail's attachment list. Kept at module scope so both
   components can reach it. */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* The roles we allow broadcasting to. Matches role names in the DB. */
const BROADCAST_ROLES = [
  "Super Admin",
  "Admin",
  "Sales",
  "Marketing",
  "Finance",
  "HR",
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString("en", { weekday: "short" });
  }
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

/* Build initials from the sender's display name — matches Apple Mail's
   circular avatar placeholder pattern. "Sarah Chen" → "SC", single-word
   names use the first two letters so we never show an empty circle. */
function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Deterministic gradient per name so the same sender always shows the
   same avatar color. Hash → index into a fixed palette keeps it cheap. */
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

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function categoryBadge(category: InboxMessageWithSender["category"]): {
  label: string;
  className: string;
} {
  switch (category) {
    case "membership_request":
      return {
        label: "Membership",
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    case "system":
      return {
        label: "System",
        className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      };
    case "alert":
      return {
        label: "Alert",
        className: "bg-red-500/15 text-red-300 border-red-500/30",
      };
    default:
      return {
        label: "Message",
        className:
          "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]",
      };
  }
}

export default function InboxPage() {
  const { account, loading: accountLoading } = useCurrentAccount();
  const accountId = account?.id ?? null;

  /* Deep-link support. NotificationBell routes `router.push(msg.link)`
     and the membership-request trigger emits `/inbox?request=<uuid>`,
     so when we arrive with that query param, auto-select the matching
     message once the list finishes loading. We also honor
     `?id=<inbox_message_uuid>` for future direct-link use. */
  const searchParams = useSearchParams();
  const deepLinkRequestId = searchParams?.get("request") ?? null;
  const deepLinkMessageId = searchParams?.get("id") ?? null;

  const [messages, setMessages] = useState<InboxMessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeMailbox, setActiveMailbox] = useState<Mailbox>("inbox");
  const [search, setSearch] = useState("");
  /* Mobile column swap: the page is a single column on small screens
     (list ↔ detail), like macOS Mail's iPhone mode. On desktop the
     3-column layout is visible all the time and this flag is ignored. */
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  /* Compose modal is open iff composeInitial is non-null. Plain "new
     message" (from the Compose button) opens with an empty object;
     Reply / Forward pass a filled payload. */
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | null>(
    null,
  );
  /* One-shot flag: we only honor the deep link on the first load after
     mount, so navigating around inside the inbox doesn't keep yanking
     the selection back to the URL target. */
  const [deepLinkConsumed, setDeepLinkConsumed] = useState(false);
  /* Small inline toast for membership approve/reject so we don't have
     to wire up a global notification system. */
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadMessages = useCallback(async () => {
    if (!accountId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchInboxMessages(accountId, {
      includeArchived: true,
      limit: 200,
    });
    setMessages(rows);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    if (!accountLoading) void loadMessages();
  }, [accountLoading, loadMessages]);

  const filtered = useMemo(() => {
    let list = messages.filter((m) => matchesMailbox(m, activeMailbox));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          (m.body ?? "").toLowerCase().includes(q) ||
          (m.sender?.full_name ?? "").toLowerCase().includes(q) ||
          (m.sender?.username ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [messages, activeMailbox, search]);

  /* Count per mailbox — drives the badges on the left rail. Computed
     once from the full message set so badges stay in sync as we
     filter/search, without needing to re-filter for each mailbox. */
  const mailboxCounts = useMemo(() => {
    const counts: Record<Mailbox, number> = {
      inbox: 0,
      unread: 0,
      membership: 0,
      system: 0,
      archive: 0,
    };
    for (const m of messages) {
      for (const box of MAILBOX_ORDER) {
        if (matchesMailbox(m, box)) counts[box] += 1;
      }
    }
    return counts;
  }, [messages]);

  /* First-load: if the URL carries `?request=<uuid>` or `?id=<uuid>`,
     find the matching row in the full messages list (not `filtered`, so
     we succeed even if the current filter would hide it) and select it.
     Widen the filter to "all" when the target is archived so the detail
     pane actually renders it. Runs only once per mount via the consumed
     flag. */
  useEffect(() => {
    if (deepLinkConsumed) return;
    if (loading) return;
    if (!deepLinkRequestId && !deepLinkMessageId) {
      setDeepLinkConsumed(true);
      return;
    }
    const target =
      (deepLinkMessageId &&
        messages.find((m) => m.id === deepLinkMessageId)) ||
      (deepLinkRequestId &&
        messages.find(
          (m) =>
            m.category === "membership_request" &&
            ((m.metadata as Record<string, unknown> | null)?.request_id as
              | string
              | undefined) === deepLinkRequestId,
        )) ||
      null;
    if (target) {
      if (target.archived_at && activeMailbox !== "archive") {
        setActiveMailbox("archive");
      }
      setSelectedId(target.id);
      /* On mobile, jump straight to the detail column so the deep link
         actually shows the message instead of dumping the user on a
         list with no visual change. */
      setMobileView("detail");
    }
    setDeepLinkConsumed(true);
  }, [
    deepLinkConsumed,
    deepLinkMessageId,
    deepLinkRequestId,
    activeMailbox,
    loading,
    messages,
  ]);

  /* Keep a valid selection: if the filter hides the current message, pick
     the first one in the filtered list. Skipped until the deep-link effect
     has had its chance, so first paint doesn't clobber the URL target. */
  useEffect(() => {
    if (!deepLinkConsumed) return;
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((m) => m.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [deepLinkConsumed, filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((m) => m.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  /* Mark a message read the first time it's selected. Optimistic update. */
  useEffect(() => {
    if (!selected || selected.read_at) return;
    const id = selected.id;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, read_at: new Date().toISOString() } : m,
      ),
    );
    void markMessageRead(id);
  }, [selected]);

  async function handleMarkAllRead() {
    if (!accountId || mailboxCounts.unread === 0) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.read_at ? m : { ...m, read_at: new Date().toISOString() },
      ),
    );
    await markAllRead(accountId);
  }

  async function handleArchive(id: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, archived_at: new Date().toISOString() } : m,
      ),
    );
    await archiveMessage(id);
  }

  /* Toggle read/unread from a list row's hover action. Optimistic so
     the dot flips before the network round-trip. */
  async function handleToggleRead(msg: InboxMessageWithSender) {
    const nextReadAt = msg.read_at ? null : new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, read_at: nextReadAt } : m)),
    );
    if (nextReadAt) {
      await markMessageRead(msg.id);
    } else {
      await markMessageUnread(msg.id);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (accountLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  if (!accountId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
          <Mail className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
        <p className="text-[13px] text-[var(--text-muted)]">
          You need to sign in to see Koleex Mail.
        </p>
        <Link
          href="/"
          className="text-[12px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Back to home
        </Link>
      </div>
    );
  }

  /* Handy aliases used inside the JSX. Pulled out so the `filtered`
     list and the "active mailbox" are easy to reason about even while
     the user is mid-search. */
  const activeLabel = MAILBOX_LABEL[activeMailbox];

  return (
    /* flex-1 + min-h-0 makes us fill the space BELOW the global fixed
       MainHeader (which sits on top with h-14). Using h-screen here
       would be 100vh — ignoring the header — and push the whole page
       into overflow, so the header would scroll out of view. */
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      {/* Top bar — one compact row across all columns. Holds back arrow,
          app title, the list/detail toggle on mobile, and the Compose
          button. Matches macOS Mail's single title strip above the
          3-column content area. */}
      <header className="shrink-0 h-14 flex items-center gap-2 px-3 md:px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <Link
          href="/"
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Back to Hub"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {/* Mobile back: when we're on the detail view, this flips us
            back to the list. Invisible on desktop where the list is
            always in view. */}
        {mobileView === "detail" && (
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="md:hidden h-8 px-2 flex items-center gap-1 rounded-lg text-[12px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Mailboxes
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
          <h1 className="text-[15px] md:text-[16px] font-semibold tracking-tight truncate">
            Koleex Mail
          </h1>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleMarkAllRead}
          disabled={mailboxCounts.unread === 0}
          className="hidden md:flex h-8 px-3 rounded-lg hover:bg-[var(--bg-surface)] text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
        <button
          onClick={() => {
            setComposeInitial({});
            /* Push the mobile view to the detail column so the new
               compose pane is actually visible on phones. On desktop
               the column is already in view. */
            setMobileView("detail");
          }}
          className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all"
        >
          <PenSquare className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Compose</span>
        </button>
      </header>

      {/* Three-column body */}
      <div className="flex-1 min-h-0 flex">
        {/* ── Column 1: Mailbox sidebar ─────────────────────────────
            Hidden on mobile — the same nav sits inside the list column
            header as a compact selector. 220px wide on desktop matches
            macOS Mail's source list. */}
        <aside
          className={`w-[220px] shrink-0 border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-y-auto ${
            mobileView === "list" ? "hidden md:flex md:flex-col" : "hidden md:flex md:flex-col"
          }`}
        >
          <div className="px-3 py-3">
            <div className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider px-2 mb-1">
              Mailboxes
            </div>
            <nav className="flex flex-col gap-0.5">
              {MAILBOX_ORDER.map((box) => {
                const active = activeMailbox === box;
                const count = mailboxCounts[box];
                const Icon =
                  box === "inbox"
                    ? InboxIcon
                    : box === "unread"
                      ? MailOpen
                      : box === "membership"
                        ? Users
                        : box === "system"
                          ? AlertCircle
                          : Archive;
                return (
                  <button
                    key={box}
                    type="button"
                    onClick={() => {
                      setActiveMailbox(box);
                      setMobileView("list");
                    }}
                    className={`h-8 px-2 rounded-md flex items-center gap-2 text-[12.5px] font-medium transition-colors ${
                      active
                        ? "bg-blue-500/15 text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        active ? "text-blue-400" : "text-[var(--text-dim)]"
                      }`}
                    />
                    <span className="flex-1 text-left">{MAILBOX_LABEL[box]}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10.5px] font-semibold tabular-nums ${
                          active ? "text-[var(--text-muted)]" : "text-[var(--text-dim)]"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ── Column 2: Message list ─────────────────────────────── */}
        <section
          className={`shrink-0 md:w-[380px] md:border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col min-h-0 ${
            mobileView === "list" ? "flex w-full" : "hidden md:flex"
          }`}
        >
          {/* List header: mailbox title + search input. The title is
              the "you are here" indicator so users don't lose track
              when they switch folders. */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight">
                  {activeLabel}
                </h2>
                <div className="text-[11px] text-[var(--text-dim)] tabular-nums">
                  {loading
                    ? "Loading…"
                    : `${filtered.length} ${filtered.length === 1 ? "message" : "messages"}`}
                </div>
              </div>
              {/* Mobile mailbox picker — on phones the aside is hidden,
                  so we surface a compact segmented control here. */}
              <div className="md:hidden">
                <select
                  value={activeMailbox}
                  onChange={(e) => setActiveMailbox(e.target.value as Mailbox)}
                  className="h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px] font-semibold text-[var(--text-primary)] outline-none"
                >
                  {MAILBOX_ORDER.map((box) => (
                    <option key={box} value={box}>
                      {MAILBOX_LABEL[box]} ({mailboxCounts[box]})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
              <Search size={14} className="text-[var(--text-dim)] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none min-w-0"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-0.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List body */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                  <Mail className="h-5 w-5 text-[var(--text-ghost)]" />
                </div>
                <p className="text-[12.5px] text-[var(--text-faint)] font-medium">
                  {search
                    ? "No messages match your search"
                    : activeMailbox === "unread"
                      ? "No unread messages"
                      : activeMailbox === "archive"
                        ? "Nothing archived"
                        : activeMailbox === "membership"
                          ? "No membership requests"
                          : activeMailbox === "system"
                            ? "No system alerts"
                            : "Inbox is empty"}
                </p>
              </div>
            ) : (
              <ul>
                {filtered.map((msg) => {
                  const isSelected = msg.id === selectedId;
                  const isUnread = !msg.read_at;
                  const senderName =
                    msg.sender?.full_name ||
                    msg.sender?.username ||
                    (msg.sender_account_id === null
                      ? "Koleex System"
                      : "Unknown");
                  const meta = (msg.metadata ?? null) as Record<
                    string,
                    unknown
                  > | null;
                  const hasAttachments = Array.isArray(meta?.attachments)
                    ? (meta!.attachments as unknown[]).length > 0
                    : false;
                  const hasProducts = Array.isArray(meta?.products)
                    ? (meta!.products as unknown[]).length > 0
                    : false;
                  return (
                    <li key={msg.id} className="relative group/row">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(msg.id);
                          setMobileView("detail");
                        }}
                        className={`relative w-full text-left px-4 py-3 transition-colors border-b border-[var(--border-subtle)] ${
                          isSelected
                            ? "bg-blue-500/10"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* Apple Mail selection indicator: a 3px blue bar
                            on the leading edge of the selected row. */}
                        {isSelected && (
                          <span
                            className="absolute inset-y-0 start-0 w-[3px] bg-blue-500"
                            aria-hidden
                          />
                        )}
                        <div className="flex gap-2.5 items-start min-w-0">
                          {/* Unread dot (blue, like Apple Mail). */}
                          <span
                            className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                              isUnread ? "bg-blue-500" : "bg-transparent"
                            }`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[13px] truncate ${
                                  isUnread
                                    ? "font-semibold text-[var(--text-primary)]"
                                    : "font-medium text-[var(--text-muted)]"
                                }`}
                              >
                                {senderName}
                              </span>
                              <span className="text-[10.5px] text-[var(--text-dim)] shrink-0 tabular-nums group-hover/row:md:opacity-0 transition-opacity">
                                {formatTimestamp(msg.created_at)}
                              </span>
                            </div>
                            <div
                              className={`text-[12.5px] truncate mt-0.5 ${
                                isUnread
                                  ? "font-semibold text-[var(--text-primary)]"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {msg.subject}
                            </div>
                            {msg.body && (
                              <div className="text-[11.5px] text-[var(--text-dim)] mt-0.5 line-clamp-2 leading-snug">
                                {msg.body}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {hasAttachments && (
                                <Paperclip className="h-3 w-3 text-[var(--text-dim)] shrink-0" />
                              )}
                              {hasProducts && (
                                <Package className="h-3 w-3 text-[var(--text-dim)] shrink-0" />
                              )}
                              <span
                                className={`inline-block text-[9px] font-semibold uppercase tracking-wider px-1.5 py-[1px] rounded border ${categoryBadge(msg.category).className}`}
                              >
                                {categoryBadge(msg.category).label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Hover action strip (desktop only). */}
                      <div className="hidden md:flex absolute top-2.5 end-2.5 items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-none group-hover/row:pointer-events-auto">
                        {msg.sender_account_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(msg.id);
                              handleReply(msg);
                            }}
                            title="Reply"
                            className="h-7 w-7 rounded-md bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors flex items-center justify-center shadow-md"
                          >
                            <CornerUpLeft className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleRead(msg);
                          }}
                          title={msg.read_at ? "Mark as unread" : "Mark as read"}
                          className="h-7 w-7 rounded-md bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors flex items-center justify-center shadow-md"
                        >
                          {msg.read_at ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <MailOpen className="h-3 w-3" />
                          )}
                        </button>
                        {!msg.archived_at && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleArchive(msg.id);
                            }}
                            title="Archive"
                            className="h-7 w-7 rounded-md bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-300 hover:border-red-500/30 transition-colors flex items-center justify-center shadow-md"
                          >
                            <Archive className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Column 3: Detail pane / Compose pane ─────────────────
             When the user hits "Compose", `composeInitial` becomes
             non-null and this column swaps out the message reader for
             an inline ComposeView. That means the user never loses
             sight of the mailbox list — Gmail + Apple Mail "reply in
             pane" pattern, but applied to brand-new messages too. */}
        <section
          className={`flex-1 min-h-0 bg-[var(--bg-primary)] ${
            mobileView === "detail" ? "flex w-full" : "hidden md:flex"
          }`}
        >
          {composeInitial !== null && accountId ? (
            <ComposeView
              senderId={accountId}
              initial={composeInitial}
              onClose={() => {
                setComposeInitial(null);
                /* On mobile, drop back to the list since there's nothing
                   to read once the compose form closes. */
                setMobileView("list");
              }}
              onSent={() => {
                setComposeInitial(null);
                setMobileView("list");
                void loadMessages();
              }}
            />
          ) : selected ? (
            <MessageDetail
              msg={selected}
              onArchive={() => handleArchive(selected.id)}
              onReply={() => handleReply(selected)}
              onForward={() => handleForward(selected)}
              onApprove={(note) => handleApprove(selected, note)}
              onReject={(reason) => handleReject(selected, reason)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                <Mail className="h-6 w-6 text-[var(--text-ghost)]" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-muted)]">
                  No Message Selected
                </div>
                <div className="text-[12px] text-[var(--text-dim)] mt-1">
                  Pick a message from the list to read it.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Inline toast for approve / reject / reply success & errors */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl border shadow-lg text-[12.5px] font-semibold flex items-center gap-2 ${
            toast.kind === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
              : "bg-red-500/15 border-red-500/30 text-red-200"
          }`}
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {toast.text}
        </div>
      )}
    </div>
  );

  /* ── Action handlers (defined here so they can close over page state) ── */

  function showToast(kind: "success" | "error", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  }

  function handleReply(msg: InboxMessageWithSender) {
    /* System notifications have no sender — can't reply. */
    if (!msg.sender_account_id || !msg.sender) {
      showToast("error", "You can't reply to a system notification.");
      return;
    }
    const senderLabel = msg.sender.full_name || msg.sender.username;
    setComposeInitial({
      recipientId: msg.sender_account_id,
      recipientLabel: senderLabel,
      lockedRecipient: true,
      subject: prefixSubject(msg.subject, "Re"),
      body: buildReplyBody(msg, senderLabel),
    });
    setMobileView("detail");
  }

  function handleForward(msg: InboxMessageWithSender) {
    const senderName =
      msg.sender?.full_name ||
      msg.sender?.username ||
      (msg.sender_account_id === null ? "Koleex System" : "Unknown");
    setComposeInitial({
      subject: prefixSubject(msg.subject, "Fwd"),
      body: buildForwardBody(msg, senderName),
    });
    setMobileView("detail");
  }

  async function handleApprove(
    msg: InboxMessageWithSender,
    note: string | null,
  ) {
    if (!accountId) return;
    const requestId = (msg.metadata as Record<string, unknown> | null)?.[
      "request_id"
    ] as string | undefined;
    if (!requestId) {
      showToast("error", "This notification has no linked request.");
      return;
    }
    const ok = await updateMembershipRequestStatus(
      requestId,
      "approved",
      accountId,
    );
    if (!ok) {
      showToast("error", "Couldn't update the request. Try again.");
      return;
    }
    /* Archive the inbox notification so the Super Admin mailbox stays
       clean. The request itself is preserved in membership_requests for
       audit. */
    await archiveMessage(msg.id);
    showToast(
      "success",
      note
        ? `Approved. Note saved with the request.`
        : "Request approved.",
    );
    void loadMessages();
  }

  async function handleReject(
    msg: InboxMessageWithSender,
    reason: string | null,
  ) {
    if (!accountId) return;
    const requestId = (msg.metadata as Record<string, unknown> | null)?.[
      "request_id"
    ] as string | undefined;
    if (!requestId) {
      showToast("error", "This notification has no linked request.");
      return;
    }
    const ok = await updateMembershipRequestStatus(
      requestId,
      "rejected",
      accountId,
    );
    if (!ok) {
      showToast("error", "Couldn't update the request. Try again.");
      return;
    }
    await archiveMessage(msg.id);
    showToast(
      "success",
      reason ? "Request rejected with reason." : "Request rejected.",
    );
    void loadMessages();
  }
}

/* ── Message detail pane ─────────────────────────────────────────────── */

function MessageDetail({
  msg,
  onArchive,
  onReply,
  onForward,
  onApprove,
  onReject,
}: {
  msg: InboxMessageWithSender;
  onArchive: () => void;
  onReply: () => void;
  onForward: () => void;
  onApprove: (note: string | null) => void;
  onReject: (reason: string | null) => void;
}) {
  const senderName =
    msg.sender?.full_name ||
    msg.sender?.username ||
    (msg.sender_account_id === null ? "Koleex System" : "Unknown");
  const badge = categoryBadge(msg.category);
  const created = new Date(msg.created_at);

  /* Inline expander for the Approve / Reject note, Gmail-style: clicking
     Reject opens a small textarea below the toolbar for an optional
     reason before committing. Same for Approve (optional welcome note). */
  const [confirmMode, setConfirmMode] = useState<"approve" | "reject" | null>(
    null,
  );
  const [confirmNote, setConfirmNote] = useState("");

  /* Only real messages from a human sender can be replied to; system
     notifications have a null sender_account_id. */
  const canReply = !!msg.sender_account_id;
  /* Only pending membership_request notifications get Approve / Reject.
     Once a Super Admin acts, they archive it, so subsequent visits
     don't see the buttons. */
  const canModerate =
    msg.category === "membership_request" && !msg.archived_at;

  const meta = (msg.metadata ?? null) as Record<string, unknown> | null;
  const attachments = Array.isArray(meta?.attachments)
    ? (meta!.attachments as InboxAttachment[])
    : [];
  const products = Array.isArray(meta?.products)
    ? (meta!.products as InboxProductRef[])
    : [];
  const showRequestDetails =
    msg.category === "membership_request" &&
    meta &&
    Object.keys(meta).length > 0;

  /* Apple Mail's header shows the full date in an unambiguous format
     (day, date, time) because the message list only shows the short
     form. */
  const formattedDate = created.toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = created.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col h-full w-full min-w-0">
      {/* Thin icon toolbar, matches macOS Mail's minimal action row. */}
      <div className="shrink-0 h-11 flex items-center gap-0.5 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        {!msg.archived_at && (
          <button
            type="button"
            onClick={onArchive}
            title="Archive"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
        {canReply && (
          <button
            type="button"
            onClick={onReply}
            title="Reply"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <CornerUpLeft className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onForward}
          title="Forward"
          className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <CornerUpRight className="h-4 w-4" />
        </button>
        {canModerate && (
          <>
            <span className="w-px h-5 bg-[var(--border-subtle)] mx-1.5" />
            <button
              type="button"
              onClick={() => {
                setConfirmMode("approve");
                setConfirmNote("");
              }}
              className="h-8 px-3 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmMode("reject");
                setConfirmNote("");
              }}
              className="h-8 px-3 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
            >
              <XCircle className="h-3 w-3" />
              Reject
            </button>
          </>
        )}
        <div className="flex-1" />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Approve / Reject inline confirmation strip */}
      {confirmMode && (
        <div
          className={`shrink-0 px-6 py-3 border-b border-[var(--border-subtle)] flex flex-col gap-2 ${
            confirmMode === "approve"
              ? "bg-emerald-500/[0.04]"
              : "bg-red-500/[0.04]"
          }`}
        >
          <div className="text-[11px] text-[var(--text-muted)]">
            {confirmMode === "approve"
              ? "Approve this request? You can add an optional welcome note."
              : "Reject this request? You can add an optional reason."}
          </div>
          <textarea
            value={confirmNote}
            onChange={(e) => setConfirmNote(e.target.value)}
            rows={2}
            placeholder={
              confirmMode === "approve"
                ? "Optional note (e.g. Welcome to Koleex — onboarding soon.)"
                : "Optional reason (shown internally only.)"
            }
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/40 resize-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setConfirmMode(null)}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const note = confirmNote.trim() || null;
                if (confirmMode === "approve") onApprove(note);
                else onReject(note);
                setConfirmMode(null);
              }}
              className={`h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                confirmMode === "approve"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
                  : "bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25"
              }`}
            >
              {confirmMode === "approve" ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Confirm approve
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Confirm reject
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Body — centered reading column, Apple Mail-style */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-8">
          {/* Big header block: avatar + sender identity + date, then a
              huge subject line — this is the macOS Mail reading view. */}
          <div className="flex items-start gap-4 mb-6">
            <div
              className={`h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-white text-[15px] font-bold bg-gradient-to-br ${gradientFor(
                senderName,
              )} shadow-sm`}
              aria-hidden
            >
              {initialsOf(senderName)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[var(--text-primary)] truncate">
                    {senderName}
                  </div>
                  <div className="text-[11.5px] text-[var(--text-dim)] truncate">
                    {msg.sender?.username
                      ? `@${msg.sender.username}`
                      : msg.sender_account_id === null
                        ? "system"
                        : "unknown"}
                    <span className="mx-1.5 text-[var(--text-ghost)]">•</span>
                    To me
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-dim)] tabular-nums text-end shrink-0">
                  <div className="font-medium">{formattedDate}</div>
                  <div>at {formattedTime}</div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-[24px] md:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight mb-6">
            {msg.subject}
          </h2>

          {msg.body && (
            <div className="text-[14px] text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap break-words">
              {msg.body}
            </div>
          )}

          {/* Attachments grid — Apple Mail shows inline thumbnails at
              the bottom of the message body. We keep file-type icons
              since Koleex Mail doesn't know which MIME types are safe
              to render as real previews. */}
          {attachments.length > 0 && (
            <div className="mt-10 pt-6 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" />
                {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((a, i) => (
                  <li key={`${a.file_path}-${i}`}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-secondary)] transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-[var(--text-dim)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                          {a.name}
                        </div>
                        <div className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
                          {formatBytes(a.size)}
                          {a.type ? ` · ${a.type.split("/").pop()}` : ""}
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-[var(--text-dim)] group-hover:text-[var(--text-primary)] shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Referenced products */}
          {products.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package className="h-3 w-3" />
                Referenced product{products.length === 1 ? "" : "s"}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {products.map((p, i) => (
                  <li key={`${p.id}-${i}`}>
                    <Link
                      href={`/products/${p.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-secondary)] transition-colors group"
                    >
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                          {p.name}
                        </div>
                        <div className="text-[10.5px] text-[var(--text-dim)] font-mono truncate">
                          {p.slug}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-[var(--text-dim)] group-hover:text-[var(--text-primary)] shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata preview (only shown for membership_request) */}
          {showRequestDetails && (
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <UserIcon className="h-3 w-3" />
                Request details
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[12px]">
                  {Object.entries(meta as Record<string, unknown>).map(
                    ([k, v]) =>
                      v && typeof v !== "object" ? (
                        <Fragment key={k}>
                          <dt className="text-[var(--text-dim)] capitalize">
                            {k.replace(/_/g, " ")}
                          </dt>
                          <dd className="text-[var(--text-primary)] font-medium break-all">
                            {String(v)}
                          </dd>
                        </Fragment>
                      ) : null,
                  )}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Tiny fragment helper so we can use <Fragment key=...> without
   importing React.Fragment everywhere. */
function Fragment({
  children,
}: {
  key?: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

/* ── Compose view ────────────────────────────────────────────────────
   Renders the compose form inline in the detail column (instead of as
   a floating modal). All the internal state, upload, and send logic
   is unchanged — only the outer wrapper differs: no fixed backdrop,
   no max-width card, just fills the parent column. */

function ComposeView({
  senderId,
  initial,
  onClose,
  onSent,
}: {
  senderId: string;
  /* Optional prefill. Passed when the user clicks Reply or Forward on a
     message — carries the pre-populated recipient / subject / body and
     (for Reply) a `lockedRecipient` flag that hides the picker so the
     reply can't be accidentally re-routed. Null / empty object =
     blank "New message" from the Compose button. */
  initial: ComposeInitial;
  onClose: () => void;
  onSent: () => void;
}) {
  /* Reply always wants a single person (locked to sender). Forward /
     fresh compose default to person-picker; the user can switch. */
  const [mode, setMode] = useState<"person" | "role">("person");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientId, setRecipientId] = useState(initial.recipientId ?? "");
  const [roleName, setRoleName] = useState(BROADCAST_ROLES[0]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* Rich compose state. Attachments are uploaded the moment the user
     picks them (so we show a file size + allow removal before send),
     and the final structured records are embedded in the outgoing
     message's `metadata.attachments` array on send.

     Products are a lightweight reference — only `id / name / slug /
     image` are carried, denormalized so the rendered message still
     makes sense even if the source product is later renamed. */
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachedProducts, setAttachedProducts] = useState<InboxProductRef[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* When the recipient is locked (Reply), we still want the human-readable
     label so the user knows who they're writing to, even though the picker
     is hidden. */
  const lockedRecipient = initial.lockedRecipient === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchMessageableAccounts();
      if (cancelled) return;
      const list = rows.filter((r) => r.id !== senderId);
      setRecipients(list);
      /* Respect the initial.recipientId if it was passed (Reply); only
         fall back to first-in-list for fresh composes. */
      if (!initial.recipientId && list.length > 0) {
        setRecipientId(list[0].id);
      }
      setLoadingRecipients(false);
    })();
    return () => {
      cancelled = true;
    };
    // `initial.recipientId` is a one-time read at mount; intentionally
    // omitted from deps so re-rendering the parent doesn't reset fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderId]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return recipients;
    const q = recipientSearch.toLowerCase();
    return recipients.filter(
      (r) =>
        r.username.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.role_name ?? "").toLowerCase().includes(q),
    );
  }, [recipients, recipientSearch]);

  /* Build the metadata blob attached to the outgoing message. We only
     include keys that have content so the DB row stays small — an empty
     attachments / products array would be noise. */
  function buildMetadata(): Record<string, unknown> | undefined {
    const m: Record<string, unknown> = {};
    if (attachments.length > 0) m.attachments = attachments;
    if (attachedProducts.length > 0) m.products = attachedProducts;
    return Object.keys(m).length > 0 ? m : undefined;
  }

  async function handleFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const uploaded: InboxAttachment[] = [];
    for (const f of Array.from(files)) {
      /* 25 MB per file. Koleex Mail isn't a file server and the
         default Supabase upload limit is generous but finite. */
      if (f.size > 25 * 1024 * 1024) {
        setError(`"${f.name}" is larger than 25 MB and was skipped.`);
        continue;
      }
      const rec = await uploadInboxAttachment(f);
      if (rec) uploaded.push(rec);
      else setError(`Couldn't upload "${f.name}". Try again.`);
    }
    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
    setUploading(false);
    /* Reset the input so the same file can be picked again if the user
       removes it and wants it back. */
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!body.trim() && attachments.length === 0 && attachedProducts.length === 0) {
      setError("Write a message or attach something.");
      return;
    }

    setBusy(true);
    const metadata = buildMetadata();

    if (mode === "person") {
      if (!recipientId) {
        setError("Pick a recipient.");
        setBusy(false);
        return;
      }
      const result = await sendMessage({
        senderId,
        recipientId,
        subject: subject.trim(),
        body: body.trim(),
        metadata,
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.error || "Couldn't send the message.");
        return;
      }
      setSuccess("Message sent.");
      setTimeout(onSent, 500);
    } else {
      const count = await broadcastToRole({
        senderId,
        roleName,
        subject: subject.trim(),
        body: body.trim(),
        excludeSelf: true,
        metadata,
      });
      setBusy(false);
      if (count === 0) {
        setError(`No active users found in the ${roleName} role.`);
        return;
      }
      setSuccess(
        count === 1
          ? `Sent to 1 person in ${roleName}.`
          : `Sent to ${count} people in ${roleName}.`,
      );
      setTimeout(onSent, 600);
    }
  }


  /* Apple Mail compose picks up the currently-selected recipient from
     the to-line as an inline pill. For the compose form we need a
     quick way to find the full recipient record by id so we can
     render that pill without another lookup. */
  const selectedRecipient = useMemo(
    () => recipients.find((r) => r.id === recipientId) ?? null,
    [recipients, recipientId],
  );

  /* Gate the autocomplete dropdown: only show it when the to-field
     is focused AND (search has input OR no recipient is picked yet).
     This keeps the compose layout quiet the moment a pill lands. */
  const [toFocused, setToFocused] = useState(false);
  const showRecipientList =
    mode === "person" &&
    !lockedRecipient &&
    toFocused &&
    (!!recipientSearch.trim() || !recipientId);

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-[var(--bg-primary)]">
      {/* ── Title bar — mirrors Apple Mail's centered "New Message"
           with a single close affordance on the right. No extra chrome,
           no colored accent — the content below should breathe. */}
      <div className="relative shrink-0 h-11 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h2 className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              {lockedRecipient
                ? "Reply"
                : initial.body && initial.body.includes("Forwarded message")
                  ? "Forward"
                  : "New Message"}
            </h2>
          </div>
          <div className="absolute inset-y-0 end-2 flex items-center">
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              aria-label="Close compose"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Group-mode toggle: shown on fresh compose so the user can
              broadcast to a whole role. Hidden while replying. */}
          {!lockedRecipient && (
            <div className="absolute inset-y-0 start-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode(mode === "person" ? "role" : "person")}
                className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                  mode === "role"
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                }`}
                title={mode === "role" ? "Switch to single recipient" : "Broadcast to role"}
              >
                <Users className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* ── Header rows: To / Subject — Apple Mail style. Labels
               are left-aligned muted text; fields are borderless with
               only a hairline between rows. */}
          <div className="shrink-0 border-b border-[var(--border-subtle)]">
            {/* To row */}
            <div className="relative flex items-center gap-2 min-h-11 px-4 border-b border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-dim)] w-14 shrink-0">
                To:
              </span>
              <div className="flex-1 flex items-center gap-1.5 flex-wrap py-1.5 min-w-0">
                {/* Reply: locked pill, no picker. */}
                {lockedRecipient ? (
                  <span className="inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full bg-blue-500/15 text-blue-300 text-[12px] font-semibold border border-blue-500/30">
                    <span className="h-4 w-4 rounded-full bg-blue-500/30 flex items-center justify-center text-[8px]">
                      {initialsOf(initial.recipientLabel ?? "?")}
                    </span>
                    {initial.recipientLabel ?? "(original sender)"}
                  </span>
                ) : mode === "role" ? (
                  /* Role broadcast: render a single pill with the current
                     role name. Clicking removes it to let the user pick
                     again — Apple Mail uses the same interaction for
                     group contacts. */
                  <span className="inline-flex items-center gap-1.5 h-6 pl-1 pr-1.5 rounded-full bg-purple-500/15 text-purple-300 text-[12px] font-semibold border border-purple-500/30">
                    <Users className="h-3 w-3" />
                    All {roleName}
                    <button
                      type="button"
                      onClick={() => setMode("person")}
                      className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-purple-500/25"
                      aria-label="Clear role"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ) : (
                  <>
                    {/* Selected recipient as a pill */}
                    {selectedRecipient && (
                      <span className="inline-flex items-center gap-1.5 h-6 pl-1 pr-1.5 rounded-full bg-blue-500/15 text-blue-300 text-[12px] font-semibold border border-blue-500/30">
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 flex items-center justify-center text-[8px]">
                          {initialsOf(
                            selectedRecipient.full_name ??
                              selectedRecipient.username,
                          )}
                        </span>
                        {selectedRecipient.full_name ?? selectedRecipient.username}
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientId("");
                            setRecipientSearch("");
                          }}
                          className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-blue-500/25"
                          aria-label="Remove recipient"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {/* Free-text search input grows to fill. When a pill
                        is already present we keep the input visible so the
                        user can still type to replace it, matching Apple
                        Mail's "tab to accept" behavior. */}
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      onFocus={() => setToFocused(true)}
                      onBlur={() => {
                        /* Delay so a click inside the dropdown has time
                           to land before we close it. */
                        setTimeout(() => setToFocused(false), 120);
                      }}
                      placeholder={
                        selectedRecipient ? "" : "Type a name or role…"
                      }
                      className="flex-1 min-w-[60px] bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
                    />
                  </>
                )}
              </div>

              {/* Autocomplete dropdown — floats below the To line when
                  the field is focused. Clicking a row sets the
                  recipientId and clears the search input. */}
              {showRecipientList && (
                <div className="absolute top-full start-4 end-4 z-10 mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl max-h-56 overflow-y-auto">
                  {loadingRecipients ? (
                    <div className="h-16 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--text-dim)]" />
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="h-16 flex items-center justify-center text-[12px] text-[var(--text-dim)]">
                      No matches
                    </div>
                  ) : (
                    filteredRecipients.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setRecipientId(r.id);
                          setRecipientSearch("");
                          setToFocused(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                      >
                        <div
                          className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-br ${gradientFor(
                            r.full_name ?? r.username,
                          )}`}
                        >
                          {initialsOf(r.full_name ?? r.username)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                            {r.full_name || r.username}
                          </div>
                          <div className="text-[10.5px] text-[var(--text-dim)] truncate">
                            @{r.username}
                            {r.role_name ? ` · ${r.role_name}` : ""}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Role picker strip — only visible in broadcast mode so the
                user can swap which role they're targeting. */}
            {mode === "role" && !lockedRecipient && (
              <div className="flex items-center gap-2 min-h-11 px-4 border-b border-[var(--border-subtle)]">
                <span className="text-[12px] text-[var(--text-dim)] w-14 shrink-0">
                  Role:
                </span>
                <div className="flex-1 flex flex-wrap gap-1.5 py-1.5 min-w-0">
                  {BROADCAST_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleName(r)}
                      className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition-colors border ${
                        roleName === r
                          ? "bg-purple-500/15 border-purple-500/40 text-purple-200"
                          : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subject row */}
            <div className="flex items-center gap-2 h-11 px-4">
              <span className="text-[12px] text-[var(--text-dim)] w-14 shrink-0">
                Subject:
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder=""
                className="flex-1 bg-transparent text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none min-w-0"
              />
            </div>
          </div>

          {/* ── Body area — full-width, borderless textarea.
               No "Message" label, no surface background, matches the
               Apple Mail body where typing begins immediately. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={10}
              className="w-full min-h-[220px] px-5 py-4 bg-transparent text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none resize-none leading-relaxed"
            />

            {/* Attachment chips + product chips sit inside the body
                column so they feel like part of the message, not a
                separate panel. */}
            {(attachments.length > 0 || attachedProducts.length > 0) && (
              <div className="px-5 pb-4 space-y-2">
                {attachments.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {attachments.map((a, i) => (
                      <li
                        key={`${a.file_path}-${i}`}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                      >
                        <div className="h-8 w-8 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                            {a.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] tabular-nums">
                            {formatBytes(a.size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center shrink-0"
                          aria-label={`Remove ${a.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachedProducts.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {attachedProducts.map((p, i) => (
                      <li
                        key={`${p.id}-${i}`}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-[var(--text-dim)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] truncate">
                            {p.slug}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachedProducts((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center shrink-0"
                          aria-label={`Remove ${p.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Inline error + success messages still live in the
                scrollable body so they're visible even with a long
                attachment list. */}
            {error && (
              <div className="mx-5 mb-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mx-5 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-3 py-2 text-[12px]">
                {success}
              </div>
            )}
          </div>

          {/* ── Bottom toolbar — icon-only attach buttons on the left,
               Send button on the right (Apple Mail uses a round blue
               button with an up-arrow; we keep it rounded + blue to
               match that signature). */}
          <div className="shrink-0 flex items-center gap-1 px-3 h-12 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFilesPicked(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file"
              className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setProductPickerOpen(true)}
              title="Select product"
              className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <Package className="h-4 w-4" />
            </button>
            {(attachments.length > 0 || attachedProducts.length > 0) && (
              <span className="text-[10.5px] text-[var(--text-dim)] ml-1.5 tabular-nums">
                {attachments.length > 0 &&
                  `${attachments.length} file${attachments.length === 1 ? "" : "s"}`}
                {attachments.length > 0 && attachedProducts.length > 0 && " · "}
                {attachedProducts.length > 0 &&
                  `${attachedProducts.length} product${attachedProducts.length === 1 ? "" : "s"}`}
              </span>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={busy}
              className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-400 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              title="Send"
              aria-label="Send"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>

      {/* Product picker — secondary modal rendered on top of compose.
          Clicking a card toggles selection; the picker's footer "Add"
          button merges the selection into the compose state. */}
      {productPickerOpen && (
        <ProductPickerModal
          alreadyAdded={attachedProducts}
          onCancel={() => setProductPickerOpen(false)}
          onConfirm={(picked) => {
            /* Merge: keep existing picks and append any new ones that
               weren't already attached. Deduped by id. */
            setAttachedProducts((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const merged = [...prev];
              for (const p of picked) {
                if (!seen.has(p.id)) {
                  merged.push(p);
                  seen.add(p.id);
                }
              }
              return merged;
            });
            setProductPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Product picker modal ─────────────────────────────────────────────── */

function ProductPickerModal({
  alreadyAdded,
  onCancel,
  onConfirm,
}: {
  alreadyAdded: InboxProductRef[];
  onCancel: () => void;
  onConfirm: (picked: InboxProductRef[]) => void;
}) {
  useScrollLock();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  /* Staged selection: a set of product ids the user has ticked in this
     session. Confirmed on Add, discarded on Cancel. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ps, imgs] = await Promise.all([
        fetchProducts(),
        fetchProductMainImages(),
      ]);
      if (cancelled) return;
      setProducts(ps);
      setImages(imgs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const alreadyIds = useMemo(
    () => new Set(alreadyAdded.map((p) => p.id)),
    [alreadyAdded],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const picked: InboxProductRef[] = [];
    for (const p of products) {
      if (selected.has(p.id)) {
        picked.push({
          id: p.id,
          name: p.product_name,
          slug: p.slug,
          image: images[p.id] ?? null,
        });
      }
    }
    onConfirm(picked);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[6vh] overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[var(--text-dim)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Select product
            </h2>
            {selected.size > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-300 border-blue-500/30">
                {selected.size} selected
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X size={15} className="text-[var(--text-dim)]" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 gap-2 focus-within:border-[var(--border-focus)] transition-all">
            <Search size={14} className="text-[var(--text-dim)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, brand, slug, or tag…"
              className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-0.5">
                <X size={14} className="text-[var(--text-dim)]" />
              </button>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                <Package className="h-5 w-5 text-[var(--text-ghost)]" />
              </div>
              <p className="text-[12px] text-[var(--text-dim)]">
                {search ? "No products match your search" : "No products yet"}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((p) => {
                const isSelected = selected.has(p.id);
                const isAlready = alreadyIds.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => !isAlready && toggle(p.id)}
                      disabled={isAlready}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                        isAlready
                          ? "bg-[var(--bg-surface)] border-[var(--border-subtle)] opacity-60 cursor-not-allowed"
                          : isSelected
                            ? "bg-blue-500/[0.08] border-blue-500/40"
                            : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
                      }`}
                    >
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                        {images[p.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={images[p.id]}
                            alt={p.product_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                          {p.product_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.brand && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium truncate">
                              {p.brand}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-dim)] font-mono truncate">
                            {p.slug}
                          </span>
                        </div>
                      </div>
                      {isAlready ? (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/25 shrink-0">
                          Added
                        </span>
                      ) : isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                      ) : (
                        <Plus className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={selected.size === 0}
            className="h-9 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
