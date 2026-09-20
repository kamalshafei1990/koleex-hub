import "server-only";

/* GET  /api/hr/payroll/runs            — runs, newest first (HR·view)
   POST /api/hr/payroll/runs { period: "YYYY-MM", country?: "CN" }
        — generate (or regenerate the drafts of) the month's payroll (HR·create) */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { cleanTz, todayIso } from "@/lib/server/me-hr";
import { runPayroll } from "@/lib/server/payroll-run";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const { data } = await supabaseServer.from("hr_payroll_runs").select("*")
    .or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`)
    .order("period", { ascending: false }).limit(60);
  return NextResponse.json({ runs: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "create");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { period?: unknown; country?: unknown; tz?: unknown; deduct_absence?: unknown } | null;
  const period = typeof body?.period === "string" && /^\d{4}-\d{2}$/.test(body.period) ? body.period : null;
  if (!period) return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  const country = typeof body?.country === "string" && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : null;
  try {
    const result = await runPayroll({ tenantId: auth.tenant_id, period, country, createdBy: auth.account_id, today: todayIso(cleanTz(body?.tz)), deductAbsence: body?.deduct_absence !== false });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[api/hr/payroll/runs]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Payroll run failed." }, { status: 500 });
  }
}
