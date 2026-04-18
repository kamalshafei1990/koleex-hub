import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET    /api/planning/items/:id — fetch a single item
   PATCH  /api/planning/items/:id — update fields (tenant-scoped)
   DELETE /api/planning/items/:id — hard delete */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("planning_items")
    .select(
      `*,
       resource:resource_id ( id, name, type, account_id, color, icon ),
       role:role_id ( id, name, color )`,
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = [
    "type", "title", "notes", "resource_id", "role_id",
    "start_at", "end_at", "allocated_hours", "allocated_pct",
    "linked_entity_type", "linked_entity_id", "linked_entity_label",
    "is_billable", "hourly_rate", "status",
    "recurrence_rule",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  // Lifecycle timestamps stay in sync when status changes.
  if (patch.status === "published" && !patch.published_at) {
    patch.published_at = new Date().toISOString();
  }
  if (patch.status === "completed") {
    patch.completed_at = new Date().toISOString();
  }
  if (patch.status === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
  }

  const { data, error } = await supabaseServer
    .from("planning_items")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("planning_items")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
