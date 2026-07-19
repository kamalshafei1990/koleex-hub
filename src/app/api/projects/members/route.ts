import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listAssignableEmployees } from "@/lib/server/assignable-employees";

/* GET /api/projects/members — assignable employees for the Project manager /
   Task assignee pickers. Same curated list as To-do assignees (internal,
   active, human accounts with real names), gated by Projects access so
   Projects users don't need the Accounts module. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  try {
    const members = await listAssignableEmployees(auth.tenant_id);
    return NextResponse.json(
      { members },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
    );
  } catch (e) {
    console.error("[api/projects/members]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }
}
