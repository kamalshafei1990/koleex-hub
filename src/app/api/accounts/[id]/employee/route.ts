import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* POST /api/accounts/[id]/employee
   body: { person_id?: string | null, updates: Record<string, unknown> }

   Find-or-create the HR record for this account and apply `updates`. Backs the
   Private HR tab on the account page, where an internal account may not have a
   koleex_employees row yet.

   One call replaces three browser round trips (look up by account_id, then
   update or insert) against koleex_employees — a service-role-only table, so
   every one of them affected nothing and the tab could not save.

   Gated on Accounts, not Employees: this is the account page's own tab, and
   requiring the Employees module here would lock out the admins who use it. */

/* Columns the caller must never set through this path — identity and tenancy
   are decided here, not by the form. */
const PROTECTED = ["id", "tenant_id", "account_id", "person_id", "created_at"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "edit");
  if (deny) return deny;

  /* The account must be in the caller's tenant, or an id from another tenant
     would get an HR record created against it. */
  let accQ = supabaseServer.from("accounts").select("id, tenant_id, person_id").eq("id", accountId);
  if (auth.tenant_id) accQ = accQ.eq("tenant_id", auth.tenant_id);
  const { data: acc } = await accQ.maybeSingle();
  if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { person_id?: string | null; updates?: Record<string, unknown> }
    | null;
  const updates = { ...(body?.updates ?? {}) };
  for (const c of PROTECTED) delete updates[c];

  const { data: existing, error: findErr } = await supabaseServer
    .from("koleex_employees")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (findErr) {
    console.error("[api/accounts/employee find]", findErr.message);
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  if (existing) {
    if (Object.keys(updates).length === 0) return NextResponse.json({ employee: existing });
    const { data, error } = await supabaseServer
      .from("koleex_employees")
      .update(updates)
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[api/accounts/employee update]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ employee: data });
  }

  const { data, error } = await supabaseServer
    .from("koleex_employees")
    .insert({
      ...updates,
      account_id: accountId,
      person_id: body?.person_id ?? (acc as { person_id: string | null }).person_id ?? null,
      tenant_id: auth.tenant_id,
      employment_status: (updates.employment_status as string) ?? "active",
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/accounts/employee create]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ employee: data });
}
