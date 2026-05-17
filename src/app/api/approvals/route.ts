import "server-only";

/* GET /api/approvals          unified pending queue
   POST /api/approvals         transition body { entity, entityId, action, reason? }
*/

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";
import {
  listPending, transitionApproval, canApprove,
  type ApprovalEntity, type ApprovalAction,
} from "@/lib/approvals";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const exp = await getUserExperience(auth);
  const items = await listPending(auth.tenant_id);
  /* Cost-sensitive entities hidden from roles that cannot see cost data. */
  const filtered = exp.can_see_cost_data
    ? items
    : items.filter((i) => i.kind !== "bill" && i.kind !== "journal");
  return NextResponse.json({
    items: filtered,
    can_approve: canApprove(exp.dashboard_role, exp.is_super_admin),
  });
}

interface PostBody {
  entity?: ApprovalEntity; entityId?: string; action?: ApprovalAction;
  reason?: string; note?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.entity || !body.entityId || !body.action) {
    return NextResponse.json({ error: "entity, entityId, action required" }, { status: 400 });
  }

  /* Submission is open to any authenticated user; approve / reject
     require the approver predicate. */
  if (body.action === "approve" || body.action === "reject") {
    const exp = await getUserExperience(auth);
    if (!canApprove(exp.dashboard_role, exp.is_super_admin)) {
      return NextResponse.json({ error: "Approval permission denied for this role." }, { status: 403 });
    }
  }

  const r = await transitionApproval({
    tenantId: auth.tenant_id, actorId: auth.account_id,
    entity: body.entity, entityId: body.entityId,
    action: body.action, reason: body.reason, note: body.note,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
  return NextResponse.json({ ok: true, status: r.status });
}
