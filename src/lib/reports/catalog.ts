/* ---------------------------------------------------------------------------
   Reports — the built-in types' catalog: every type's sections, its default
   readers and its flags (Phase 1 → 5B; moved out of ./templates.ts in 5C).

   WHO MAY IMPORT THIS: the server, the Reports home (the list of types to
   write), the template builder and validate:reports. The report page
   (/reports/[id]) and its print NEVER do — a report arrives with its own type
   from the server (GET /api/work-reports/[id] → `template.def`), so the page
   the whole team opens every day does not grow with each new type. The
   engine's types and helpers stay in ./templates.ts, which this file uses.
   --------------------------------------------------------------------------- */

import type { RrIconName } from "@/components/ui/RrIcon";
import type { ReportColumnType, ReportFamily, ReportSectionDef, ReportSectionKind, ReportTemplateDef } from "./templates";
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
  { key: "hr_incident", family: "hr", icon: "hard-hat", cadence: null, recipients: "manager_hr", reviewRequired: false, confidential: false, urgent: true,
    sections: [t("what", "text", true), t("where_when", "text", true), t("people", "list"), t("action", "text")] },
  { key: "hr_grievance", family: "hr", icon: "lock", cadence: null, recipients: "hr", reviewRequired: false, confidential: true,
    sections: [t("subject", "text", true), t("details", "text", true), t("wanted", "text")] },
  { key: "hr_warning", family: "hr", icon: "id-badge", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("incident", "text", true), t("rule", "text"), t("action", "text", true)] },
  { key: "hr_exit_interview", family: "hr", icon: "users", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, hrOnly: true,
    sections: [t("employee", "text", true), t("reasons", "list", true), t("liked", "list"), t("improve", "list"), t("return", "text")] },
  /* ── Asked for by events (Phase 3D, owner's picks 25 Sep 2026) ──
     Anyone may also start the first two themselves; the probation review
     only ever comes from its request, to the employee's manager. */
  { key: "return_plan", family: "work", icon: "arrow-left", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("away", "text"), t("catch_up", "list", true), t("priorities", "list", true), t("help", "text")] },
  { key: "attendance_note", family: "work", icon: "fingerprint", cadence: null, recipients: "manager", reviewRequired: false, confidential: false,
    sections: [t("what", "text"), t("reason", "text", true), t("covered", "text"), t("correction", "text")] },
  { key: "probation_review", family: "hr", icon: "award", cadence: null, recipients: "hr", reviewRequired: false, confidential: true, requestOnly: true,
    sections: [t("employee", "text", true), t("performance", "text", true), t("strengths", "list"), t("concerns", "list"), t("recommendation", "text", true)] },
];


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
