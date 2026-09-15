#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   migrate-legacy-customer-codes — move the pre-scheme codes onto BD-100 form.

   Eight real customers still carry codes from before the country-prefixed
   scheme existed: CUS-0001, CUST-D001 … CUST-D007. They were deliberately
   left alone by backfill-customer-codes.mts, which only fills BLANK codes —
   overwriting an identifier a person might have quoted to a customer is not
   something a backfill should decide on its own.

   The owner has now asked for them to be unified.

   ── Why this is safe to do ────────────────────────────────────────────────
   Checked first, not assumed: NO quotation, invoice, packing list, contract
   or order snapshot anywhere prints one of these codes. Nothing a customer
   has ever received refers to them, so changing them cannot make a document
   disagree with the record.

   ── What it does not do ───────────────────────────────────────────────────
   It does not invent numbers. Every new code comes from next_customer_code(),
   the same allocator the app uses, so the sequences stay correct and two
   customers cannot end up sharing a code.

   The old code is preserved in `notes` rather than discarded — if anyone ever
   does turn up holding a piece of paper with CUST-D004 on it, the row can
   still be found.

   DRY RUN BY DEFAULT. The dry run PROJECTS the codes it would allocate by
   reading the sequence table, and never calls the allocator.

       npx tsx scripts/migrate-legacy-customer-codes.mts
       npx tsx scripts/migrate-legacy-customer-codes.mts --apply
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { COUNTRIES } from "../src/lib/commercial-policy/countries";

const APPLY = process.argv.includes("--apply");

const env = readFileSync(".env.local", "utf8");
const envGet = (k: string) =>
  env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
const sb = createClient(envGet("NEXT_PUBLIC_SUPABASE_URL"), envGet("SUPABASE_SERVICE_ROLE_KEY"));

const isFixtureTenant = (id: unknown) => String(id).startsWith("00000000-");

/** The scheme: two-letter country, dash, number from 100. */
const CONFORMS = /^[A-Z]{2}-\d+$/;

/** The country column holds a name ("Egypt") or already a code ("EG"). */
function iso(raw: string | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "XX";
  if (v.length === 2) return v.toUpperCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase())?.code ?? "XX";
}

interface Row {
  id: string;
  tenant_id: string;
  customer_code: string | null;
  name: string | null;
  company_name: string | null;
  country: string | null;
  notes: string | null;
}

const { data, error } = await sb
  .from("customers")
  .select("id, tenant_id, customer_code, name, company_name, country, notes")
  .order("customer_code");
if (error) {
  console.error("Could not read customers:", error.message);
  process.exit(1);
}

const legacy = (data as Row[]).filter(
  (r) => !isFixtureTenant(r.tenant_id) && r.customer_code && !CONFORMS.test(r.customer_code),
);

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${legacy.length} customer(s) on a pre-scheme code\n`);
if (legacy.length === 0) process.exit(0);

/* Refuse outright if any of these codes is printed on a document. The check
   that made this safe is re-run here, because "safe when I looked" is not the
   same as "safe when it runs". */
const codes = new Set(legacy.map((r) => r.customer_code as string));
const printed: string[] = [];
for (const [table, numCol] of [
  ["quotations", "quote_no"],
  ["invoices", "inv_no"],
] as const) {
  const { data: docs } = await sb.from(table).select(`${numCol}, doc`);
  for (const d of (docs ?? []) as Record<string, unknown>[]) {
    const cn = ((d.doc ?? {}) as Record<string, unknown>).clientNo;
    if (typeof cn === "string" && codes.has(cn.trim())) printed.push(`${table} ${String(d[numCol])} → ${cn}`);
  }
}
const { data: orders } = await sb.from("orders").select("order_no, customer_code");
for (const o of (orders ?? []) as Record<string, unknown>[]) {
  if (typeof o.customer_code === "string" && codes.has(o.customer_code)) {
    printed.push(`order ${String(o.order_no)} snapshot → ${o.customer_code}`);
  }
}
if (printed.length > 0) {
  console.error("REFUSING — these codes are printed on existing records:");
  for (const p of printed) console.error(`  ${p}`);
  console.error("\nChanging them would make a document disagree with the record.");
  process.exit(1);
}
console.log("✓ none of these codes appears on any document\n");

/* Project the next number per (tenant, country) without consuming it. */
const projected = new Map<string, number>();
async function projectedCode(tenant: string, cc: string): Promise<string> {
  const key = `${tenant}:${cc}`;
  if (!projected.has(key)) {
    const { data: seq } = await sb
      .from("customer_code_sequences")
      .select("next_value")
      .eq("tenant_id", tenant)
      .eq("country_code", cc)
      .maybeSingle();
    projected.set(key, Number((seq as { next_value?: number } | null)?.next_value ?? 100));
  }
  const n = projected.get(key)!;
  projected.set(key, n + 1);
  return `${cc}-${n}`;
}

let done = 0;
for (const r of legacy) {
  const cc = iso(r.country);
  const who = r.company_name || r.name || r.id.slice(0, 8);

  let next: string;
  if (APPLY) {
    const { data: allocated, error: e } = await sb.rpc("next_customer_code", {
      p_tenant: r.tenant_id,
      p_country: cc,
    });
    if (e || !allocated) {
      console.error(`  ✗ ${who}: could not allocate — ${e?.message}`);
      continue;
    }
    next = String(allocated);
  } else {
    next = await projectedCode(r.tenant_id, cc);
  }

  console.log(`  ${String(r.customer_code).padEnd(12)} → ${next.padEnd(8)} ${who}  [${r.country ?? "—"} → ${cc}]`);

  if (!APPLY) {
    done++;
    continue;
  }

  /* Keep the old identifier findable. */
  const note = `Previous customer code: ${r.customer_code} (migrated ${new Date().toISOString().slice(0, 10)}).`;
  const notes = r.notes ? `${r.notes}\n${note}` : note;

  const { error: upErr } = await sb
    .from("customers")
    .update({ customer_code: next, notes })
    .eq("id", r.id);
  if (upErr) {
    console.error(`  ✗ ${who}: update failed — ${upErr.message}`);
    continue;
  }
  done++;
}

console.log(`\n${APPLY ? "Migrated" : "Would migrate"} ${done} customer(s).`);
if (!APPLY) console.log("Nothing was written. Re-run with --apply to commit.");
