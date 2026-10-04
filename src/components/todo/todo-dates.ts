/* ---------------------------------------------------------------------------
   To-do dates — one definition of "which calendar day is this task due".

   ⚠️ due_date / start_date are TIMESTAMPTZ columns, but the form writes a bare
   "YYYY-MM-DD", which Postgres stores as midnight UTC ("2026-09-26T00:00:00
   +00:00"). Parsed with `new Date()`, that instant is the 25th anywhere west
   of Greenwich — so the list said "Yesterday" / "Overdue" for a task due
   today, and the edit form (which slices the date part) disagreed with the
   row. A midnight-UTC value is therefore read as the DATE it was written as;
   anything carrying a real time (CRM / calendar integrations) is read in the
   viewer's own calendar.

   Every label is day-first (the Hub's D/M/Y rule) in the app language, never
   the browser's month-first default.
   --------------------------------------------------------------------------- */

const MS_DAY = 86_400_000;

export function todoLocale(lang: string): string {
  const base = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar" : "en-GB";
  return `${base}-u-nu-latn`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DD" of a Date. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local "YYYY-MM-DD" for today. */
export function todayIso(now = new Date()): string {
  return isoDay(now);
}

/** The calendar day ("YYYY-MM-DD") a stored date/timestamp stands for. */
export function dayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  /* Midnight UTC = a date-only value written by the form. */
  if (/^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?(Z|[+-]00(:?00)?)$/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : isoDay(d);
}

/** Local-midnight Date for a "YYYY-MM-DD" key. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole calendar days from today to the value (0 = today, -1 = yesterday). */
export function daysFromToday(value: string | null | undefined, now = new Date()): number | null {
  const key = dayKey(value);
  if (!key) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((keyToDate(key).getTime() - today.getTime()) / MS_DAY);
}

export const isOverdueDate = (due: string | null | undefined, now?: Date) => {
  const n = daysFromToday(due, now);
  return n !== null && n < 0;
};
export const isDueTodayDate = (due: string | null | undefined, now?: Date) => daysFromToday(due, now) === 0;

type TFn = (key: string, fallback?: string) => string;

/** "26 Sep" this year, "26 Sep 2025" otherwise — day first, app language. */
export function fmtDay(value: string | null | undefined, lang: string, withYear?: boolean): string {
  const key = dayKey(value);
  if (!key) return "—";
  const d = keyToDate(key);
  const showYear = withYear ?? d.getFullYear() !== new Date().getFullYear();
  try {
    return d.toLocaleDateString(todoLocale(lang), {
      day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}),
    });
  } catch {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${showYear ? `/${d.getFullYear()}` : ""}`;
  }
}

/** Day + time for an instant (reminders, notes). */
export function fmtDayTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  try {
    return d.toLocaleString(todoLocale(lang), {
      day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }),
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
  } catch {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/** Relative due label: Today / Tomorrow / Yesterday / weekday (this week) / 26 Sep. */
export function fmtDue(value: string | null | undefined, t: TFn, lang: string): string {
  const diff = daysFromToday(value);
  if (diff === null) return "";
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  if (diff > 1 && diff <= 6) {
    try {
      return keyToDate(dayKey(value)!).toLocaleDateString(todoLocale(lang), { weekday: "long" });
    } catch { /* fall through */ }
  }
  return fmtDay(value, lang);
}

/** Local datetime-input value ("YYYY-MM-DDTHH:MM") <-> ISO instant. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Inclusive [start, end] day keys for a horizon relative to today. */
export function horizonRange(h: "today" | "week" | "month", now = new Date()): [string, string] {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (h === "today") return [isoDay(now), isoDay(now)];
  if (h === "week") {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    return [isoDay(new Date(y, m, d - dow)), isoDay(new Date(y, m, d - dow + 6))];
  }
  return [isoDay(new Date(y, m, 1)), isoDay(new Date(y, m + 1, 0))];
}

/* ── Task clarity helpers (row + detail sheet) ── */

/** "15:30" when the stored due carries a real time; "" for a date-only
 *  value (a bare day, or the midnight-UTC the form writes for one). */
export function dueTimeOf(value: string | null | undefined): string {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  if (/^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?(Z|[+-]00(:?00)?)$/.test(value)) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "28/09" (this year) or "28/09/2027" — the Hub's day-first short date. */
export function fmtDm(value: string | null | undefined): string {
  const key = dayKey(value);
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return Number(y) === new Date().getFullYear() ? `${d}/${m}` : `${d}/${m}/${y}`;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

/** What an employee needs from a due date at a glance:
 *  "Due today" / "Due in 2 days" / "3 days overdue", plus "28/09" and the
 *  time when one was set. */
export function dueInfo(value: string | null | undefined, t: TFn): { rel: string; dm: string; time: string; tone: DueTone } | null {
  const n = daysFromToday(value);
  if (n === null) return null;
  const rel = n === 0 ? t("due.today")
    : n === 1 ? t("due.tomorrow")
    : n > 1 ? t("due.inDays").replace("{n}", String(n))
    : n === -1 ? t("due.overdue1")
    : t("due.overdueDays").replace("{n}", String(-n));
  return { rel, dm: fmtDm(value), time: dueTimeOf(value), tone: n < 0 ? "overdue" : n === 0 ? "today" : n <= 2 ? "soon" : "later" };
}

/** "5 min ago" / "yesterday" / "3 days ago" in the app language; older
 *  than a week falls back to the day-first date. */
export function fmtAgo(iso: string | null | undefined, lang: string, now = Date.now()): string {
  if (!iso) return "";
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const s = Math.round((at - now) / 1000);
  const abs = Math.abs(s);
  try {
    const rtf = new Intl.RelativeTimeFormat(todoLocale(lang), { numeric: "auto" });
    if (abs < 60) return rtf.format(0, "second");
    if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
    if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
    if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), "day");
  } catch { /* fall through */ }
  return fmtDay(iso, lang);
}
