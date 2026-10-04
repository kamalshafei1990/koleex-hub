#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   validate:contract-terms — proves the contract adapts to the deal.

   The failure this guards against is the one the brief warned about most: a
   generic contract that prints letter-of-credit clauses on a T/T order, FOB
   obligations on an EXW order, or an empty inspection heading when no
   inspection was agreed. A buyer's lawyer notices immediately, and it is the
   difference between a contract that reads as drafted for the deal and one
   that reads as generated.

   Also guards the wording that matters commercially — "on board the vessel"
   rather than the "ship's rail" deleted from Incoterms in 2010, and the point
   that a documentary credit is independent of the sales contract.
   --------------------------------------------------------------------------- */

import { articlesFor, GENERAL_ARTICLES, TERMS_VERSION, type ContractContext } from "../src/lib/contracts/general-terms";

let failed = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  ok    ${name}`);
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const titlesOf = (c: ContractContext) => articlesFor(c).map((a) => a.title);
const textOf = (c: ContractContext) => articlesFor(c).map((a) => `${a.title}\n${a.body}`).join("\n\n");

console.log(`General terms v${TERMS_VERSION} · ${GENERAL_ARTICLES.length} articles defined\n`);

/* ── Scenario A — FOB, staged T/T, 2-year warranty, seller QC ── */
const A: ContractContext = {
  incoterm: "FOB", incotermPlace: "Ningbo, China",
  paymentKind: "tt", paymentLabel: "30% T/T deposit, 70% before shipment",
  currency: "USD", leadTimeDays: 45, leadTimeBasis: "after_deposit",
  warrantyMonths: 24, inspection: "seller",
};
console.log("Scenario A — FOB / T/T 30-70 / 24 months");
check("no documentary-credit article", !titlesOf(A).includes("Documentary Credit"));
check("no spare-parts article", !titlesOf(A).includes("Spare Parts"));
check("no customised-goods article", !titlesOf(A).includes("Customised Goods"));
check("lead time starts at the deposit", textOf(A).includes("receipt by the Seller of the agreed advance payment"));
check("warranty says 24 months", textOf(A).includes("24 months"));
check("names the port, not a bare FOB", textOf(A).includes("FOB Ningbo, China"));
check("container caveat present for a sea term", textOf(A).includes("held at the container terminal"));

/* ── Scenario B — CIF, 100% L/C at sight, third-party inspection ── */
const B: ContractContext = {
  incoterm: "CIF", incotermPlace: "Chittagong, Bangladesh",
  paymentKind: "lc", paymentLabel: "100% irrevocable L/C at sight",
  currency: "USD", leadTimeDays: 60, leadTimeBasis: "after_lc_opening",
  warrantyMonths: 60, inspection: "third_party",
};
console.log("\nScenario B — CIF / L/C at sight / third-party inspection");
check("documentary-credit article appears", titlesOf(B).includes("Documentary Credit"));
check("credit is independent of the contract", textOf(B).includes("separate undertaking"));
check("cites UCP 600", textOf(B).includes("UCP 600"));
check("lead time starts at the operative credit", textOf(B).includes("operative documentary credit"));
check("inspection is the third-party wording", textOf(B).includes("independent inspection body"));
check("warranty says 60 months", textOf(B).includes("60 months"));

/* ── Scenario C — EXW, advance payment, no inspection ── */
const C: ContractContext = {
  incoterm: "EXW", incotermPlace: "Taizhou, China",
  paymentKind: "tt", paymentLabel: "100% T/T in advance",
  currency: "EUR", leadTimeDays: 30, leadTimeBasis: "after_order",
  warrantyMonths: 12, inspection: "none",
};
console.log("\nScenario C — EXW / advance / no inspection");
check("inspection article omitted entirely", !titlesOf(C).includes("Inspection"));
check("no container caveat on a non-sea term", !textOf(C).includes("held at the container terminal"));
check("buyer arranges carriage under EXW", textOf(C).includes("nominated by the Buyer"));
check("currency is not hard-coded to USD", textOf(C).includes("EUR") && !/stated in USD/.test(textOf(C)));
check("lead time starts at the contract date", textOf(C).includes("the date of this Contract"));

/* ── Scenario D — customised goods with spares ── */
const D: ContractContext = { ...A, isCustomised: true, hasSpareParts: true };
console.log("\nScenario D — customised goods with spare parts");
check("customised-goods article appears", titlesOf(D).includes("Customised Goods"));
check("spare-parts article appears", titlesOf(D).includes("Spare Parts"));
check("more articles than the plain case", articlesFor(D).length === articlesFor(A).length + 2);

/* ── Wording that must never regress ── */
console.log("\nWording guards");
const all = GENERAL_ARTICLES.map((a) => a.body({ incoterm: "FOB", paymentKind: "lc" })).join("\n");
check('never says "ship\'s rail"', !/ship'?s rail/i.test(all), "deleted from Incoterms in 2010");
check("risk and title are distinguished", /Passing of title is separate from passing of risk/.test(all));
check("Incoterms cited with the year", /Incoterms® 2020/.test(all));
check("CISG is addressed explicitly", /United Nations Convention/.test(all));

/* ── Numbering is contiguous whatever is omitted ── */
console.log("\nNumbering");
for (const [label, ctx] of [["A", A], ["B", B], ["C", C], ["D", D]] as const) {
  const ns = articlesFor(ctx).map((a) => a.n);
  const contiguous = ns.every((n, i) => n === i + 1);
  check(`scenario ${label} numbers 1..${ns.length} with no gaps`, contiguous, ns.join(","));
}

console.log(failed === 0 ? "\nPASS" : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
