import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST   /api/crm/opportunities/[id]/archive  — archive
   DELETE /api/crm/opportunities/[id]/archive  — un-archive */

async function existsInTenant(
  id: string,
  tenantId: string | null,
): Promise<boolean> {
  let q = supabaseServer.from("crm_opportunities").select("id").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data !== null;
}

async function setArchivedAt(
  id: string,
  value: string | null,
): Promise<NextResponse> {
  const { error } = await supabaseServer
    .from("crm_opportunities")
    .update({ archived_at: value })
    .eq("id", id);
  if (error) {
    console.error("[api/crm/opportunities/[id]/archive]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return setArchivedAt(id, new Date().toISOString());
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return setArchivedAt(id, null);
}
