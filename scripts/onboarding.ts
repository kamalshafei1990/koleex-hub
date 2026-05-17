#!/usr/bin/env tsx

/* ===========================================================================
   Financial Onboarding validator.

   Coverage (10 assertions):
     01  buildSetupSnapshot returns 10 cards, all empty on a fresh tenant
     02  base_currency defaults to USD when tenant has none
     03  Setting tenants.default_currency changes the snapshot's base
     04  An opening_balances cash entry flips the cash_accounts card
         to 'started' and shifts completion %
     05  Asset insert shows up in the Assets card with totals
     06  FX rate insert: pair distinct constraint rejects same code pair
     07  FX rate insert: positive rate accepted
     08  FX rate insert: unique (tenant, from, to, date) enforced
     09  Opening-balances soft-delete via DELETE clears the row
     10  Tenant isolation — A's snapshot never references B
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { buildSetupSnapshot } from "../src/lib/finance/onboarding";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[onboarding] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000FA";
const TENANT_B = "00000000-0000-4000-a000-0000000000FB";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `onboarding-${id.slice(-4)}`,
      name: `Onboarding Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
      default_currency: null,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("finance_assets").delete().eq("tenant_id", t);
    await supabase.from("finance_fx_rates").delete().eq("tenant_id", t);
    await supabase.from("finance_opening_balances").delete().eq("tenant_id", t);
    await supabase.from("finance_bank_accounts").delete().eq("tenant_id", t);
    /* Reset default_currency so 02 starts from null. */
    await supabase.from("tenants").update({ default_currency: null }).eq("id", t);
  }
}

async function main() {
  console.log("─".repeat(72));
  console.log("Financial Onboarding validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  /* 01 — Fresh tenant: 10 cards, all empty. */
  const fresh = await buildSetupSnapshot(TENANT_A);
  const allEmpty = fresh.cards.every((c) => c.key === "base_currency" ? true : c.status === "empty");
  ok(
    "01  fresh tenant: 10 cards, every non-currency card status='empty'",
    fresh.cards.length === 10 && allEmpty,
    `cards=${fresh.cards.length} statuses=${fresh.cards.map((c) => c.status).join("/")}`,
  );

  /* 02 — Base currency defaults to USD when tenant has none. */
  ok(
    "02  base_currency defaults to USD when not set",
    fresh.base_currency === "USD",
    `base=${fresh.base_currency}`,
  );

  /* 03 — Setting default currency reflects in the snapshot. */
  await supabase.from("tenants").update({ default_currency: "EUR" }).eq("id", TENANT_A);
  const eurSnap = await buildSetupSnapshot(TENANT_A);
  ok(
    "03  setting tenant default_currency = 'EUR' updates the snapshot",
    eurSnap.base_currency === "EUR",
    `base=${eurSnap.base_currency}`,
  );

  /* 04 — Insert an opening_balances cash entry; cash_accounts flips
     to 'started' and completion increases. */
  await supabase.from("finance_opening_balances").insert({
    tenant_id: TENANT_A, category: "cash", label: "Main petty cash",
    amount: 250, currency: "EUR",
  });
  const afterCash = await buildSetupSnapshot(TENANT_A);
  const cashCard = afterCash.cards.find((c) => c.key === "cash_accounts");
  ok(
    "04  cash entry flips cash_accounts → 'started' with total=250",
    cashCard?.status === "started" && Math.abs((cashCard?.total ?? 0) - 250) < 0.0001 && afterCash.completion > fresh.completion,
    `card=${cashCard?.status} total=${cashCard?.total} completion=${afterCash.completion.toFixed(2)}`,
  );

  /* 05 — Asset insert reflects in Assets card. */
  await supabase.from("finance_assets").insert({
    tenant_id: TENANT_A, name: "Forklift FL-2026", category: "Machinery",
    purchase_value: 18500, depreciation_method: "straight_line",
    useful_life_years: 5, currency: "EUR",
  });
  const afterAsset = await buildSetupSnapshot(TENANT_A);
  const assetCard = afterAsset.cards.find((c) => c.key === "assets");
  ok(
    "05  asset insert flips assets card → 'started' with total=18500",
    assetCard?.status === "started" && Math.abs((assetCard?.total ?? 0) - 18500) < 0.0001,
    `card=${assetCard?.status} total=${assetCard?.total}`,
  );

  /* 06 — FX same-code rejected. */
  const sameCode = await supabase.from("finance_fx_rates").insert({
    tenant_id: TENANT_A, from_currency: "USD", to_currency: "USD",
    rate: 1, effective_date: "2026-01-01",
  });
  ok(
    "06  FX rate rejects same from/to currency",
    !!sameCode.error,
    sameCode.error?.message?.slice(0, 60) ?? "",
  );

  /* 07 — Positive rate accepted. */
  const fxOk = await supabase.from("finance_fx_rates").insert({
    tenant_id: TENANT_A, from_currency: "USD", to_currency: "EUR",
    rate: 0.92, effective_date: "2026-05-17",
  });
  ok(
    "07  positive FX rate accepted",
    !fxOk.error,
    fxOk.error?.message?.slice(0, 60) ?? "",
  );

  /* 08 — Duplicate (tenant, from, to, date) blocked. */
  const dup = await supabase.from("finance_fx_rates").insert({
    tenant_id: TENANT_A, from_currency: "USD", to_currency: "EUR",
    rate: 0.95, effective_date: "2026-05-17",
  });
  ok(
    "08  duplicate (tenant, from, to, date) rejected",
    !!dup.error && dup.error.code === "23505",
    dup.error?.message?.slice(0, 60) ?? "",
  );

  /* 09 — Delete an opening balance row clears it. */
  const { data: obRow } = await supabase
    .from("finance_opening_balances")
    .select("id").eq("tenant_id", TENANT_A).eq("category", "cash").limit(1).maybeSingle();
  const obId = (obRow as { id: string } | null)?.id;
  await supabase.from("finance_opening_balances").delete().eq("id", obId ?? "");
  const after = await buildSetupSnapshot(TENANT_A);
  const cashCardAfter = after.cards.find((c) => c.key === "cash_accounts");
  ok(
    "09  removing the cash entry flips cash_accounts back to 'empty'",
    cashCardAfter?.status === "empty" && (cashCardAfter?.total ?? -1) === 0,
    `card=${cashCardAfter?.status} total=${cashCardAfter?.total}`,
  );

  /* 10 — Tenant isolation. */
  await supabase.from("finance_assets").insert({
    tenant_id: TENANT_B, name: "B Asset", category: "Other",
    purchase_value: 99999, depreciation_method: "none", currency: "USD",
  });
  const aSnap = await buildSetupSnapshot(TENANT_A);
  const aAssetCard = aSnap.cards.find((c) => c.key === "assets");
  /* A's asset card was 18500 (from step 5). It must not pick up B's 99999. */
  ok(
    "10  tenant isolation — A's snapshot ignores B's assets",
    Math.abs((aAssetCard?.total ?? 0) - 18500) < 0.0001,
    `A.assets.total=${aAssetCard?.total}`,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
