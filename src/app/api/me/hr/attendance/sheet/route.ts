import "server-only";

/* GET /api/me/hr/attendance/sheet?month=YYYY-MM&tz= — MY month, every day
   accounted for (weekend / holiday / leave / present / late / absent).
   Identity-scoped: the employee id is the caller's own. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { cleanTz, resolveMyEmployee, todayIso } from "@/lib/server/me-hr";
import { buildAttendanceSheet, parseMonth } from "@/lib/server/attendance-sheet";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });
  const url = new URL(req.url);
  const today = todayIso(cleanTz(url.searchParams.get("tz")));
  const { year, month } = parseMonth(url.searchParams.get("month"), today);
  const sheet = await buildAttendanceSheet({ employeeId: me.id, tenantId: auth.tenant_id, year, month, today });
  return NextResponse.json({ sheet }, { headers: { "Cache-Control": "private, no-store" } });
}
