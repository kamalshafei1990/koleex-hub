/* ---------------------------------------------------------------------------
   QA Issue Reporter (Phase 1) — shared types & constants.

   Client-safe: no server imports. Used by the floating reporter, the submit
   API, and the /qa admin console.
   --------------------------------------------------------------------------- */

export type IssueType =
  | "bug"
  | "ui"
  | "translation"
  | "performance"
  | "missing_feature"
  | "data"
  | "ux"
  | "suggestion"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";

/** Operational urgency (workflow), distinct from severity (impact). */
export type Priority = "low" | "normal" | "high" | "urgent";

export type IssueStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "fixed"
  | "verified"
  | "rejected"
  | "duplicate"
  | "needs_more_info"
  | "closed"
  | "reopened";

export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "ui", label: "UI Problem" },
  { value: "translation", label: "Translation Issue" },
  { value: "performance", label: "Performance Issue" },
  { value: "missing_feature", label: "Missing Feature" },
  { value: "data", label: "Data Issue" },
  { value: "ux", label: "Confusing UX" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
];

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUSES: { value: IssueStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "needs_more_info", label: "Needs More Info" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

/** Terminal-ish states that stamp resolved_at and can be reopened. */
export const RESOLVED_STATUSES: IssueStatus[] = ["fixed", "verified", "rejected", "duplicate", "closed"];

/** Linear happy-path lifecycle, used for the workflow stepper UI. */
export const WORKFLOW_STEPS: { value: IssueStatus; label: string }[] = [
  { value: "new", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
];

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = Object.fromEntries(
  ISSUE_TYPES.map((t) => [t.value, t.label]),
) as Record<IssueType, string>;
export const SEVERITY_LABEL: Record<Severity, string> = Object.fromEntries(
  SEVERITIES.map((t) => [t.value, t.label]),
) as Record<Severity, string>;
export const STATUS_LABEL: Record<IssueStatus, string> = Object.fromEntries(
  STATUSES.map((t) => [t.value, t.label]),
) as Record<IssueStatus, string>;
export const PRIORITY_LABEL: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((t) => [t.value, t.label]),
) as Record<Priority, string>;

export const ISSUE_TYPE_VALUES = ISSUE_TYPES.map((t) => t.value);
export const SEVERITY_VALUES = SEVERITIES.map((t) => t.value);
export const STATUS_VALUES = STATUSES.map((t) => t.value);
export const PRIORITY_VALUES = PRIORITIES.map((t) => t.value);

/** Sort weight for the priority queue (urgent first). */
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export interface QaReport {
  id: string;
  tenant_id: string;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  app_module: string | null;
  route: string | null;
  page_title: string | null;
  issue_type: IssueType;
  severity: Severity;
  title: string;
  description: string | null;
  expected_result: string | null;
  suggested_solution: string | null;
  /** Resolved to a short-lived signed URL by the API; null when no screenshot.
   *  Mirrors `screenshot_urls[0]` for backward compatibility. */
  screenshot_url: string | null;
  /** All screenshots attached to this report, as short-lived signed URLs.
   *  null when none were attached. Hydrated by the API. */
  screenshot_urls?: string[] | null;
  browser_info: string | null;
  device_info: string | null;
  screen_size: string | null;
  language: string | null;
  timezone: string | null;
  status: IssueStatus;
  assigned_to: string | null;
  developer_notes: string | null;
  resolution_summary: string | null;
  fixed_commit: string | null;
  /* Phase-3 workflow & ticketing. */
  priority: Priority;
  assigned_at: string | null;
  assigned_by: string | null;
  duplicate_of_issue_id: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  reopen_count: number;
  /** Generated column — true when the row carries everything the AI pipeline needs. */
  claude_ready: boolean;
  /** Hydrated by the API (denormalised, not a column): display name of the assignee. */
  assigned_to_name?: string | null;
  /** Hydrated by the API: comment count for list badges. */
  comment_count?: number;
  /* Phase-2 component inspection metadata. */
  component_name: string | null;
  component_module: string | null;
  component_section: string | null;
  component_record_id: string | null;
  component_rect: { top: number; left: number; width: number; height: number } | null;
  /** All components picked by the reporter (multi-select). The first entry
   *  mirrors the scalar component_* fields for backward compatibility. */
  components?: Array<{
    component: string;
    module: string | null;
    section: string | null;
    recordId: string | null;
    rect: { top: number; left: number; width: number; height: number } | null;
    fallback?: boolean;
    route?: string;
  }> | null;
  component_path: string | null;
  data_entity: string | null;
  db_table: string | null;
  repro_steps: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/**
 * Map a Hub route to its owning app/module. Longest-prefix match wins, so
 * "/suppliers/main" resolves to "Suppliers". Falls back to the first path
 * segment (title-cased) or "Hub".
 */
const ROUTE_MODULE_RULES: { prefix: string; module: string }[] = [
  { prefix: "/suppliers", module: "Suppliers" },
  { prefix: "/products", module: "Product Data" },
  { prefix: "/product-data", module: "Product Data" },
  { prefix: "/catalogs", module: "Catalogs" },
  { prefix: "/database", module: "Database" },
  { prefix: "/inventory", module: "Inventory" },
  { prefix: "/finance", module: "Finance" },
  { prefix: "/expenses", module: "Expenses" },
  { prefix: "/sales", module: "Sales" },
  { prefix: "/purchase", module: "Purchase" },
  { prefix: "/invoices", module: "Invoices" },
  { prefix: "/quotations", module: "Quotations" },
  { prefix: "/crm", module: "CRM" },
  { prefix: "/contacts", module: "Contacts" },
  { prefix: "/customers", module: "Customers" },
  { prefix: "/employees", module: "HR" },
  { prefix: "/hr", module: "HR" },
  { prefix: "/projects", module: "Projects" },
  { prefix: "/operations", module: "Operations" },
  { prefix: "/notes", module: "Notes" },
  { prefix: "/discuss", module: "Discuss" },
  { prefix: "/calendar", module: "Calendar" },
  { prefix: "/knowledge", module: "Knowledge" },
  { prefix: "/admin", module: "Admin" },
  { prefix: "/create", module: "Create" },
  { prefix: "/qa", module: "QA" },
];

/* ─────────────────────────── Phase-3 entities ─────────────────────────── */

/** An image attached to a QA comment. Stored as path+metadata; the API
 *  injects a short-lived signed `url` on read (paths stay private). */
export interface QaAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
  uploaded_at?: string;
  /** Short-lived signed URL, present only on API reads. */
  url?: string | null;
}

/** A single message in an issue's discussion thread. */
export interface QaComment {
  id: string;
  tenant_id: string;
  issue_id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  message: string;
  is_internal_note: boolean;
  attachments: QaAttachment[];
  created_at: string;
  edited_at: string | null;
}

export type ActivityType =
  | "created"
  | "status_changed"
  | "assigned"
  | "unassigned"
  | "priority_changed"
  | "reopened"
  | "resolved"
  | "comment_added"
  | "duplicate_marked"
  | "commit_added"
  | "watcher_added"
  | "watcher_removed";

/** One append-only entry in an issue's activity timeline. */
export interface QaActivity {
  id: string;
  tenant_id: string;
  issue_id: string;
  actor_id: string | null;
  actor_name: string | null;
  activity_type: ActivityType;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  created: "filed the issue",
  status_changed: "changed status",
  assigned: "assigned",
  unassigned: "unassigned",
  priority_changed: "changed priority",
  reopened: "reopened",
  resolved: "resolved",
  comment_added: "commented",
  duplicate_marked: "marked as duplicate",
  commit_added: "linked a fix commit",
  watcher_added: "started watching",
  watcher_removed: "stopped watching",
};

/** A user following an issue (identity exposed to admins only). */
export interface QaWatcher {
  account_id: string;
  name: string;
  avatar_url: string | null;
}

/** A pickable assignee (developer/tester) for the assignment dropdown. */
export interface QaAssignee {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

/** Predefined saved views for the queue (client-side filter presets). */
export type SavedViewId =
  | "all"
  | "my_issues"
  | "urgent"
  | "waiting_verification"
  | "ready_for_claude"
  | "recently_reopened";

export const SAVED_VIEWS: { id: SavedViewId; label: string }[] = [
  { id: "all", label: "All Issues" },
  { id: "my_issues", label: "My Issues" },
  { id: "urgent", label: "Urgent" },
  { id: "waiting_verification", label: "Waiting Verification" },
  { id: "ready_for_claude", label: "Ready for AI" },
  { id: "recently_reopened", label: "Recently Reopened" },
];

/**
 * Compute Claude-readiness on the client (mirror of the DB generated column).
 * A report is ready when it carries a screenshot, pinned component metadata,
 * a description, and an expected result.
 */
export function isClaudeReady(r: Pick<QaReport,
  "screenshot_url" | "component_name" | "description" | "expected_result" | "claude_ready">): boolean {
  if (typeof r.claude_ready === "boolean") return r.claude_ready;
  return Boolean(
    r.screenshot_url &&
    r.component_name &&
    r.description && r.description.trim() &&
    r.expected_result && r.expected_result.trim(),
  );
}

export function moduleForRoute(route: string | null | undefined): string {
  if (!route) return "Hub";
  const path = route.split("?")[0];
  let best: { prefix: string; module: string } | null = null;
  for (const rule of ROUTE_MODULE_RULES) {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  if (best) return best.module;
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return "Hub";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}
