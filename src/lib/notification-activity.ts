/* ---------------------------------------------------------------------------
   notification-activity — the ONE classifier that maps a notification's
   kind/metadata.type string onto the eight per-activity preference keys shown
   in Settings → Notifications ("By activity") and Settings → Sounds.

   Pure and environment-free on purpose: the client uses it to pick the chime
   (notificationSound.ts re-exports it) and the SERVER uses it in the push
   sender to honour the same toggles. Before this existed the eight switches
   were written to accounts.preferences.notifications and read by NOTHING —
   turning an activity off changed no behaviour anywhere.

   Keep the substring rules in sync with the `kind` / `metadata.type` strings
   the notify paths emit (todo fan-out, project-notify, calendar attendees,
   HR expiry cron, QA, price/fx). New activity => add the key here, in
   DEFAULT_PREFERENCES.notifications, and in the two Settings screens.
   --------------------------------------------------------------------------- */

export const NOTIFICATION_ACTIVITIES = [
  "mentions", "approvals", "assignments", "tasks_due",
  "quotation_activity", "low_stock", "qa_reports", "price_fx",
] as const;
export type NotificationActivity = (typeof NOTIFICATION_ACTIVITIES)[number];

/** Classify a notification type string (inbox metadata.type or push kind)
 *  into an activity key — null when it matches none (never gated). */
export function classifyNotificationActivity(raw: unknown): NotificationActivity | null {
  const type = typeof raw === "string" ? raw : "";
  if (!type) return null;
  if (type.includes("mention")) return "mentions";
  if (type.includes("approval")) return "approvals";
  if (type.includes("assign") || type.includes("observer")) return "assignments";
  if (
    type.includes("reminder") || type.includes("overdue") || type.includes("due") ||
    type.includes("recurring") || type.startsWith("calendar")
  ) return "tasks_due";
  if (type.includes("quotation") || type.includes("quote")) return "quotation_activity";
  if (type.includes("stock")) return "low_stock";
  if (type.startsWith("qa")) return "qa_reports";
  if (type.includes("price") || type.includes("fx") || type.includes("rate")) return "price_fx";
  return null;
}

/** True when `prefs` (accounts.preferences.notifications, possibly partial or
 *  missing) allows this activity. Unset keys default to ON — only an explicit
 *  false mutes, matching withDefaults() semantics. */
export function activityAllowed(
  prefs: Record<string, unknown> | null | undefined,
  activity: NotificationActivity | null,
): boolean {
  if (!activity) return true;
  return prefs?.[activity] !== false;
}

/* ── Quiet hours ─────────────────────────────────────────────────────────
   A daily silence window stored in preferences.notifications.quiet_hours as
   {enabled, start:"HH:MM", end:"HH:MM", tz} — tz snapshotted from the browser
   at save time so the server can evaluate the recipient's LOCAL clock. Used
   by sendPushToAccounts (skip + log) and the bell chime (mute, badge still
   updates). Malformed input fails OPEN: a broken pref must never silence
   someone forever. */

export interface QuietHoursLike {
  enabled?: boolean;
  start?: string;
  end?: string;
  tz?: string;
}

function minutesInZone(now: Date, tz: string | undefined): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      ...(tz ? { timeZone: tz } : {}),
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null; // unknown tz string — fail open
  }
}

function parseHHMM(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** True when `now` falls inside the user's quiet window. Windows may cross
 *  midnight (22:00→08:00). start === end is treated as disabled, not 24h —
 *  an accidental equal pair should not mute everything. */
export function inQuietHours(
  qh: QuietHoursLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!qh?.enabled) return false;
  const start = parseHHMM(qh.start);
  const end = parseHHMM(qh.end);
  if (start == null || end == null || start === end) return false;
  const cur = minutesInZone(now, qh.tz);
  if (cur == null) return false;
  return start < end
    ? cur >= start && cur < end
    : cur >= start || cur < end; // crosses midnight
}
