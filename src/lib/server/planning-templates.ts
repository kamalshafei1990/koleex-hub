import "server-only";

/* ---------------------------------------------------------------------------
   planning-templates — shift templates (planning_templates).

   The table predates this feature: id, tenant_id, name, type, role_id,
   start_time (time), duration_hours, default_note. A template's END is
   start_time + duration_hours, so an overnight template (22:00 → 06:00)
   needs no extra column. Migration 20260926_planning_additions adds
   resource_id, color and created_by_account_id; until it runs, writes retry
   without those columns and reads simply don't return them.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { PLANNING_ITEM_TYPES, isPlanningUuid } from "@/lib/planning-validate";

export interface PlanningTemplateOut {
  id: string;
  name: string;
  type: string;
  role_id: string | null;
  resource_id: string | null;
  color: string | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  default_note: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const EXTENDED_TEMPLATE_COLS = ["resource_id", "color", "created_by_account_id"] as const;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => {
  const x = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

export function normalizeTemplate(r: Record<string, unknown>): PlanningTemplateOut {
  const start = typeof r.start_time === "string" && TIME_RE.test(r.start_time) ? r.start_time.slice(0, 5) : "09:00";
  const dur = Number(r.duration_hours ?? 8) || 8;
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    type: String(r.type ?? "shift"),
    role_id: (r.role_id as string | null) ?? null,
    resource_id: (r.resource_id as string | null | undefined) ?? null,
    color: (r.color as string | null | undefined) ?? null,
    start_time: start,
    end_time: fromMin(toMin(start) + dur * 60),
    duration_hours: dur,
    default_note: (r.default_note as string | null) ?? null,
  };
}

export type TemplateInput = Partial<{
  name: string;
  type: string;
  role_id: string | null;
  resource_id: string | null;
  color: string | null;
  start_time: string;
  duration_hours: number;
  default_note: string | null;
}>;

/** Validate a template body. start_time + end_time → duration (overnight ok). */
export function parseTemplateInput(raw: unknown, mode: "create" | "patch"): { ok: true; value: TemplateInput } | { ok: false; field: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, field: "body" };
  const b = raw as Record<string, unknown>;
  const out: TemplateInput = {};
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 120) return { ok: false, field: "name" };
    out.name = b.name.trim();
  } else if (mode === "create") return { ok: false, field: "name" };
  if (b.type !== undefined) {
    if (!(PLANNING_ITEM_TYPES as readonly unknown[]).includes(b.type)) return { ok: false, field: "type" };
    out.type = b.type as string;
  }
  for (const k of ["role_id", "resource_id"] as const) {
    if (b[k] === undefined) continue;
    if (b[k] === null || b[k] === "") out[k] = null;
    else if (isPlanningUuid(b[k])) out[k] = b[k] as string;
    else return { ok: false, field: k };
  }
  if (b.color !== undefined) {
    if (b.color === null || b.color === "") out.color = null;
    else if (typeof b.color === "string" && COLOR_RE.test(b.color)) out.color = b.color;
    else return { ok: false, field: "color" };
  }
  if (b.default_note !== undefined) {
    if (b.default_note !== null && (typeof b.default_note !== "string" || b.default_note.length > 2000)) return { ok: false, field: "default_note" };
    out.default_note = (b.default_note as string | null) || null;
  }
  const hasStart = b.start_time !== undefined;
  const hasEnd = b.end_time !== undefined;
  if (hasStart || hasEnd || mode === "create") {
    if (typeof b.start_time !== "string" || !TIME_RE.test(b.start_time)) return { ok: false, field: "start_time" };
    if (typeof b.end_time !== "string" || !TIME_RE.test(b.end_time)) return { ok: false, field: "end_time" };
    let mins = toMin(b.end_time) - toMin(b.start_time);
    if (mins <= 0) mins += 1440; // overnight
    out.start_time = b.start_time.slice(0, 5);
    out.duration_hours = Math.round((mins / 60) * 100) / 100;
  }
  return { ok: true, value: out };
}

/** Postgres "undefined column" / PostgREST "column not in schema cache". */
export function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /column .* does not exist|schema cache/i.test(err.message ?? "");
}

/** Insert / update, retrying without the migration's columns if absent. */
export async function writeTemplate(
  op: { kind: "insert"; row: Record<string, unknown> } | { kind: "update"; id: string; tenantId: string; row: Record<string, unknown> },
): Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }> {
  const run = (row: Record<string, unknown>) =>
    op.kind === "insert"
      ? supabaseServer.from("planning_templates").insert(row).select("*").maybeSingle()
      : supabaseServer.from("planning_templates").update(row).eq("id", op.id).eq("tenant_id", op.tenantId).select("*").maybeSingle();
  let r = await run(op.row);
  if (r.error && isMissingColumn(r.error)) {
    const legacy = { ...op.row };
    for (const k of EXTENDED_TEMPLATE_COLS) delete legacy[k];
    r = await run(legacy);
  }
  return { data: (r.data as Record<string, unknown> | null) ?? null, error: r.error };
}
