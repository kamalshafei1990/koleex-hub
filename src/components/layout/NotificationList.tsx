"use client";

/* ---------------------------------------------------------------------------
   NotificationList — the rows of the bell (and of the notification center):
   day sections, two-line rows, folded repeats, quick actions, a skeleton.

   A row is two lines: the app's own icon (the Semantic Icon Registry's
   app.<id>, the same glyph as the launcher and the sidebar), the subject in
   the reader's language and the time; then the body, or the sender. Unread
   = a Hub Blue dot and a heavier subject. Mark read / unread and archive
   sit on the row's end on hover or keyboard focus.

   Shaping (tabs, sections, groups) is lib/notification-view; words are
   translations/notif-ui (+ hubT for app names); the text of each row is
   NotificationText (templates in the reader's language, older rows through
   auto-translation). Tokens only (--text-*, --bg-*), so both skins and both
   themes read it the same way.
   --------------------------------------------------------------------------- */

import { lazy, Suspense, useState } from "react";
import BoundIcon from "@/components/common/BoundIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import MailOpenIcon from "@/components/icons/ui/MailOpenIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import ChevronDownIcon from "@/components/icons/ui/ChevronDownIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import { clockText } from "@/lib/notification-pause";
import { canMute } from "@/lib/notification-mute";

/* The ⋯ panel (Later, Mute) loads when first opened (NotificationMore). */
const MorePanel = lazy(() => import("./NotificationMore").then((m) => ({ default: m.MorePanel })));
import { APP_REGISTRY } from "@/lib/navigation";
import { NotificationBody, NotificationSubject, useRenderedNotification } from "@/components/layout/NotificationText";
import { byWaiting, defOf, isWaiting, sectionize, waitOf, type DaySection, type ViewRow } from "@/lib/notification-view";
import { partsText, templateParts } from "@/lib/notification-templates";
import { decide, decisionOf, type Verdict } from "@/lib/notification-decisions";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import XCircleIcon from "@/components/icons/ui/XCircleIcon";
import { dmy } from "@/lib/discuss-time";
import type { Lang } from "@/lib/i18n";

export type ListRow = ViewRow & {
  body: string | null;
  link: string | null;
  archived_at?: string | null;
  /** Put off until then (the center's "Later" view). */
  snoozed_until?: string | null;
  sender?: { full_name?: string | null; username?: string | null } | null;
};

type TFn = (key: string, fallback?: string) => string;

/** "5m ago" … "3d ago", then the date — day first, always (owner rule;
 *  toLocaleDateString() took the browser's locale and printed 9/18/2026).
 *  `t` is hubT's (notif.justNow / minAgo / hourAgo / dayAgo). */
export function notifTimeAgo(iso: string, t: TFn): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return t("notif.justNow");
  if (minutes < 60) return t("notif.minAgo").replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notif.hourAgo").replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7) return t("notif.dayAgo").replace("{n}", String(days));
  return dmy(new Date(iso), true);
}

export interface ListActions<R extends ListRow> {
  onOpen: (row: R) => void;
  onSetRead: (rows: R[], read: boolean) => void;
  onArchive: (rows: R[]) => void;
  /** A decision was taken on the row (DecisionBar) — the row's work is done. */
  onDecided?: (row: R, verdict: Verdict) => void;
  /** Later: put the rows off until `until` (lib/notification-pause). */
  onSnooze?: (rows: R[], until: string) => void;
  /** Back now, where it was (the "Later" view). */
  onUnsnooze?: (rows: R[]) => void;
  /** Stop notifications about the row's topic (lib/notification-mute). */
  onMute?: (row: R) => Promise<boolean>;
}

/* ── Decide on the notification itself ──────────────────────────────────
   Approve, or reject / send back, a request the row is about — through the
   same route the app's own screen uses (lib/notification-decisions), so
   who-may-decide and what-it-needs stay on the server. Both steps confirm:
   approving a leave by brushing a row is not a decision. A refusal that
   needs its reason cannot be sent without one. The bar never lets a click
   or a keystroke through to the row it sits in. */
export function DecisionBar({
  meta, tUi, onDecided, large = false, look = "row", onModeChange,
}: {
  meta: unknown; tUi: TFn; onDecided: (verdict: Verdict) => void; large?: boolean;
  /** "card": the pop-up card's buttons — the Hub's primary (solid inverted)
   *  and danger (red tint) — instead of the bell row's tinted pair. */
  look?: "row" | "card";
  /** Told when a decision starts or is cancelled, so a card can hold its timer. */
  onModeChange?: (deciding: boolean) => void;
}) {
  const spec = decisionOf(meta);
  const [mode, setModeState] = useState<Verdict | null>(null);
  const setMode = (m: Verdict | null) => { setModeState(m); onModeChange?.(m !== null); };
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!spec) return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const rejectLabel = spec.rejectWord === "return" ? tUi("dec.return") : tUi("mod.reject");
  const needsReason = mode === "reject" && spec.reasonRequired;
  const reasonOk = !needsReason || note.trim().length >= Math.max(1, spec.reasonMin);
  const h = look === "card" ? "h-[30px] px-3 text-[12px] rounded-[10px]" : large ? "h-8 px-3 text-[11.5px]" : "h-7 px-2.5 text-[11px]";
  const card = look === "card";
  /* The card's pair, in the Hub's own button language (kds Button): the
     primary is the inverted solid (Aurora adds its Hub-Blue halo on hover),
     the refusal is the danger tint. */
  const approveCls = card
    ? "justify-center bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-medium hover:opacity-90"
    : "rounded-lg border border-emerald-500/30 bg-emerald-500/12 font-semibold text-emerald-500 hover:bg-emerald-500/20";
  const rejectCls = card
    ? "justify-center border border-red-500/30 bg-red-500/15 font-medium text-red-500 hover:bg-red-500/25"
    : "rounded-lg border border-red-500/30 bg-red-500/10 font-semibold text-red-500 hover:bg-red-500/20";
  async function confirm() {
    if (!mode) return;
    if (!reasonOk) { setErr(tUi("dec.reasonShort")); return; }
    setBusy(true);
    setErr(null);
    const r = await decide(meta, mode, note);
    setBusy(false);
    if (r.ok) { onDecided(mode); return; }
    setErr(
      r.code === "forbidden" ? tUi("dec.forbidden")
      : r.code === "decided" ? tUi("dec.decided")
      : r.code === "reason" ? tUi("dec.reasonShort")
      : r.message ?? tUi("dec.failed"),
    );
  }
  return (
    <div className={card ? "mt-2.5" : "mt-2"} onClick={stop} onKeyDown={stop}>
      {!mode ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" data-kx-keep-hover onClick={() => { setMode("approve"); setNote(""); setErr(null); }}
            className={`flex items-center gap-1.5 transition-colors ${approveCls} ${h}`}>
            <CheckCircleIcon className={card ? "h-3.5 w-3.5" : "h-3 w-3"} />
            {spec.single === "handled" ? tUi("dec.handled") : tUi("mod.approve")}
          </button>
          {!spec.single && (
            <button type="button" data-kx-keep-hover onClick={() => { setMode("reject"); setNote(""); setErr(null); }}
              className={`flex items-center gap-1.5 transition-colors ${rejectCls} ${h}`}>
              <XCircleIcon className={card ? "h-3.5 w-3.5" : "h-3 w-3"} />
              {rejectLabel}
            </button>
          )}
        </div>
      ) : (
        <div className={card ? "space-y-1.5" : `space-y-1.5 rounded-lg border p-2 ${mode === "approve" ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-red-500/25 bg-red-500/[0.05]"}`}>
          {spec.takesNote && (
            <textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); if (err) setErr(null); }}
              rows={2}
              autoFocus
              placeholder={needsReason ? tUi("mod.reasonPh") : tUi("mod.notePh")}
              className={`w-full resize-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)] ${card ? "rounded-[10px]" : "rounded-md"}`}
            />
          )}
          {err && <p role="alert" className="text-[11px] font-medium text-red-500">{err}</p>}
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" data-kx-keep-hover onClick={() => { setMode(null); setErr(null); }}
              className={`whitespace-nowrap text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)] ${card ? "font-medium hover:bg-[var(--bg-surface)]" : "rounded-lg font-semibold"} ${h}`}>
              {tUi("mod.cancel")}
            </button>
            <button type="button" data-kx-keep-hover onClick={() => void confirm()} disabled={busy || !reasonOk}
              className={`flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-40 ${h} ${
                card
                  ? mode === "approve" ? approveCls : rejectCls
                  : `rounded-lg border font-semibold ${mode === "approve"
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                    : "border-red-500/40 bg-red-500/15 text-red-500 hover:bg-red-500/25"}`
              }`}>
              {mode === "approve" ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
              {mode === "approve"
                ? spec.single === "handled" ? tUi("dec.confirmHandled") : tUi("mod.confirmApprove")
                : spec.rejectWord === "return" ? tUi("dec.confirmReturn") : tUi("mod.confirmReject")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SECTION_KEY: Record<DaySection, string> = {
  today: "section.today",
  yesterday: "section.yesterday",
  week: "section.week",
  older: "section.older",
};

const senderName = (r: ListRow) => r.sender?.full_name || r.sender?.username || null;

export function AppGlyph({ meta, tHub }: { meta: unknown; tHub: TFn }) {
  const appId = defOf(meta)?.app;
  const app = appId ? APP_REGISTRY.find((a) => a.id === appId) : undefined;
  const Icon = app?.icon;
  return (
    <span
      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
      title={app ? tHub(app.tKey, app.name) : undefined}
    >
      {app && Icon
        ? <BoundIcon semanticKey={`app.${app.id}`} className="h-4 w-4" fallback={<Icon size={16} />} />
        : <BellIcon size={15} />}
    </span>
  );
}

function UnreadDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute start-1.5 top-[18px] h-1.5 w-1.5 rounded-full ${on ? "bg-[#567FB2]" : "bg-transparent"}`}
    />
  );
}

/* How long a request has waited on the reader (lib/notification-view): in
   the time's place on the first line — it IS the row's time, counted from
   when the reader was first asked (a reminder moves created_at, never the
   wait). Plain under a day, amber from a day, red from three. */
function WaitChip({ row, tUi }: { row: ViewRow; tUi: TFn }) {
  const { hours, level } = waitOf(row);
  const days = Math.floor(hours / 24);
  const text = hours < 24
    ? tUi("wait.hours").replace("{n}", String(Math.max(1, hours)))
    : days === 1 ? tUi("wait.day") : tUi("wait.days").replace("{n}", String(days));
  const tone = level === "long"
    ? "rounded-full bg-red-500/12 px-1.5 font-semibold text-red-500"
    : level === "day"
      ? "rounded-full bg-amber-500/15 px-1.5 font-semibold text-amber-600 dark:text-amber-400"
      : "text-[var(--text-dim)]";
  return <span className={`shrink-0 whitespace-nowrap text-[10.5px] tabular-nums ${tone}`}>{text}</span>;
}

/** The first line's time: how long it has waited for a request the reader
 *  owes (always in the "Needs you" list; elsewhere once it has waited a
 *  day), else how long ago it arrived. */
function RowTime({ row, tUi, time, waiting, later = false }: { row: ListRow; tUi: TFn; time: (iso: string) => string; waiting: boolean; later?: boolean }) {
  /* The "Later" view: when it comes back. */
  if (later && row.snoozed_until) {
    return (
      <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-[var(--text-dim)]">
        {tUi("later.back").replace("{time}", clockText(new Date(row.snoozed_until), false, tUi("pause.tomorrow")))}
      </span>
    );
  }
  if (isWaiting(row)) {
    const { hours, level } = waitOf(row);
    if (hours >= 1 && (waiting || level !== "fresh")) return <WaitChip row={row} tUi={tUi} />;
  }
  return <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{time(row.created_at)}</span>;
}

/* A row's two quick actions (read / archive) live at the END OF ITS SECOND
   LINE, in a slot kept for them at rest (42px: two 20px buttons and their
   gap; 16px tall, inside the line's height). They show on hover or keyboard
   focus; the words never move and are never covered, and the time on the
   first line stays in view (owner, 26/09). They used to float over the
   row's corner — 54×28px — and cut the end off a long title; then they took
   the time's place, and the owner wanted the time kept.
   On a touch screen there is no hover: the ⋯ (Later, Mute) stays in view
   there, with a tap area larger than its glyph so a near miss does not open
   the notification (owner, 26/09: "from the phone"). */
function ActionSlot<R extends ListRow>({
  rows, unread, tUi, actions, more,
}: { rows: R[]; unread: boolean; tUi: TFn; actions: ListActions<R>; more?: { open: boolean; toggle: () => void } }) {
  /* 42px for two buttons, 64px with the ⋯ (Later) — kept at rest either way. */
  return (
    <span className={`ms-auto flex h-4 shrink-0 items-center justify-end ${more ? "min-w-[64px]" : "min-w-[42px]"}`}>
      <RowActions rows={rows} unread={unread} tUi={tUi} actions={actions} more={more} />
    </span>
  );
}

function RowActions<R extends ListRow>({
  rows, unread, tUi, actions, more,
}: { rows: R[]; unread: boolean; tUi: TFn; actions: ListActions<R>; more?: { open: boolean; toggle: () => void } }) {
  const look = "h-4 w-5 place-items-center rounded text-[var(--text-dim)] hover:bg-[var(--bg-surface-strong)] hover:text-[var(--text-primary)]";
  const btn = `grid ${look}`;
  return (
    <span className="flex items-center gap-0.5">
      <span className="hidden items-center gap-0.5 group-hover/row:flex group-focus-within/row:flex">
        <button
          type="button"
          data-kx-keep-hover
          className={btn}
          aria-label={unread ? tUi("markRead") : tUi("markUnread")}
          title={unread ? tUi("markRead") : tUi("markUnread")}
          onClick={(e) => { e.stopPropagation(); actions.onSetRead(rows, unread); }}
        >
          {unread ? <MailOpenIcon size={12} /> : <EnvelopeIcon size={12} />}
        </button>
        <button
          type="button"
          data-kx-keep-hover
          className={btn}
          aria-label={tUi("archive")}
          title={tUi("archive")}
          onClick={(e) => { e.stopPropagation(); actions.onArchive(rows); }}
        >
          <ArchiveIcon size={12} />
        </button>
      </span>
      {more && (
        <button
          type="button"
          data-kx-keep-hover
          className={`relative ${look} after:absolute after:-inset-2 after:content-[''] ${more.open ? "grid" : "hidden group-hover/row:grid group-focus-within/row:grid [@media(hover:none)]:grid"}`}
          aria-label={tUi("more")}
          aria-expanded={more.open}
          title={tUi("more")}
          onClick={(e) => { e.stopPropagation(); more.toggle(); }}
        >
          <MoreHorizontalIcon size={12} />
        </button>
      )}
    </span>
  );
}

function Row<R extends ListRow>({
  row, lang, tHub, tUi, time, actions, selected = false, waiting = false, later = false,
}: { row: R; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R>; selected?: boolean; waiting?: boolean; later?: boolean }) {
  const unread = !row.read_at;
  const [moreOpen, setMoreOpen] = useState(false);
  const more = actions.onSnooze && !row.archived_at ? { open: moreOpen, toggle: () => setMoreOpen((v) => !v) } : undefined;
  const who = senderName(row);
  /* Second line: the body — or, when there is none, who sent it. A name is
     never sent through auto-translation. A Super Admin's copy of a request
     that waited three days says whom it waits on instead. */
  const hasBody = !!useRenderedNotification(row.metadata, lang)?.body || !!row.body;
  const waitsOn = (row.metadata as { escalated_for?: unknown } | null | undefined)?.escalated_for;
  return (
    <li className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-current={selected || undefined}
        onClick={() => actions.onOpen(row)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions.onOpen(row); } }}
        className={`group/row relative flex cursor-pointer gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:bg-[var(--bg-surface-hover)] ${selected ? "bg-[var(--bg-surface-active)]" : ""}`}
      >
        <UnreadDot on={unread} />
        <AppGlyph meta={row.metadata} tHub={tHub} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[12.5px] ${unread ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]"}`}>
              <NotificationSubject meta={row.metadata} subject={row.subject} lang={lang} plain />
            </span>
            <RowTime row={row} tUi={tUi} time={time} waiting={waiting} later={later} />
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {typeof waitsOn === "string" && waitsOn ? (
              <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[var(--text-secondary)]">{tUi("wait.on").replace("{who}", waitsOn)}</p>
            ) : hasBody ? (
              <NotificationBody meta={row.metadata} body={row.body} lang={lang} plain className="min-w-0 flex-1 line-clamp-1 text-[11.5px] text-[var(--text-dim)]" />
            ) : who ? (
              <p className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--text-dim)]">{who}</p>
            ) : null}
            <ActionSlot rows={[row]} unread={unread} tUi={tUi} actions={actions} more={more} />
          </div>
          {more?.open && (
            <Suspense fallback={null}>
              <MorePanel
                later={later}
                onSnooze={actions.onSnooze ? (until) => actions.onSnooze!([row], until) : undefined}
                onUnsnooze={later && actions.onUnsnooze ? () => actions.onUnsnooze!([row]) : undefined}
                onMute={actions.onMute && canMute(row.metadata) ? () => actions.onMute!(row) : undefined}
                onDone={() => setMoreOpen(false)}
              />
            </Suspense>
          )}
          {actions.onDecided && !row.archived_at && !later && (
            <DecisionBar meta={row.metadata} tUi={tUi} onDecided={(v) => actions.onDecided!(row, v)} />
          )}
        </div>
      </div>
    </li>
  );
}

function Group<R extends ListRow>({
  rows, digestTitle, lang, tHub, tUi, time, actions, selectedId,
}: { rows: R[]; digestTitle: string | null; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R>; selectedId?: string | null }) {
  /* Opens by itself when the selected row is inside it (a deep link). */
  const [open, setOpen] = useState(() => !!selectedId && rows.some((r) => r.id === selectedId));
  const [moreOpen, setMoreOpen] = useState(false);
  const more = actions.onSnooze ? { open: moreOpen, toggle: () => setMoreOpen((v) => !v) } : undefined;
  const latest = rows[0];
  const unread = rows.some((r) => !r.read_at);
  const who = senderName(latest);
  return (
    <li className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        className="group/row relative flex cursor-pointer gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:bg-[var(--bg-surface-hover)]"
      >
        <UnreadDot on={unread} />
        <AppGlyph meta={latest.metadata} tHub={tHub} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[12.5px] ${unread ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]"}`}>
              {digestTitle ?? <NotificationSubject meta={latest.metadata} subject={latest.subject} lang={lang} plain />}
            </span>
            {!digestTitle && (
              <span className="shrink-0 rounded-full bg-[var(--bg-surface-strong)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                ×{rows.length}
              </span>
            )}
            <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{time(latest.created_at)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--text-dim)]">
            {who && <span className="min-w-0 truncate">{who}</span>}
            {who && <span aria-hidden>·</span>}
            <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-[var(--text-secondary)]">
              {open ? tUi("group.hide") : tUi("group.show").replace("{n}", String(rows.length))}
              <ChevronDownIcon size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
            <ActionSlot rows={rows} unread={unread} tUi={tUi} actions={actions} more={more} />
          </div>
          {more?.open && (
            <Suspense fallback={null}>
              <MorePanel later={false} onSnooze={(until) => actions.onSnooze?.(rows, until)} onDone={() => setMoreOpen(false)} />
            </Suspense>
          )}
        </div>
      </div>
      {open && (
        <ul className="border-s border-[var(--border-faint)] ms-[34px] mb-1">
          {rows.map((r) => (
            <Row key={r.id} row={r} lang={lang} tHub={tHub} tUi={tUi} time={time} actions={actions} selected={r.id === selectedId} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NotificationSections<R extends ListRow>({
  rows, lang, tHub, tUi, time, actions, selectedId = null, waiting = false, later = false,
}: {
  rows: R[]; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R>; selectedId?: string | null;
  /** The "Needs you" list: one list, what has waited longest first, each
   *  row saying how long — no day sections (a request from last week is the
   *  most urgent thing on it, not the last), no folding. */
  waiting?: boolean;
  /** The "Later" view: one list in the order given (the soonest back
   *  first), each row saying when it comes back. */
  later?: boolean;
}) {
  if (waiting || later) {
    return (
      <ul className="pt-1">
        {(later ? rows : byWaiting(rows)).map((r) => (
          <Row key={r.id} row={r} lang={lang} tHub={tHub} tUi={tUi} time={time} actions={actions} selected={r.id === selectedId} waiting={waiting} later={later} />
        ))}
      </ul>
    );
  }
  const sections = sectionize(rows);
  return (
    <>
      {sections.map(({ section, items }) => (
        <section key={section} aria-label={tUi(SECTION_KEY[section])}>
          <h3 className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            {tUi(SECTION_KEY[section])}
          </h3>
          <ul>
            {items.map((it) =>
              it.kind === "row" ? (
                <Row key={it.row.id} row={it.row} lang={lang} tHub={tHub} tUi={tUi} time={time} actions={actions} selected={it.row.id === selectedId} />
              ) : (
                <Group
                  key={it.key}
                  rows={it.rows}
                  digestTitle={it.digest ? partsText(templateParts(`${it.digest.k}.s`, lang, it.digest.p) ?? []) || null : null}
                  lang={lang}
                  tHub={tHub}
                  tUi={tUi}
                  time={time}
                  actions={actions}
                  selectedId={selectedId}
                />
              ),
            )}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Rows' shape while the first answer is on its way — never an empty box. */
export function NotificationSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-hidden className="py-2">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex gap-3 px-4 py-2.5">
          <span className="h-8 w-8 shrink-0 rounded-[10px] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
          <span className="flex-1 space-y-1.5 pt-1">
            <span className="block h-2.5 rounded bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" style={{ width: `${72 - i * 9}%` }} />
            <span className="block h-2 w-2/5 rounded bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
          </span>
        </li>
      ))}
    </ul>
  );
}
