import "server-only";

/* ===========================================================================
   POST /api/accounting/draft
   Body: { kind: "payment" | "expense" | "cash_movement", source_id: string }

   Creates a draft journal entry for an operational source row.
   Idempotent: if a non-voided entry already exists for the source,
   returns the existing entry id. On success the source row's
   accounting_status flips to 'drafted'.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { draftCashMovement, draftExpense, draftPayment } from "@/lib/accounting/posting";

interface Body {
  kind?: "payment" | "expense" | "cash_movement";
  source_id?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.kind || !body.source_id) {
    return NextResponse.json({ error: "kind + source_id required" }, { status: 400 });
  }
  const ctx = { tenantId: auth.tenant_id, postedByAccountId: auth.account_id };
  const res =
    body.kind === "payment"  ? await draftPayment(ctx, body.source_id)
    : body.kind === "expense" ? await draftExpense(ctx, body.source_id)
    : await draftCashMovement(ctx, body.source_id);

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code ?? 500 });
  return NextResponse.json(res);
}
