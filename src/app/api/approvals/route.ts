import "server-only";

/* GET /api/approvals          unified pending queue
   POST /api/approvals         transition body { entity, entityId, action, reason? }

   Both verbs pass requireApprovalsAccess — an internal account with the
   Finance module: view to read the queue, create to move an item — before
   they read a row or the request body (src/lib/approvals/gate.ts).
   Guarded by validate:finance-perf §F.
*/

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";
import {
  listPending, transitionApproval, canApprove, isApprovalEntity, isApprovalAction,
  visibleKinds, COST_SENSITIVE_KINDS,
} from "@/lib/approvals";
import { requireApprovalsAccess } from "@/lib/approvals/gate";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireApprovalsAccess(auth, "view");
  if (denied) return denied;

  /* can_approve asks the same door the POST will, so the screen never offers
     an Approve the server would refuse — and it stays false during view-as,
     which is read-only. */
  const [exp, items, moveDenied] = await Promise.all([
    getUserExperience(auth),
    listPending(auth.tenant_id),
    requireApprovalsAccess(auth, "create"),
  ]);
  /* Cost-sensitive entities hidden from roles that cannot see cost data. */
  const kinds = new Set(visibleKinds(exp.can_see_cost_data));
  return NextResponse.json({
    items: items.filter((i) => kinds.has(i.kind)),
    can_approve: canApprove(exp.dashboard_role, exp.is_super_admin) && moveDenied === null,
  });
}

interface PostBody {
  entity?: unknown; entityId?: unknown; action?: unknown;
  reason?: unknown; note?: unknown;
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireApprovalsAccess(auth, "create");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.entity || !body.entityId || !body.action) {
    return NextResponse.json({ error: "entity, entityId, action required" }, { status: 400 });
  }
  if (!isApprovalEntity(body.entity) || !isApprovalAction(body.action) || typeof body.entityId !== "string") {
    return NextResponse.json({ error: "Unknown entity or action." }, { status: 400 });
  }

  const exp = await getUserExperience(auth);
  /* Can't read → can't write: the queue hides bills and journals from a role
     that cannot see cost data, so that role cannot move them either. */
  if (COST_SENSITIVE_KINDS.has(body.entity) && !exp.can_see_cost_data) {
    return NextResponse.json({ error: "Your role can't act on cost-sensitive items." }, { status: 403 });
  }
  /* Approve / reject also need the approver predicate. */
  if ((body.action === "approve" || body.action === "reject") && !canApprove(exp.dashboard_role, exp.is_super_admin)) {
    return NextResponse.json({ error: "Approval permission denied for this role." }, { status: 403 });
  }

  const r = await transitionApproval({
    tenantId: auth.tenant_id, actorId: auth.account_id,
    entity: body.entity, entityId: body.entityId, action: body.action,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
  return NextResponse.json({ ok: true, status: r.status });
}
