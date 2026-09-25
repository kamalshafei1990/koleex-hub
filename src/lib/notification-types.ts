/* ---------------------------------------------------------------------------
   notification-types — ONE registry for every notification the Hub sends.

   Before this, what a notification "was" lived in eight places: the writer
   picked a string, a substring classifier guessed its preference bucket from
   words inside it (`includes("due")`, `includes("stock")`…), and its app,
   importance and lifecycle were written down nowhere. A new type whose name
   happened to contain "due" was silently filed under reminders; a type nobody
   classified landed under "Other", took the default chime and could not be
   muted (QA, until 19/09 — note_shared and ai_brief still do).

   Each entry answers, once:
     app        which Hub app it belongs to (an APP_REGISTRY id — the bell's
                icon and name come from here in the redesign)
     activity   the Settings "By activity" switch that mutes / sounds it.
                null = never mutable on purpose (Super-Admin critical alerts),
                or an OPEN decision — `activityNote` says which.
     severity   default weight (a row's own metadata.severity still wins):
                info · action (waits on the reader) · warning · critical
     lifecycle  what makes an unread copy go away without a click:
                clear       — resolved when its cause finishes (by `key`)
                supersede   — a newer one about the same `key` replaces it
                info        — a record of something that happened; stays
                              until read
                push-only   — never an inbox row (Discuss messages)
                gap         — KNOWN missing lifecycle; `note` says what it
                              should be. Phase C2 closes these.

   Pure data, no imports beyond types: the server writers, the bell and the
   push sender all read it. validate:notification-types keeps it honest —
   every type a writer emits is registered here, every entry has a live
   emitter, and `activity` equals what the legacy classifier returned (so
   adopting the registry changed no one's mute or chime).
   --------------------------------------------------------------------------- */
import type { NotificationActivity } from "@/lib/notification-activity";

export type NotifApp =
  | "todo" | "calendar" | "issue-reports" | "reports" | "hr" | "me"
  | "projects" | "planning" | "inventory" | "quotations" | "invoices"
  | "finance" | "notes" | "accounts" | "ai" | "discuss" | "activity-monitor"
  | "settings";

export type NotifSeverity = "info" | "action" | "warning" | "critical";

export type NotifLifecycle =
  | { kind: "clear"; key: string; when: string }
  | { kind: "supersede"; key: string }
  | { kind: "info" }
  | { kind: "push-only" }
  | { kind: "gap"; note: string };

export interface NotificationTypeDef {
  app: NotifApp;
  activity: NotificationActivity | null;
  /** Required when activity is null: why it cannot (or does not yet) mute. */
  activityNote?: string;
  severity: NotifSeverity;
  lifecycle: NotifLifecycle;
}

const SA_CRITICAL = "Super-Admin critical alert: deliberately never mutable.";
const todoClear = { kind: "clear", key: "todo_id", when: "the task is done or deleted (plus the feed reconcile)" } as const;

export const NOTIFICATION_TYPES = {
  /* ── To-do ─────────────────────────────────────────────────────────── */
  todo_assignment:          { app: "todo", activity: "assignments", severity: "action", lifecycle: todoClear },
  todo_mention:             { app: "todo", activity: "mentions", severity: "info", lifecycle: todoClear },
  todo_observer:            { app: "todo", activity: "assignments", severity: "info", lifecycle: todoClear },
  todo_approval_request:    { app: "todo", activity: "approvals", severity: "action", lifecycle: todoClear },
  todo_approval_decision:   { app: "todo", activity: "approvals", severity: "info", lifecycle: todoClear },
  todo_reminder:            { app: "todo", activity: "tasks_due", severity: "info", lifecycle: { kind: "supersede", key: "todo_id" } },
  todo_overdue:             { app: "todo", activity: "tasks_due", severity: "warning", lifecycle: todoClear },
  todo_recurring:           { app: "todo", activity: "tasks_due", severity: "info", lifecycle: { kind: "supersede", key: "subject" } },

  /* ── Calendar ──────────────────────────────────────────────────────── */
  calendar_invite:          { app: "calendar", activity: "calendar_events", severity: "action", lifecycle: { kind: "supersede", key: "event_id" } },
  calendar_reminder:        { app: "calendar", activity: "calendar_events", severity: "info", lifecycle: { kind: "supersede", key: "event_id" } },
  calendar_cancelled:       { app: "calendar", activity: "calendar_events", severity: "info", lifecycle: { kind: "supersede", key: "event_id" } },
  calendar_rescheduled:     { app: "calendar", activity: "calendar_events", severity: "info", lifecycle: { kind: "supersede", key: "event_id" } },
  calendar_rsvp_accepted:   { app: "calendar", activity: "calendar_events", severity: "info", lifecycle: { kind: "supersede", key: "event_id" } },
  calendar_rsvp_declined:   { app: "calendar", activity: "calendar_events", severity: "info", lifecycle: { kind: "supersede", key: "event_id" } },

  /* ── Issue reports (QA) ────────────────────────────────────────────── */
  qa_issue_assigned:        { app: "issue-reports", activity: "qa_reports", severity: "action", lifecycle: { kind: "gap", note: "clear by issue_id when the issue is closed/verified" } },
  qa_issue_reassigned:      { app: "issue-reports", activity: "qa_reports", severity: "action", lifecycle: { kind: "gap", note: "clear by issue_id when the issue is closed/verified" } },
  qa_comment_added:         { app: "issue-reports", activity: "comments_activity", severity: "info", lifecycle: { kind: "gap", note: "clear by issue_id when the issue is closed/verified" } },
  qa_status_changed:        { app: "issue-reports", activity: "qa_reports", severity: "info", lifecycle: { kind: "gap", note: "supersede by issue_id — only the latest status matters" } },
  qa_priority_changed:      { app: "issue-reports", activity: "qa_reports", severity: "info", lifecycle: { kind: "gap", note: "supersede by issue_id — only the latest priority matters" } },
  qa_issue_reopened:        { app: "issue-reports", activity: "qa_reports", severity: "warning", lifecycle: { kind: "gap", note: "clear by issue_id when the issue is closed/verified" } },
  qa_issue_verified:        { app: "issue-reports", activity: "qa_reports", severity: "info", lifecycle: { kind: "info" } },
  qa_issue_closed:          { app: "issue-reports", activity: "qa_reports", severity: "info", lifecycle: { kind: "info" } },
  qa_issue_mentioned:       { app: "issue-reports", activity: "mentions", severity: "info", lifecycle: { kind: "gap", note: "clear by issue_id when the issue is closed/verified" } },
  qa_issue_duplicate_marked: { app: "issue-reports", activity: "qa_reports", severity: "info", lifecycle: { kind: "info" } },

  /* ── Reports ───────────────────────────────────────────────────────── */
  report_approval_request:  { app: "reports", activity: "approvals", severity: "action", lifecycle: { kind: "clear", key: "report_id", when: "the report is approved or returned" } },
  report_submitted:         { app: "reports", activity: "reports_activity", severity: "info", lifecycle: { kind: "info" } },
  report_decided:           { app: "reports", activity: "reports_activity", severity: "info", lifecycle: { kind: "info" } },
  report_comment:           { app: "reports", activity: "comments_activity", severity: "info", lifecycle: { kind: "supersede", key: "report_id" } },
  report_reminder:          { app: "reports", activity: "reports_activity", severity: "action", lifecycle: { kind: "gap", note: "clear when the owed report is sent" } },
  report_escalation:        { app: "reports", activity: "reports_activity", severity: "warning", lifecycle: { kind: "gap", note: "clear when the owed report is sent" } },
  report_request:           { app: "reports", activity: "reports_activity", severity: "action", lifecycle: { kind: "gap", note: "clear when the requested report is sent (request_id)" } },

  /* ── HR (the approver's side) ──────────────────────────────────────── */
  leave_approval_request:   { app: "hr", activity: "approvals", severity: "action", lifecycle: { kind: "clear", key: "leave_request_id", when: "the step is decided" } },
  attendance_correction_approval_request: { app: "hr", activity: "approvals", severity: "action", lifecycle: { kind: "clear", key: "attendance_correction_id", when: "the correction is decided" } },
  attendance_overtime_approval_request:   { app: "hr", activity: "approvals", severity: "action", lifecycle: { kind: "clear", key: "attendance_record_id", when: "the overtime is decided" } },
  hr_expiry:                { app: "hr", activity: "hr_activity", severity: "action", lifecycle: { kind: "supersede", key: "employee_id+field" } },

  /* ── My HR (the employee's side) ───────────────────────────────────── */
  leave_request_decided:            { app: "me", activity: "hr_activity", severity: "info", lifecycle: { kind: "info" } },
  hr_attendance_correction_decided: { app: "me", activity: "hr_activity", severity: "info", lifecycle: { kind: "info" } },
  hr_attendance_overtime_decided:   { app: "me", activity: "hr_activity", severity: "info", lifecycle: { kind: "info" } },
  hr_attendance_auto_closed:        { app: "me", activity: "hr_activity", severity: "info", lifecycle: { kind: "info" } },
  hr_attendance_clockout_reminder:  { app: "me", activity: "hr_activity", severity: "info", lifecycle: { kind: "gap", note: "clear when the employee clocks out (or the day auto-closes)" } },

  /* ── Projects & Planning ───────────────────────────────────────────── */
  project_task_assigned:    { app: "projects", activity: "projects_planning", severity: "action", lifecycle: { kind: "clear", key: "task_id", when: "the task is completed" } },
  project_task_comment:     { app: "projects", activity: "comments_activity", severity: "info", lifecycle: { kind: "clear", key: "task_id", when: "the task is completed" } },
  project_task_due:         { app: "projects", activity: "projects_planning", severity: "warning", lifecycle: { kind: "clear", key: "task_id", when: "the task is completed (the reminder cron also replaces its own)" } },
  planning_published:       { app: "planning", activity: "projects_planning", severity: "info", lifecycle: { kind: "gap", note: "clear by item id when the shift is taken by someone else or unpublished" } },
  planning_taken:           { app: "planning", activity: "projects_planning", severity: "info", lifecycle: { kind: "info" } },

  /* ── Inventory ─────────────────────────────────────────────────────── */
  transfer_approved:        { app: "inventory", activity: "inventory_activity", severity: "info", lifecycle: { kind: "gap", note: "supersede by transfer_id — only the latest state matters" } },
  transfer_cancelled:       { app: "inventory", activity: "inventory_activity", severity: "info", lifecycle: { kind: "gap", note: "supersede by transfer_id — only the latest state matters" } },
  transfer_shipped:         { app: "inventory", activity: "inventory_activity", severity: "info", lifecycle: { kind: "gap", note: "supersede by transfer_id — only the latest state matters" } },
  transfer_received:        { app: "inventory", activity: "inventory_activity", severity: "info", lifecycle: { kind: "gap", note: "supersede by transfer_id — only the latest state matters" } },
  low_stock_alert:          { app: "inventory", activity: "low_stock", severity: "warning", lifecycle: { kind: "gap", note: "clear by item when stock is back above its minimum (24 h dedupe exists)" } },

  /* ── Commercial & finance ──────────────────────────────────────────── */
  quotation_updated:        { app: "quotations", activity: "quotation_activity", severity: "info", lifecycle: { kind: "gap", note: "supersede by quotation id — 5 unread copies of one quotation measured 26/09" } },
  invoice_sent:             { app: "invoices", activity: "finance_activity", severity: "info", lifecycle: { kind: "info" } },
  finance_reminder:         { app: "finance", activity: "finance_activity", severity: "action", lifecycle: { kind: "gap", note: "clear by reminder_id when marked collected/paid/cancelled" } },

  /* ── Notes, membership, AI, Discuss ────────────────────────────────── */
  note_shared:              { app: "notes", activity: null, activityNote: "OPEN: no Settings switch fits a shared note yet — lands under Other.", severity: "info", lifecycle: { kind: "info" } },
  membership_request:       { app: "accounts", activity: "membership_requests", severity: "action", lifecycle: { kind: "gap", note: "clear when the request is approved or rejected" } },
  support_request:          { app: "accounts", activity: "membership_requests", severity: "action", lifecycle: { kind: "gap", note: "clear when the sign-in help request is handled" } },
  ai_brief:                 { app: "ai", activity: null, activityNote: "OPEN: no Settings switch for the daily brief yet — lands under Other.", severity: "info", lifecycle: { kind: "gap", note: "supersede — today's brief replaces yesterday's unread one" } },
  discuss_message:          { app: "discuss", activity: "discuss_messages", severity: "info", lifecycle: { kind: "push-only" } },
  test:                     { app: "settings", activity: null, activityNote: "The user's own test push (Settings → Notifications) — muting it would defeat the test.", severity: "info", lifecycle: { kind: "push-only" } },

  /* ── Super-Admin security (notifySuperAdmins → metadata.kind) ──────── */
  new_device:               { app: "activity-monitor", activity: "security_alerts", severity: "warning", lifecycle: { kind: "supersede", key: "subject" } },
  failed_login_threshold:   { app: "activity-monitor", activity: "security_alerts", severity: "warning", lifecycle: { kind: "supersede", key: "subject" } },
  suspicious:               { app: "activity-monitor", activity: "security_alerts", severity: "warning", lifecycle: { kind: "supersede", key: "subject" } },
  price_cost_change:        { app: "activity-monitor", activity: "price_fx", severity: "warning", lifecycle: { kind: "supersede", key: "subject" } },
  data_delete:              { app: "activity-monitor", activity: null, activityNote: SA_CRITICAL, severity: "critical", lifecycle: { kind: "supersede", key: "subject" } },
  sensitive_export:         { app: "activity-monitor", activity: null, activityNote: SA_CRITICAL, severity: "critical", lifecycle: { kind: "supersede", key: "subject" } },
  admin_role_change:        { app: "activity-monitor", activity: null, activityNote: SA_CRITICAL, severity: "critical", lifecycle: { kind: "supersede", key: "subject" } },
  settings_change:          { app: "activity-monitor", activity: null, activityNote: SA_CRITICAL, severity: "critical", lifecycle: { kind: "supersede", key: "subject" } },
  file_change:              { app: "activity-monitor", activity: null, activityNote: SA_CRITICAL, severity: "critical", lifecycle: { kind: "supersede", key: "subject" } },
} as const satisfies Record<string, NotificationTypeDef>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

/** The registered definition for a stored `metadata.type ?? metadata.kind`,
 *  or null for a string nobody registered (old rows, or a writer the
 *  validator has not seen yet — both fall back to the legacy classifier). */
export function notificationTypeDef(raw: unknown): NotificationTypeDef | null {
  if (typeof raw !== "string" || !raw) return null;
  return (NOTIFICATION_TYPES as Record<string, NotificationTypeDef>)[raw] ?? null;
}
