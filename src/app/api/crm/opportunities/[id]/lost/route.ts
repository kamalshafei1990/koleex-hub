import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/crm/opportunities/[id]/lost
   Body: { reason: string }
   Marks an opportunity lost: stamps lost_at + reason, zeros probability,
   archives the row. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const { reason } = (await req.json()) as { reason: string };

  let existsQ = supabaseServer
    .from("crm_opportunities")
    .select("id")
    .eq("id", id);
  if (auth.tenant_id) existsQ = existsQ.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await existsQ.maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from("crm_opportunities")
    .update({
      lost_reason: reason,
      lost_at: now,
      probability: 0,
      archived_at: now,
    })
    .eq("id", id);
  if (error) {
    console.error("[api/crm/opportunities/[id]/lost]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
