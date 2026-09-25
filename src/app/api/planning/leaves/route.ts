import "server-only";

/* GET /api/planning/leaves?from=YYYY-MM-DD&to=YYYY-MM-DD
   Approved HR leave mapped onto Planning employee resources, so the
   schedule board can block those days visually and flag any item
   scheduled over someone's leave.

   Tenant scope: hr_leave_requests carries no tenant_id, so the query is
   driven FROM the tenant — its employee resources → their accounts → the
   employees behind those accounts → only those employees' leave. The row
   limit therefore applies within this tenant, not across all of them. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const noStore = { headers: { "Cache-Control": "private, no-store" } };
  const fail = (where: string, msg: string) => {
    console.error(`[api/planning/leaves] ${where}:`, msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  };

  const { data: resources, error: resErr } = await supabaseServer
    .from("planning_resources")
    .select("id, account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("type", "employee")
    .not("account_id", "is", null);
  if (resErr) return fail("resources", resErr.message);
  const accountToResource = new Map(
    (resources ?? []).map((r) => [r.account_id as string, r.id as string]),
  );
  const accountIds = [...accountToResource.keys()];
  if (accountIds.length === 0) return NextResponse.json({ leaves: [] }, noStore);

  const { data: emps, error: empErr } = await supabaseServer
    .from("koleex_employees")
    .select("id, account_id")
    .in("account_id", accountIds)
    .or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`);
  if (empErr) return fail("employees", empErr.message);
  const empToAccount = new Map(
    (emps ?? []).map((e) => [e.id as string, e.account_id as string]),
  );
  const employeeIds = [...empToAccount.keys()];
  if (employeeIds.length === 0) return NextResponse.json({ leaves: [] }, noStore);

  const { data: reqs, error: lvErr } = await supabaseServer
    .from("hr_leave_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .in("employee_id", employeeIds)
    .lte("start_date", to)
    .gte("end_date", from)
    .limit(500);
  if (lvErr) return fail("leave", lvErr.message);

  const leaves = (reqs ?? []).flatMap((r) => {
    const acct = empToAccount.get(r.employee_id as string);
    const resourceId = acct ? accountToResource.get(acct) : null;
    if (!resourceId) return [];
    return [{ resource_id: resourceId, start_date: r.start_date, end_date: r.end_date }];
  });

  return NextResponse.json({ leaves }, noStore);
}
