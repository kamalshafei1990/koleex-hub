import "server-only";

/* ===========================================================================
   POST /api/accounting/post
   Body: { kind: "payment" | "expense" | "cash_movement" | "opening_balance", … }

   Operator-driven entry point into the posting engine. Routes the
   request to the right posting function so the UI can "post this
   payment to the ledger" with one click. Semi-automatic per the
   Phase A.1 brief — no auto-post triggers anywhere.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  postBankMovement,
  postExpense,
  postOpeningBalance,
  postPayment,
} from "@/lib/accounting/posting";

interface Body {
  kind?: "payment" | "expense" | "cash_movement" | "opening_balance";
  payment_id?: string;
  expense_id?: string;
  cash_movement_id?: string;
  opening?: {
    account_code: string;
    amount: number;
    currency?: string;
    entry_date?: string;
    description?: string;
    opening_id?: string;
  };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  const ctx = { tenantId: auth.tenant_id, postedByAccountId: auth.account_id };

  switch (body.kind) {
    case "payment": {
      if (!body.payment_id) return NextResponse.json({ error: "payment_id required" }, { status: 400 });
      const r = await postPayment(ctx, body.payment_id);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
    }
    case "expense": {
      if (!body.expense_id) return NextResponse.json({ error: "expense_id required" }, { status: 400 });
      const r = await postExpense(ctx, body.expense_id);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
    }
    case "cash_movement": {
      if (!body.cash_movement_id) return NextResponse.json({ error: "cash_movement_id required" }, { status: 400 });
      const r = await postBankMovement(ctx, body.cash_movement_id);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
    }
    case "opening_balance": {
      if (!body.opening?.account_code) return NextResponse.json({ error: "opening.account_code required" }, { status: 400 });
      const r = await postOpeningBalance(ctx, {
        accountCode: body.opening.account_code,
        amount: body.opening.amount,
        currency: body.opening.currency,
        entryDate: body.opening.entry_date,
        description: body.opening.description,
        openingId: body.opening.opening_id,
      });
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.code ?? 500 });
    }
    default:
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }
}
