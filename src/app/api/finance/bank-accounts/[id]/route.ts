import "server-only";

/* ===========================================================================
   /api/finance/bank-accounts/[id]

   GET   — account + cash movements + recent imports + reconciliation
           summary, scoped to this account.
   PATCH — edit account fields. Currency change is gated when the
           account already has movements (treasury invariant).
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  BankAccount,
  BankAccountStatus,
  BankStatementImport,
  CashMovement,
  FinanceReconciliationCandidate,
} from "@/lib/finance/types";

export interface BankAccountDetailResponse {
  account: BankAccount;
  movements: CashMovement[];
  imports: BankStatementImport[];
  reconciliation: {
    matched: number;
    partially_matched: number;
    unreconciled: number;
    mismatch: number;
    verified: number;
    disputed: number;
    pending_candidates: number;
  };
  counters: {
    unreconciled_count: number;
    last_import_at: string | null;
    last_movement_at: string | null;
  };
}

const MOVEMENT_LIMIT = 100;
const IMPORT_LIMIT = 25;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const [acctRes, movRes, impRes, candRes] = await Promise.all([
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabaseServer
      .from("finance_cash_movements")
      .select("*")
      .eq("bank_account_id", id)
      .eq("tenant_id", auth.tenant_id)
      .order("movement_date", { ascending: false })
      .limit(MOVEMENT_LIMIT),
    supabaseServer
      .from("finance_bank_statement_imports")
      .select("*")
      .eq("bank_account_id", id)
      .eq("tenant_id", auth.tenant_id)
      .order("uploaded_at", { ascending: false })
      .limit(IMPORT_LIMIT),
    supabaseServer
      .from("finance_reconciliation_candidates")
      .select("id, cash_movement_id, status")
      .eq("tenant_id", auth.tenant_id),
  ]);

  if (!acctRes.data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const account = acctRes.data as BankAccount;
  const movements = (movRes.data ?? []) as CashMovement[];
  const imports = (impRes.data ?? []) as BankStatementImport[];
  const allCandidates = (candRes.data ?? []) as Pick<FinanceReconciliationCandidate, "id" | "cash_movement_id" | "status">[];

  const movementIds = new Set(movements.map((m) => m.id));
  const pendingCandidates = allCandidates.filter(
    (c) => c.status === "suggested" && movementIds.has(c.cash_movement_id),
  ).length;

  const reconciliation = {
    matched: 0,
    partially_matched: 0,
    unreconciled: 0,
    mismatch: 0,
    verified: 0,
    disputed: 0,
    pending_candidates: pendingCandidates,
  };
  for (const m of movements) {
    const k = m.reconciliation_status as keyof typeof reconciliation;
    if (k in reconciliation && k !== "pending_candidates") reconciliation[k] += 1;
  }

  const last_movement_at = movements[0]?.movement_date ?? null;
  const last_import_at = imports[0]?.uploaded_at ?? null;
  const unreconciled_count = reconciliation.unreconciled;

  const body: BankAccountDetailResponse = {
    account,
    movements,
    imports,
    reconciliation,
    counters: { unreconciled_count, last_import_at, last_movement_at },
  };
  return NextResponse.json(body);
}

interface PatchBody {
  bank_name?: string;
  account_name?: string;
  account_number?: string | null;
  iban?: string | null;
  swift_code?: string | null;
  currency?: string;
  country?: string | null;
  opening_balance?: number;
  available_balance?: number;
  pending_balance?: number;
  restricted_balance?: number;
  status?: BankAccountStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  /* Load current row + count of movements to guard the currency edit. */
  const { data: existingRow } = await supabaseServer
    .from("finance_bank_accounts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!existingRow) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const existing = existingRow as BankAccount;

  if (body.currency && body.currency.toUpperCase() !== existing.currency) {
    const { count } = await supabaseServer
      .from("finance_cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("bank_account_id", id)
      .eq("tenant_id", auth.tenant_id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot change currency once the account has cash movements" },
        { status: 409 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.bank_name        != null) patch.bank_name        = body.bank_name.trim();
  if (body.account_name     != null) patch.account_name     = body.account_name.trim();
  if (body.account_number   !== undefined) patch.account_number = body.account_number || null;
  if (body.iban             !== undefined) patch.iban       = body.iban || null;
  if (body.swift_code       !== undefined) patch.swift_code = body.swift_code || null;
  if (body.country          !== undefined) patch.country    = body.country || null;
  if (body.currency         != null) patch.currency        = body.currency.toUpperCase();
  if (body.opening_balance  != null) patch.opening_balance = body.opening_balance;
  if (body.available_balance != null) patch.available_balance = body.available_balance;
  if (body.pending_balance  != null) patch.pending_balance = body.pending_balance;
  if (body.restricted_balance != null) patch.restricted_balance = body.restricted_balance;
  if (body.status           != null) patch.status          = body.status;

  /* Recompute current_balance whenever balance fields change. */
  if (patch.available_balance != null || patch.pending_balance != null || patch.restricted_balance != null) {
    const avail = (patch.available_balance ?? existing.available_balance) as number;
    const pend  = (patch.pending_balance   ?? existing.pending_balance)   as number;
    const restr = (patch.restricted_balance ?? existing.restricted_balance) as number;
    patch.current_balance = avail + pend + restr;
  }

  /* Merge notes into metadata without overwriting existing keys. */
  if (body.notes != null || body.metadata) {
    const md = { ...(existing.metadata ?? {}), ...(body.metadata ?? {}) };
    if (body.notes != null) (md as Record<string, unknown>).notes = body.notes;
    patch.metadata = md;
  }

  const { data, error } = await supabaseServer
    .from("finance_bank_accounts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data as BankAccount });
}
