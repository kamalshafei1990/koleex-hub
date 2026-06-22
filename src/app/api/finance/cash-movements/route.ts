import "server-only";

/* ===========================================================================
   POST /api/finance/cash-movements

   Manual cash-movement entry. Used for bank fees, FX adjustments,
   opening-balance corrections, and any one-off entry that doesn't
   come from a bank-statement import.

   Defaults:
     · reconciliation_status = 'unreconciled'
     · evidence_status        = 'missing'

   The movement enters the auto-reconciliation queue alongside imported
   ones — the engine never auto-confirms anything.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { CashMovement, CashMovementDirection, CashMovementType } from "@/lib/finance/types";

interface Body {
  bank_account_id: string;
  movement_type: CashMovementType;
  direction: CashMovementDirection;
  amount: number;
  currency?: string;
  movement_date: string;        // yyyy-mm-dd
  value_date?: string | null;
  bank_reference?: string | null;
  external_reference?: string | null;
  counterparty_name?: string | null;
  notes?: string | null;
  related_payment_id?: string | null;
}

const ALLOWED_TYPES: CashMovementType[] = ["incoming", "outgoing", "transfer", "fee", "fx", "refund", "adjustment"];

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (!body.bank_account_id || !body.amount || !body.movement_date || !body.direction || !body.movement_type) {
    return NextResponse.json({ error: "bank_account_id, movement_type, direction, amount, movement_date are required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(body.movement_type)) {
    return NextResponse.json({ error: "Invalid movement_type" }, { status: 400 });
  }
  if (!(body.direction === "inflow" || body.direction === "outflow")) {
    return NextResponse.json({ error: "direction must be inflow or outflow" }, { status: 400 });
  }
  if (Number(body.amount) <= 0) {
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
  }

  /* Verify the account is in this tenant. */
  const { data: acct } = await supabaseServer
    .from("finance_bank_accounts")
    .select("id, tenant_id, currency, status")
    .eq("id", body.bank_account_id)
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!acct) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  if ((acct as { status: string }).status !== "active") {
    return NextResponse.json({ error: "Cannot record a movement on an inactive account" }, { status: 409 });
  }
  const accountCurrency = (acct as { currency: string }).currency;

  const { data, error } = await supabaseServer
    .from("finance_cash_movements")
    .insert({
      tenant_id: auth.tenant_id,
      bank_account_id: body.bank_account_id,
      related_payment_id: body.related_payment_id ?? null,
      movement_type: body.movement_type,
      direction: body.direction,
      currency: (body.currency ?? accountCurrency).toUpperCase(),
      amount: Number(body.amount),
      exchange_rate: null,
      reporting_amount: null,
      bank_reference: body.bank_reference?.trim() || null,
      external_reference: body.external_reference?.trim() || null,
      counterparty_name: body.counterparty_name?.trim() || null,
      movement_date: body.movement_date,
      cleared_at: null,
      reconciliation_status: "unreconciled",
      evidence_status: "missing",
      notes: body.notes?.trim() || null,
      metadata: { manual_entry: true },
      created_by: auth.account_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movement: data as CashMovement });
}
