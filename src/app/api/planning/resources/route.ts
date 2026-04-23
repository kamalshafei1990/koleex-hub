import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/planning/resources — list resources (filterable by type).
        On every call we also auto-sync active employees into
        planning_resources so Employees ↔ Planning stay aligned.
   POST /api/planning/resources — create a non-employee resource
        (materials, rooms, vehicles, etc.). */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // employee|material|room|vehicle|other
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  // Ensure every active employee has a matching resource row.
  // Cheap upsert — only inserts missing rows.
  await syncEmployeeResources(auth.tenant_id);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ resources: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const body = (await req.json()) as {
    type: "employee" | "material" | "room" | "vehicle" | "other";
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    capacity_hours_per_day?: number | null;
    hourly_cost?: number | null;
    account_id?: string | null;
  };

  if (!body.name?.trim() || !body.type) {
    return NextResponse.json({ error: "name and type required" }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ resource: data });
}

/**
 * Ensure every internal active account in the tenant has a matching
 * employee resource. Name comes from accounts.username; department comes
 * from koleex_employees when we have an employee row for that account.
 * Idempotent — only inserts missing rows.
 */
async function syncEmployeeResources(tenantId: string): Promise<void> {
  const { data: accts } = await supabaseServer
    .from("accounts")
    .select("id, username")
    .eq("tenant_id", tenantId)
    .eq("user_type", "internal")
    .eq("status", "active");
  if (!accts?.length) return;

  const accountIds = accts.map((a) => a.id);

  const [{ data: existing }, { data: emps }] = await Promise.all([
    supabaseServer
      .from("planning_resources")
      .select("account_id")
      .eq("tenant_id", tenantId)
      .eq("type", "employee"),
    supabaseServer
      .from("koleex_employees")
      .select("account_id, department")
      .in("account_id", accountIds),
  ]);

  const haveAccountIds = new Set(
    (existing ?? []).map((r) => r.account_id).filter(Boolean) as string[],
  );
  const deptByAccount = new Map(
    (emps ?? [])
      .filter((e) => e.account_id)
      .map((e) => [e.account_id as string, e.department as string | null]),
  );

  const toInsert = accts
    .filter((a) => !haveAccountIds.has(a.id))
    .map((a) => ({
      tenant_id: tenantId,
      type: "employee" as const,
      account_id: a.id,
      name: a.username || "Employee",
      description: deptByAccount.get(a.id) ?? null,
      is_active: true,
    }));

  if (toInsert.length) {
    await supabaseServer.from("planning_resources").insert(toInsert);
  }
}
