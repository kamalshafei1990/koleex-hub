/* ---------------------------------------------------------------------------
   notification-view — how a list of notifications is SHOWN: which tab a row
   belongs to, which day section, and which rows fold into one.

   Pure (no React, no fetch): the bell and the notification center shape the
   same rows the same way, and each rule is testable on its own.

   · Tabs. "Security" is every type the registry files under the Activity
     Monitor (new device, failed sign-ins, deletions, role and setting
     changes…) — separated from the work they used to drown: on the owner's
     feed they were 96% of all rows. "Needs you" is every unread row whose
     type waits on the reader (severity "action": approvals, assignments,
     requests), read oldest-first with how long each has waited. "All" is
     the work — everything that is not Security.
   · Sections. Today / Yesterday / This week / Older, on the reader's clock.
   · Groups. Rows of the same type from the same sender on the same day that
     say the same thing fold into one: identical subjects ("kamal signed in
     from a new device" ×3), or the same audited action on the same kind of
     record ("Delete — product" ×6, each product listed when opened).
   --------------------------------------------------------------------------- */
import { notificationTypeDef, type NotificationTypeDef } from "@/lib/notification-types";
import { readTpl, type NotifTpl } from "@/lib/notification-templates";

export type BellTab = "all" | "action" | "security";
export type DaySection = "today" | "yesterday" | "week" | "older";

export interface ViewRow {
  id: string;
  subject: string;
  read_at: string | null;
  created_at: string;
  sender_account_id: string | null;
  metadata?: unknown;
}

export function typeOf(meta: unknown): string | null {
  const m = meta as { type?: unknown; kind?: unknown } | null | undefined;
  const t = m?.type ?? m?.kind;
  return typeof t === "string" && t ? t : null;
}

export function defOf(meta: unknown): NotificationTypeDef | null {
  return notificationTypeDef(typeOf(meta));
}

export const isSecurity = (meta: unknown): boolean => defOf(meta)?.app === "activity-monitor";

export function inTab(row: ViewRow, tab: BellTab): boolean {
  if (tab === "security") return isSecurity(row.metadata);
  if (isSecurity(row.metadata)) return false;
  if (tab === "action") return !row.read_at && defOf(row.metadata)?.severity === "action";
  return true;
}

/* ── How long a request has waited on the reader ─────────────────────────
   A reminder brings the request back to the top of the list — its
   created_at moves to "now" — so the moment the reader was FIRST asked is
   kept in metadata.first_at (lib/server/inbox-resurface). The "Needs you"
   list is read oldest-first by it: what has waited longest leads. */
export function waitingSince(row: ViewRow): string {
  const f = (row.metadata as { first_at?: unknown } | null | undefined)?.first_at;
  return typeof f === "string" && f && !Number.isNaN(Date.parse(f)) ? f : row.created_at;
}

/** Oldest waiting first. */
export function byWaiting<R extends ViewRow>(rows: R[]): R[] {
  return [...rows].sort((a, b) => Date.parse(waitingSince(a)) - Date.parse(waitingSince(b)));
}

/** A request still on the reader: unread, and of a type that waits on them. */
export const isWaiting = (row: ViewRow): boolean => !row.read_at && defOf(row.metadata)?.severity === "action";

export type WaitLevel = "fresh" | "day" | "long";
/** Hours waited, and how loud to say it: a day turns it amber, three red —
 *  the day the approval reminders tell the Super Admins (lib/server/
 *  approval-reminders ESCALATE_AFTER_H). */
export function waitOf(row: ViewRow, now: number = Date.now()): { hours: number; level: WaitLevel } {
  const hours = Math.max(0, Math.floor((now - Date.parse(waitingSince(row))) / 3_600_000));
  return { hours, level: hours >= 72 ? "long" : hours >= 24 ? "day" : "fresh" };
}

/* ── Back after an absence ────────────────────────────────────────────────
   Owner (item 4 of the second round): after a few hours away, or first thing
   in the morning, ONE card that sums up what came in — not a wall of them. */
const HOUR_MS = 3_600_000;
export const AWAY_MS = 3 * HOUR_MS;

/** Away long enough for a summary: three hours, or a new day (an hour at least). */
export function isAway(last: number, now: number): boolean {
  if (!last || now - last < HOUR_MS) return false;
  if (now - last >= AWAY_MS) return true;
  return dayStart(new Date(last)) !== dayStart(new Date(now));
}

/** What came in since `since`, still unread (security alerts have their own
 *  tab): how many wait on the reader, how many are updates, and the apps they
 *  came from, the busiest first. */
export function awaySummary(rows: ViewRow[], since: number): { needs: number; updates: number; apps: string[] } {
  const fresh = rows.filter((r) => !r.read_at && !isSecurity(r.metadata) && Date.parse(r.created_at) > since);
  const needs = fresh.filter((r) => defOf(r.metadata)?.severity === "action").length;
  const byApp = new Map<string, number>();
  for (const r of fresh) {
    const a = defOf(r.metadata)?.app;
    if (a) byApp.set(a, (byApp.get(a) ?? 0) + 1);
  }
  return { needs, updates: fresh.length - needs, apps: [...byApp].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a) };
}

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function sectionOf(iso: string, now: Date = new Date()): DaySection {
  const t = new Date(iso).getTime();
  const today = dayStart(now);
  if (t >= today) return "today";
  if (t >= today - 86_400_000) return "yesterday";
  if (t >= today - 6 * 86_400_000) return "week";
  return "older";
}

/* The audited Super-Admin kinds: one template shape, the record's label
   the only difference between six deletions of six products. */
const AUDIT_KINDS = new Set(["data_delete", "sensitive_export", "price_cost_change", "settings_change", "admin_role_change", "file_change", "suspicious"]);

export type ViewItem<R extends ViewRow> =
  | { kind: "row"; row: R }
  | { kind: "group"; key: string; rows: R[]; digest: NotifTpl | null };

function signature(row: ViewRow): string {
  const type = typeOf(row.metadata) ?? "";
  if (AUDIT_KINDS.has(type)) {
    const p = readTpl(row.metadata)?.p ?? {};
    if (p.action && p.entity) return `a|${String(p.action)}|${String(p.entity)}|${String(p.module ?? "")}`;
  }
  return `s|${row.subject}`;
}

/** Fold same-day repeats from one sender into groups, in list order: a group
 *  sits where its newest member sat. Rows must already be newest-first. */
export function groupRows<R extends ViewRow>(rows: R[]): ViewItem<R>[] {
  const buckets = new Map<string, R[]>();
  const keyOf = (r: R) => {
    const d = new Date(r.created_at);
    return [typeOf(r.metadata) ?? "", r.sender_account_id ?? "", `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, signature(r)].join("§");
  };
  for (const r of rows) {
    const k = keyOf(r);
    const b = buckets.get(k);
    if (b) b.push(r);
    else buckets.set(k, [r]);
  }
  const out: ViewItem<R>[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    const k = keyOf(r);
    const b = buckets.get(k)!;
    if (b.length < 2) { out.push({ kind: "row", row: r }); continue; }
    if (placed.has(k)) continue;
    placed.add(k);
    const type = typeOf(r.metadata) ?? "";
    const tpl = readTpl(r.metadata);
    const p = tpl?.p ?? {};
    const digest: NotifTpl | null = AUDIT_KINDS.has(type) && p.action && p.entity
      ? { k: "sa_alert.digest", p: { action: p.action, entity: p.entity, count: b.length } }
      : null;
    out.push({ kind: "group", key: k, rows: b, digest });
  }
  return out;
}

/** Items per day section, sections in order, empty ones dropped. */
export function sectionize<R extends ViewRow>(rows: R[], now: Date = new Date()): Array<{ section: DaySection; items: ViewItem<R>[] }> {
  const order: DaySection[] = ["today", "yesterday", "week", "older"];
  const by = new Map<DaySection, R[]>();
  for (const r of rows) {
    const s = sectionOf(r.created_at, now);
    const list = by.get(s);
    if (list) list.push(r);
    else by.set(s, [r]);
  }
  return order.filter((s) => by.has(s)).map((s) => ({ section: s, items: groupRows(by.get(s)!) }));
}
