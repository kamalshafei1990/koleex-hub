"use client";

/* ---------------------------------------------------------------------------
   /inbox — the notification center.

   It was "Koleex Mail": a mail client (Compose, Reply, Forward, attach a
   file, reference a product) showing notifications as if they were letters.
   In the month measured there was not one message between two people —
   conversations live in Discuss — so the owner retired the mail and kept
   the place (26/09/2026): every notification the Hub sent you, the same rows
   as the bell, with room to read, filter and search.

     · Views  All (the work) · Needs you · Security (Super Admins) · Unread ·
       Archive — the bell's tabs plus the two a full page has room for.
     · Apps   narrow any view to one app (the registry's app, its icon).
     · Rows   the bell's list (NotificationList): day sections, two-line rows,
       folded repeats, read / archive in place.
     · Read   the whole notification in the reader's language, and the way
       into the app it is about. A membership request is decided right here,
       through the reviewers' API (the decision is recorded, and every other
       reviewer's copy clears).

   Layout follows THIS page's width (@container), not the window's: one pane
   under 45rem, list + reading pane from 45rem, and the views/apps rail from
   68rem.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSkin } from "@/lib/appearance";
import { useToast } from "@/components/kds/useToast";
import KdsSelect from "@/components/kds/Select";
import BoundIcon from "@/components/common/BoundIcon";
import { BACK_CHROME } from "@/components/ui/back-chrome";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";
import { NotificationBody, NotificationSubject } from "@/components/layout/NotificationText";
import {
  NotificationSections,
  NotificationSkeleton,
  notifTimeAgo,
  type ListActions,
} from "@/components/layout/NotificationList";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import CheckCheckIcon from "@/components/icons/ui/CheckCheckIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import MailOpenIcon from "@/components/icons/ui/MailOpenIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import XCircleIcon from "@/components/icons/ui/XCircleIcon";
import {
  archiveMessages,
  fetchInboxMessagesOrNull,
  markMessageRead,
  markMessagesRead,
  markMessagesUnread,
  subscribeToInboxMessages,
  type InboxAttachment,
  type InboxProductRef,
} from "@/lib/inbox";
import { useCurrentAccount, useCurrentAccountId, getCurrentAccountIdSync } from "@/lib/identity";
import { readWarmMailFeed, writeWarmMailFeed } from "@/lib/inbox-warm";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import { notifUiT } from "@/lib/translations/notif-ui";
import { APP_REGISTRY } from "@/lib/navigation";
import { defOf, inTab, isSecurity } from "@/lib/notification-view";
import { partsText, renderNotification } from "@/lib/notification-templates";
import { dmy, discussTime } from "@/lib/discuss-time";
import type { InboxMessageWithSender } from "@/types/supabase";

/* ssr:false — the canvas has no server rendering, and mounting it only under
   Aurora is the ONE JavaScript branch the skin system allows itself. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

type View = "all" | "action" | "security" | "unread" | "archive";
type Msg = InboxMessageWithSender;

function inView(m: Msg, view: View): boolean {
  if (view === "archive") return !!m.archived_at;
  if (m.archived_at) return false;
  if (view === "unread") return !m.read_at;
  return inTab(m, view);
}

const VIEW_LABEL: Record<View, string> = {
  all: "tab.all",
  action: "tab.action",
  security: "tab.security",
  unread: "view.unread",
  archive: "view.archive",
};

/* The membership request a notification is about. The writer stores
   `membership_request_id`; rows from before 26/09 carried `request_id`. */
const requestIdOf = (m: Msg): string | null => {
  const meta = (m.metadata ?? null) as Record<string, unknown> | null;
  const id = meta?.membership_request_id ?? meta?.request_id;
  return typeof id === "string" && id ? id : null;
};

const appOf = (m: Msg) => {
  const id = defOf(m.metadata)?.app;
  return id ? APP_REGISTRY.find((a) => a.id === id) ?? null : null;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NotificationCenterPage() {
  const { account, loading: accountLoading } = useCurrentAccount();
  const accountId = account?.id ?? null;
  const aurora = useSkin() === "aurora";
  const router = useRouter();
  const { t: tHub, lang } = useTranslation(hubT);
  const { t: tUi } = useTranslation(notifUiT);
  const { showToast, toastElement } = useToast();

  /* Deep links: the bell and the membership fan-out may point here with
     ?id=<inbox row> or ?request=<membership request>. */
  const searchParams = useSearchParams();
  const deepLinkRequestId = searchParams?.get("request") ?? null;
  const deepLinkMessageId = searchParams?.get("id") ?? null;

  /* Painted from the last answer (inbox-warm, full rows — the reading pane
     needs the whole metadata), refreshed underneath. */
  const [messages, setMessages] = useState<Msg[]>(() => readWarmMailFeed(getCurrentAccountIdSync()) ?? []);
  const [loading, setLoading] = useState(() => messages.length === 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [appFilter, setAppFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  /* One pane under 45rem: the list, or the open notification. */
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [deepLinkConsumed, setDeepLinkConsumed] = useState(false);

  /* The list needs only the id, which sits in localStorage from the first
     render — never wait for the whole profile (that cost 1.6 s, 26/09). */
  const quickAccountId = useCurrentAccountId();
  const feedAccountId = quickAccountId ?? accountId;
  const loadedRef = useRef(false);
  /* Every state change lands after the answer — none synchronously in the
     effect that starts it. No account: nothing to fetch (the page renders
     its signed-out state). null = the request failed: keep what is on
     screen. */
  const applyRows = useCallback((rows: Msg[] | null) => {
    if (rows) {
      loadedRef.current = true;
      setMessages(rows);
    }
    setLoading(false);
  }, []);
  const loadMessages = useCallback(async () => {
    if (!feedAccountId) return;
    applyRows(await fetchInboxMessagesOrNull({ includeArchived: true, limit: 200 }));
  }, [feedAccountId, applyRows]);

  useEffect(() => {
    if (!feedAccountId) return;
    let alive = true;
    fetchInboxMessagesOrNull({ includeArchived: true, limit: 200 }).then((rows) => { if (alive) applyRows(rows); });
    return () => { alive = false; };
  }, [feedAccountId, applyRows]);

  /* Keep the stored list in step with the screen, once a real answer came. */
  useEffect(() => {
    if (loadedRef.current) writeWarmMailFeed(feedAccountId, messages);
  }, [messages, feedAccountId]);

  /* Live: a new row reloads the list; a burst collapses into one reload. */
  useEffect(() => {
    if (!accountId) return;
    let timer: number | null = null;
    return subscribeToInboxMessages(accountId, () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => { timer = null; void loadMessages(); }, 400);
    });
  }, [accountId, loadMessages]);

  /* ── Shaping ─────────────────────────────────────────────────────────── */
  const hasSecurity = useMemo(() => messages.some((m) => isSecurity(m.metadata)), [messages]);
  const views: View[] = hasSecurity ? ["all", "action", "security", "unread", "archive"] : ["all", "action", "unread", "archive"];

  /* A count is things needing attention (unread) — except Archive, which
     shows how much is there. */
  const counts = useMemo(() => {
    const c: Record<View, number> = { all: 0, action: 0, security: 0, unread: 0, archive: 0 };
    for (const m of messages) {
      for (const v of ["all", "action", "security", "unread", "archive"] as View[]) {
        if (!inView(m, v)) continue;
        if (v === "archive" || !m.read_at) c[v] += 1;
      }
    }
    return c;
  }, [messages]);

  const inCurrentView = useMemo(() => messages.filter((m) => inView(m, view)), [messages, view]);

  /* The apps this view holds, with how much each has — the rail's second
     list and the narrow screens' app picker. */
  const apps = useMemo(() => {
    const by = new Map<string, number>();
    for (const m of inCurrentView) {
      const a = appOf(m);
      if (a) by.set(a.id, (by.get(a.id) ?? 0) + 1);
    }
    return [...by.entries()]
      .map(([id, n]) => ({ app: APP_REGISTRY.find((a) => a.id === id)!, n }))
      .sort((x, y) => y.n - x.n);
  }, [inCurrentView]);

  /* Search reads what the reader SEES (the template in their language) as
     well as the stored English, the body and the sender. */
  const filtered = useMemo(() => {
    let list = appFilter ? inCurrentView.filter((m) => appOf(m)?.id === appFilter) : inCurrentView;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const r = renderNotification(m.metadata, lang);
        const hay = [
          m.subject,
          m.body ?? "",
          r ? partsText(r.subject) : "",
          r?.body ? partsText(r.body) : "",
          m.sender?.full_name ?? "",
          m.sender?.username ?? "",
        ].join("\n").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [inCurrentView, appFilter, search, lang]);

  /* Switching view drops an app filter the new view does not have. */
  const appFilterLive = appFilter && apps.some((a) => a.app.id === appFilter) ? appFilter : "";
  if (appFilterLive !== appFilter) setAppFilter(appFilterLive);

  const selected = useMemo(() => messages.find((m) => m.id === selectedId) ?? null, [messages, selectedId]);

  /* ── Actions (optimistic; one request for the lot) ────────────────────── */
  function setRowsRead(rows: Msg[], read: boolean) {
    const change = rows.filter((m) => !!m.read_at !== read);
    if (change.length === 0) return;
    const ids = new Set(change.map((m) => m.id));
    const nowIso = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, read_at: read ? nowIso : null } : m)));
    void (read ? markMessagesRead([...ids]) : markMessagesUnread([...ids]));
  }

  function archiveRows(rows: Msg[]) {
    const live = rows.filter((m) => !m.archived_at);
    if (live.length === 0) return;
    const ids = new Set(live.map((m) => m.id));
    const nowIso = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, archived_at: nowIso } : m)));
    if (selectedId && ids.has(selectedId)) {
      setSelectedId(null);
      setMobileView("list");
    }
    void archiveMessages([...ids]);
  }

  /* Opening a notification is what reads it — nothing is selected (and
     nothing silently marked read) just because the page opened. */
  function openRow(m: Msg) {
    setSelectedId(m.id);
    setMobileView("detail");
    if (!m.read_at) {
      const nowIso = new Date().toISOString();
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: nowIso } : x)));
      void markMessageRead(m.id);
    }
  }

  /* First answer in: honour ?id= / ?request= once (during render, the
     "adjust state when data arrives" pattern), widening to the view that
     holds the target so the reading pane can show it. */
  if (!deepLinkConsumed && !loading) {
    setDeepLinkConsumed(true);
    const target =
      (deepLinkMessageId && messages.find((m) => m.id === deepLinkMessageId)) ||
      (deepLinkRequestId && messages.find((m) => requestIdOf(m) === deepLinkRequestId)) ||
      null;
    if (target) {
      if (target.archived_at) setView("archive");
      else if (isSecurity(target.metadata)) setView("security");
      openRow(target);
    }
  }

  const listActions: ListActions<Msg> = {
    onOpen: openRow,
    onSetRead: setRowsRead,
    onArchive: archiveRows,
  };

  /* Mark read — what the reader is looking at (this view, this app, this
     search): its unread rows, in one request. */
  function markViewRead() {
    if (view === "archive") return;
    setRowsRead(filtered.filter((m) => !m.read_at), true);
  }
  const viewUnread = view === "archive" ? 0 : filtered.filter((m) => !m.read_at).length;

  /* A membership request decided here goes through the reviewers' API: the
     decision is recorded (who, when, why), and every other reviewer's copy
     of this notification clears. A refusal needs its reason — the API says
     so, and the applicant will ask why. */
  async function decideRequest(m: Msg, status: "approved" | "rejected", note: string): Promise<boolean> {
    const id = requestIdOf(m);
    if (!id) { showToast(tUi("mod.noRequest"), "error"); return false; }
    const res = await fetch(`/api/membership-requests/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note || null }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const j = (await res?.json().catch(() => null)) as { error?: string } | null;
      showToast(j?.error ?? tUi("mod.failed"), "error");
      return false;
    }
    archiveRows([m]);
    showToast(status === "approved" ? tUi("mod.approved") : tUi("mod.rejected"), "success");
    return true;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (accountLoading && !feedAccountId) return <DirectoryListSkeleton label={tHub("notif.title")} />;

  if (!feedAccountId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-primary)] p-6">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-surface)] text-[var(--text-dim)]">
          <BellIcon size={20} />
        </div>
        <Link href="/" className="flex h-9 items-center rounded-xl bg-[var(--bg-inverted)] px-4 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90">
          Hub
        </Link>
      </div>
    );
  }

  const emptyText =
    search.trim() ? tUi("empty.search")
    : view === "action" ? tUi("empty.action")
    : view === "security" ? tUi("empty.security")
    : view === "unread" ? tUi("empty.unread")
    : view === "archive" ? tUi("empty.archive")
    : tHub("notif.caughtUp");

  const viewButton = (v: View, compact: boolean) => {
    const active = view === v;
    const n = counts[v];
    return (
      <button
        key={v}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => { setView(v); setSelectedId(null); setMobileView("list"); }}
        className={
          compact
            ? `flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
                active
                  ? aurora ? "kx-chip-on border-transparent text-[var(--text-primary)]" : "border-[var(--bg-inverted)] bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`
            : `flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-start text-[12.5px] font-medium transition-colors ${
                active
                  ? aurora ? "kx-seg-on text-[var(--text-primary)]" : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              }`
        }
      >
        <span className="min-w-0 flex-1 truncate">{tUi(VIEW_LABEL[v])}</span>
        {n > 0 && (
          <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
            v === "security" ? "bg-red-500/15 text-red-500" : active && !aurora ? "bg-[var(--text-inverted)]/20" : "bg-[#567FB2]/15 text-[#567FB2]"
          }`}>
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
    );
  };

  return (
    /* flex-1 + min-h-0 fills the space BELOW the Hub's fixed header; kx-app
       remaps the surfaces for Aurora and matches nothing under Core. */
    <div className="@container kx-app relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {aurora && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}

      {/* Title strip — tint, not blur: the Hub's header pane above already
          frosts, and two filtered bands stack badly. */}
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 md:px-5">
        {/* One back control at a time, one level up: the list while a
            notification is open on a phone, the Hub otherwise. */}
        {mobileView === "detail" ? (
          <>
            <button type="button" onClick={() => setMobileView("list")} className={`${BACK_CHROME} @[45rem]:hidden`} aria-label={tHub("notif.title")}>
              <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
            </button>
            <Link href="/" className={`${BACK_CHROME} hidden @[45rem]:flex`} aria-label="Hub">
              <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
              <span className="hidden text-[12px] font-medium sm:inline">Hub</span>
            </Link>
          </>
        ) : (
          <Link href="/" className={BACK_CHROME} aria-label="Hub">
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
            <span className="hidden text-[12px] font-medium sm:inline">Hub</span>
          </Link>
        )}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <BellIcon size={16} />
          </div>
          <h1 className="truncate text-[15px] font-bold tracking-tight md:text-[18px]">{tHub("notif.title")}</h1>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          data-kx-keep-hover
          onClick={markViewRead}
          disabled={viewUnread === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
        >
          <CheckCheckIcon className="h-3.5 w-3.5" />
          <span className="hidden @[30rem]:inline">{tHub("notif.markAllRead")}</span>
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* ── Rail (≥ 68rem): views, then apps ───────────────────────── */}
        <aside className="kx-glass-drawer hidden w-[230px] shrink-0 overflow-y-auto border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)] @[68rem]:flex @[68rem]:flex-col">
          <div role="tablist" aria-label={tHub("notif.title")} className="flex flex-col gap-0.5 p-3">
            {views.map((v) => viewButton(v, false))}
          </div>
          {apps.length > 0 && (
            <div className="px-3 pb-3">
              <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{tUi("center.apps")}</div>
              <div className="flex flex-col gap-0.5">
                {[{ app: null, n: inCurrentView.length }, ...apps].map(({ app, n }) => {
                  const active = (app?.id ?? "") === appFilter;
                  const Icon = app?.icon;
                  return (
                    <button
                      key={app?.id ?? "all"}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setAppFilter(app?.id ?? ""); setSelectedId(null); }}
                      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-start text-[12.5px] transition-colors ${
                        active
                          ? aurora ? "kx-seg-on font-medium text-[var(--text-primary)]" : "bg-[var(--bg-surface-strong)] font-medium text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center text-[var(--text-dim)]">
                        {app && Icon ? <BoundIcon semanticKey={`app.${app.id}`} className="h-3.5 w-3.5" fallback={<Icon size={14} />} /> : <BellIcon size={13} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{app ? tHub(app.tKey, app.name) : tUi("center.allApps")}</span>
                      <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ── List ────────────────────────────────────────────────────── */}
        <section
          aria-label={tHub("notif.title")}
          className={`kx-glass-drawer min-w-0 flex-col border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)] @[45rem]:flex @[45rem]:w-[360px] @[45rem]:shrink-0 @[80rem]:w-[400px] ${
            mobileView === "list" ? "flex w-full" : "hidden"
          }`}
        >
          <div className="shrink-0 space-y-2 border-b border-[var(--border-subtle)] p-3">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3">
              <SearchIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tUi("center.search")}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
              />
            </label>
            {/* Under 68rem the rail is gone: views as chips (they wrap —
                nothing hides behind a sideways scroll), apps as a picker. */}
            <div className="flex flex-col gap-2 @[68rem]:hidden">
              <div role="tablist" aria-label={tHub("notif.title")} className="flex flex-wrap gap-1.5">
                {views.map((v) => viewButton(v, true))}
              </div>
              {apps.length > 1 && (
                <KdsSelect
                  value={appFilter}
                  onChange={(v) => { setAppFilter(v); setSelectedId(null); }}
                  placeholder={tUi("center.allApps")}
                  options={apps.map(({ app, n }) => ({ value: app.id, label: `${tHub(app.tKey, app.name)} · ${n}` }))}
                  triggerClassName="flex h-8 w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[12px] text-[var(--text-secondary)]"
                />
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {filtered.length > 0 && (
              <NotificationSections
                rows={filtered}
                lang={lang}
                tHub={tHub}
                tUi={tUi}
                time={(iso) => notifTimeAgo(iso, tHub)}
                actions={listActions}
                selectedId={selectedId}
              />
            )}
            {loading && messages.length === 0 && <NotificationSkeleton rows={6} />}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]">
                  <BellIcon size={18} />
                </div>
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">{emptyText}</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Reading pane ─────────────────────────────────────────────── */}
        <main className={`min-w-0 flex-1 flex-col @[45rem]:flex ${mobileView === "detail" ? "flex" : "hidden"}`}>
          {selected ? (
            <Detail
              key={selected.id}
              msg={selected}
              lang={lang}
              tHub={tHub}
              tUi={tUi}
              onToggleRead={() => setRowsRead([selected], !selected.read_at)}
              onArchive={() => archiveRows([selected])}
              onOpenLink={(href) => router.push(href)}
              onDecide={(status, note) => decideRequest(selected, status, note)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-surface)] text-[var(--text-faint)]">
                <MailOpenIcon className="h-5 w-5" />
              </div>
              <p className="text-[12.5px] text-[var(--text-dim)]">{tUi("center.pick")}</p>
            </div>
          )}
        </main>
      </div>
      {toastElement}
    </div>
  );
}

/* ── The reading pane ───────────────────────────────────────────────────── */

type TFn = (key: string, fallback?: string) => string;

function Detail({
  msg, lang, tHub, tUi, onToggleRead, onArchive, onOpenLink, onDecide,
}: {
  msg: Msg;
  lang: "en" | "zh" | "ar";
  tHub: TFn;
  tUi: TFn;
  onToggleRead: () => void;
  onArchive: () => void;
  onOpenLink: (href: string) => void;
  onDecide: (status: "approved" | "rejected", note: string) => Promise<boolean>;
}) {
  const app = appOf(msg);
  const Icon = app?.icon;
  const sender = msg.sender?.full_name || msg.sender?.username || null;
  const created = new Date(msg.created_at);
  const meta = (msg.metadata ?? null) as Record<string, unknown> | null;
  const attachments = Array.isArray(meta?.attachments) ? (meta!.attachments as InboxAttachment[]) : [];
  const products = Array.isArray(meta?.products) ? (meta!.products as InboxProductRef[]) : [];
  const isRequest = msg.category === "membership_request";
  const canDecide = isRequest && !msg.archived_at && !!requestIdOf(msg);
  const [deciding, setDeciding] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /* The applicant's form, as sent — without the plumbing keys. Only when
     the row has no body: the request's body already IS that form. */
  const requestFields = isRequest && meta && !msg.body
    ? Object.entries(meta).filter(([k, v]) => v && typeof v !== "object" && !/^(type|kind|tpl)$|_id$/.test(k))
    : [];

  const iconBtn =
    "grid h-8 w-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]";

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3">
        <button type="button" data-kx-keep-hover onClick={onToggleRead} className={iconBtn}
          aria-label={msg.read_at ? tUi("markUnread") : tUi("markRead")} title={msg.read_at ? tUi("markUnread") : tUi("markRead")}>
          {msg.read_at ? <EnvelopeIcon className="h-4 w-4" /> : <MailOpenIcon className="h-4 w-4" />}
        </button>
        {!msg.archived_at && (
          <button type="button" data-kx-keep-hover onClick={onArchive} className={iconBtn} aria-label={tUi("archive")} title={tUi("archive")}>
            <ArchiveIcon className="h-4 w-4" />
          </button>
        )}
        {canDecide && (
          <>
            <span className="mx-1.5 h-5 w-px bg-[var(--border-subtle)]" />
            <button type="button" data-kx-keep-hover onClick={() => { setDeciding("approved"); setNote(""); }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/25">
              <CheckCircleIcon className="h-3 w-3" />
              {tUi("mod.approve")}
            </button>
            <button type="button" data-kx-keep-hover onClick={() => { setDeciding("rejected"); setNote(""); }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-3 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-500/25">
              <XCircleIcon className="h-3 w-3" />
              {tUi("mod.reject")}
            </button>
          </>
        )}
      </div>

      {deciding && (
        <div className={`flex shrink-0 flex-col gap-2 border-b border-[var(--border-subtle)] px-6 py-3 ${deciding === "approved" ? "bg-emerald-500/[0.05]" : "bg-red-500/[0.05]"}`}>
          <p className="text-[11.5px] text-[var(--text-muted)]">{deciding === "approved" ? tUi("mod.approveHint") : tUi("mod.rejectHint")}</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={deciding === "approved" ? tUi("mod.notePh") : tUi("mod.reasonPh")}
            className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={() => setDeciding(null)} className="h-8 rounded-lg px-3 text-[11px] font-semibold text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]">
              {tUi("mod.cancel")}
            </button>
            <button
              type="button"
              disabled={busy || (deciding === "rejected" && !note.trim())}
              onClick={async () => {
                setBusy(true);
                const ok = await onDecide(deciding, note.trim());
                setBusy(false);
                if (ok) setDeciding(null);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                deciding === "approved"
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                  : "border border-red-500/40 bg-red-500/15 text-red-500 hover:bg-red-500/25"
              }`}
            >
              {deciding === "approved" ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
              {deciding === "approved" ? tUi("mod.confirmApprove") : tUi("mod.confirmReject")}
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-6 py-8 md:px-10">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
              {app && Icon ? <BoundIcon semanticKey={`app.${app.id}`} className="h-5 w-5" fallback={<Icon size={20} />} /> : <BellIcon size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {app ? tHub(app.tKey, app.name) : tHub("notif.title")}
              </div>
              <div className="truncate text-[11.5px] text-[var(--text-dim)]">
                {sender && <>{sender} · </>}
                <span className="tabular-nums">{dmy(created)} · {discussTime(msg.created_at, lang)}</span>
              </div>
            </div>
          </div>

          <h2 className="mb-5 text-[22px] font-bold leading-tight tracking-tight text-[var(--text-primary)] md:text-[26px]">
            <NotificationSubject meta={msg.metadata} subject={msg.subject} lang={lang} />
          </h2>

          <NotificationBody
            meta={msg.metadata}
            body={msg.body}
            lang={lang}
            className="whitespace-pre-wrap break-words text-[14px] leading-[1.7] text-[var(--text-secondary)]"
          />

          {msg.link && (
            <button
              type="button"
              onClick={() => onOpenLink(msg.link!)}
              className="mt-6 flex h-9 items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            >
              {app ? tUi("detail.open").replace("{app}", tHub(app.tKey, app.name)) : tUi("detail.openLink")}
              <ExternalLinkIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </button>
          )}

          {/* Rows from the mail era may carry files or product references. */}
          {attachments.length > 0 && (
            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{tUi("detail.attachments")}</div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {attachments.map((a, i) => (
                  <li key={`${a.file_path}-${i}`}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-focus)]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <DocumentIcon className="h-4 w-4 text-[var(--text-dim)]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{a.name}</span>
                        <span className="block text-[10.5px] tabular-nums text-[var(--text-dim)]">{formatBytes(a.size)}</span>
                      </span>
                      <DownloadIcon className="h-4 w-4 shrink-0 text-[var(--text-dim)] group-hover:text-[var(--text-primary)]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {products.length > 0 && (
            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{tUi("detail.products")}</div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {products.map((p, i) => (
                  <li key={`${p.id}-${i}`}>
                    <Link href={`/products/${p.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-focus)]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        {p.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                          : <PackageIcon className="h-4 w-4 text-[var(--text-dim)]" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {requestFields.length > 0 && (
            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{tUi("detail.request")}</div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[12px]">
                {requestFields.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="capitalize text-[var(--text-dim)]">{k.replace(/_/g, " ")}</dt>
                    <dd className="break-all font-medium text-[var(--text-primary)]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
