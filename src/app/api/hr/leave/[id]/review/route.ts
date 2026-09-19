import "server-only";

/* POST /api/hr/leave/[id]/review — { decision: "approve" | "reject", notes? }
   HR's step (or HR's override of a request the manager has not reached yet).
   Gated on HR·edit; the reviewer recorded on the row is the caller's own
   employee record when they have one. Replaces the client-side
   reviewLeaveRequest write so the decision, the balance deduction and the
   notifications happen in one place, server-side. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";
import { reviewLeave } from "@/lib/server/leave-review";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { decision?: unknown; notes?: unknown } | null;
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "decision must be approve|reject" }, { status: 400 });

  const me = await resolveMyEmployee(auth);
  const result = await reviewLeave({
    requestId: id, decision, as: "hr",
    reviewerEmployeeId: me?.id ?? null, reviewerAccountId: auth.account_id, tenantId: auth.tenant_id,
    notes: typeof body?.notes === "string" ? body.notes : null,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "update_failed" ? 500 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
