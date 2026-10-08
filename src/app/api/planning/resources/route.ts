import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { maybeSyncEmployeeResources } from "@/lib/server/planning-resource-sync";

/* GET  /api/planning/resources — list resources (filterable by type).
        The Employees ↔ Planning sync no longer blocks this read: it runs in
        after(), throttled per tenant, and only writes when something is
        actually out of step (see lib/server/planning-resource-sync.ts).
   POST /api/planning/resources — create a non-employee resource
        (materials, rooms, vehicles, etc.). */

const RESOURCE_TYPES = new Set(["employee", "material", "room", "vehicle", "other"]);

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // employee|material|room|vehicle|other
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  if (type && !RESOURCE_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Keep employee resources aligned with accounts — after the response.
  after(() => maybeSyncEmployeeResources(auth.tenant_id));

  let q = supabaseServer
    .from("planning_resources")
    .select(
      "id, tenant_id, type, account_id, name, description, icon, color, capacity_hours_per_day, hourly_cost, is_active, created_at, updated_at",
    )
    .eq("tenant_id", auth.tenant_id);

  if (type) q = q.eq("type", type);
  if (!includeInactive) q = q.eq("is_active", true);

  q = q.order("type", { ascending: true }).order("name", { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error("[api/planning/resources GET]", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ resources: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as {
    type: "employee" | "material" | "room" | "vehicle" | "other";
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    capacity_hours_per_day?: number | null;
    hourly_cost?: number | null;
    account_id?: string | null;
  };

  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200 || !RESOURCE_TYPES.has(body.type)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  // An employee resource may only point at an account of this tenant.
  if (body.type === "employee" && body.account_id) {
    const { data: acct } = await supabaseServer
      .from("accounts").select("id").eq("id", body.account_id).eq("tenant_id", auth.tenant_id).maybeSingle();
    if (!acct) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("planning_resources")
    .insert({
      tenant_id: auth.tenant_id,
      type: body.type,
      name: body.name.trim(),
      description: body.description ?? null,
      icon: body.icon ?? null,
      color: body.color ?? null,
      capacity_hours_per_day: body.capacity_hours_per_day ?? null,
      hourly_cost: body.hourly_cost ?? null,
      account_id: body.type === "employee" ? body.account_id ?? null : null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/planning/resources POST]", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ resource: data });
}
