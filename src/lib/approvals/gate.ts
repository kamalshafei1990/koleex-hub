import "server-only";

/* ===========================================================================
   The one door into the approvals surface (/api/approvals and everything
   under it).

   The queue is the tenant's whole pending finance work — amounts, currencies,
   references, counterparties — and its activity log says who decided what and
   why. Both routes used to check only that the caller was signed in, so any
   account could read all of it, and any account could move a draft to
   'submitted'.

   Every handler now calls requireApprovalsAccess right after requireAuth and
   before it touches a row or the request body. The chain lives here, once, so
   a verb cannot keep one step and quietly lose the other:

     1. INTERNAL accounts only. A customer login shares the accounts table; the
        finance queue is not something a module grant should be able to open to
        it by accident, so it is refused at the door — the rule Koleex AI keeps
        with requireInternalUser.
     2. The Finance module. `view` reads the queue and its activity; `create`
        moves an item — the action /api/finance/{expenses,payments}/[id]/approval
        already ask for, so both doors give the same person the same answer.

   Guarded by validate:finance-perf §F.
   ========================================================================== */

import { NextResponse } from "next/server";
import {
  requireModuleAccess, requireModuleAction, type ServerAuthContext,
} from "@/lib/server/auth";

export async function requireApprovalsAccess(
  auth: ServerAuthContext,
  action: "view" | "create",
): Promise<NextResponse | null> {
  if (auth.user_type !== "internal") {
    return NextResponse.json(
      { error: "Approvals are available to internal Koleex accounts only." },
      { status: 403 },
    );
  }
  return action === "view"
    ? requireModuleAccess(auth, "Finance")
    : requireModuleAction(auth, "Finance", action);
}
