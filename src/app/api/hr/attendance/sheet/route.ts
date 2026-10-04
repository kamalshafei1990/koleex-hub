import "server-only";

/* GET /api/hr/attendance/sheet?employee_id=&month=YYYY-MM — the monthly
   sheet for ANY employee, for HR (HR·view). Same builder as the employee's
   own view, so the two never disagree. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { cleanTz, todayIso } from "@/lib/server/me-hr";
import { buildAttendanceSheet, parseMonth } from "@/lib/server/attendance-sheet";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id");
  if (!employeeId || !/^[0-9a-f-]{36}$/i.test(employeeId)) return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  const today = todayIso(cleanTz(url.searchParams.get("tz")));
  const { year, month } = parseMonth(url.searchParams.get("month"), today);
  const sheet = await buildAttendanceSheet({ employeeId, tenantId: auth.tenant_id, year, month, today });
  return NextResponse.json({ sheet }, { headers: { "Cache-Control": "private, no-store" } });
}
