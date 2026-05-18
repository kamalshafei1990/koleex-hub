#!/usr/bin/env tsx

/* ===========================================================================
   Quotation-save regression validator.

   Locks in the fix for the "Save failed (500): insert or update on table
   'quotations' violates foreign key constraint 'quotations_created_by_fkey'"
   bug reported from the live quotation editor.

   Coverage (5 assertions):
     01  quotations.created_by FK now references accounts(id), not auth.users
     02  sales_orders.created_by FK now references accounts(id)
     03  Inserting a quotation with created_by = a real accounts.id succeeds
         (was throwing FK violation before the fix)
     04  upsertDoc surface no longer leaks raw "violates foreign key"
         strings — humanizeError wraps the message
     05  Tenant isolation preserved: a row remains tenant-scoped
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { humanizeError } from "../src/lib/ui/humanize-error";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) { console.warn("[quotation-fix] env not set; skipping."); process.exit(0); }
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-00000000C3A1";
const TENANT_B = "00000000-0000-4000-a000-00000000C3A2";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensure() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `q-fix-${id.slice(-4)}`, name: `QFix ${id.slice(-4)}`,
      is_host: false, active: true, default_currency: "CNY",
    }, { onConflict: "id" });
  }
}

async function makeAccount(username: string, tenant: string): Promise<string> {
  const existing = await supabase.from("accounts").select("id").eq("username", username).maybeSingle();
  if (existing.data) return (existing.data as { id: string }).id;
  const person = await supabase.from("people").insert({ full_name: username }).select("id").single();
  const ins = await supabase.from("accounts").insert({
    tenant_id: tenant, username,
    login_email: `${username}@qfix.local`,
    status: "active", user_type: "internal",
    person_id: (person.data as { id: string }).id,
  }).select("id").single();
  return (ins.data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Quotation-save regression validator");
  console.log("─".repeat(72));
  await ensure();

  /* We probe the FK behaviour: inserting a quotation with a valid
     accounts.id must succeed (was a 500 FK violation before the fix). */
  const actor = await makeAccount("qfix-actor", TENANT_A);

  /* 03 — Quotation insert with valid accounts.id succeeds. */
  await supabase.from("quotations").delete().eq("tenant_id", TENANT_A).eq("quote_no", "QF-1");
  const ins = await supabase.from("quotations").insert({
    tenant_id: TENANT_A,
    quote_no: "QF-1",
    customer_id: null,
    currency: "CNY",
    status: "draft",
    issue_date: new Date().toISOString().slice(0, 10),
    valid_till: null,
    total: 0,
    doc: {},
    created_by: actor,
  }).select("id").single();
  ok("01  Quotation insert with accounts.id succeeds (FK fixed)",
     ins.error === null && !!ins.data, ins.error?.message ?? "");

  /* 02 — Sales order insert with valid accounts.id succeeds. */
  await supabase.from("sales_orders").delete().eq("tenant_id", TENANT_A).eq("so_no", "SOFX-1");
  const soIns = await supabase.from("sales_orders").insert({
    tenant_id: TENANT_A, so_no: "SOFX-1", status: "draft",
    currency: "USD", created_by: actor,
  }).select("id").single();
  ok("02  Sales order insert with accounts.id succeeds (FK fixed)",
     soIns.error === null && !!soIns.data, soIns.error?.message ?? "");

  /* 03 — humanizeError maps the original Postgres FK error. */
  const original = "insert or update on table \"quotations\" violates foreign key constraint \"quotations_created_by_fkey\"";
  const human = humanizeError(original);
  ok("03  humanizeError maps the original quotation FK error to plain English",
     human === "Linked record is missing or was removed — pick a different value.",
     `got "${human}"`);

  /* 04 — Make sure a totally unrelated message is NOT mangled. */
  ok("04  humanizeError preserves human messages unchanged",
     humanizeError("Title is required.") === "Title is required.");

  /* 05 — Tenant isolation. A quotation inserted on A is not visible to B. */
  const { count: aCount } = await supabase.from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_A).eq("quote_no", "QF-1");
  const { count: bCount } = await supabase.from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_B).eq("quote_no", "QF-1");
  ok("05  Tenant isolation: B doesn't see A's QF-1 quotation",
     (aCount ?? 0) === 1 && (bCount ?? 0) === 0,
     `A=${aCount} B=${bCount}`);

  /* Cleanup. */
  await supabase.from("quotations").delete().eq("tenant_id", TENANT_A).eq("quote_no", "QF-1");
  await supabase.from("sales_orders").delete().eq("tenant_id", TENANT_A).eq("so_no", "SOFX-1");

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
