import "server-only";

/* POST /api/me/hr/approvals/[id] — { decision: "approve" | "reject", notes? }
   The MANAGER's step. Identity-scoped like the rest of /api/me/hr: the caller
   is resolved to their employee record, and leave-review refuses unless that
   employee is the requester's manager_id and the request is still pending.
   No HR permission — being someone's manager is the permission. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";
import { reviewLeave } from "@/lib/server/leave-review";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { decision?: unknown; notes?: unknown } | null;
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "decision must be approve|reject" }, { status: 400 });

  const result = await reviewLeave({
    requestId: id, decision, as: "manager",
    reviewerEmployeeId: me.id, reviewerAccountId: auth.account_id, tenantId: auth.tenant_id,
    notes: typeof body?.notes === "string" ? body.notes : null,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "not_your_report" ? 403 : result.error === "update_failed" ? 500 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
