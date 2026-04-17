import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH  /api/accounts/[id] — update account fields.
   DELETE /api/accounts/[id] — remove account (cascade by DB).

   Guard: "Accounts" module permission. tenant_id can never be rewritten
   by the client (stripped server-side). */

async function existsInTenant(
  id: string,
  tenantId: string | null,
): Promise<boolean> {
  let q = supabaseServer.from("accounts").select("id").eq("id", id);
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
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  // Never let the client write these through a general update.
  delete patch.id;
  delete patch.tenant_id;
  delete patch.password_hash; // use the dedicated reset endpoint
  delete patch.created_at;

  const { error } = await supabaseServer
    .from("accounts")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/accounts/[id] PATCH]", error.message);
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
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  if (!(await existsInTenant(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Safety: never let an admin delete their own account through the API.
  if (id === auth.account_id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 },
    );
  }

  const { error } = await supabaseServer
    .from("accounts")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/accounts/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
