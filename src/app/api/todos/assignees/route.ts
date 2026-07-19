import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listAssignableEmployees } from "@/lib/server/assignable-employees";

/* GET /api/todos/assignees — assignable employees (internal, active, human
   accounts with real names) + the distinct department list for filters.
   Shared source: src/lib/server/assignable-employees.ts */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  try {
    const assignees = await listAssignableEmployees(auth.tenant_id);
    const departments = Array.from(
      new Set(assignees.map((a) => a.department).filter(Boolean) as string[]),
    ).sort();
    return NextResponse.json(
      { assignees, departments },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
    );
  } catch (e) {
    console.error("[api/todos/assignees]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load assignees" }, { status: 500 });
  }
}
