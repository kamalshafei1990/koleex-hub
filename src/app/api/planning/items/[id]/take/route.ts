import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyPlanningTaken } from "@/lib/server/planning-notify";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { PLANNING_ERR } from "@/lib/server/planning-access";
import { checkPlanningConflicts, conflictBody } from "@/lib/server/planning-conflicts";
import { isPlanningUuid } from "@/lib/planning-validate";

/* POST /api/planning/items/:id/take — claim an open shift.
   Only a PUBLISHED item with no resource can be taken. The caller must have
   an active employee resource on the same tenant; that resource is
   assigned. Answers:
     404 not_found     — no such item in this tenant
     409 conflict      — already taken, or not a published open shift
     400 no_resource   — the caller has no employee resource
     409 schedule_conflict — the caller is already booked / on leave then
                         (super admin may pass ?force=1) */

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "create");
  if (deny) return deny;
  const { id } = await params;
  if (!isPlanningUuid(id)) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });

  const [itemRes, resRes] = await Promise.all([
    supabaseServer
      .from("planning_items")
      .select("id, status, resource_id, title, start_at, end_at")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    /* An account can end up with more than one employee resource (a manual
       one plus the synced one). Pick deterministically — the oldest — so
       the same person always lands on the same row. */
    supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .eq("type", "employee")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
  ]);

  if (itemRes.error || resRes.error) {
    console.error("[api/planning/items/take]", itemRes.error?.message ?? resRes.error?.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  const item = itemRes.data as { id: string; status: string; resource_id: string | null; title: string | null; start_at: string; end_at: string } | null;
  if (!item) return NextResponse.json({ error: PLANNING_ERR[404] }, { status: 404 });
  if (item.resource_id || item.status !== "published") {
    return NextResponse.json({ error: PLANNING_ERR[409] }, { status: 409 });
  }
  const res = (resRes.data ?? [])[0] as { id: string } | undefined;
  if (!res) return NextResponse.json({ error: "no_resource" }, { status: 400 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1" && auth.is_super_admin;
  try {
    const check = await checkPlanningConflicts(
      auth.tenant_id,
      [{ id: item.id, title: item.title, resource_id: res.id, start_at: item.start_at, end_at: item.end_at, status: item.status }],
      { tz: url.searchParams.get("tz") },
    );
    if (check.total > 0 && !force) return NextResponse.json(conflictBody(check, auth.is_super_admin), { status: 409 });
  } catch (e) {
    console.error("[api/planning/items/take] conflicts:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }

  // Conditional update closes the race where two people hit "Take" at once.
  const { data, error } = await supabaseServer
    .from("planning_items")
    .update({ resource_id: res.id })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "published")
    .is("resource_id", null)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/planning/items/take] update:", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: PLANNING_ERR[409] }, { status: 409 });

  // Notify the item's creator that the shift was claimed.
  after(() => notifyPlanningTaken(auth, data));

  return NextResponse.json({ item: data });
}
