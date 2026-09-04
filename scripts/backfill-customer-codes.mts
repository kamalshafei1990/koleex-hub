#!/usr/bin/env tsx
/* Backfill customer codes for customers created before the scheme existed.
 *
 * Codes are BD-100, BD-101, EG-100 … — an ISO country prefix plus a
 * per-country counter starting at 100 (owner's choice, 2026-08-24). Oldest
 * customer in each country takes 100.
 *
 * Deliberately conservative:
 *   · customers that ALREADY have a code are left alone. Several carry an
 *     older format (CUS-0001, CUST-D001…). Rewriting an identifier a customer
 *     may already have been told is not a backfill decision to make silently.
 *   · the placeholder tenant 00000000-… is skipped; those rows are fixtures.
 *   · idempotent — re-running assigns nothing new.
 *
 * Run: npx tsx scripts/backfill-customer-codes.mts [--apply]
 * Without --apply it only prints what it would do.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES } from "../src/lib/commercial-policy/countries";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const APPLY = process.argv.includes("--apply");
/* Test fixtures each sit in their OWN synthetic tenant (…-0000-4000-a000-…f1,
   …a4, …b4 …), not one shared placeholder, so matching a single id missed all
   of them. Match the family instead. */
const isFixtureTenant = (id: string) => id.startsWith("00000000-");

/* The country column holds a name ("Bangladesh") or sometimes already a code
   ("BD"); anything unrecognised becomes XX so the customer still gets a
   stable code rather than none. */
function iso(raw: string | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "XX";
  if (v.length === 2) return v.toUpperCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase())?.code ?? "XX";
}

type Row = {
  id: string; name: string | null; country: string | null;
  customer_code: string | null; tenant_id: string; created_at: string;
};

async function main() {
  const res = await fetch(
    `${url}/rest/v1/customers?select=id,name,country,customer_code,tenant_id,created_at&order=created_at.asc`,
    { headers: H },
  );
  const rows = (await res.json()) as Row[];

  const todo = rows.filter(
    (r) => !r.customer_code?.trim() && !isFixtureTenant(r.tenant_id),
  );
  const kept = rows.filter((r) => r.customer_code?.trim());
  const fixtures = rows.filter(
    (r) => !r.customer_code?.trim() && isFixtureTenant(r.tenant_id),
  );

  console.log(`${rows.length} customers · ${kept.length} already coded · ${fixtures.length} fixtures skipped · ${todo.length} to assign\n`);
  if (!todo.length) { console.log("Nothing to do."); return; }

  /* On --apply, ask the database for each code so the shared counter stays
     authoritative. On a dry run, PREVIEW from the current counter values
     instead: calling the allocator would increment it, which would mean a
     "show me what you'd do" run silently burned a code per customer — it did
     exactly that the first time this ran. */
  const plan: Array<{ row: Row; code: string }> = [];

  if (APPLY) {
    for (const row of todo) {
      const r = await fetch(`${url}/rest/v1/rpc/next_customer_code`, {
        method: "POST", headers: H,
        body: JSON.stringify({ p_tenant: row.tenant_id, p_country: iso(row.country) }),
      });
      const code = await r.json();
      if (typeof code !== "string") { console.error(`  ! no code for ${row.name}:`, code); continue; }
      plan.push({ row, code });
      console.log(`  ${code.padEnd(9)} ${(row.name ?? "").slice(0, 30).padEnd(32)} ${row.country ?? "—"}`);
    }
  } else {
    const seqRes = await fetch(
      `${url}/rest/v1/customer_code_sequences?select=tenant_id,country_code,next_value`,
      { headers: H },
    );
    const seqs = (await seqRes.json()) as Array<{ tenant_id: string; country_code: string; next_value: number }>;
    const cursor = new Map<string, number>();
    for (const row of todo) {
      const cc = iso(row.country);
      const k = `${row.tenant_id}|${cc}`;
      const start = cursor.get(k) ?? seqs.find((x) => x.tenant_id === row.tenant_id && x.country_code === cc)?.next_value ?? 100;
      cursor.set(k, start + 1);
      const code = `${cc}-${start}`;
      plan.push({ row, code });
      console.log(`  ${code.padEnd(9)} ${(row.name ?? "").slice(0, 30).padEnd(32)} ${row.country ?? "—"}`);
    }
    console.log("\nDry run — nothing written, no codes consumed. Re-run with --apply.");
    return;
  }

  let ok = 0;
  for (const { row, code } of plan) {
    const r = await fetch(`${url}/rest/v1/customers?id=eq.${row.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ customer_code: code }),
    });
    if (r.ok) ok++; else console.error(`  ! failed ${row.name}:`, await r.text());
  }
  console.log(`\nWrote ${ok}/${plan.length}.`);
}

void main();
