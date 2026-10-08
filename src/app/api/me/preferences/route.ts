import "server-only";

/* ===========================================================================
   GET /api/me/preferences — the caller's own finance visibility.

   READ ONLY. The PATCH that used to live here is gone, and its absence is the
   security fix, not a simplification: it accepted a `dashboard_role` straight
   from the request body with no permission check, and that role decided
   `can_see_cost_data` / `can_see_bank_balances` / `can_see_profit` — which
   /api/inventory/items, /api/finance/workspace, /api/approvals,
   /api/reports/operational and /api/executive/snapshot all enforce server-side.
   Any employee could send one request making themselves "accountant".

   Every answer now comes from Roles & Permissions (src/lib/experience): the
   role's «private records» switch for cost, «Bank & Profit» and «Finance
   Approvals» for the rest — never a preference, never the department's name.
   Nothing writes accounts.preferences any more. The other keys it carried
   (ui_mode / favorite_apps / pinned_workflows) were read only by the /home
   role dashboard, which was removed in the same change.

   Do not re-add a writer here. validate:budgets J1 fails if the experience
   layer ever reads a preference again, and validate:finance-perf §G if it
   reads the department.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const experience = await getUserExperience(auth);
  return NextResponse.json({ experience });
}
