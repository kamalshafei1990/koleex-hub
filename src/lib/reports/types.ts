/* ===========================================================================
   Phase R.1 — Reporting & PDF Output System
   Core types shared by report builders, the renderer, and the API.

   The hard rule that runs through this whole module: every report is
   either `external` (customer- / supplier-facing, must NEVER leak
   internal data like profit, margin, cost, intelligence signals) or
   `internal` (operator-only, free to expose everything). The
   discriminator drives both the builder logic AND the HTML renderer
   (the renderer refuses to print an "internal_warning" or any
   internal-flagged field on an external report).
   ========================================================================== */

export type ReportVisibility = "external" | "internal";

export type ReportType =
  /* External — safe to print and hand to a customer / supplier. */
  | "customer_statement"
  | "supplier_statement"
  /* Internal — operator-only. Show profit, cost, signals, etc. */
  | "payment_report"
  | "reconciliation_report"
  | "treasury_report"
  | "expense_report"
  | "executive_summary";

export type ReportChannel = "preview" | "pdf" | "print";

/** Per-report filter shape — superset, individual reports use a subset. */
export interface ReportFilters {
  customer_id?: string;
  supplier_id?: string;
  bank_account_id?: string;
  date_from?: string;       // ISO yyyy-mm-dd
  date_to?: string;         // ISO yyyy-mm-dd
  currency?: string;        // limit to a single currency
  category_id?: string;     // expense report
  include_drafts?: boolean;
}

/** What the builder needs to render. Built once per report request. */
export interface ReportBuildContext {
  tenantId: string;
  tenantName: string;
  generatedByName: string;
  generatedByAccountId: string | null;
  filters: ReportFilters;
}

/* ---------- The report payload — the renderer's only input ------------- */

export interface ReportMeta {
  report_type: ReportType;
  visibility: ReportVisibility;
  title: string;
  subtitle?: string;
  generated_at: string;          // ISO timestamp
  generated_by_name: string;
  period?: { from: string; to: string };
  currency: string;
  report_no: string;             // human-readable per-export reference
  tenant_name: string;
  locale: string;                // "en-US" for now
}

export interface ReportRecipient {
  label: string;                 // "Customer" | "Supplier"
  name: string;
  address?: string;
  contact?: string;
  account_no?: string;
}

export type SummaryTone = "positive" | "negative" | "neutral" | "warning";
export type ValueFormat = "money" | "count" | "percent" | "text" | "date";

export interface ReportSummaryItem {
  label: string;
  value: number | string;
  format?: ValueFormat;
  tone?: SummaryTone;
  hint?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: ValueFormat;
  width?: string;                // CSS value, e.g. "120px"
}

export type ReportRowValue = string | number | null;

export interface ReportTableSection {
  kind: "table";
  title?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, ReportRowValue>>;
  empty_state?: string;
}

export interface ReportKvSection {
  kind: "kv";
  title?: string;
  pairs: Array<{ label: string; value: string }>;
}

export interface ReportNoteSection {
  kind: "note";
  title?: string;
  body: string;
}

export interface ReportSpacerSection {
  kind: "spacer";
}

export type ReportSection =
  | ReportTableSection
  | ReportKvSection
  | ReportNoteSection
  | ReportSpacerSection;

export interface ReportTotalsItem {
  label: string;
  value: number;
  format?: ValueFormat;
  emphasized?: boolean;
}

/* ── Phase R.3 — signature / stamp slots ───────────────────────────
   Architecture-only; the renderer draws labelled signature lines and
   an empty stamp box ready for ink. Upload/storage of actual
   signatures and stamps is out of scope for R.3. */
export type SignatureRole = "prepared_by" | "reviewed_by" | "approved_by" | "audited_by";

export interface SignatureSlot {
  role: SignatureRole;
  /** Display label override. Defaults applied by renderer. */
  label?: string;
  /** Pre-filled name (e.g. "John Doe, Controller"). May stay null —
   *  a signature line is still drawn in either case. */
  name?: string | null;
  /** ISO date pre-filled into the date line, or null for blank. */
  date?: string | null;
}

/* ── Phase R.3 — QR verification placeholder ───────────────────────
   Architecture-only — the renderer draws a labelled box. A future
   phase wires a QR generator + a verification endpoint. */
export interface VerificationBlock {
  /** URL the QR will encode (placeholder while the verification
   *  endpoint is unimplemented). */
  verification_url?: string;
  /** Short token the operator can quote when verifying by phone. */
  token?: string;
  /** "Coming soon" hint shown in the placeholder box. */
  caption?: string;
}

/* ── Phase R.3 — executive cover page ──────────────────────────────
   Only used by the Executive Finance Summary today. The composer
   emits a dedicated page-1 cover when this block is present and
   then continues with the regular report on page 2. */
export interface CoverPage {
  /** Headline kpis (4 cells, label + value). Same format keys as
   *  ReportSummaryItem so the cover renderer reuses formatting. */
  headline: ReportSummaryItem[];
  /** Up to 3 risks surfaced large on the cover. */
  top_risks?: string[];
  /** Short narrative — 2-3 sentences. Wrapped to ≤ 3 lines on cover. */
  narrative?: string;
}

export interface ReportPayload {
  meta: ReportMeta;
  recipient?: ReportRecipient;
  summary: ReportSummaryItem[];
  sections: ReportSection[];
  totals?: ReportTotalsItem[];
  notes?: string[];
  /** Only ever set on internal reports — the renderer refuses to print
   *  it on an external one. Used for "INTERNAL — NOT FOR DISTRIBUTION"
   *  watermark + warning band. */
  internal_warning?: string;
  /** Phase R.3 — formal signature areas. Renderer draws a labelled
   *  signature line + date line per slot. Internal reports get
   *  Prepared/Reviewed/Approved; external reports get Prepared only. */
  signatures?: SignatureSlot[];
  /** Phase R.3 — verification block. Architecture only. */
  verification?: VerificationBlock;
  /** Phase R.3 — executive cover page. Only renderer-aware when
   *  present; safe to omit for all non-executive reports. */
  cover?: CoverPage;
  /** Total row count (used for the audit row). */
  row_count: number;
  /** Headline numeric total (used for the audit row). Null for reports
   *  that don't have a single headline number. */
  total_amount?: number | null;
}

/* ---------- Template descriptor returned by GET /api/reports/templates - */

export interface ReportTemplateDescriptor {
  type: ReportType;
  visibility: ReportVisibility;
  title: string;
  description: string;
  required_filters: Array<keyof ReportFilters>;
  optional_filters: Array<keyof ReportFilters>;
  icon: string;                  // RrIcon name
}

/* ---------- Audit row shape -------------------------------------------- */

export interface FinanceReportExport {
  id: string;
  tenant_id: string;
  report_type: ReportType;
  visibility: ReportVisibility;
  channel: ReportChannel;
  target_entity_type: "customer" | "supplier" | "order" | "bank_account" | null;
  target_entity_id: string | null;
  generated_by: string | null;
  generated_at: string;
  filters: ReportFilters;
  file_path: string | null;
  row_count: number;
  total_amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
}
