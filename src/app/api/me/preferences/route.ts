import "server-only";

/* ===========================================================================
   GET /api/me/preferences — the caller's derived experience snapshot.

   READ ONLY. The PATCH that used to live here is gone, and its absence is the
   security fix, not a simplification: it accepted a `dashboard_role` straight
   from the request body with no permission check, and that role decides
   `can_see_cost_data` / `can_see_bank_balances` / `can_see_profit` — which
   /api/inventory/items, /api/finance/workspace, /api/approvals,
   /api/reports/operational and /api/executive/snapshot all enforce server-side.
   Any employee could send one request making themselves "accountant".

   The role is now derived from the HR department on the employee record and
   from is_super_admin. Nothing writes accounts.preferences any more. The other
   keys it carried (ui_mode / favorite_apps / pinned_workflows) were read only
   by the /home role dashboard, which was removed in the same change.

   Do not re-add a writer here without a permission check on the target role.
   `npm run validate:role-experience` assertion 07 fails if the stored
   preference is ever honoured again.
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
