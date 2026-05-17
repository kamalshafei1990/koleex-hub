#!/usr/bin/env tsx

/* ===========================================================================
   Currency Stabilization validator.

   Coverage (10 assertions):
     01  Every transactional table carries the 4 FX columns
     02  Default currency seeds to CNY when a tenant's row is empty
     03  resolveBaseCurrency returns the tenant's default_currency
     04  resolveRate(USD→CNY) honours the most-recent ≤date rule
     05  resolveRate throws when no rate is configured
     06  convertToBase(amount=100, USD, base=CNY) = amount × rate
     07  convertToBase identity (currency = base) returns rate=1
     08  recordFxExchange writes a row with rate = to/from and a non-null
         exchange_no; same-currency pair rejected
     09  recordFxExchange computes gain_loss_base when rates are configured
     10  Tenant isolation — A cannot see B's rates or exchanges
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  resolveBaseCurrency,
  resolveRate,
  convertToBase,
  recordFxExchange,
} from "../src/lib/finance/currency";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[currency] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000C1";
const TENANT_B = "00000000-0000-4000-a000-0000000000C2";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function near(a: number, b: number, tol = 0.0001) { return Math.abs(a - b) < tol; }

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `currency-${id.slice(-4)}`,
      name: `Currency Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("finance_fx_exchanges").delete().eq("tenant_id", t);
    await supabase.from("finance_fx_rates").delete().eq("tenant_id", t);
    await supabase.from("finance_bank_accounts").delete().eq("tenant_id", t);
  }
}

async function ensureBank(tenantId: string, code: string, currency: string): Promise<string> {
  const { data } = await supabase.from("finance_bank_accounts").insert({
    tenant_id: tenantId, bank_name: code, account_name: code,
    currency, opening_balance: 0, status: "active",
  }).select("id").single();
  return (data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("Currency Stabilization validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  /* 01 — Every transactional table carries the 4 FX columns. */
  const tables = [
    "finance_payments","finance_expenses","finance_cash_movements",
    "invoices","vendor_bills","purchase_orders","sales_orders",
    "finance_bank_accounts",
  ];
  const missing: string[] = [];
  for (const tbl of tables) {
    const { data } = await supabase
      .from("information_schema.columns" as never)
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tbl)
      .in("column_name", ["fx_rate", "base_amount", "base_currency", "fx_conversion_date"]);
    /* PostgREST can't reach information_schema; use raw SQL through RPC
       — but to keep this validator lib-only, instead query each table
       for the column by selecting a 0-row result. If the column is
       missing the query errors. */
    void data;
    const probe = await supabase.from(tbl).select("fx_rate, base_amount, base_currency, fx_conversion_date").limit(0);
    if (probe.error) missing.push(tbl);
  }
  ok(
    "01  every transactional table has fx_rate / base_amount / base_currency / fx_conversion_date",
    missing.length === 0,
    missing.length ? `missing on: ${missing.join(", ")}` : `${tables.length} tables checked`,
  );

  /* 02 — Default currency seeds to CNY. */
  await supabase.from("tenants").update({ default_currency: null }).eq("id", TENANT_A);
  /* Even with NULL the helper falls back to CNY. */
  const fallback = await resolveBaseCurrency(TENANT_A);
  ok("02  base currency falls back to CNY when default_currency is null", fallback === "CNY", `base=${fallback}`);

  /* 03 — resolveBaseCurrency reflects tenant setting. */
  await supabase.from("tenants").update({ default_currency: "CNY" }).eq("id", TENANT_A);
  const baseA = await resolveBaseCurrency(TENANT_A);
  ok("03  resolveBaseCurrency reads tenants.default_currency", baseA === "CNY", `base=${baseA}`);

  /* Seed two USD→CNY rates: an older one and a newer one. */
  await supabase.from("finance_fx_rates").insert([
    { tenant_id: TENANT_A, from_currency: "USD", to_currency: "CNY", rate: 7.10, effective_date: "2026-01-01" },
    { tenant_id: TENANT_A, from_currency: "USD", to_currency: "CNY", rate: 7.25, effective_date: "2026-05-01" },
  ]);

  /* 04 — Most-recent ≤date wins. */
  const onJan15 = await resolveRate({ tenantId: TENANT_A, from: "USD", to: "CNY", date: "2026-01-15" });
  const onMay15 = await resolveRate({ tenantId: TENANT_A, from: "USD", to: "CNY", date: "2026-05-15" });
  ok(
    "04  resolveRate honours most-recent ≤date",
    near(onJan15.rate, 7.10) && near(onMay15.rate, 7.25),
    `jan=${onJan15.rate} may=${onMay15.rate}`,
  );

  /* 05 — Missing rate throws. */
  let threw = false;
  try {
    await resolveRate({ tenantId: TENANT_A, from: "EUR", to: "CNY" });
  } catch { threw = true; }
  ok("05  resolveRate throws when no rate is configured", threw);

  /* 06 — convertToBase applies the rate. */
  const conv = await convertToBase({ tenantId: TENANT_A, amount: 100, currency: "USD", date: "2026-05-15" });
  ok(
    "06  convertToBase(100 USD, base=CNY) = 100 × 7.25",
    conv.base_currency === "CNY" && near(conv.base_amount, 725) && near(conv.fx_rate, 7.25),
    `base_amount=${conv.base_amount} rate=${conv.fx_rate}`,
  );

  /* 07 — Identity. */
  const identity = await convertToBase({ tenantId: TENANT_A, amount: 50, currency: "CNY" });
  ok(
    "07  convertToBase identity returns rate=1, amount unchanged",
    identity.fx_rate === 1 && identity.base_amount === 50,
  );

  /* 08 — recordFxExchange happy path + same-currency rejection. */
  const usdBank = await ensureBank(TENANT_A, "USD-OP", "USD");
  const cnyBank = await ensureBank(TENANT_A, "CNY-OP", "CNY");
  const exch = await recordFxExchange({
    tenantId: TENANT_A, exchangeDate: "2026-05-15",
    fromBankId: usdBank, toBankId: cnyBank,
    fromCurrency: "USD", toCurrency: "CNY",
    fromAmount: 1000, toAmount: 7250,
  });
  ok(
    "08  recordFxExchange writes a row with rate=to/from and exchange_no",
    exch.ok && !!exch.exchange_no && near(exch.fx_rate ?? 0, 7.25),
    `no=${exch.exchange_no} rate=${exch.fx_rate}`,
  );
  const sameCur = await recordFxExchange({
    tenantId: TENANT_A, exchangeDate: "2026-05-15",
    fromBankId: usdBank, toBankId: cnyBank,
    fromCurrency: "USD", toCurrency: "USD",
    fromAmount: 100, toAmount: 100,
  });
  ok(
    "08b same-currency exchange rejected (400)",
    !sameCur.ok && sameCur.code === 400,
    sameCur.error ?? "",
  );

  /* 09 — Gain/loss computed when rates are configured.
     1000 USD → 7250 CNY at our rate 7.25 → gain/loss = 0. */
  ok(
    "09  recordFxExchange computes gain_loss_base when rates exist (≈0 here)",
    typeof exch.gain_loss_base === "number" && near(exch.gain_loss_base ?? 999, 0, 0.5),
    `gain_loss=${exch.gain_loss_base}`,
  );

  /* 10 — Tenant isolation. */
  await supabase.from("finance_fx_rates").insert({
    tenant_id: TENANT_B, from_currency: "USD", to_currency: "CNY", rate: 99, effective_date: "2026-05-15",
  });
  const aRate = await resolveRate({ tenantId: TENANT_A, from: "USD", to: "CNY", date: "2026-05-15" });
  ok(
    "10  tenant isolation — A never sees B's rates",
    !near(aRate.rate, 99),
    `A.rate=${aRate.rate} (must not equal 99)`,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
