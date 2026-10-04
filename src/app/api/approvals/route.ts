import "server-only";

/* GET /api/approvals          unified pending queue
   POST /api/approvals         transition body { entity, entityId, action, reason? }

   Both verbs pass requireApprovalsAccess — an internal account with the
   Finance module: view to read the queue, create to move an item — before
   they read a row or the request body (src/lib/approvals/gate.ts). Who sees
   bills and journals, and who approves, is Roles & Permissions
   (src/lib/experience) — never the department's name.
   Guarded by validate:finance-perf §F and §G.
*/

import { NextResponse, after } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { canApproveFinance, canSeeCostData } from "@/lib/experience";
import {
  listPending, transitionApproval, isApprovalEntity, isApprovalAction,
  visibleKinds, COST_SENSITIVE_KINDS,
} from "@/lib/approvals";
import { requireApprovalsAccess } from "@/lib/approvals/gate";
import { notifyExpenseTransitionById } from "@/lib/server/commerce-notify";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireApprovalsAccess(auth, "view");
  if (denied) return denied;

  /* can_approve asks the same door the POST will, so the screen never offers
     an Approve the server would refuse — and it stays false during view-as,
     which is read-only. */
  const [items, approver, moveDenied] = await Promise.all([
    listPending(auth.tenant_id),
    canApproveFinance(auth),
    requireApprovalsAccess(auth, "create"),
  ]);
  /* Cost-sensitive entities hidden from roles that cannot see cost data. */
  const kinds = new Set(visibleKinds(canSeeCostData(auth)));
  return NextResponse.json({
    items: items.filter((i) => kinds.has(i.kind)),
    can_approve: approver && moveDenied === null,
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

  /* Can't read → can't write: the queue hides bills and journals from a role
     that cannot see cost data, so that role cannot move them either. */
  if (COST_SENSITIVE_KINDS.has(body.entity) && !canSeeCostData(auth)) {
    return NextResponse.json({ error: "Your role can't act on cost-sensitive items." }, { status: 403 });
  }
  /* Approve / reject also need «Finance Approvals». */
  if ((body.action === "approve" || body.action === "reject") && !(await canApproveFinance(auth))) {
    return NextResponse.json({ error: "Your role can't approve or reject (Finance Approvals)." }, { status: 403 });
  }

  const r = await transitionApproval({
    tenantId: auth.tenant_id, actorId: auth.account_id,
    entity: body.entity, entityId: body.entityId, action: body.action,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
  if (body.entity === "expense" && r.status) {
    const expenseId = body.entityId, to = r.status;
    const note = typeof body.reason === "string" ? body.reason : typeof body.note === "string" ? body.note : null;
    after(() => notifyExpenseTransitionById(auth, expenseId, to, note));
  }
  return NextResponse.json({ ok: true, status: r.status });
}
