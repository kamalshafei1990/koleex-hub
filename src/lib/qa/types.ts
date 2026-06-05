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

export type IssueStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "fixed"
  | "rejected"
  | "duplicate"
  | "needs_more_info"
  | "closed";

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
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "needs_more_info", label: "Needs More Info" },
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

export const ISSUE_TYPE_VALUES = ISSUE_TYPES.map((t) => t.value);
export const SEVERITY_VALUES = SEVERITIES.map((t) => t.value);
export const STATUS_VALUES = STATUSES.map((t) => t.value);

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
  /** Resolved to a short-lived signed URL by the API; null when no screenshot. */
  screenshot_url: string | null;
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
