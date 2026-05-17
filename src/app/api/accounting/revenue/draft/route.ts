import "server-only";

/* ===========================================================================
   POST /api/accounting/revenue/draft

   Body: { invoice_id: string }
   Creates a draft Dr 1100 / Cr 4000 entry for a confirmed invoice.
   Idempotent.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { draftRevenueRecognition } from "@/lib/accounting/posting";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { invoice_id?: string } | null;
  if (!body?.invoice_id) {
    return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
  }

  const r = await draftRevenueRecognition(
    { tenantId: auth.tenant_id, postedByAccountId: auth.account_id },
    body.invoice_id,
  );
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 500 });
  return NextResponse.json(r);
}
