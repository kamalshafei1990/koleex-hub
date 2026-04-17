import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH  /api/crm/opportunities/[id]  — partial update
   DELETE /api/crm/opportunities/[id]  — remove
   Tenant-scoped; per-record owner scope is applied by scope helpers at
   fetch time. Write permission = "CRM" module access. */

async function existsInTenant(
  id: string,
  tenantId: string | null,
): Promise<boolean> {
  let q = supabaseServer.from("crm_opportunities").select("id").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data !== null;
}

async function isWonStage(
  stageId: string,
  tenantId: string | null,
): Promise<boolean> {
  let q = supabaseServer
    .from("crm_stages")
    .select("is_won")
    .eq("id", stageId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return Boolean((data as { is_won?: boolean } | null)?.is_won);
}

async function reflectWinOnContact(
  contactId: string | null,
  tenantId: string | null,
): Promise<void> {
  if (!contactId) return;
  let q = supabaseServer
    .from("contacts")
    .select("customer_type")
    .eq("id", contactId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  if (
    (data as { customer_type?: string | null } | null)?.customer_type ===
    "customer"
  ) {
    return;
  }
  await supabaseServer
    .from("contacts")
    .update({ customer_type: "customer" })
    .eq("id", contactId);
}

export async function PATCH(
  req: Request,
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

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  const { error } = await supabaseServer
    .from("crm_opportunities")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/crm/opportunities/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If this edit moved the opp into a Won stage, mirror onto the contact.
  const stageId = patch.stage_id as string | undefined;
  if (stageId && (await isWonStage(stageId, auth.tenant_id))) {
    const { data: opp } = await supabaseServer
      .from("crm_opportunities")
      .select("contact_id")
      .eq("id", id)
      .maybeSingle();
    await reflectWinOnContact(
      (opp as { contact_id?: string | null } | null)?.contact_id ?? null,
      auth.tenant_id,
    );
  }

  return NextResponse.json({ ok: true });
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

  const { error } = await supabaseServer
    .from("crm_opportunities")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/crm/opportunities/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
