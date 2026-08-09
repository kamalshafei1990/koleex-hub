import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* POST /api/employees/[id]/link-account   body: { account_id: string }

   Stamps the new login onto the HR record right after an account is created,
   so the HR side knows which login belongs to which employee.

   This gets its own route on purpose. PATCH /api/employees/[id] deliberately
   strips `account_id` from the patch — a general edit form must not be able to
   re-point an employee at someone else's login — so the link needs a narrow
   endpoint that does exactly this one thing and nothing else.

   It replaces a browser write to koleex_employees, a service-role-only table:
   the update silently affected zero rows and only logged its own error, so
   after creating an account from the employee picker the two records were
   never actually linked. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: employeeId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Creating the link is part of creating an account, so it is gated on the
     Accounts module rather than Employees. */
  const deny = await requireModuleAction(auth, "Accounts", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { account_id?: unknown } | null;
  const accountId = typeof body?.account_id === "string" ? body.account_id : null;
  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  /* Both sides must live in the caller's tenant, or an id from another tenant
     could be attached to a login here. */
  const [{ data: emp }, { data: acct }] = await Promise.all([
    supabaseServer.from("koleex_employees").select("id, tenant_id").eq("id", employeeId).maybeSingle(),
    supabaseServer.from("accounts").select("id, tenant_id").eq("id", accountId).maybeSingle(),
  ]);
  if (!emp || !acct) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth.tenant_id) {
    const et = (emp as { tenant_id: string | null }).tenant_id;
    const at = (acct as { tenant_id: string | null }).tenant_id;
    if ((et && et !== auth.tenant_id) || (at && at !== auth.tenant_id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const { error } = await supabaseServer
    .from("koleex_employees")
    .update({ account_id: accountId })
    .eq("id", employeeId);
  if (error) {
    console.error("[api/employees/link-account]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
