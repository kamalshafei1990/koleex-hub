import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/crm/opportunities/[id]/move
   Body: { stageId: string; isWonStage: boolean }
   Moves an opportunity to a new stage. Stamps won_at + mirrors onto
   the contact when isWonStage = true. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const body = (await req.json()) as { stageId: string; isWonStage: boolean };

  let existingQuery = supabaseServer
    .from("crm_opportunities")
    .select("id, contact_id")
    .eq("id", id);
  if (auth.tenant_id) existingQuery = existingQuery.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await existingQuery.maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { stage_id: body.stageId };
  if (body.isWonStage) {
    patch.won_at = new Date().toISOString();
    patch.probability = 100;
  }

  const { error } = await supabaseServer
    .from("crm_opportunities")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/crm/opportunities/[id]/move]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.isWonStage) {
    const contactId = (existing as { contact_id: string | null }).contact_id;
    if (contactId) {
      let q = supabaseServer
        .from("contacts")
        .select("customer_type")
        .eq("id", contactId);
      if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
      const { data } = await q.maybeSingle();
      if (
        (data as { customer_type?: string | null } | null)?.customer_type !==
        "customer"
      ) {
        await supabaseServer
          .from("contacts")
          .update({ customer_type: "customer" })
          .eq("id", contactId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
