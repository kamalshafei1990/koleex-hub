/* ---------------------------------------------------------------------------
   planning-validate — one input validator for planning items, shared by the
   API routes (authoritative) and the item modal (early feedback).

   Isomorphic on purpose: no "use client", no "server-only", no imports.
   zod is not a dependency of this repo, so this is a small hand validator
   covering exactly what planning_items accepts:

     · type / status / linked_entity_type are closed enums (the table has
       CHECK constraints on type + status — an unknown value used to surface
       as a raw Postgres error string in the client);
     · start_at / end_at must parse as dates and end must be after start
       (planning_items has CHECK end_at > start_at);
     · ids are UUIDs; free text is length-capped.

   Errors are CODES, never sentences — the client maps them to translated
   copy, and the server never echoes database text back.
   --------------------------------------------------------------------------- */

export const PLANNING_ITEM_TYPES = [
  "shift",
  "meeting",
  "production",
  "delivery",
  "maintenance",
  "project_task",
  "room_booking",
  "other",
] as const;

export const PLANNING_STATUSES = ["draft", "published", "completed", "cancelled"] as const;

/* "contact" / "quotation" / "invoice" are still ACCEPTED so historical rows
   (and any integration that wrote them) stay editable; the modal no longer
   offers them for new links. "project" is written by Projects' "Schedule in
   Planning" action. */
export const PLANNING_LINKED_TYPES = [
  "customer",
  "supplier",
  "contact",
  "product",
  "project",
  "quotation",
  "invoice",
  "other",
] as const;

export const PLANNING_LIMITS = {
  title: 200,
  notes: 5000,
  linkedLabel: 200,
  recurrenceRule: 500,
  maxHours: 10_000,
  maxPct: 1_000,
  maxRate: 1_000_000,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlanningUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type PlanningValidationCode =
  | "invalid_body"
  | "invalid_type"
  | "invalid_status"
  | "invalid_title"
  | "invalid_notes"
  | "invalid_resource"
  | "invalid_role"
  | "invalid_start"
  | "invalid_end"
  | "end_before_start"
  | "invalid_hours"
  | "invalid_pct"
  | "invalid_linked"
  | "invalid_billable"
  | "invalid_rate"
  | "invalid_recurrence"
  | "start_end_required";

export interface PlanningValidationError {
  ok: false;
  code: PlanningValidationCode;
  field?: string;
}

/** The writable columns of planning_items, all optional (PATCH shape). */
export interface PlanningItemInput {
  type?: (typeof PLANNING_ITEM_TYPES)[number];
  title?: string;
  notes?: string | null;
  resource_id?: string | null;
  role_id?: string | null;
  start_at?: string;
  end_at?: string;
  allocated_hours?: number | null;
  allocated_pct?: number | null;
  linked_entity_type?: (typeof PLANNING_LINKED_TYPES)[number] | null;
  linked_entity_id?: string | null;
  linked_entity_label?: string | null;
  is_billable?: boolean;
  hourly_rate?: number | null;
  status?: (typeof PLANNING_STATUSES)[number];
  recurrence_rule?: string | null;
}

const fail = (code: PlanningValidationCode, field?: string): PlanningValidationError => ({ ok: false, code, field });

/** Parse an ISO-ish datetime. Returns the normalised ISO string or null. */
export function parsePlanningDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function optNumber(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return undefined;
  return v;
}

function optText(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > max) return undefined;
  return v;
}

/**
 * Validate a create (mode "create") or partial update (mode "patch") body.
 * Unknown keys are dropped. For "patch", `current` supplies the row's
 * existing start/end so a one-sided reschedule is checked against the
 * EFFECTIVE window.
 */
export function validatePlanningItemInput(
  raw: unknown,
  mode: "create" | "patch",
  current?: { start_at: string; end_at: string } | null,
): { ok: true; value: PlanningItemInput } | PlanningValidationError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("invalid_body");
  const b = raw as Record<string, unknown>;
  const out: PlanningItemInput = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;

  if (has("type")) {
    if (!(PLANNING_ITEM_TYPES as readonly unknown[]).includes(b.type)) return fail("invalid_type", "type");
    out.type = b.type as PlanningItemInput["type"];
  }
  if (has("status")) {
    if (!(PLANNING_STATUSES as readonly unknown[]).includes(b.status)) return fail("invalid_status", "status");
    out.status = b.status as PlanningItemInput["status"];
  }
  if (has("title")) {
    const v = b.title === null ? "" : b.title;
    if (typeof v !== "string" || v.length > PLANNING_LIMITS.title) return fail("invalid_title", "title");
    out.title = v.trim();
  }
  if (has("notes")) {
    const v = optText(b.notes, PLANNING_LIMITS.notes);
    if (v === undefined) return fail("invalid_notes", "notes");
    out.notes = v;
  }
  for (const k of ["resource_id", "role_id"] as const) {
    if (!has(k)) continue;
    const v = b[k];
    if (v === null || v === "") out[k] = null;
    else if (isPlanningUuid(v)) out[k] = v;
    else return fail(k === "resource_id" ? "invalid_resource" : "invalid_role", k);
  }
  if (has("start_at")) {
    const v = parsePlanningDate(b.start_at);
    if (!v) return fail("invalid_start", "start_at");
    out.start_at = v;
  }
  if (has("end_at")) {
    const v = parsePlanningDate(b.end_at);
    if (!v) return fail("invalid_end", "end_at");
    out.end_at = v;
  }
  if (has("allocated_hours")) {
    const v = optNumber(b.allocated_hours, 0, PLANNING_LIMITS.maxHours);
    if (v === undefined) return fail("invalid_hours", "allocated_hours");
    out.allocated_hours = v;
  }
  if (has("allocated_pct")) {
    const v = optNumber(b.allocated_pct, 0, PLANNING_LIMITS.maxPct);
    if (v === undefined) return fail("invalid_pct", "allocated_pct");
    out.allocated_pct = v;
  }
  if (has("hourly_rate")) {
    const v = optNumber(b.hourly_rate, 0, PLANNING_LIMITS.maxRate);
    if (v === undefined) return fail("invalid_rate", "hourly_rate");
    out.hourly_rate = v;
  }
  if (has("is_billable")) {
    if (typeof b.is_billable !== "boolean") return fail("invalid_billable", "is_billable");
    out.is_billable = b.is_billable;
  }
  if (has("linked_entity_type")) {
    const v = b.linked_entity_type;
    if (v === null || v === "") out.linked_entity_type = null;
    else if ((PLANNING_LINKED_TYPES as readonly unknown[]).includes(v)) out.linked_entity_type = v as PlanningItemInput["linked_entity_type"];
    else return fail("invalid_linked", "linked_entity_type");
  }
  if (has("linked_entity_id")) {
    const v = b.linked_entity_id;
    if (v === null || v === "") out.linked_entity_id = null;
    else if (isPlanningUuid(v)) out.linked_entity_id = v;
    else return fail("invalid_linked", "linked_entity_id");
  }
  if (has("linked_entity_label")) {
    const v = optText(b.linked_entity_label, PLANNING_LIMITS.linkedLabel);
    if (v === undefined) return fail("invalid_linked", "linked_entity_label");
    out.linked_entity_label = v === null ? null : v.trim() || null;
  }
  if (has("recurrence_rule")) {
    const v = optText(b.recurrence_rule, PLANNING_LIMITS.recurrenceRule);
    if (v === undefined) return fail("invalid_recurrence", "recurrence_rule");
    out.recurrence_rule = v;
  }

  if (mode === "create" && (!out.start_at || !out.end_at)) return fail("start_end_required");

  const effStart = out.start_at ?? current?.start_at;
  const effEnd = out.end_at ?? current?.end_at;
  if (effStart && effEnd && Date.parse(effEnd) <= Date.parse(effStart)) {
    return fail("end_before_start", "end_at");
  }

  return { ok: true, value: out };
}
