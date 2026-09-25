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

import { useState } from "react";
import BoundIcon from "@/components/common/BoundIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import MailOpenIcon from "@/components/icons/ui/MailOpenIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import ChevronDownIcon from "@/components/icons/ui/ChevronDownIcon";
import { APP_REGISTRY } from "@/lib/navigation";
import { NotificationBody, NotificationSubject, useRenderedNotification } from "@/components/layout/NotificationText";
import { defOf, sectionize, type DaySection, type ViewRow } from "@/lib/notification-view";
import { partsText, templateParts } from "@/lib/notification-templates";
import type { Lang } from "@/lib/i18n";

export type ListRow = ViewRow & {
  body: string | null;
  link: string | null;
  sender?: { full_name?: string | null; username?: string | null } | null;
};

type TFn = (key: string, fallback?: string) => string;

export interface ListActions<R extends ListRow> {
  onOpen: (row: R) => void;
  onSetRead: (rows: R[], read: boolean) => void;
  onArchive: (rows: R[]) => void;
}

const SECTION_KEY: Record<DaySection, string> = {
  today: "section.today",
  yesterday: "section.yesterday",
  week: "section.week",
  older: "section.older",
};

const senderName = (r: ListRow) => r.sender?.full_name || r.sender?.username || null;

function AppGlyph({ meta, tHub }: { meta: unknown; tHub: TFn }) {
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

function RowActions<R extends ListRow>({
  rows, unread, tUi, actions,
}: { rows: R[]; unread: boolean; tUi: TFn; actions: ListActions<R> }) {
  const btn =
    "grid h-6 w-6 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]";
  return (
    <span className="absolute end-3 top-2 hidden items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] p-0.5 shadow-sm group-hover/row:flex group-focus-within/row:flex">
      <button
        type="button"
        data-kx-keep-hover
        className={btn}
        aria-label={unread ? tUi("markRead") : tUi("markUnread")}
        title={unread ? tUi("markRead") : tUi("markUnread")}
        onClick={(e) => { e.stopPropagation(); actions.onSetRead(rows, unread); }}
      >
        {unread ? <MailOpenIcon size={13} /> : <EnvelopeIcon size={13} />}
      </button>
      <button
        type="button"
        data-kx-keep-hover
        className={btn}
        aria-label={tUi("archive")}
        title={tUi("archive")}
        onClick={(e) => { e.stopPropagation(); actions.onArchive(rows); }}
      >
        <ArchiveIcon size={13} />
      </button>
    </span>
  );
}

function Row<R extends ListRow>({
  row, lang, tHub, tUi, time, actions,
}: { row: R; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R> }) {
  const unread = !row.read_at;
  const who = senderName(row);
  /* Second line: the body — or, when there is none, who sent it. A name is
     never sent through auto-translation. */
  const hasBody = !!useRenderedNotification(row.metadata, lang)?.body || !!row.body;
  return (
    <li className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => actions.onOpen(row)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions.onOpen(row); } }}
        className="group/row relative flex cursor-pointer gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:bg-[var(--bg-surface-hover)]"
      >
        <UnreadDot on={unread} />
        <AppGlyph meta={row.metadata} tHub={tHub} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[12.5px] ${unread ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]"}`}>
              <NotificationSubject meta={row.metadata} subject={row.subject} lang={lang} plain />
            </span>
            <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)] group-hover/row:invisible group-focus-within/row:invisible">{time(row.created_at)}</span>
          </div>
          {hasBody ? (
            <NotificationBody meta={row.metadata} body={row.body} lang={lang} plain className="mt-0.5 line-clamp-1 text-[11.5px] text-[var(--text-dim)]" />
          ) : who ? (
            <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-dim)]">{who}</p>
          ) : null}
        </div>
        <RowActions rows={[row]} unread={unread} tUi={tUi} actions={actions} />
      </div>
    </li>
  );
}

function Group<R extends ListRow>({
  rows, digestTitle, lang, tHub, tUi, time, actions,
}: { rows: R[]; digestTitle: string | null; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R> }) {
  const [open, setOpen] = useState(false);
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
              <span className="shrink-0 rounded-full bg-[var(--bg-surface-strong)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)] group-hover/row:invisible group-focus-within/row:invisible">
                ×{rows.length}
              </span>
            )}
            <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)] group-hover/row:invisible group-focus-within/row:invisible">{time(latest.created_at)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--text-dim)]">
            {who && <span className="min-w-0 truncate">{who}</span>}
            {who && <span aria-hidden>·</span>}
            <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-[var(--text-secondary)]">
              {open ? tUi("group.hide") : tUi("group.show").replace("{n}", String(rows.length))}
              <ChevronDownIcon size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </div>
        </div>
        <RowActions rows={rows} unread={unread} tUi={tUi} actions={actions} />
      </div>
      {open && (
        <ul className="border-s border-[var(--border-faint)] ms-[34px] mb-1">
          {rows.map((r) => (
            <Row key={r.id} row={r} lang={lang} tHub={tHub} tUi={tUi} time={time} actions={actions} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NotificationSections<R extends ListRow>({
  rows, lang, tHub, tUi, time, actions,
}: { rows: R[]; lang: Lang; tHub: TFn; tUi: TFn; time: (iso: string) => string; actions: ListActions<R> }) {
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
                <Row key={it.row.id} row={it.row} lang={lang} tHub={tHub} tUi={tUi} time={time} actions={actions} />
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
