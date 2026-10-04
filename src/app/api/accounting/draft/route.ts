import "server-only";

/* POST /api/accounting/draft   { kind, source_id }
   Creates the draft journal entry for a source document (payment, expense,
   cash_movement, sales_revenue, inventory_cogs, vendor_bill,
   inventory_receipt, payroll, fx_exchange). Idempotent: an existing
   non-voided entry is returned. The source row mirrors 'drafted'. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { draftSource, isSourceKind } from "@/lib/accounting/posting";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; source_id?: unknown };
  if (!isSourceKind(body.kind) || typeof body.source_id !== "string" || !body.source_id) {
    return NextResponse.json({ error: "kind + source_id required" }, { status: 400 });
  }
  const res = await draftSource({ tenantId: auth.tenant_id, postedByAccountId: auth.account_id }, body.kind, body.source_id);
  if (!res.ok) return NextResponse.json({ error: res.error, details: res.details }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
