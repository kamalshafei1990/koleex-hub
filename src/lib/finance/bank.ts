import "server-only";

/* ---------------------------------------------------------------------------
   Bank account helpers shared by the routes that create payments on the
   operator's behalf (invoice receipts, vendor payments). A payment must
   name the bank account it moved through so the ledger books it on that
   account's own sub-account; when the operator did not pick one, the
   tenant's primary account in the payment currency is the sensible default.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

interface BankLite { id: string; currency: string; is_primary: boolean; status: string }

export async function defaultBankAccountId(tenantId: string, currency: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("finance_bank_accounts")
    .select("id, currency, is_primary, status")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .eq("status", "active");
  const banks = (data ?? []) as BankLite[];
  const ccy = currency.toUpperCase();
  const pick =
    banks.find((b) => b.currency.toUpperCase() === ccy && b.is_primary) ??
    banks.find((b) => b.currency.toUpperCase() === ccy) ??
    banks.find((b) => b.is_primary) ??
    banks[0];
  return pick?.id ?? null;
}

export interface BankLedgerBalance {
  bank_account_id: string;
  gl_account_id: string | null;
  gl_code: string | null;
  currency: string;
  ledger_native: number;
  ledger_base: number;
  statement_balance: number;
  difference: number;
  last_entry_date: string | null;
  foreign_lines: number;
}

/** Ledger vs statement per bank account (fn_accounting_bank_balances). */
export async function bankLedgerBalances(tenantId: string): Promise<Map<string, BankLedgerBalance>> {
  await supabaseServer.rpc("fn_accounting_ensure_bank_accounts", { p_tenant_id: tenantId });
  const { data } = await supabaseServer.rpc("fn_accounting_bank_balances", { p_tenant_id: tenantId });
  const map = new Map<string, BankLedgerBalance>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(r.bank_account_id), {
      bank_account_id: String(r.bank_account_id),
      gl_account_id: (r.gl_account_id as string | null) ?? null,
      gl_code: (r.gl_code as string | null) ?? null,
      currency: String(r.currency ?? ""),
      ledger_native: Number(r.ledger_native) || 0,
      ledger_base: Number(r.ledger_base) || 0,
      statement_balance: Number(r.statement_balance) || 0,
      difference: Number(r.difference) || 0,
      last_entry_date: (r.last_entry_date as string | null) ?? null,
      foreign_lines: Number(r.foreign_lines) || 0,
    });
  }
  return map;
}
