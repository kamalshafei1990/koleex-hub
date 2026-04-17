import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH /api/contacts/[id] — update a contact. Tenant-enforced.
   DELETE /api/contacts/[id] — remove a contact. Tenant-enforced.

   Permission: "Customers" module access. Further per-record scope
   (owner / department / all) is applied via the existing anon-key
   path for now — tonight's hardening closes the tenant boundary. */

async function existsInTenant(id: string, tenantId: string | null): Promise<boolean> {
  let q = supabaseServer.from("contacts").select("id").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data !== null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;
  delete patch.created_at;

  const { error } = await supabaseServer
    .from("contacts")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseServer
    .from("contacts")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
