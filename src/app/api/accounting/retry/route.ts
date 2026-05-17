import "server-only";

/* ===========================================================================
   POST /api/accounting/retry
   Body: { kind: "payment" | "expense" | "cash_movement", source_id: string }

   Re-attempts recognition for a failed (or stuck-drafted) source.
   Clears accounting_last_error on success.

   Flow:
     1. If an active draft exists, post it.
     2. Otherwise rebuild the draft from scratch (recomputes Dr/Cr
        from the current operational row) and post.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { retryRecognition } from "@/lib/accounting/posting";

interface Body {
  kind?: "payment" | "expense" | "cash_movement";
  source_id?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.kind || !body.source_id) {
    return NextResponse.json({ error: "kind + source_id required" }, { status: 400 });
  }
  const ctx = { tenantId: auth.tenant_id, postedByAccountId: auth.account_id };
  const res = await retryRecognition(ctx, body.kind, body.source_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
