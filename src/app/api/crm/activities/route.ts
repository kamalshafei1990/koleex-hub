import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

/* GET  /api/crm/activities?opportunityId=<uuid>
   POST /api/crm/activities
   Tenant-scoped. Requires "CRM" module access. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const url = new URL(req.url);

  /* ?feed=1 — every activity in the tenant, each carrying its parent
     opportunity's name, company and stage so the row renders without a second
     round trip. The browser built this by reading crm_activities and then
     crm_opportunities directly; both are service-role-only, so the CRM
     activity feed was permanently empty. */
  if (url.searchParams.get("feed") === "1") {
    let aq = supabaseServer.from("crm_activities").select("*").order("due_at", { ascending: true });
    if (auth.tenant_id) aq = aq.eq("tenant_id", auth.tenant_id);
    const { data: acts, error: aErr } = await aq;
    if (aErr) {
      console.error("[api/crm/activities feed]", aErr.message);
      return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
    }
    const rows = (acts ?? []) as { opportunity_id: string }[];
    if (rows.length === 0) return NextResponse.json({ activities: [] });

    const oppIds = [...new Set(rows.map((r) => r.opportunity_id).filter(Boolean))];
    const { data: opps, error: oErr } = await supabaseServer
      .from("crm_opportunities")
      .select("id, name, company_name, stage_id")
      .in("id", oppIds);
    if (oErr) console.error("[api/crm/activities feed opps]", oErr.message);
    const byId = new Map(
      ((opps ?? []) as { id: string }[]).map((o) => [o.id, o]),
    );
    return NextResponse.json({
      activities: rows.map((r) => ({ ...r, opportunity: byId.get(r.opportunity_id) ?? null })),
    });
  }

  const opportunityId = url.searchParams.get("opportunityId");
  if (!opportunityId) {
    return NextResponse.json(
      { error: "opportunityId is required" },
      { status: 400 },
    );
  }

  // Tenant check via the opportunity row.
  let oppQuery = supabaseServer
    .from("crm_opportunities")
    .select("id")
    .eq("id", opportunityId);
  if (auth.tenant_id) oppQuery = oppQuery.eq("tenant_id", auth.tenant_id);
  const { data: opp } = await oppQuery.maybeSingle();
  if (!opp) return NextResponse.json({ activities: [] });

  const { data, error } = await supabaseServer
    .from("crm_activities")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api/crm/activities GET]", error.message);
    return NextResponse.json(
      { error: "Failed to load activities" },
      { status: 500 },
    );
  }
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "CRM", "create");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const oppId = body.opportunity_id as string | undefined;

  // Verify the opportunity belongs to the caller's tenant.
  if (oppId) {
    let oppQuery = supabaseServer
      .from("crm_opportunities")
      .select("id")
      .eq("id", oppId);
    if (auth.tenant_id) oppQuery = oppQuery.eq("tenant_id", auth.tenant_id);
    const { data: opp } = await oppQuery.maybeSingle();
    if (!opp) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }
  }

  const row = { ...body, tenant_id: auth.tenant_id };
  const { data, error } = await supabaseServer
    .from("crm_activities")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/crm/activities POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ activity: data });
}
