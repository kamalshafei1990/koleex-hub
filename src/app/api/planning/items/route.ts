import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/planning/items — list planning items.
     Query params:
       start=<ISO>        inclusive window start (required for range queries)
       end=<ISO>          exclusive window end
       resource_id=X      filter to a single resource
       role_id=X          filter to a single role
       type=shift|...     filter by entity type
       status=draft|...   filter by lifecycle status
       mine=1             only items on the caller's own resource
                          (where resource.account_id == auth.account_id)
       open=1             only open shifts (resource_id IS NULL)
       linked_entity_type=X & linked_entity_id=Y → look up items attached
                          to a Hub entity (customer, project, etc.)
   POST /api/planning/items — create a new item (draft by default). */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const resourceId = url.searchParams.get("resource_id");
  const roleId = url.searchParams.get("role_id");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";
  const open = url.searchParams.get("open") === "1";
  const linkedType = url.searchParams.get("linked_entity_type");
  const linkedId = url.searchParams.get("linked_entity_id");

  let q = supabaseServer
    .from("planning_items")
    .select(
      `id, tenant_id, type, title, notes, resource_id, role_id,
       start_at, end_at, allocated_hours, allocated_pct,
       linked_entity_type, linked_entity_id, linked_entity_label,
       is_billable, hourly_rate, status,
       published_at, completed_at, cancelled_at,
       recurrence_rule, recurrence_parent_id,
       created_by_account_id, created_at, updated_at,
       resource:resource_id ( id, name, type, account_id, color, icon ),
       role:role_id ( id, name, color )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (start) q = q.gte("end_at", start);
  if (end) q = q.lt("start_at", end);
  if (resourceId) q = q.eq("resource_id", resourceId);
  if (roleId) q = q.eq("role_id", roleId);
  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  if (open) q = q.is("resource_id", null);
  if (linkedType) q = q.eq("linked_entity_type", linkedType);
  if (linkedId) q = q.eq("linked_entity_id", linkedId);

  // "mine" — restrict to items whose resource belongs to the caller.
  if (mine) {
    const { data: mineResources } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id);
    const ids = (mineResources ?? []).map((r) => r.id);
    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }
    q = q.in("resource_id", ids);
  }

  q = q.order("start_at", { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error("[api/planning/items GET]", error.message);
    return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const body = (await req.json()) as {
    type?: string;
    title?: string;
    notes?: string | null;
    resource_id?: string | null;
    role_id?: string | null;
    start_at: string;
    end_at: string;
    allocated_hours?: number | null;
    allocated_pct?: number | null;
    linked_entity_type?: string | null;
    linked_entity_id?: string | null;
    linked_entity_label?: string | null;
    is_billable?: boolean;
    hourly_rate?: number | null;
    status?: "draft" | "published" | "completed" | "cancelled";
    recurrence_rule?: string | null;
  };

  if (!body.start_at || !body.end_at) {
    return NextResponse.json({ error: "start_at and end_at required" }, { status: 400 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    type: body.type ?? "shift",
    title: body.title ?? "",
    notes: body.notes ?? null,
    resource_id: body.resource_id ?? null,
    role_id: body.role_id ?? null,
    start_at: body.start_at,
    end_at: body.end_at,
    allocated_hours: body.allocated_hours ?? null,
    allocated_pct: body.allocated_pct ?? null,
    linked_entity_type: body.linked_entity_type ?? null,
    linked_entity_id: body.linked_entity_id ?? null,
    linked_entity_label: body.linked_entity_label ?? null,
    is_billable: body.is_billable ?? false,
    hourly_rate: body.hourly_rate ?? null,
    status: body.status ?? "draft",
    recurrence_rule: body.recurrence_rule ?? null,
    created_by_account_id: auth.account_id,
  };

  const { data, error } = await supabaseServer
    .from("planning_items")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/planning/items POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
