import "server-only";

/* GET /api/approvals/activity — the approvals audit trail: who submitted,
   approved or rejected what, with the note. Same door as /api/approvals
   (internal account + Finance·view) before anything is read; only the kinds
   the caller may see; at most ACTIVITY_LIMIT_MAX rows.
   Guarded by validate:finance-perf §F. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";
import { listActivity, isApprovalEntity, visibleKinds } from "@/lib/approvals";
import { requireApprovalsAccess } from "@/lib/approvals/gate";

const ACTIVITY_LIMIT_MAX = 200;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireApprovalsAccess(auth, "view");
  if (denied) return denied;

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  if (entity !== null && !isApprovalEntity(entity)) {
    return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
  }
  const entityId = url.searchParams.get("entityId");
  const asked = Math.trunc(Number(url.searchParams.get("limit")));
  const limit = asked > 0 ? Math.min(asked, ACTIVITY_LIMIT_MAX) : 50;

  const exp = await getUserExperience(auth);
  const rows = await listActivity(auth.tenant_id, {
    entity: entity ?? undefined, entityId: entityId ?? undefined, limit,
    kinds: visibleKinds(exp.can_see_cost_data),
  });
  return NextResponse.json({ items: rows });
}
