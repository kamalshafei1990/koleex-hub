#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   backfill-orders — give existing invoices the order they never had.

   WHY ONLY INVOICES. Owner decision (2026-08-24): an order is created when a
   quotation becomes an invoice, because a quotation may go to ten prospects
   and only the invoice is a real sale. Backfilling an order per quotation
   would fill the Orders app with deals that never happened. So: one order per
   invoice, and a quotation joins its invoice's order when it is linked.

   DRY RUN BY DEFAULT. It PROJECTS the deal numbers it would allocate by
   reading the sequence, and never calls next_deal_number — the customer-code
   backfill consumed real codes on its dry run and that must not happen twice.
   Pass --apply to actually write.

       npx tsx scripts/backfill-orders.mts
       npx tsx scripts/backfill-orders.mts --apply
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const env = readFileSync(".env.local", "utf8");
const envGet = (k: string) =>
  env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
const sb = createClient(envGet("NEXT_PUBLIC_SUPABASE_URL"), envGet("SUPABASE_SERVICE_ROLE_KEY"));

/* Test fixtures each carry their own synthetic tenant. Backfilling them would
   invent orders for data that is not real. */
const isFixtureTenant = (t: string) => t.startsWith("00000000-");

interface QuoteRef { id: string; deal_no: number | null; order_id: string | null }

interface InvoiceRow {
  id: string; tenant_id: string; inv_no: string | null; deal_no: number | null;
  order_id: string | null; customer_id: string | null; currency: string | null;
  total: number | null; linked_quotation_id: string | null; doc: Record<string, unknown> | null;
}

const { data: rawInvoices, error } = await sb
  .from("invoices")
  .select("id, tenant_id, inv_no, deal_no, order_id, customer_id, currency, total, linked_quotation_id, doc")
  .is("order_id", null)
  .order("issue_date", { ascending: true });
if (error) { console.error("Could not read invoices:", error.message); process.exit(1); }

const invoices = (rawInvoices as InvoiceRow[]).filter((r) => !isFixtureTenant(r.tenant_id));
const skippedFixtures = (rawInvoices as InvoiceRow[]).length - invoices.length;

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${invoices.length} invoice(s) without an order` +
            (skippedFixtures ? `, ${skippedFixtures} fixture row(s) skipped` : ""));
if (invoices.length === 0) process.exit(0);

/* Project the next deal number per tenant WITHOUT consuming it. */
const tenants = [...new Set(invoices.map((r) => r.tenant_id))];
const projected = new Map<string, number>();
for (const t of tenants) {
  const { data } = await sb.from("doc_sequences").select("next_value").eq("tenant_id", t).eq("scope", "deal").maybeSingle();
  projected.set(t, Number((data as { next_value?: number } | null)?.next_value ?? 1));
}

let created = 0, attachedQuotes = 0;

for (const inv of invoices) {
  const doc = (inv.doc ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof doc[k] === "string" ? (doc[k] as string).trim() || null : null);

  /* A linked quotation may already carry the deal — reuse it so both
     documents land on one order rather than two. */
  let dealNo: number | null = inv.deal_no;
  let quote: QuoteRef | null = null;
  if (inv.linked_quotation_id) {
    const { data } = await sb.from("quotations").select("id, deal_no, order_id").eq("id", inv.linked_quotation_id).maybeSingle();
    quote = (data as QuoteRef | null) ?? null;
    if (dealNo == null && quote?.deal_no != null) dealNo = quote.deal_no;
  }

  if (dealNo == null) {
    if (APPLY) {
      const { data, error: e } = await sb.rpc("next_deal_number", { p_tenant: inv.tenant_id });
      if (e || data == null) { console.error(`  ✗ ${inv.inv_no}: could not allocate — ${e?.message}`); continue; }
      dealNo = Number(data);
    } else {
      dealNo = projected.get(inv.tenant_id)!;
      projected.set(inv.tenant_id, dealNo + 1);
    }
  }

  /* Prefer the CRM row; fall back to what the document itself recorded, which
     is where every real invoice here keeps the buyer. */
  let code: string | null = str("clientNo");
  let name: string | null = str("customerName");
  let company: string | null = str("companyName");
  if (inv.customer_id) {
    const { data } = await sb.from("customers").select("customer_code, name, company_name").eq("id", inv.customer_id).maybeSingle();
    const c = data as { customer_code: string | null; name: string | null; company_name: string | null } | null;
    if (c) { code = c.customer_code ?? code; name = c.name ?? name; company = c.company_name ?? company; }
  }

  const party = company || name || code || "—";
  console.log(`  ${inv.inv_no ?? inv.id}  →  KL-${dealNo}  ${party}  ${inv.currency ?? ""} ${inv.total ?? 0}` +
              (quote ? `  (+ quotation ${quote.id.slice(0, 8)})` : ""));

  if (!APPLY) { created++; if (quote) attachedQuotes++; continue; }

  const { data: order, error: oe } = await sb.from("orders").insert({
    tenant_id: inv.tenant_id, deal_no: dealNo, order_no: `KL-${dealNo}`,
    customer_id: inv.customer_id, customer_code: code, customer_name: name, company_name: company,
    currency: inv.currency, total: inv.total ?? 0, status: "open",
  }).select("id").single();
  if (oe) { console.error(`  ✗ ${inv.inv_no}: order insert failed — ${oe.message}`); continue; }

  await sb.from("invoices").update({ order_id: order.id, deal_no: dealNo }).eq("id", inv.id);
  created++;
  if (quote) {
    await sb.from("quotations").update({ order_id: order.id, deal_no: dealNo }).eq("id", quote.id);
    attachedQuotes++;
  }
}

console.log(`\n${APPLY ? "Created" : "Would create"} ${created} order(s); ` +
            `${APPLY ? "attached" : "would attach"} ${attachedQuotes} linked quotation(s).`);
if (!APPLY) console.log("Nothing was written. Re-run with --apply to commit.");
