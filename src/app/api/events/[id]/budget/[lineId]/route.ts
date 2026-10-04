import "server-only";

/* PATCH/DELETE /api/events/[id]/budget/[lineId] — edit or drop one budget
   line. Same mutation rule as the rest of the event. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { BUDGET_CATEGORIES } from "@/lib/events/types";
import { EVENTS_MODULE, requireOwnedEvent, requireTenant } from "@/lib/server/events";

function readPatch(body: unknown): { patch?: Record<string, unknown>; error?: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.label !== undefined) {
    const label = String(b.label).trim().slice(0, 200);
    if (!label) return { error: "A label is required" };
    patch.label = label;
  }
  if (b.category !== undefined) {
    if (!(BUDGET_CATEGORIES as readonly string[]).includes(String(b.category))) {
      return { error: "Unknown budget category" };
    }
    patch.category = b.category;
  }
  for (const key of ["planned", "actual"] as const) {
    if (b[key] !== undefined) {
      const n = b[key] === null || b[key] === "" ? 0 : Number(b[key]);
      if (!Number.isFinite(n) || n < 0) return { error: "Amounts must be positive numbers" };
      patch[key] = n;
    }
  }
  if (b.notes !== undefined) patch.notes = b.notes === null ? null : String(b.notes).slice(0, 500);
  if (Object.keys(patch).length === 0) return { error: "Nothing to update" };
  return { patch };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "edit");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { patch, error: pErr } = readPatch(body);
  if (pErr || !patch) return NextResponse.json({ error: pErr }, { status: 400 });

  const { error: upErr } = await supabaseServer
    .from("koleex_event_budget_lines")
    .update(patch)
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", lineId);
  if (upErr) {
    console.error("[events] budget patch:", upErr.message);
    return NextResponse.json({ error: "Could not update budget line" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "delete");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  const { error: delErr } = await supabaseServer
    .from("koleex_event_budget_lines")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", lineId);
  if (delErr) {
    console.error("[events] budget delete:", delErr.message);
    return NextResponse.json({ error: "Could not delete budget line" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
