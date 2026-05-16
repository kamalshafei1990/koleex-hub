import "server-only";

/* ===========================================================================
   /api/finance/bank-accounts

   GET  — list bank accounts for the tenant with operational counters:
           · unreconciled_count       (cash movements unreconciled)
           · last_import_at           (newest bank-statement-import upload)
           · last_movement_at         (newest movement_date)
   POST — create a new bank account; enforces "one primary per currency"

   Tenant-scoped, Finance-module gated.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankAccount, BankAccountStatus } from "@/lib/finance/types";

export interface BankAccountListItem extends BankAccount {
  unreconciled_count: number;
  last_import_at: string | null;
  last_movement_at: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const [accountsRes, movementsRes, importsRes] = await Promise.all([
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("bank_name", { ascending: true }),
    supabaseServer
      .from("finance_cash_movements")
      .select("bank_account_id, reconciliation_status, movement_date")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_bank_statement_imports")
      .select("bank_account_id, uploaded_at, status")
      .eq("tenant_id", auth.tenant_id),
  ]);

  if (accountsRes.error) {
    return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });
  }

  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const movements = (movementsRes.data ?? []) as { bank_account_id: string; reconciliation_status: string; movement_date: string }[];
  const imports = (importsRes.data ?? []) as { bank_account_id: string; uploaded_at: string; status: string }[];

  /* Fold operational counters into each row. Counters are computed
     in-memory because the cardinality (per tenant) is small. */
  const unreconciledByAcct = new Map<string, number>();
  const lastMovementByAcct = new Map<string, string>();
  for (const m of movements) {
    if (m.reconciliation_status === "unreconciled") {
      unreconciledByAcct.set(m.bank_account_id, (unreconciledByAcct.get(m.bank_account_id) ?? 0) + 1);
    }
    const prev = lastMovementByAcct.get(m.bank_account_id) ?? "";
    if (m.movement_date > prev) lastMovementByAcct.set(m.bank_account_id, m.movement_date);
  }
  const lastImportByAcct = new Map<string, string>();
  for (const i of imports) {
    const prev = lastImportByAcct.get(i.bank_account_id) ?? "";
    if (i.uploaded_at > prev) lastImportByAcct.set(i.bank_account_id, i.uploaded_at);
  }

  const items: BankAccountListItem[] = accounts.map((a) => ({
    ...a,
    unreconciled_count: unreconciledByAcct.get(a.id) ?? 0,
    last_import_at: lastImportByAcct.get(a.id) ?? null,
    last_movement_at: lastMovementByAcct.get(a.id) ?? null,
  }));

  return NextResponse.json({ accounts: items });
}

interface CreateBody {
  bank_name: string;
  account_name: string;
  account_number?: string | null;
  iban?: string | null;
  swift_code?: string | null;
  currency: string;
  country?: string | null;
  opening_balance?: number;
  available_balance?: number;
  pending_balance?: number;
  restricted_balance?: number;
  status?: BankAccountStatus;
  is_primary?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
}

const VALID_CURRENCY_REGEX = /^[A-Z]{3,4}$/;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (!body.bank_name?.trim() || !body.account_name?.trim()) {
    return NextResponse.json({ error: "bank_name and account_name are required" }, { status: 400 });
  }
  const currency = (body.currency ?? "").trim().toUpperCase();
  if (!VALID_CURRENCY_REGEX.test(currency)) {
    return NextResponse.json({ error: "Currency must be a 3–4 letter ISO code" }, { status: 400 });
  }

  /* Enforce one-primary-per-currency. If the new account is primary,
     demote any existing primary in the same currency. */
  if (body.is_primary) {
    await supabaseServer
      .from("finance_bank_accounts")
      .update({ is_primary: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("currency", currency)
      .eq("is_primary", true);
  }

  const opening = Number(body.opening_balance ?? 0);
  const available = Number(body.available_balance ?? opening);
  const pending = Number(body.pending_balance ?? 0);
  const restricted = Number(body.restricted_balance ?? 0);
  const current = available + pending + restricted;

  const metadata = body.metadata ?? {};
  if (body.notes) (metadata as Record<string, unknown>).notes = body.notes;

  const { data, error } = await supabaseServer
    .from("finance_bank_accounts")
    .insert({
      tenant_id: auth.tenant_id,
      bank_name: body.bank_name.trim(),
      account_name: body.account_name.trim(),
      account_number: body.account_number?.trim() || null,
      iban: body.iban?.trim() || null,
      swift_code: body.swift_code?.trim() || null,
      currency,
      country: body.country?.trim() || null,
      opening_balance: opening,
      current_balance: current,
      available_balance: available,
      pending_balance: pending,
      restricted_balance: restricted,
      status: body.status ?? "active",
      is_primary: !!body.is_primary,
      metadata,
      created_by: auth.account_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data as BankAccount });
}
