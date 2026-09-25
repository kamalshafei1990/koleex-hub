/* ---------------------------------------------------------------------------
   Reports — the built-in types' catalog: every type's sections, its default
   readers and its flags (Phase 1 → 5B; moved out of ./templates.ts in 5C).

   WHO MAY IMPORT THIS: the server, the template builder (its own chunk,
   loaded when its tab opens) and validate:reports. The report page
   (/reports/[id]) and its print NEVER do — a report arrives with its own type
   from the server (GET /api/work-reports/[id] → `template.def`), so the page
   the whole team opens every day does not grow with each new type. Nor does
   the Reports home: it lists the types from their HEADS, ./catalog-heads.ts,
   generated from this file — ⚠️ after ANY change here run
   `npm run -s reports:heads` (validate:reports fails until you do). The
   engine's types and helpers stay in ./templates.ts, which this file uses.
   --------------------------------------------------------------------------- */

import type { RrIconName } from "@/components/ui/RrIcon";
import type { ReportColumnType, ReportDataSource, ReportFamily, ReportSectionDef, ReportSectionKind, ReportTemplateDef } from "./templates";
import { CARRY_RULES } from "./carry";

const t = (id: string, kind: ReportSectionKind, required = false): ReportSectionDef => ({ id, kind, required });
/** A block section (Phase 4A) with its points, columns or link types. */
const b = (id: string, kind: ReportSectionKind, extra: Omit<ReportSectionDef, "id" | "kind" | "required">, required = false): ReportSectionDef => ({ id, kind, required, ...extra });
const pts = (...ids: string[]) => ids.map((id) => ({ id }));
/** A table column (text unless said). */
const c = (id: string, type: ReportColumnType = "text") => ({ id, type });
/** A CEO-office type (5B): officeOnly, to the writer's manager, no review. */
const office = (key: string, icon: RrIconName, sections: ReportSectionDef[], more: Partial<ReportTemplateDef> = {}): ReportTemplateDef =>
  ({ key, family: "office", icon, cadence: null, officeOnly: true, recipients: "manager", reviewRequired: false, confidential: false, sections, ...more });
const R = { range: true } as const;

/* ── 5C helpers (owner's picks 26 Sep 2026) ── */
/** What the report is about — ONE project, employee or warehouse (picking
 *  another replaces it); its numbers blocks read it (DATA_ABOUT). */
const about = (type: "project" | "employee" | "warehouse", required = true): ReportSectionDef =>
  b(type, "links", { linkTypes: [type], max: 1 }, required);
const data = (id: string, source: ReportDataSource, extra: Omit<ReportSectionDef, "id" | "kind" | "required" | "source"> = {}): ReportSectionDef =>
  b(id, "data", { source, ...extra });
type More = Partial<ReportTemplateDef>;
/** An HR type: HR · view starts it (`orTeam`: a manager too), and it reaches HR. */
const hr = (key: string, group: string, icon: RrIconName, sections: ReportSectionDef[], more: More = {}): ReportTemplateDef =>
  ({ key, family: "hr", group, icon, cadence: null, app: "HR", recipients: "manager_hr", reviewRequired: false, confidential: false, sections, ...more });
/** A salary type: «Payroll Reports» starts it; confidential, to the writer's manager only. */
const pay = (key: string, icon: RrIconName, sections: ReportSectionDef[], more: More = {}): ReportTemplateDef =>
  ({ key, family: "hr", group: "pay", icon, cadence: "monthly", payrollOnly: true, recipients: "manager", reviewRequired: false, confidential: true, sections, ...more });
const prj = (key: string, group: string, icon: RrIconName, sections: ReportSectionDef[], more: More = {}): ReportTemplateDef =>
  ({ key, family: "projects", group, icon, cadence: null, app: "Projects", recipients: "manager", reviewRequired: false, confidential: false, sections, ...more });
const inv = (key: string, icon: RrIconName, sections: ReportSectionDef[], more: More = {}): ReportTemplateDef =>
  ({ key, family: "inventory", icon, cadence: null, app: "Inventory", recipients: "manager", reviewRequired: false, confidential: false, sections, ...more });
const fin = (key: string, icon: RrIconName, sections: ReportSectionDef[], more: More = {}): ReportTemplateDef =>
  ({ key, family: "finance", icon, cadence: "monthly", app: "Finance", recipients: "manager", reviewRequired: false, confidential: false, sections, ...more });
const M = { cadence: "monthly" } as const;
const TEAM = { orTeam: true } as const;

export const REPORT_TEMPLATES: ReportTemplateDef[] = [
  /* ── Work: the Executive Assistant JD's reporting system, for everyone ── */
  { key: "daily", family: "work", icon: "calendar", cadence: "daily", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("meetings", "list"), t("done", "list", true), t("pending", "list"), t("blockers", "text"), t("tomorrow", "list")] },
  { key: "weekly_plan", family: "work", icon: "bullseye-arrow", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("goals", "list", true), t("meetings", "list"), t("deadlines", "list"), t("support", "text")] },
  { key: "weekly", family: "work", icon: "clipboard", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("summary", "text", true), t("meetings", "list"), t("projects", "list"), t("decisions", "list"), t("next_week", "list")] },
  { key: "monthly", family: "work", icon: "newspaper", cadence: "monthly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("summary", "text", true), t("projects", "list"), t("travel", "list"), t("social", "text"), t("improvements", "list")] },
  /* ── Visits ── */
  { key: "customer_visit", family: "visits", icon: "handshake", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("link", "links", { linkTypes: ["customer", "product", "order"] }), t("who", "text", true), t("purpose", "text"), t("discussion", "text", true), t("opportunities", "list"), t("next_steps", "list")] },
  { key: "supplier_visit", family: "visits", icon: "building", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("link", "links", { linkTypes: ["supplier", "product"] }), t("who", "text", true), t("purpose", "text"), t("findings", "list", true), t("decisions", "list"), t("next_steps", "list")] },
  /* ── Sales & customers (Phase 4B, owner's picks 25 Sep 2026): the
     customer reports, the numbers from the apps, the key customer, the
     market ── */
  { key: "customer_call", family: "sales", icon: "user-headset", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "quotation", "order", "product"] }),
      b("channel", "choice", { options: ["phone", "whatsapp", "wechat", "email", "video", "in_person"] }, true),
      t("who", "text", true), t("discussion", "text", true), t("needs", "list"), t("next_steps", "list"),
    ] },
  { key: "complaint", family: "sales", icon: "hand-holding-heart", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "order", "invoice", "product"] }, true),
      b("severity", "choice", { options: ["low", "medium", "high", "critical"] }, true),
      t("what", "text", true), t("cause", "text"), t("actions", "list"),
      b("status", "choice", { options: ["solved", "in_progress", "open"] }, true),
      b("customer_sign", "signature", {}),
    ] },
  { key: "lost_deal", family: "sales", icon: "cross-circle", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "quotation", "product"] }, true),
      b("reason", "choice", { options: ["price", "delivery", "quality", "specs", "payment", "competitor", "budget", "no_reply", "other"] }, true),
      t("story", "text", true),
      b("competitor", "table", { columns: [{ id: "competitor", type: "text" }, { id: "product", type: "text" }, { id: "price", type: "money" }, { id: "terms", type: "text" }], summary: "lowest" }),
      t("lesson", "text"),
    ] },
  { key: "sales_weekly", family: "sales", icon: "coins", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("quotations", "data", { source: "quotations" }), b("orders", "data", { source: "orders" }), b("invoices", "data", { source: "invoices" }),
      t("highlights", "text", true), b("customers", "links", { linkTypes: ["customer", "quotation", "order"] }), t("problems", "text"), t("next", "list"),
    ] },
  { key: "sales_monthly", family: "sales", icon: "money", cadence: "monthly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("quotations", "data", { source: "quotations" }), b("orders", "data", { source: "orders" }), b("invoices", "data", { source: "invoices" }),
      t("highlights", "text", true), b("customers", "links", { linkTypes: ["customer", "quotation", "order"] }), t("problems", "text"), t("next", "list"),
    ] },
  { key: "quote_followup", family: "sales", icon: "clock", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("waiting", "data", { source: "quotes_waiting", notes: true }), t("summary", "text", true)] },
  { key: "collection", family: "sales", icon: "wallet", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("receivables", "data", { source: "receivables", notes: true }), t("actions", "list", true), t("escalate", "text")] },
  { key: "account_plan", family: "sales", icon: "flag-checkered", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer"] }, true),
      b("goals", "table", { columns: [{ id: "goal", type: "text" }, { id: "target", type: "text" }, { id: "date", type: "date" }, { id: "owner", type: "text" }] }, true),
      b("relationship", "score", { points: pts("satisfaction", "trust", "communication", "payment", "growth") }, true),
      t("risks", "list"), t("actions", "list", true),
    ] },
  { key: "account_review", family: "sales", icon: "badge-check", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer"] }, true),
      t("year", "text", true),
      b("rating", "score", { points: pts("satisfaction", "trust", "communication", "payment", "growth") }, true),
      t("wins", "list"), t("problems", "list"), t("next_year", "list", true),
    ] },
  { key: "competitor_prices", family: "sales", icon: "scale", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["product"] }),
      t("market", "text", true),
      b("prices", "table", { columns: [{ id: "competitor", type: "text" }, { id: "product", type: "text" }, { id: "price", type: "money" }, { id: "terms", type: "text" }, { id: "source", type: "text" }], summary: "lowest" }, true),
      t("notes", "text"),
    ] },
  { key: "country_study", family: "sales", icon: "ship-side", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      t("country", "text", true), t("demand", "text", true),
      b("competitors", "table", { columns: [{ id: "competitor", type: "text" }, { id: "brands", type: "text" }, { id: "price", type: "money" }, { id: "share", type: "text" }], summary: "lowest" }),
      t("channels", "list"), t("rules", "text"),
      b("recommendation", "choice", { options: ["go", "test", "wait", "no"] }, true),
      t("why", "text", true),
    ] },
  { key: "agent_report", family: "sales", icon: "contract", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "product"] }),
      t("agent", "text", true), t("results", "text", true),
      b("rating", "score", { points: pts("sales", "coverage", "communication", "payment", "policy") }),
      t("issues", "list"), t("support", "text"),
    ] },
  /* ── Quality (Phase 4C) ── */
  { key: "pre_shipment", family: "quality", icon: "box-circle-check", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "supplier", "product"] }, true),
      b("checks", "checklist", { points: pts("quantity", "packing", "marks", "appearance", "function", "accessories", "manuals", "safety") }, true),
      b("defects", "table", { columns: [{ id: "defect", type: "text" }, { id: "count", type: "number" }, { id: "level", type: "text" }] }),
      b("result", "choice", { options: ["pass", "conditional", "fail"] }, true),
      t("notes", "text"),
      b("inspector_sign", "signature", {}),
    ] },
  { key: "incoming", family: "quality", icon: "box-open", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "supplier", "product"] }, true),
      b("checks", "checklist", { points: pts("quantity", "packaging", "damage", "labels", "documents", "function") }, true),
      b("issues", "table", { columns: [{ id: "item", type: "text" }, { id: "expected", type: "number" }, { id: "received", type: "number" }, { id: "note", type: "text" }], summary: "none" }),
      b("result", "choice", { options: ["accepted", "partial", "rejected"] }, true),
      t("notes", "text"),
    ] },
  { key: "defect_report", family: "quality", icon: "stethoscope", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["product", "supplier", "order", "customer"] }, true),
      b("severity", "choice", { options: ["minor", "major", "critical"] }, true),
      t("what", "text", true), t("scope", "text"), t("cause", "text"), t("containment", "list"),
    ] },
  { key: "corrective_action", family: "quality", icon: "recycle", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "product", "order"] }),
      t("problem", "text", true), t("root_cause", "text", true),
      b("actions", "table", { columns: [{ id: "action", type: "text" }, { id: "owner", type: "text" }, { id: "due", type: "date" }, { id: "state", type: "text" }] }, true),
      t("verification", "text"),
      b("status", "choice", { options: ["open", "in_progress", "closed"] }, true),
    ] },
  { key: "supplier_return", family: "quality", icon: "delivery-truck", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "order", "product"] }, true),
      b("items", "table", { columns: [{ id: "item", type: "text" }, { id: "qty", type: "number" }, { id: "reason", type: "text" }], summary: "none" }, true),
      b("reason", "choice", { options: ["defect", "wrong_item", "damaged", "excess", "other"] }, true),
      b("ask", "choice", { options: ["replace", "repair", "refund", "credit"] }, true),
      t("notes", "text"),
    ] },
  /* ── Purchasing & suppliers: sourcing (4C) ── */
  { key: "supplier_approval", family: "suppliers", icon: "shield-check", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier"] }, true),
      b("documents", "checklist", { points: pts("licence", "export", "certificates", "bank", "factory", "samples", "references", "terms") }, true),
      b("rating", "score", { points: pts("quality", "price", "capacity", "communication", "reliability") }, true),
      b("decision", "choice", { options: ["approve", "trial", "reject"] }, true),
      t("why", "text", true),
    ] },
  { key: "sample_evaluation", family: "suppliers", icon: "flask", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "product"] }, true),
      b("checks", "checklist", { points: pts("spec", "workmanship", "materials", "function", "packaging", "labelling") }, true),
      b("rating", "score", { points: pts("quality", "finish", "function", "value") }, true),
      b("decision", "choice", { options: ["approve", "revise", "reject"] }, true),
      t("comments", "text"),
    ] },
  { key: "negotiation", family: "suppliers", icon: "percentage", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "product"] }, true),
      b("rounds", "table", { columns: [{ id: "round", type: "text" }, { id: "date", type: "date" }, { id: "offer", type: "money" }, { id: "target", type: "money" }, { id: "notes", type: "text" }], summary: "lowest", summaryOf: ["offer"] }, true),
      b("outcome", "choice", { options: ["agreed", "pending", "walked_away"] }, true),
      t("terms", "text"), t("next_steps", "list"),
    ] },
  /* ── Purchasing & suppliers: follow-up and rating (4C) ── */
  { key: "production_followup", family: "suppliers", icon: "pallet", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "supplier", "product"] }, true),
      b("stages", "checklist", { points: pts("materials", "parts", "assembly", "testing", "packing", "ready") }),
      b("progress", "choice", { options: ["on_time", "at_risk", "late"] }, true),
      t("ready_date", "text", true),
      b("delay", "choice", { options: ["materials", "capacity", "quality", "holiday", "payment", "other"] }),
      t("issues", "list"),
    ] },
  { key: "supplier_performance", family: "suppliers", icon: "heart-rate", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier"] }, true),
      b("rating", "score", { points: pts("quality", "delivery", "price", "communication", "service", "documents") }, true),
      t("incidents", "list"), t("strengths", "list"),
      b("verdict", "choice", { options: ["keep", "improve", "replace"] }, true),
      t("actions", "list"),
    ] },
  { key: "supplier_risk", family: "suppliers", icon: "flag-alt", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier"] }, true),
      b("level", "choice", { options: ["low", "medium", "high"] }, true),
      b("risks", "table", { columns: [{ id: "risk", type: "text" }, { id: "impact", type: "text" }, { id: "mitigation", type: "text" }, { id: "owner", type: "text" }] }, true),
      t("notes", "text"),
    ] },
  { key: "supplier_stop", family: "suppliers", icon: "lock", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier"] }, true),
      b("reason", "choice", { options: ["quality", "fraud", "delivery", "conduct", "price", "other"] }, true),
      t("what", "text", true), t("impact", "text"), t("alternative", "text"),
    ] },
  /* ── Purchasing numbers from the apps (4C) — the writer's own documents ── */
  { key: "purchasing_weekly", family: "suppliers", icon: "truck-container", cadence: "weekly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("orders", "data", { source: "purchase_orders" }), b("receipts", "data", { source: "receipts" }),
      b("shortages", "data", { source: "shortages" }), b("late", "data", { source: "pos_late", notes: true }),
      t("highlights", "text", true), t("problems", "text"), t("next", "list"),
    ] },
  { key: "purchasing_monthly", family: "suppliers", icon: "ship-side", cadence: "monthly", recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("orders", "data", { source: "purchase_orders" }), b("receipts", "data", { source: "receipts" }),
      b("shortages", "data", { source: "shortages" }), b("late", "data", { source: "pos_late", notes: true }),
      t("highlights", "text", true), t("problems", "text"), t("next", "list"),
    ] },
  { key: "late_pos", family: "suppliers", icon: "clock", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("late", "data", { source: "pos_late", notes: true }), t("summary", "text", true)] },
  { key: "payables", family: "suppliers", icon: "file-invoice-dollar", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [b("bills", "data", { source: "payables", notes: true }), t("plan", "text", true)] },
  /* ── Logistics (4D) ── */
  { key: "container_loading", family: "logistics", icon: "truck-side", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "customer", "product"] }, true),
      t("container", "text", true),
      b("checks", "checklist", { points: pts("clean", "undamaged", "packing", "count", "marks", "securing", "photos", "seal") }, true),
      t("issues", "text"),
      b("loader_sign", "signature", {}),
    ] },
  { key: "shipment_update", family: "logistics", icon: "shipping-fast", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "customer"] }, true),
      b("status", "choice", { options: ["booked", "loaded", "departed", "in_transit", "arrived", "cleared", "delivered", "delayed"] }, true),
      t("details", "text"), t("eta", "text", true), t("issues", "list"),
    ] },
  { key: "damage_claim", family: "logistics", icon: "gavel", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "supplier", "product", "customer"] }, true),
      t("what", "text", true),
      b("items", "table", { columns: [{ id: "item", type: "text" }, { id: "qty", type: "number" }, { id: "value", type: "money" }], summaryOf: ["value"] }, true),
      b("against", "choice", { options: ["forwarder", "insurer", "supplier", "carrier"] }, true),
      b("status", "choice", { options: ["preparing", "submitted", "accepted", "rejected", "paid"] }, true),
      t("notes", "text"),
    ] },
  { key: "customs_clearance", family: "logistics", icon: "stamp", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["order", "customer"] }, true),
      b("documents", "checklist", { points: pts("invoice", "packing_list", "bill", "origin", "conformity", "insurance") }, true),
      b("costs", "table", { columns: [{ id: "item", type: "text" }, { id: "amount", type: "money" }] }),
      b("status", "choice", { options: ["waiting_docs", "submitted", "inspection", "cleared", "held"] }, true),
      t("issues", "text"),
    ] },
  /* ── After-sales (4D; installation came with 4A) ── */
  { key: "service_visit", family: "service", icon: "car-mechanic", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "product", "order"] }, true),
      t("problem", "text", true), t("work", "list", true),
      b("parts", "table", { columns: [{ id: "part", type: "text" }, { id: "qty", type: "number" }], summary: "none" }),
      b("result", "choice", { options: ["fixed", "partly", "not_fixed"] }, true),
      t("next", "text"),
      b("customer_sign", "signature", {}),
    ] },
  { key: "warranty_claim", family: "service", icon: "receipt", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "product", "order"] }, true),
      t("serial", "text", true), t("fault", "text", true),
      b("cause", "choice", { options: ["manufacturing", "misuse", "wear", "transport", "unknown"] }, true),
      b("decision", "choice", { options: ["covered", "partly", "not_covered"] }, true),
      t("action", "text"),
    ] },
  { key: "customer_training", family: "service", icon: "graduation-cap", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "product"] }, true),
      b("attendees", "table", { columns: [{ id: "name", type: "text" }, { id: "role", type: "text" }] }, true),
      b("topics", "checklist", { points: pts("operation", "settings", "maintenance", "safety", "troubleshooting") }, true),
      b("rating", "score", { points: pts("understanding", "participation", "readiness") }),
      t("notes", "text"),
      b("customer_sign", "signature", {}),
    ] },
  { key: "spare_parts_request", family: "service", icon: "cog", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "product", "order"] }, true),
      b("parts", "table", { columns: [{ id: "part", type: "text" }, { id: "code", type: "text" }, { id: "qty", type: "number" }], summary: "none" }, true),
      b("urgency", "choice", { options: ["normal", "urgent", "machine_down"] }, true),
      b("payer", "choice", { options: ["warranty", "customer", "company"] }, true),
      t("notes", "text"),
    ] },
  /* ── Travel, visitors & meetings (4D) ── */
  { key: "trip_report", family: "travel", icon: "plane-departure", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, range: true,
    sections: [
      t("destination", "text", true),
      b("meetings", "table", { columns: [{ id: "date", type: "date" }, { id: "who", type: "text" }, { id: "company", type: "text" }, { id: "outcome", type: "text" }] }, true),
      t("results", "text", true), t("follow_ups", "list"),
      b("link", "links", { linkTypes: ["customer", "supplier"] }),
      b("expenses", "data", { source: "expenses" }),
    ] },
  { key: "delegation_visit", family: "travel", icon: "hotel", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, range: true,
    sections: [
      b("link", "links", { linkTypes: ["customer", "supplier"] }),
      b("visitors", "table", { columns: [{ id: "name", type: "text" }, { id: "company", type: "text" }, { id: "role", type: "text" }] }, true),
      t("program", "list"), t("discussed", "text", true), t("outcomes", "list", true), t("next_steps", "list"),
    ] },
  { key: "meeting_minutes", family: "travel", icon: "chair-office", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      t("attendees", "list", true), t("agenda", "list"), t("discussion", "text"),
      b("decisions", "table", { columns: [{ id: "decision", type: "text" }, { id: "owner", type: "text" }, { id: "due", type: "date" }] }, true),
      t("next_meeting", "text"),
    ] },
  { key: "decision_log", family: "travel", icon: "books", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("decisions", "table", { columns: [{ id: "date", type: "date" }, { id: "decision", type: "text" }, { id: "by", type: "text" }, { id: "why", type: "text" }] }, true),
      t("notes", "text"),
    ] },
  /* ── Purchasing & suppliers, After-sales: the first users of the Phase 4A
     blocks (the families fill out in their own phases) ── */
  { key: "factory_audit", family: "suppliers", icon: "tools", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["supplier", "product"] }, true),
      b("checks", "checklist", { points: pts("licence", "capacity", "equipment", "quality_system", "materials", "samples", "packaging", "safety", "workforce") }, true),
      b("rating", "score", { points: [{ id: "quality", weight: 30 }, { id: "capacity", weight: 20 }, { id: "price", weight: 20 }, { id: "delivery", weight: 15 }, { id: "communication", weight: 15 }] }, true),
      t("findings", "list"),
      t("decision", "text", true),
    ] },
  { key: "price_comparison", family: "suppliers", icon: "balance-scale-left", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["product", "supplier"] }),
      b("offers", "table", { columns: [{ id: "supplier", type: "text" }, { id: "price", type: "money" }, { id: "moq", type: "number" }, { id: "lead", type: "number" }, { id: "terms", type: "text" }], summary: "lowest" }, true),
      t("recommendation", "text", true),
    ] },
  { key: "installation", family: "service", icon: "hammer", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      b("link", "links", { linkTypes: ["customer", "order", "product"] }, true),
      t("work", "list", true),
      b("checks", "checklist", { points: pts("delivered", "installed", "power", "test_run", "settings", "training", "safety", "documents") }, true),
      t("issues", "text"),
      b("customer_sign", "signature", {}, true),
    ] },
  /* ── The manager and the team (Phase 5A, owner's picks 25 Sep 2026):
     only someone with a team starts these ── */
  { key: "team_summary", family: "team", icon: "users", cadence: null, range: true, teamOnly: true, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [
      t("summary", "text", true), t("attention", "list"), t("decisions", "list"),
      b("reports", "data", { source: "team_reports" }), b("work", "data", { source: "team_workload" }), b("attendance", "data", { source: "team_attendance" }),
      t("next", "list"),
    ] },
  { key: "one_on_one", family: "team", icon: "handshake", cadence: null, teamOnly: true, recipients: "none", reviewRequired: false, confidential: true,
    sections: [
      t("discussed", "text", true), t("wins", "list"), t("challenges", "list"),
      b("actions", "table", { columns: [{ id: "action", type: "text" }, { id: "owner", type: "text" }, { id: "due", type: "date" }], summary: "none" }),
      t("support", "text"), t("feedback", "text"),
    ] },
  { key: "promotion_recommendation", family: "team", icon: "award", cadence: null, teamOnly: true, recipients: "manager_hr", reviewRequired: true, confidential: true,
    sections: [
      t("employee", "text", true),
      b("recommendation", "choice", { options: ["promotion", "raise", "bonus", "new_role", "other"] }, true),
      t("current", "text"), t("proposed", "text"), t("justification", "text", true), t("achievements", "list"),
      b("rating", "score", { points: [{ id: "performance", weight: 30 }, { id: "reliability", weight: 20 }, { id: "teamwork", weight: 15 }, { id: "initiative", weight: 15 }, { id: "skills", weight: 20 }] }, true),
      t("effective", "text"),
      b("sign", "signature", {}),
    ] },
  /* ── The CEO office (Phase 5B, owner's picks 25 Sep 2026): only super
     admins and «CEO Office» in Roles start these ── */
  /* The CEO's day */
  office("morning_brief", "mug-hot", [
    t("priorities", "list", true), b("schedule", "data", { source: "schedule" }), b("decisions", "data", { source: "decisions" }),
    b("occasions", "data", { source: "occasions" }), t("followups", "list"), t("notes", "text"),
  ]),
  office("decisions_waiting", "scale", [
    t("summary", "text", true), b("decisions", "data", { source: "decisions" }),
    b("requests", "table", { columns: [c("request"), c("from"), c("deadline", "date"), c("recommendation")] }), t("notes", "text"),
  ]),
  office("followups_open", "clipboard", [
    t("summary", "text", true), b("departments", "data", { source: "followups" }), t("overdue", "list"), t("actions", "list"),
  ], R),
  office("promises_log", "badge-check", [
    b("promises", "table", { columns: [c("promise"), c("to"), c("due", "date"), c("owner"), c("state")] }, true), t("notes", "text"),
  ], R),
  office("calls_log", "user-headset", [
    b("calls", "table", { columns: [c("date", "date"), c("who"), c("channel"), c("subject"), c("action")] }, true), t("urgent", "list"), t("notes", "text"),
  ], R),
  /* Time and travel */
  office("next_week", "calendar", [
    t("summary", "text", true), b("schedule", "data", { source: "schedule" }), t("prep", "list"), t("conflicts", "list"),
  ], R),
  office("trip_folder", "plane", [
    t("purpose", "text", true),
    b("ready", "checklist", { points: pts("passport_visa", "flights", "hotel", "transport", "meetings", "documents", "gifts", "money", "insurance", "contacts") }),
    b("itinerary", "table", { columns: [c("date", "date"), c("time"), c("what"), c("where")] }),
    b("people", "table", { columns: [c("name"), c("company"), c("phone")] }), t("notes", "text"),
  ], R),
  office("bookings_log", "ticket", [
    b("bookings", "table", { columns: [c("date", "date"), c("kind"), c("for"), c("details"), c("cost", "money"), c("ref")], summaryOf: ["cost"] }, true), t("notes", "text"),
  ], R),
  office("time_split", "clock", [
    t("reading", "text", true), b("time", "data", { source: "time_split" }), b("meetings", "data", { source: "meetings" }), t("next", "list"),
  ], R),
  office("meetings_summary", "chair-office", [
    t("summary", "text", true), b("meetings", "data", { source: "meetings" }), t("decisions", "list"),
    b("actions", "table", { columns: [c("action"), c("owner"), c("due", "date")] }),
  ], R),
  /* The office */
  office("office_readiness", "broom", [
    b("checks", "checklist", { points: pts("reception", "meeting_rooms", "supplies", "hospitality", "printers_it", "internet_phones", "security_keys", "lights_ac", "cleaning", "mail") }, true),
    t("issues", "list"), t("notes", "text"),
  ]),
  office("admin_affairs", "building", [
    t("summary", "text", true), t("done", "list"), t("pending", "list"), t("issues", "list"), t("next", "list"),
  ], { cadence: "monthly" }),
  office("office_expenses", "wallet", [
    t("summary", "text", true), b("expenses", "data", { source: "expenses" }), t("unusual", "list"), t("savings", "list"),
  ], { cadence: "monthly" }),
  office("assets_custody", "key", [
    b("assets", "table", { columns: [c("item"), c("tag"), c("holder"), c("location"), c("condition")] }, true), t("missing", "list"), t("notes", "text"),
  ]),
  office("renewals", "recycle", [
    b("items", "table", { columns: [c("item"), c("provider"), c("renews", "date"), c("cost", "money"), c("owner"), c("action")], summaryOf: ["cost"] }, true),
    t("due_soon", "list"), t("notes", "text"),
  ]),
  office("visitors_log", "id-badge", [
    t("summary", "text", true), b("invited", "data", { source: "visitors" }),
    b("visitors", "table", { columns: [c("date", "date"), c("name"), c("company"), c("host"), c("purpose")] }), t("followups", "list"),
  ], R),
  /* Documents */
  office("gov_bank", "bank", [
    b("transactions", "table", { columns: [c("date", "date"), c("entity"), c("transaction"), c("state"), c("next")] }, true), t("waiting", "list"), t("notes", "text"),
  ], R),
  office("company_documents", "file", [
    b("documents", "table", { columns: [c("document"), c("number"), c("expires", "date"), c("kept"), c("action")] }, true), t("expiring", "list"), t("notes", "text"),
  ]),
  office("stamp_log", "signature", [
    b("uses", "table", { columns: [c("date", "date"), c("document"), c("party"), c("used_by"), c("approved_by")] }, true), t("notes", "text"),
  ], R),
  office("correspondence", "paper-plane", [
    b("letters", "table", { columns: [c("date", "date"), c("direction"), c("party"), c("subject"), c("ref"), c("action")] }, true), t("pending", "list"), t("notes", "text"),
  ], R),
  office("gift_register", "gift", [
    b("gifts", "table", { columns: [c("date", "date"), c("direction"), c("party"), c("gift"), c("value", "money"), c("approved_by")], summaryOf: ["value"] }, true), t("notes", "text"),
  ], R),
  office("occasions", "cocktail", [
    t("plan", "list", true), b("occasions", "data", { source: "occasions" }),
    b("greetings", "table", { columns: [c("date", "date"), c("person"), c("occasion"), c("how")] }), t("notes", "text"),
  ], R),
  /* ── Memos ── */
  { key: "decision_memo", family: "memos", icon: "gavel", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [t("background", "text", true), t("options", "list", true), t("recommendation", "text", true), t("deadline", "text")] },
  { key: "escalation", family: "memos", icon: "flag-alt", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, urgent: true,
    sections: [t("what", "text", true), t("impact", "text", true), t("needed", "text", true)] },
  { key: "handover", family: "memos", icon: "briefcase", cadence: null, recipients: "manager", reviewRequired: true, confidential: false,
    sections: [t("open_tasks", "list", true), t("meetings", "list"), t("contacts", "list"), t("notes", "text")] },
  { key: "free", family: "memos", icon: "document", cadence: null, recipients: "manager", reviewRequired: false, confidential: false, customTitle: true,
    sections: [t("body", "text", true)] },
  /* ── HR (the owner: "I need the HR also") ── */
  { key: "hr_incident", family: "hr", group: "records", icon: "hard-hat", cadence: null, recipients: "manager_hr", reviewRequired: false, confidential: false, urgent: true,
    sections: [t("what", "text", true), t("where_when", "text", true), t("people", "list"), t("action", "text")] },
  { key: "hr_grievance", family: "hr", group: "relations", icon: "lock", cadence: null, recipients: "hr", reviewRequired: false, confidential: true,
    sections: [t("subject", "text", true), t("details", "text", true), t("wanted", "text")] },
  { key: "hr_warning", family: "hr", group: "relations", icon: "id-badge", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("incident", "text", true), t("rule", "text"), t("action", "text", true)] },
  { key: "hr_exit_interview", family: "hr", group: "exit", icon: "users", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("reasons", "list", true), t("liked", "list"), t("improve", "list"), t("return", "text")] },
  /* ── HR (Phase 5C, owner's picks 26 Sep 2026): seven groups — hiring,
     time, pay, performance, relations, movement & exit, records & safety.
     The numbers come from the HR app: HR · view reads the company; a
     manager their own team where it is about people's days. ── */
  hr("hr_hiring_plan", "hiring", "users", [
    b("roles", "table", { columns: [c("role"), c("department"), c("count", "number"), c("needed_by", "date"), c("reason")], summaryOf: ["count"] }, true),
    t("summary", "text", true), t("budget", "text"),
  ], { ...TEAM, reviewRequired: true }),
  hr("hr_pipeline", "hiring", "search", [data("pipeline", "hiring"), t("summary", "text", true), t("next", "list")], { cadence: "weekly" }),
  hr("hr_interview", "hiring", "user-headset", [
    t("candidate", "text", true), t("role", "text", true),
    b("scores", "score", { points: [{ id: "experience", weight: 2 }, { id: "skills", weight: 2 }, { id: "communication" }, { id: "attitude" }, { id: "culture" }, { id: "language" }] }, true),
    b("verdict", "choice", { options: ["hire", "second_interview", "keep", "reject"] }, true), t("notes", "text"),
  ], { ...TEAM, confidential: true, recipients: "hr" }),
  hr("hr_reference_check", "hiring", "fingerprint", [
    t("candidate", "text", true),
    b("referees", "table", { columns: [c("referee"), c("company"), c("relation")], summary: "none" }),
    t("said", "text", true), b("verdict", "choice", { options: ["positive", "mixed", "negative"] }, true),
  ], { hrOnly: true, confidential: true, recipients: "hr" }),
  hr("hr_offer", "hiring", "contract", [
    t("candidate", "text", true), t("role", "text", true),
    b("package", "table", { columns: [c("item"), c("monthly", "money")] }, true),
    t("start", "text", true), t("reason", "text"),
  ], { hrOnly: true, confidential: true, reviewRequired: true }),
  hr("hr_onboarding", "hiring", "box-circle-check", [
    about("employee"), data("steps", "onboarding"),
    b("setup", "checklist", { points: pts("account", "devices", "email", "contract", "id_badge", "introduction", "policies", "training") }, true),
    t("notes", "text"),
  ], TEAM),
  hr("hr_new_hire", "hiring", "graduation-cap", [
    about("employee"), data("onboarding", "onboarding"), data("days", "staff_attendance"),
    t("learned", "list"), t("support", "text"),
    b("rating", "score", { points: [{ id: "learning" }, { id: "quality" }, { id: "attitude" }, { id: "teamwork" }] }),
    t("manager_view", "text", true),
  ], { ...TEAM, cadence: "weekly" }),
  hr("hr_attendance", "time", "fingerprint", [data("sheet", "staff_attendance"), t("summary", "text", true)], { ...TEAM, ...M }),
  hr("hr_lateness", "time", "clock", [data("late", "late_absence", { notes: true }), t("summary", "text", true), t("actions", "list")], { ...TEAM, ...M }),
  hr("hr_leave", "time", "calendar", [data("taken", "leave_taken"), data("balances", "leave_balances"), t("summary", "text", true)], { ...TEAM, ...M }),
  hr("hr_overtime", "time", "clock", [data("overtime", "overtime_hours"), t("summary", "text", true)], { ...TEAM, ...M }),
  pay("hr_payroll", "money", [data("payslips", "payroll"), t("summary", "text", true), t("changes", "list")]),
  pay("hr_staff_cost", "calculator", [data("cost", "staff_cost"), t("summary", "text", true)]),
  hr("hr_insurance", "pay", "shield-check", [data("insured", "insurance"), t("notes", "text", true)], { ...M, confidential: true }),
  pay("hr_salary_review", "percentage", [
    data("salaries", "salaries", { input: { id: "proposed", type: "money", against: "current", diff: "increase" }, notes: true }),
    t("basis", "text", true), t("budget", "text"),
  ], { cadence: null, reviewRequired: true }),
  hr("hr_appraisal", "performance", "award", [
    about("employee"), data("record", "appraisals"),
    b("scores", "score", { points: [{ id: "goals", weight: 3 }, { id: "quality", weight: 2 }, { id: "productivity", weight: 2 }, { id: "teamwork" }, { id: "initiative" }] }),
    t("strengths", "list"), t("improve", "list"), t("goals_next", "list"), t("summary", "text", true),
  ], { ...TEAM, confidential: true }),
  hr("hr_appraisal_results", "performance", "badge-check", [data("results", "appraisal_results"), t("summary", "text", true), t("actions", "list")], { confidential: true }),
  hr("hr_training", "performance", "books", [
    b("plan", "table", { columns: [c("course"), c("audience"), c("month"), c("cost", "money")], summaryOf: ["cost"] }),
    data("log", "training"), t("summary", "text", true),
  ], M),
  hr("hr_skills", "performance", "bulb", [data("skills", "skills"), t("gaps", "list"), t("summary", "text", true)]),
  hr("hr_behavior", "performance", "heart-rate", [data("behavior", "behavior"), t("summary", "text", true), t("actions", "list")], { confidential: true }),
  hr("hr_investigation", "relations", "gavel", [
    about("employee", false), t("subject", "text", true), t("attendees", "list"), t("statements", "list", true), t("documents", "list"),
    t("findings", "text", true),
    b("outcome", "choice", { options: ["no_action", "verbal_warning", "written_warning", "deduction", "suspension", "termination", "other"] }, true),
    b("hr_sign", "signature", {}), b("employee_sign", "signature", {}),
  ], { hrOnly: true, confidential: true }),
  hr("hr_grievance_summary", "relations", "hand-holding-heart", [data("counts", "grievances"), t("summary", "text", true), t("actions", "list")], { ...M, confidential: true }),
  hr("hr_movement", "exit", "arrow-up-right", [data("moves", "movement"), t("summary", "text", true)], M),
  hr("hr_turnover", "exit", "recycle", [data("turnover", "turnover"), t("reasons", "list"), t("summary", "text", true)], M),
  hr("hr_end_of_service", "exit", "stamp", [
    about("employee"), data("leave", "leave_balances"),
    b("dues", "table", { columns: [c("item"), c("amount", "money")] }),
    b("custody", "checklist", { points: pts("laptop", "phone", "car", "keys", "card", "documents", "tools") }),
    t("handover", "text", true), b("employee_sign", "signature", {}),
  ], { hrOnly: true, confidential: true, reviewRequired: true }),
  hr("hr_expiring", "records", "clock", [data("expiring", "expiring"), t("summary", "text", true), t("actions", "list")], M),
  hr("hr_contracts", "records", "contract", [data("contracts", "contracts", { notes: true }), t("summary", "text", true)], M),
  hr("hr_missing_files", "records", "file", [data("files", "missing_files"), t("plan", "text", true)], M),
  hr("hr_safety_inspection", "records", "hard-hat", [
    b("checks", "checklist", { points: pts("extinguishers", "exits", "first_aid", "electrical", "storage", "ppe", "cleanliness", "signs") }, true),
    t("actions", "list"), b("sign", "signature", {}),
  ], { ...TEAM, ...M }),
  hr("hr_monthly", "records", "newspaper", [
    data("kpis", "hr_kpis"), data("cost", "staff_cost"), t("summary", "text", true), t("highlights", "list"), t("next", "list"),
  ], M),
  hr("hr_headcount", "records", "building", [data("headcount", "headcount"), t("summary", "text", true)], M),
  /* ── Projects (5C): starting, running, every project, closing. A report
     about one project reads its numbers; the projects the writer can see
     (the Projects app's own rule) when it covers them all. ── */
  prj("prj_proposal", "start", "bulb", [
    t("problem", "text", true), t("idea", "text", true),
    b("cost", "table", { columns: [c("item"), c("amount", "money")] }),
    t("benefit", "text", true), t("risks", "list"), t("timeline", "text"),
  ], { reviewRequired: true }),
  prj("prj_charter", "start", "flag-checkered", [
    about("project"), data("facts", "project_overview"), t("goal", "text", true), t("in_scope", "list"), t("out_scope", "list"),
    data("team", "project_team"), t("milestones", "list"), t("budget", "text"),
  ], { reviewRequired: true }),
  prj("prj_plan", "start", "calendar", [about("project"), data("schedule", "project_schedule"), data("team", "project_team"), t("phases", "list", true), t("resources", "text")]),
  prj("prj_stakeholders", "start", "users", [
    about("project"),
    b("map", "table", { columns: [c("who"), c("role"), c("influence"), c("interest"), c("how")], summary: "none" }, true),
  ]),
  prj("prj_status", "execution", "clipboard", [
    about("project"), data("facts", "project_overview"), data("done", "project_done"), data("overdue", "project_overdue"), data("milestones", "project_milestones"),
    t("highlights", "text", true), t("risks", "list"), t("next", "list"),
  ], { cadence: "weekly" }),
  prj("prj_progress", "execution", "bullseye-arrow", [about("project"), data("schedule", "project_schedule"), t("summary", "text", true)]),
  prj("prj_budget", "execution", "coins", [about("project"), data("budget", "project_budget"), data("expenses", "project_expenses"), t("summary", "text", true)]),
  prj("prj_resources", "execution", "users", [about("project", false), data("team", "project_team"), t("needs", "text", true)], M),
  prj("prj_overdue", "execution", "clock", [about("project", false), data("overdue", "project_overdue"), t("actions", "list", true)]),
  prj("prj_dependencies", "execution", "key", [about("project", false), data("blocked", "project_blocked"), t("cross", "list"), t("summary", "text", true)]),
  prj("prj_risks", "execution", "shield-check", [
    about("project"),
    b("risks", "table", { columns: [c("risk"), c("likelihood"), c("impact"), c("owner"), c("action"), c("status")], summary: "none" }, true),
    t("issues", "list"),
  ]),
  prj("prj_change", "execution", "arrow-up-right", [
    about("project"), b("kind", "choice", { options: ["scope", "schedule", "cost", "quality"] }, true),
    t("change", "text", true), t("reason", "text", true),
    b("impact", "table", { columns: [c("item"), c("days", "number"), c("cost", "money")] }),
  ], { reviewRequired: true }),
  prj("prj_milestone", "execution", "flag-checkered", [about("project"), data("milestones", "project_milestones"), data("done", "project_done"), t("delivered", "text", true), t("next", "list")], { ...R, reviewRequired: true }),
  prj("prj_acceptance", "execution", "signature", [
    about("project"), t("deliverable", "text", true),
    b("checks", "checklist", { points: pts("scope", "quality", "documents", "training", "issues_listed") }, true),
    t("open_issues", "list"), b("owner_sign", "signature", {}, true),
  ]),
  prj("prj_quality", "execution", "badge-check", [
    about("project"), b("checks", "checklist", { points: pts("requirements", "tested", "reviewed", "documented", "standards") }, true),
    t("issues", "list"), t("verdict", "text"),
  ]),
  prj("prj_portfolio", "portfolio", "briefcase", [data("portfolio", "portfolio"), t("summary", "text", true)], { cadence: "weekly" }),
  prj("prj_at_risk", "portfolio", "flag-alt", [data("risky", "projects_at_risk", { notes: true }), t("summary", "text", true)], { cadence: "weekly" }),
  prj("prj_closure", "closure", "box-circle-check", [
    about("project"), data("facts", "project_overview"), data("budget", "project_budget"),
    t("result", "text", true), t("went_well", "list"), t("lessons", "list"), t("repeat", "list"), t("stop", "list"),
  ]),
  prj("prj_post_review", "closure", "search", [
    about("project"), b("benefit", "choice", { options: ["achieved", "partly", "not_achieved"] }, true), t("evidence", "text", true), t("followups", "list"),
  ]),
  prj("prj_team_eval", "closure", "award", [
    about("project"), data("team", "project_team", { input: { id: "score", type: "number", min: 1, max: 5 }, notes: true }), t("summary", "text", true),
  ], { confidential: true }),
  /* ── Inventory (5C): a report NEVER changes stock — a count or a
     write-off is adjusted in Inventory, with its own approval. ── */
  inv("inv_count", "clipboard", [
    about("warehouse"),
    data("count", "stock_count", { input: { id: "counted", type: "number", against: "system", diff: "variance", valueBy: "unit_cost", value: "variance_value" }, notes: true }),
    t("findings", "text", true), b("keeper_sign", "signature", {}),
  ], { reviewRequired: true }),
  inv("inv_writeoff", "trash", [
    about("warehouse", false),
    b("items", "table", { columns: [c("item"), c("quantity", "number"), c("value", "money"), c("reason")], summaryOf: ["value"] }, true),
    data("posted", "stock_writeoffs"), t("cause", "text"), b("keeper_sign", "signature", {}),
  ], { ...R, reviewRequired: true }),
  inv("inv_movement", "pallet", [about("warehouse", false), data("moves", "stock_moves"), t("summary", "text", true)], { cadence: "daily" }),
  inv("inv_low_stock", "box-open", [about("warehouse", false), data("low", "low_stock", { notes: true }), t("actions", "list", true)], { cadence: "weekly" }),
  /* ── Finance (5C): the books' numbers — bank, cash and profit only with
     «Bank & Profit». ── */
  fin("fin_expenses", "receipt", [data("by_category", "expense_categories"), data("list", "company_expenses"), t("summary", "text", true)]),
  fin("fin_petty_cash", "wallet", [
    b("entries", "table", { columns: [c("date", "date"), c("description"), c("received", "money"), c("spent", "money")], summaryOf: ["received", "spent"] }, true),
    t("balance", "text", true), b("custodian_sign", "signature", {}),
  ], { app: "Expenses", reviewRequired: true }),
  fin("fin_budget", "piggy-bank", [
    data("budget", "expense_categories", { input: { id: "budget", type: "money", against: "actual", diff: "remaining" }, notes: true }),
    t("summary", "text", true), t("actions", "list"),
  ]),
  fin("fin_cash_flow", "bank", [data("cash", "cash_position"), data("flow", "cash_flow"), t("summary", "text", true), t("forecast", "text")]),
  fin("fin_statements", "balance-scale-left", [data("pl", "profit_loss"), data("ar", "ar_aging"), data("ap", "ap_aging"), t("summary", "text", true)]),
  fin("fin_month_close", "stamp", [
    data("checks", "month_close"),
    b("steps", "checklist", { points: pts("bank_reconciled", "expenses_posted", "invoices_posted", "payroll_posted", "depreciation", "fx_revaluation", "period_locked") }),
    data("pl", "profit_loss"), t("comment", "text", true),
  ]),
  /* ── Asked for by events (Phase 3D, owner's picks 25 Sep 2026) ──
     Anyone may also start the first two themselves; the probation review
     only ever comes from its request, to the employee's manager. */
  { key: "return_plan", family: "work", icon: "arrow-left", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("away", "text"), t("catch_up", "list", true), t("priorities", "list", true), t("help", "text")] },
  { key: "attendance_note", family: "work", icon: "fingerprint", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("what", "text"), t("reason", "text", true), t("covered", "text"), t("correction", "text")] },
  { key: "probation_review", family: "hr", group: "hiring", icon: "award", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, requestOnly: true,
    sections: [t("employee", "text", true), t("performance", "text", true), t("strengths", "list"), t("concerns", "list"), t("recommendation", "text", true)] },
];


/** The groups a family's types show under on the Reports home (5C), in
 *  order — each `grp.<family>.<group>`. A builder type has none: it shows
 *  after them. The home reads the copy in ./catalog-heads.ts. */
export const FAMILY_GROUPS: Partial<Record<ReportFamily, string[]>> = {
  hr: ["hiring", "time", "pay", "performance", "relations", "exit", "records"],
  projects: ["start", "execution", "portfolio", "closure"],
};

const BY_KEY = new Map(REPORT_TEMPLATES.map((x) => [x.key, x]));
export const reportTemplate = (key: string): ReportTemplateDef | null => BY_KEY.get(key) ?? null;
/** A built-in by its key, or the type itself (a builder type — 4E — comes
 *  whole, from its report). */
export const asTemplate = (t: string | ReportTemplateDef | null | undefined): ReportTemplateDef | null =>
  typeof t === "string" ? reportTemplate(t) : t ?? null;

/** The families whose section words a report shows: its own, and those of
 *  the earlier reports its carry-over quotes. A builder type asks with the
 *  built-in it was copied from. Sent with the report (GET …/[id]). */
export function sectionFamilies(templateKey: string): ReportFamily[] {
  const own = reportTemplate(templateKey)?.family;
  const quoted = (CARRY_RULES[templateKey] ?? []).map((r) => reportTemplate(r.from)?.family);
  return Array.from(new Set([own, ...quoted].filter((f): f is ReportFamily => !!f)));
}
