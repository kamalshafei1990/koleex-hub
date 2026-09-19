#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   audit:orders — the invariants the Orders programme depends on, checked
   against the LIVE database.

   Every other validator in this repo reads SOURCE. This one reads DATA,
   because the defects that actually appeared while building the programme
   were all data-shaped and none of them were visible in the code:

     · an invoice storing leadTimeBasis "after_deposit" beside a payment term
       that never asks for a deposit
     · a contract whose deal_no disagreed with its order's
     · a signed contract that superseding had quietly unlocked
     · documents pointing at an order that no longer exists

   Read-only. It never writes, so it is safe to run against production at any
   time. Exit code 1 on a violation so it can gate a deploy.

       npx tsx scripts/audit-orders-integrity.mts
       npx tsx scripts/audit-orders-integrity.mts --tenant <uuid>
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const envGet = (k: string) =>
  env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
const sb = createClient(envGet("NEXT_PUBLIC_SUPABASE_URL"), envGet("SUPABASE_SERVICE_ROLE_KEY"));

const tenantArg = process.argv.indexOf("--tenant");
const ONLY_TENANT = tenantArg > -1 ? process.argv[tenantArg + 1] : null;

/* Fixtures each carry their own synthetic tenant and are allowed to be odd. */
const isFixture = (t: unknown) => String(t).startsWith("00000000-");

let violations = 0;
/* In self-test mode a violation is the EXPECTED result, so the reporters
   swap: a caught violation prints as a pass. */
let expectingViolations = false;
const caught: string[] = [];
const ok = (n: string, detail = "") => {
  if (!expectingViolations) console.log(`  ✓ ${n}${detail ? ` — ${detail}` : ""}`);
};
const bad = (n: string, detail: string) => {
  if (expectingViolations) {
    caught.push(n);
    return;
  }
  violations++;
  console.error(`  ✗ ${n} — ${detail}`);
};

type Row = Record<string, unknown>;
const rowsOf = async (table: string, cols: string): Promise<Row[]> => {
  const { data, error } = await sb.from(table).select(cols);
  if (error) throw new Error(`${table}: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).filter((r) => !isFixture(r.tenant_id) && (!ONLY_TENANT || r.tenant_id === ONLY_TENANT));
};

interface Dataset {
  orders: Row[];
  quotations: Row[];
  invoices: Row[];
  contracts: Row[];
  documents: Row[];
  pos: Row[];
  sequences: Row[];
}

async function loadFromDatabase(): Promise<Dataset> {
  const [orders, quotations, invoices, contracts, documents, pos] = await Promise.all([
    rowsOf("orders", "id, tenant_id, deal_no, order_no, status, currency, total"),
    rowsOf("quotations", "id, tenant_id, quote_no, deal_no, order_id"),
    rowsOf("invoices", "id, tenant_id, inv_no, deal_no, order_id"),
    rowsOf(
      "sales_contracts",
      "id, tenant_id, contract_no, deal_no, order_id, invoice_id, status, snapshot, signed_at, amends_id",
    ),
    rowsOf("documents", "id, tenant_id, doc_no, doc_kind, deal_no, order_id"),
    rowsOf("purchase_orders", "id, tenant_id, po_no, deal_no, order_id"),
  ]);
  const { data: seqs } = await sb.from("doc_sequences").select("tenant_id, next_value").eq("scope", "deal");
  return { orders, quotations, invoices, contracts, documents, pos, sequences: (seqs ?? []) as Row[] };
}

function runChecks(data: Dataset) {
  const { orders, quotations, invoices, contracts, documents, pos } = data;
  const orderById = new Map(orders.map((o) => [o.id as string, o]));
  const packingLists = documents.filter((d) => d.doc_kind === "packing_list");

  if (!expectingViolations) {
    console.log(
      `Orders integrity — ${orders.length} order(s), ${quotations.length} quotation(s), ${invoices.length} invoice(s), ` +
        `${contracts.length} contract(s), ${packingLists.length} packing list(s), ${pos.length} purchase order(s)\n`,
    );
  }

/* ── 1. One deal, one order ──────────────────────────────────────────────── */
if (!expectingViolations) console.log("1. Deal numbers");
{
  const seen = new Map<string, string[]>();
  for (const o of orders) {
    const key = `${o.tenant_id}:${o.deal_no}`;
    seen.set(key, [...(seen.get(key) ?? []), o.order_no as string]);
  }
  const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
  dupes.length === 0
    ? ok("no two orders share a deal number", `${seen.size} deal(s)`)
    : bad("two orders share a deal number", dupes.map(([k, v]) => `${k} → ${v.join(", ")}`).join("; "));

  const mismatched = orders.filter((o) => o.order_no !== `KL-${o.deal_no}`);
  mismatched.length === 0
    ? ok("every order_no is KL-{deal_no}")
    : bad("order_no does not match its deal", mismatched.map((o) => `${o.order_no} vs deal ${o.deal_no}`).join(", "));
}

/* ── 2. A document's deal must be its order's deal ───────────────────────── */
if (!expectingViolations) console.log("\n2. Documents agree with their order");
for (const [label, rows, numberCol] of [
  ["quotations", quotations, "quote_no"],
  ["invoices", invoices, "inv_no"],
  ["contracts", contracts, "contract_no"],
  ["packing lists", packingLists, "doc_no"],
  ["purchase orders", pos, "po_no"],
] as const) {
  const linked = rows.filter((r) => r.order_id);
  const orphans = linked.filter((r) => !orderById.has(r.order_id as string));
  const disagreeing = linked
    .filter((r) => orderById.has(r.order_id as string))
    .filter((r) => r.deal_no != null && r.deal_no !== orderById.get(r.order_id as string)!.deal_no);

  if (orphans.length) bad(`${label} point at a missing order`, orphans.map((r) => String(r[numberCol])).join(", "));
  if (disagreeing.length)
    bad(
      `${label} carry a deal number their order disagrees with`,
      disagreeing
        .map((r) => `${r[numberCol]} says ${r.deal_no}, order says ${orderById.get(r.order_id as string)!.deal_no}`)
        .join("; "),
    );
  if (!orphans.length && !disagreeing.length) ok(`${label} agree with their order`, `${linked.length} linked`);
}

/* ── 3. Contract numbering and the amendment chain ───────────────────────── */
if (!expectingViolations) console.log("\n3. Contracts");
{
  const badNumber = contracts.filter((c) => {
    const base = `KL-CN-${c.deal_no}`;
    return c.contract_no !== base && !new RegExp(`^${base}-\\d+$`).test(c.contract_no as string);
  });
  badNumber.length === 0
    ? ok("every contract_no is KL-CN-{deal} or a -N amendment of it")
    : bad("contract_no does not belong to its deal", badNumber.map((c) => c.contract_no).join(", "));

  /* The invariant amendments exist to protect: at most ONE contract in force
     per deal. Two signed contracts on one deal means two live agreements. */
  const signedPerDeal = new Map<string, string[]>();
  for (const c of contracts.filter((c) => c.status === "signed")) {
    const key = `${c.tenant_id}:${c.deal_no}`;
    signedPerDeal.set(key, [...(signedPerDeal.get(key) ?? []), c.contract_no as string]);
  }
  const twoLive = [...signedPerDeal.entries()].filter(([, v]) => v.length > 1);
  twoLive.length === 0
    ? ok("no deal has two contracts in force")
    : bad("a deal has TWO signed contracts", twoLive.map(([k, v]) => `${k} → ${v.join(" + ")}`).join("; "));

  /* A signed or superseded contract must carry the snapshot it was frozen
     into — that snapshot IS the agreement once the ink is dry. */
  const executed = contracts.filter((c) => c.status === "signed" || c.status === "superseded");
  const noSnapshot = executed.filter((c) => !c.snapshot);
  noSnapshot.length === 0
    ? ok("every executed contract kept its snapshot", `${executed.length} executed`)
    : bad("an executed contract has NO snapshot", noSnapshot.map((c) => `${c.contract_no} (${c.status})`).join(", "));

  const signedNoDate = executed.filter((c) => !c.signed_at);
  signedNoDate.length === 0
    ? ok("every executed contract records when it was signed")
    : bad("an executed contract has no signed_at", signedNoDate.map((c) => c.contract_no).join(", "));

  /* An amendment must amend something real, on the same deal. */
  const byId = new Map(contracts.map((c) => [c.id as string, c]));
  const amendments = contracts.filter((c) => c.amends_id);
  const brokenChain = amendments.filter((c) => {
    const target = byId.get(c.amends_id as string);
    return !target || target.deal_no !== c.deal_no;
  });
  brokenChain.length === 0
    ? ok("every amendment amends a contract on the same deal", `${amendments.length} amendment(s)`)
    : bad("an amendment points at a missing or foreign contract", brokenChain.map((c) => c.contract_no).join(", "));

  /* Once an amendment is signed its target must be retired — otherwise both
     are in force, which is what the whole supersede dance prevents. */
  const shouldBeRetired = amendments
    .filter((c) => c.status === "signed")
    .map((c) => byId.get(c.amends_id as string))
    .filter((t): t is Row => !!t && t.status === "signed");
  shouldBeRetired.length === 0
    ? ok("a signed amendment always retired what it replaced")
    : bad(
        "a signed amendment left its original in force",
        shouldBeRetired.map((t) => t.contract_no).join(", "),
      );

  /* At most one OPEN amendment per contract — two drafts both claiming to
     replace the same agreement is the race the API refuses. */
  const openPerTarget = new Map<string, string[]>();
  for (const c of amendments.filter((c) => c.status === "draft" || c.status === "ready")) {
    const k = c.amends_id as string;
    openPerTarget.set(k, [...(openPerTarget.get(k) ?? []), c.contract_no as string]);
  }
  const racing = [...openPerTarget.entries()].filter(([, v]) => v.length > 1);
  racing.length === 0
    ? ok("no contract has two open amendments")
    : bad("a contract has TWO open amendments", racing.map(([, v]) => v.join(" + ")).join("; "));
}

/* ── 4. Contracts are raised FROM invoices ───────────────────────────────── */
if (!expectingViolations) console.log("\n4. Contracts and their invoices");
{
  const invoiceIds = new Set(invoices.map((i) => i.id as string));
  const dangling = contracts.filter((c) => c.invoice_id && !invoiceIds.has(c.invoice_id as string));
  dangling.length === 0
    ? ok("every contract's invoice still exists")
    : bad("a contract points at a deleted invoice", dangling.map((c) => c.contract_no).join(", "));
}

/* ── 5. The deal counter is ahead of everything it issued ────────────────── */
if (!expectingViolations) console.log("\n5. The deal counter");
{
  for (const s of data.sequences) {
    if (isFixture(s.tenant_id) || (ONLY_TENANT && s.tenant_id !== ONLY_TENANT)) continue;
    const issued = [...orders, ...contracts, ...invoices, ...quotations, ...packingLists, ...pos]
      .filter((r) => r.tenant_id === s.tenant_id && typeof r.deal_no === "number")
      .map((r) => r.deal_no as number);
    const highest = issued.length ? Math.max(...issued) : -1;
    const next = Number(s.next_value);
    next > highest
      ? ok(`counter for ${String(s.tenant_id).slice(0, 8)} is ahead of every issued number`, `next=${next}, highest issued=${highest === -1 ? "none" : highest}`)
      : bad(
          `counter for ${String(s.tenant_id).slice(0, 8)} would REISSUE a number`,
          `next=${next} but ${highest} is already in use`,
        );
  }
}

}

/* ── Self-test ────────────────────────────────────────────────────────────
   An audit that has never been seen to FAIL is not evidence. On live data
   most of these checks pass with zero rows, which proves nothing at all — so
   each one is also fed the exact violation it exists to catch, and must
   report it. If a check stops catching its own case, this fails the build
   before anyone trusts a green run. */
const TENANT = "11111111-1111-4111-8111-111111111111";
const base = (over: Row = {}): Row => ({ tenant_id: TENANT, ...over });

const CASES: { name: string; expect: string; data: Dataset }[] = [
  {
    name: "two orders on one deal",
    expect: "two orders share a deal number",
    data: blank({ orders: [base({ id: "o1", deal_no: 5, order_no: "KL-5" }), base({ id: "o2", deal_no: 5, order_no: "KL-5" })] }),
  },
  {
    name: "order_no that does not match its deal",
    expect: "order_no does not match its deal",
    data: blank({ orders: [base({ id: "o1", deal_no: 5, order_no: "KL-9" })] }),
  },
  {
    name: "an invoice pointing at a missing order",
    expect: "invoices point at a missing order",
    data: blank({ invoices: [base({ id: "i1", inv_no: "INV-1", order_id: "gone", deal_no: 5 })] }),
  },
  {
    name: "an invoice whose deal disagrees with its order",
    expect: "invoices carry a deal number their order disagrees with",
    data: blank({
      orders: [base({ id: "o1", deal_no: 5, order_no: "KL-5" })],
      invoices: [base({ id: "i1", inv_no: "INV-1", order_id: "o1", deal_no: 7 })],
    }),
  },
  {
    name: "a contract numbered for another deal",
    expect: "contract_no does not belong to its deal",
    data: blank({ contracts: [base({ id: "c1", contract_no: "KL-CN-9", deal_no: 5, status: "draft" })] }),
  },
  {
    name: "TWO signed contracts on one deal",
    expect: "a deal has TWO signed contracts",
    data: blank({
      contracts: [
        base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "signed", snapshot: {}, signed_at: "2026-01-01" }),
        base({ id: "c2", contract_no: "KL-CN-5-2", deal_no: 5, status: "signed", snapshot: {}, signed_at: "2026-01-02" }),
      ],
    }),
  },
  {
    name: "an executed contract with no snapshot",
    expect: "an executed contract has NO snapshot",
    data: blank({
      contracts: [base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "signed", snapshot: null, signed_at: "2026-01-01" })],
    }),
  },
  {
    name: "an executed contract with no signed_at",
    expect: "an executed contract has no signed_at",
    data: blank({
      contracts: [base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "signed", snapshot: {}, signed_at: null })],
    }),
  },
  {
    name: "an amendment pointing at a missing contract",
    expect: "an amendment points at a missing or foreign contract",
    data: blank({
      contracts: [base({ id: "c2", contract_no: "KL-CN-5-2", deal_no: 5, status: "draft", amends_id: "gone" })],
    }),
  },
  {
    name: "a signed amendment that left its original in force",
    expect: "a signed amendment left its original in force",
    data: blank({
      contracts: [
        base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "signed", snapshot: {}, signed_at: "2026-01-01" }),
        base({ id: "c2", contract_no: "KL-CN-5-2", deal_no: 5, status: "signed", snapshot: {}, signed_at: "2026-01-02", amends_id: "c1" }),
      ],
    }),
  },
  {
    name: "two open amendments of one contract",
    expect: "a contract has TWO open amendments",
    data: blank({
      contracts: [
        base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "signed", snapshot: {}, signed_at: "2026-01-01" }),
        base({ id: "c2", contract_no: "KL-CN-5-2", deal_no: 5, status: "draft", amends_id: "c1" }),
        base({ id: "c3", contract_no: "KL-CN-5-3", deal_no: 5, status: "ready", amends_id: "c1" }),
      ],
    }),
  },
  {
    name: "a contract pointing at a deleted invoice",
    expect: "a contract points at a deleted invoice",
    data: blank({
      contracts: [base({ id: "c1", contract_no: "KL-CN-5", deal_no: 5, status: "draft", invoice_id: "gone" })],
    }),
  },
  {
    name: "a counter that would reissue a number",
    expect: "would REISSUE a number",
    data: blank({
      orders: [base({ id: "o1", deal_no: 12, order_no: "KL-12" })],
      sequences: [{ tenant_id: TENANT, next_value: 12 }],
    }),
  },
];

function blank(over: Partial<Dataset>): Dataset {
  return { orders: [], quotations: [], invoices: [], contracts: [], documents: [], pos: [], sequences: [], ...over };
}

function selfTest(): number {
  console.log("Self-test — every check must catch the violation it exists for\n");
  let failures = 0;
  for (const c of CASES) {
    expectingViolations = true;
    caught.length = 0;
    runChecks(c.data);
    expectingViolations = false;
    const hit = caught.some((n) => n.includes(c.expect));
    if (hit) console.log(`  ✓ caught: ${c.name}`);
    else {
      failures++;
      console.error(`  ✗ MISSED: ${c.name} — expected a violation matching "${c.expect}", got [${caught.join(" | ")}]`);
    }
  }
  console.log(failures === 0 ? `\nSelf-test PASS — ${CASES.length} checks proven to fire` : `\nSelf-test: ${failures} check(s) no longer fire`);
  return failures;
}

/* ── Run ──────────────────────────────────────────────────────────────────── */
const selfFailures = selfTest();
console.log("");
runChecks(await loadFromDatabase());

const failed = violations + selfFailures;
console.log(failed === 0 ? "\nPASS — every invariant holds" : `\n${violations} live violation(s), ${selfFailures} broken check(s)`);
process.exit(failed === 0 ? 0 : 1);
