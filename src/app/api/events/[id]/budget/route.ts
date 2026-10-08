import "server-only";

/* POST /api/events/[id]/budget — add a budget line. PATCH/DELETE on
   /api/events/[id]/budget/[lineId]. Same rule as every event mutation:
   module "Events" edit + event ownership; tenant from the session. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { BUDGET_CATEGORIES } from "@/lib/events/types";
import { EVENTS_MODULE, requireOwnedEvent, requireTenant } from "@/lib/server/events";

function readLine(body: unknown): { fields?: Record<string, unknown>; error?: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const fields: Record<string, unknown> = {};

  if (b.label !== undefined) {
    const label = String(b.label).trim().slice(0, 200);
    if (!label) return { error: "A label is required" };
    fields.label = label;
  }
  if (b.category !== undefined) {
    if (!(BUDGET_CATEGORIES as readonly string[]).includes(String(b.category))) {
      return { error: "Unknown budget category" };
    }
    fields.category = b.category;
  }
  for (const key of ["planned", "actual"] as const) {
    if (b[key] !== undefined) {
      const n = b[key] === null || b[key] === "" ? 0 : Number(b[key]);
      if (!Number.isFinite(n) || n < 0) return { error: "Amounts must be positive numbers" };
      fields[key] = n;
    }
  }
  if (b.notes !== undefined) fields.notes = b.notes === null ? null : String(b.notes).slice(0, 500);
  return { fields };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "edit");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error: ownedErr } = await requireOwnedEvent(auth, id);
  if (ownedErr) return ownedErr;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fields, error } = readLine(body);
  if (error || !fields?.label) {
    return NextResponse.json({ error: error ?? "A label is required" }, { status: 400 });
  }

  /* Land after the current last line unless sort_order came explicit. */
  let sortOrder = 0;
  if (fields.sort_order !== undefined && Number.isFinite(Number(fields.sort_order))) {
    sortOrder = Number(fields.sort_order);
  } else {
    const { data: last } = await supabaseServer
      .from("koleex_event_budget_lines")
      .select("sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  }

  const { data, error: dbErr } = await supabaseServer
    .from("koleex_event_budget_lines")
    .insert({
      tenant_id: auth.tenant_id,
      event_id: id,
      label: fields.label,
      category: fields.category ?? "other",
      planned: fields.planned ?? 0,
      actual: fields.actual ?? 0,
      sort_order: sortOrder,
      notes: fields.notes ?? null,
    })
    .select("id")
    .single();
  if (dbErr || !data) {
    console.error("[events] budget create:", dbErr?.message);
    return NextResponse.json({ error: "Could not add budget line" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
