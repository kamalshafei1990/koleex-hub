import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET    /api/accounts/[id] — fetch single account with person, company,
                                 role, employee, overrides joined.
   PATCH  /api/accounts/[id] — update account fields.
   DELETE /api/accounts/[id] — remove account (cascade by DB).

   Guard: "Accounts" module permission. tenant_id can never be rewritten
   by the client (stripped server-side). */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  let q = supabaseServer
    .from("accounts")
    .select("*")
    .eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: account, error } = await q.maybeSingle();
  if (error) {
    console.error("[api/accounts/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const acc = account as Record<string, unknown>;

  // Parallel join lookups — all via service_role, all tenant-safe.
  const [personRes, companyRes, roleRes, employeeRes, overridesRes, presetRes] =
    await Promise.all([
      acc.person_id
        ? supabaseServer
            .from("people")
            .select("*")
            .eq("id", acc.person_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      acc.company_id
        ? supabaseServer
            .from("companies")
            .select("*")
            .eq("id", acc.company_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      acc.role_id
        ? supabaseServer
            .from("koleex_roles")
            .select("*")
            .eq("id", acc.role_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseServer
        .from("koleex_employees")
        .select("*")
        .eq("account_id", id)
        .maybeSingle(),
      supabaseServer
        .from("account_permission_overrides")
        .select("*")
        .eq("account_id", id),
      acc.role_id
        ? supabaseServer
            .from("access_presets")
            .select("*")
            .eq("role_id", acc.role_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return NextResponse.json({
    account: {
      ...acc,
      person: personRes.data,
      company: companyRes.data,
      role: roleRes.data,
      employee: employeeRes.data,
      overrides: overridesRes.data ?? [],
      preset: presetRes.data,
    },
  });
}

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
