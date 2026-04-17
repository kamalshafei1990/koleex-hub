import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/crm/activities?opportunityId=<uuid>
   POST /api/crm/activities
   Tenant-scoped. Requires "CRM" module access. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const opportunityId = new URL(req.url).searchParams.get("opportunityId");
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
  const deny = await requireModuleAccess(auth, "CRM");
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
