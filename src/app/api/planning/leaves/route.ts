import "server-only";

/* GET /api/planning/leaves?from=YYYY-MM-DD&to=YYYY-MM-DD
   Approved HR leave mapped onto Planning employee resources, so the
   schedule board can block those days visually and flag any item
   scheduled over someone's leave. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const { data: reqs } = await supabaseServer
    .from("hr_leave_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from)
    .limit(500);
  if (!reqs || reqs.length === 0) return NextResponse.json({ leaves: [] });

  const employeeIds = [...new Set(reqs.map((r) => r.employee_id as string).filter(Boolean))];
  const { data: emps } = await supabaseServer
    .from("koleex_employees")
    .select("id, account_id")
    .in("id", employeeIds);
  const empToAccount = new Map(
    (emps ?? []).map((e) => [e.id as string, e.account_id as string | null]),
  );

  const accountIds = [...new Set([...empToAccount.values()].filter(Boolean))] as string[];
  if (accountIds.length === 0) return NextResponse.json({ leaves: [] });
  const { data: resources } = await supabaseServer
    .from("planning_resources")
    .select("id, account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("type", "employee")
    .in("account_id", accountIds);
  const accountToResource = new Map(
    (resources ?? []).map((r) => [r.account_id as string, r.id as string]),
  );

  const leaves = reqs.flatMap((r) => {
    const acct = empToAccount.get(r.employee_id as string);
    const resourceId = acct ? accountToResource.get(acct) : null;
    if (!resourceId) return [];
    return [{ resource_id: resourceId, start_date: r.start_date, end_date: r.end_date }];
  });

  return NextResponse.json({ leaves });
}
