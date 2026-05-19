import "server-only";

/* ===========================================================================
   Finance Onboarding — read-only status snapshot.

   The setup dashboard renders one card per area. Each card shows three
   things: a status (`empty` / `started` / `complete`), the count of
   captured rows, and a total amount when relevant. This module
   computes all of them in one round-trip per tenant so the dashboard
   stays a single fetch.

   This file ADDS NO accounting logic — it only reads existing tables.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type CardKey =
  | "base_currency"
  | "bank_accounts"
  | "cash_accounts"
  | "opening_balances"
  | "customers_ar"
  | "suppliers_ap"
  | "assets"
  | "loans"
  | "equity"
  | "fx_rates";

export type CardStatus = "empty" | "started" | "complete";

export interface SetupCard {
  key: CardKey;
  title: string;
  hint: string;
  status: CardStatus;
  count: number;
  total: number;
  currency: string;
  href: string;
}

export interface SetupSnapshot {
  tenant_id: string;
  base_currency: string;
  /** True the moment every required card is at least 'started'. */
  ready: boolean;
  /** 0..1 ratio for the top-of-page progress bar. */
  completion: number;
  cards: SetupCard[];
}

export async function buildSetupSnapshot(tenantId: string): Promise<SetupSnapshot> {
  /* Base currency — read straight off the tenant. */
  const { data: tenantRow } = await supabaseServer
    .from("tenants")
    .select("default_currency")
    .eq("id", tenantId)
    .maybeSingle();
  /* Currency stabilization: brand-new tenants default to CNY instead of
     USD. Explicit tenant.default_currency always wins. */
  const baseCurrency = ((tenantRow as { default_currency: string | null } | null)?.default_currency ?? "CNY") || "CNY";

  /* Parallel reads — every section in one shot. */
  const [
    bankAccountsRes,
    openingBalancesRes,
    assetsRes,
    fxRatesRes,
  ] = await Promise.all([
    supabaseServer
      .from("finance_bank_accounts")
      .select("id, currency, opening_balance, status, deleted_at")
      .eq("tenant_id", tenantId),
    supabaseServer
      .from("finance_opening_balances")
      .select("id, category, amount, currency")
      .eq("tenant_id", tenantId),
    supabaseServer
      .from("finance_assets")
      .select("id, purchase_value, currency, status")
      .eq("tenant_id", tenantId),
    supabaseServer
      .from("finance_fx_rates")
      .select("id")
      .eq("tenant_id", tenantId),
  ]);

  const banks = ((bankAccountsRes.data ?? []) as Array<{
    id: string; currency: string; opening_balance: number; status: string; deleted_at: string | null;
  }>).filter((b) => !b.deleted_at && b.status === "active");

  const obRows = ((openingBalancesRes.data ?? []) as Array<{
    id: string; category: string; amount: number; currency: string;
  }>);

  const assets = ((assetsRes.data ?? []) as Array<{
    id: string; purchase_value: number; currency: string; status: string;
  }>).filter((a) => a.status !== "archived");

  const fxRates = ((fxRatesRes.data ?? []) as Array<{ id: string }>);

  /* Per-card helpers. */
  const sumByCategory = (cat: string) =>
    obRows.filter((r) => r.category === cat).reduce((s, r) => s + Number(r.amount || 0), 0);
  const countByCategory = (cat: string) =>
    obRows.filter((r) => r.category === cat).length;

  const cashSum     = sumByCategory("cash");
  const loanSum     = sumByCategory("loan");
  const equitySum   = sumByCategory("owner_capital");
  const arSum       = sumByCategory("customer_receivable");
  const apSum       = sumByCategory("supplier_payable");
  const bankSum     = banks.reduce((s, b) => s + Number(b.opening_balance || 0), 0);
  const assetSum    = assets.reduce((s, a) => s + Number(a.purchase_value || 0), 0);

  const cards: SetupCard[] = [
    {
      key: "base_currency",
      title: "Main Operating Currency",
      hint: "The currency your books are kept in. KOLEEX tenants normally use CNY.",
      status: baseCurrency ? "complete" : "empty",
      count: baseCurrency ? 1 : 0,
      total: 0,
      currency: baseCurrency,
      href: "/finance/setup#base_currency",
    },
    {
      key: "bank_accounts",
      title: "Bank Accounts",
      hint: "Every operating, savings, and FX bank account the company owns.",
      status: banks.length === 0 ? "empty" : "started",
      count: banks.length,
      total: bankSum,
      currency: baseCurrency,
      href: "/finance/setup#bank_accounts",
    },
    {
      key: "cash_accounts",
      title: "Cash Accounts",
      hint: "Physical cash on hand and petty-cash floats.",
      status: countByCategory("cash") === 0 ? "empty" : "started",
      count: countByCategory("cash"),
      total: cashSum,
      currency: baseCurrency,
      href: "/finance/setup#cash_accounts",
    },
    {
      key: "opening_balances",
      title: "Starting Company Position",
      hint: "Day-zero snapshot — what the company looked like before you started using the system.",
      status: obRows.length === 0 ? "empty" : "started",
      count: obRows.length,
      total: obRows.reduce((s, r) => s + Number(r.amount || 0), 0),
      currency: baseCurrency,
      href: "/finance/setup#opening_balances",
    },
    {
      key: "customers_ar",
      title: "Money Customers Owe Us",
      hint: "Outstanding balances customers owe at go-live (technical name: Accounts Receivable / AR).",
      status: countByCategory("customer_receivable") === 0 ? "empty" : "started",
      count: countByCategory("customer_receivable"),
      total: arSum,
      currency: baseCurrency,
      href: "/finance/setup#customers_ar",
    },
    {
      key: "suppliers_ap",
      title: "Money We Owe Suppliers",
      hint: "Outstanding balances owed to suppliers at go-live (technical name: Accounts Payable / AP).",
      status: countByCategory("supplier_payable") === 0 ? "empty" : "started",
      count: countByCategory("supplier_payable"),
      total: apSum,
      currency: baseCurrency,
      href: "/finance/setup#suppliers_ap",
    },
    {
      key: "assets",
      title: "Assets",
      hint: "Fixed assets, equipment, vehicles, IT, and machinery.",
      status: assets.length === 0 ? "empty" : "started",
      count: assets.length,
      total: assetSum,
      currency: baseCurrency,
      href: "/finance/setup#assets",
    },
    {
      key: "loans",
      title: "Loans & Liabilities",
      hint: "Bank loans and outstanding long-term liabilities.",
      status: countByCategory("loan") === 0 ? "empty" : "started",
      count: countByCategory("loan"),
      total: loanSum,
      currency: baseCurrency,
      href: "/finance/setup#loans",
    },
    {
      key: "equity",
      title: "Owner Capital",
      hint: "Money the owners invested in the business at formation (technical name: Equity).",
      status: countByCategory("owner_capital") === 0 ? "empty" : "started",
      count: countByCategory("owner_capital"),
      total: equitySum,
      currency: baseCurrency,
      href: "/finance/setup#equity",
    },
    {
      key: "fx_rates",
      title: "Exchange Rates",
      hint: "Conversion rates between currencies (e.g. USD → CNY). Required when you trade in more than one currency.",
      status: fxRates.length === 0 ? "empty" : "started",
      count: fxRates.length,
      total: 0,
      currency: baseCurrency,
      href: "/finance/setup#fx_rates",
    },
  ];

  const startedOrComplete = cards.filter((c) => c.status !== "empty").length;
  const completion = cards.length > 0 ? startedOrComplete / cards.length : 0;
  return {
    tenant_id: tenantId,
    base_currency: baseCurrency,
    ready: completion >= 0.5,
    completion,
    cards,
  };
}

