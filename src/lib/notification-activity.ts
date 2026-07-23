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
