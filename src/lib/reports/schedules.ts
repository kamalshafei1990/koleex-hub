/* ---------------------------------------------------------------------------
   Reports — the drafts the system prepares on schedule (Phase 5D, owner's
   picks 26 Sep 2026): when the week or the month a type covers has JUST
   ENDED — at 07:00 in the writer's own time on the new period's first day,
   or at the first run after it (a missed run catches up) — the report cron
   prepares that period's draft, once, and tells its writer. Nothing is ever
   sent by itself: the writer checks the numbers, writes what they mean and
   sends it.

   Who writes what is set like «who must write what» (a super admin or
   HR · edit, in the Compliance tab); a schedule gives no right — someone who
   may not start the type gets no draft. Pure: the cron, the setup API, the
   screen and validate:reports share it.
   --------------------------------------------------------------------------- */

import { behaviourKey, periodFor, type ReportCadence, type ReportTemplateDef } from "./templates";
import { OBLIGATION_KEYS, mondayOf } from "./obligations";

/** The hour, in the writer's own time, a new period's draft is prepared. */
export const SCHEDULE_HOUR = 7;
/** 6E: the time a summary Koleex AI writes into a prepared draft may take
 *  inside the report job — started only with `minMs` left, cut at `maxMs`
 *  (the job itself stops at 60 s; one that cannot start waits 15 minutes). */
export const SCHEDULE_SUMMARY = { minMs: 20_000, maxMs: 40_000 } as const;
export const SCHEDULE_LIMITS = { perTenant: 500 } as const;

const DAY = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The periods a draft can be prepared for (6D: the quarter, the half-year
 *  and the year too). */
export const SCHEDULE_CADENCES = ["weekly", "monthly", "quarterly", "halfyear", "yearly"] as const;
export type ScheduleCadence = (typeof SCHEDULE_CADENCES)[number];
export const isScheduleCadence = (c: unknown): c is ScheduleCadence => typeof c === "string" && (SCHEDULE_CADENCES as readonly string[]).includes(c);

/** A type the system may prepare: one that covers a week, a month, a
 *  quarter, a half-year or a year. The daily, weekly and monthly work
 *  reports are owed and reminded already (their own obligations); a type
 *  only an event asks for waits for it. */
export function schedulable(tpl: Pick<ReportTemplateDef, "key" | "cadence" | "requestOnly" | "base"> | null | undefined): tpl is Pick<ReportTemplateDef, "key" | "cadence" | "requestOnly" | "base"> & { cadence: ScheduleCadence } {
  return !!tpl && isScheduleCadence(tpl.cadence) && !tpl.requestOnly
    && !(OBLIGATION_KEYS as readonly string[]).includes(behaviourKey(tpl));
}

/** The day, inside the period that just ended, whose draft is due at the
 *  writer's `localDay` and `localMinutes` (minutes since their midnight) —
 *  or null while it is not yet 07:00 on the new period's first day. */
export function periodToPrepare(cadence: ReportCadence, localDay: string, localMinutes: number): string | null {
  const early = localMinutes < SCHEDULE_HOUR * 60;
  if (cadence === "weekly") {
    const monday = mondayOf(localDay);
    return localDay === monday && early ? null : addDays(monday, -7);
  }
  if (cadence === "monthly") {
    const first = `${localDay.slice(0, 8)}01`;
    return localDay === first && early ? null : addDays(first, -1);
  }
  /* 6D: the quarter / half-year / year that just ended — from 07:00 on the
     new one's first day. */
  if (cadence === "quarterly" || cadence === "halfyear" || cadence === "yearly") {
    const first = periodFor(cadence, localDay).start;
    return localDay === first && early ? null : addDays(first, -1);
  }
  return null;
}

/** The minutes since midnight of an instant in a time zone. */
export function localMinutesOf(iso: string, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return get("hour") * 60 + get("minute");
  } catch {
    const d = new Date(iso);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

/** One schedule as the setup shows it. */
export interface ScheduleRow {
  accountId: string;
  templateKey: string;
  active: boolean;
  lastPeriod: string | null;
  lastReportId: string | null;
}
