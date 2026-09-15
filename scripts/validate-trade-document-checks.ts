#!/usr/bin/env tsx
/* validate:trade-document — the quotation/invoice subset of the checker.

   Proves it catches the mistake that was live on three of five real invoices
   (FOB naming the buyer's port), and — just as important — that it stays
   SILENT on everything a quotation legitimately does not carry. A checker
   that shouts about a missing governing-law clause on a price offer is one
   people switch off. */

import { checkTradeDocument } from "../src/lib/contracts/contradictions";

let failed = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  ok    ${name}`);
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};
const ids = (d: Parameters<typeof checkTradeDocument>[0]) => checkTradeDocument(d).map((f) => f.id);
const has = (d: Parameters<typeof checkTradeDocument>[0], id: string) => ids(d).includes(id);

/* The three that were live in production. */
console.log("The mistake that was actually shipped");
for (const [rule, port, loading] of [
  ["FOB", "Chittagong, Bangladesh", "Ningbo, China"],
  ["FOB", "Alexandria, Egypt", "Ningbo, China"],
  ["FOB", "Benghazi, Libya", "Ningbo, China"],
] as const) {
  check(`${rule} ${port} is caught`,
    has({ incotermCode: rule, incotermLocation: port, loadingPort: loading, dischargePort: port },
        "place-is-destination-on-origin-term"));
}
check("FOB naming the loading port is silent",
  !has({ incotermCode: "FOB", incotermLocation: "Ningbo, China", loadingPort: "Ningbo, China", dischargePort: "Chittagong, Bangladesh" },
       "place-is-destination-on-origin-term"));
check("CIF naming the loading port is caught",
  has({ incotermCode: "CIF", incotermLocation: "Ningbo, China", loadingPort: "Ningbo, China", dischargePort: "Chittagong, Bangladesh" },
      "place-is-origin-on-destination-term"));

/* A document with no explicit incoterm LOCATION falls back to the discharge
   port — which is how these three came to be wrong in the first place. */
console.log("\nThe fallback that caused it");
check("no explicit location on FOB falls back to discharge and is caught",
  has({ incotermCode: "FOB", loadingPort: "Ningbo, China", dischargePort: "Chittagong, Bangladesh" },
      "place-is-destination-on-origin-term"));

console.log("\nWarranty against the goods");
check("goods saying 5 YEARS against a 12-month document",
  has({ warrantyMonths: 12, goods: [{ description: "Overlock machine · Warranty: 5 YEARS" }] },
      "warranty-conflicts-with-goods"));
check("agreeing goods are silent",
  !has({ warrantyMonths: 60, goods: [{ description: "Warranty: 5 years" }] }, "warranty-conflicts-with-goods"));

/* THE POINT OF THE SUBSET — a quotation must not be nagged about contract
   clauses it has no business carrying. */
console.log("\nSilence on what a price offer does not carry");
const bare = { incotermCode: "FOB", incotermLocation: "Ningbo, China", loadingPort: "Ningbo, China", dischargePort: "Chittagong, Bangladesh" };
for (const id of ["no-governing-law", "law-without-forum", "payment-missing", "no-documents-listed", "no-lead-time", "no-warranty", "clock-without-advance", "lc-vs-deposit"]) {
  check(`no "${id}" on a plain quotation`, !has(bare, id));
}
check("a clean document raises nothing at all", ids(bare).length === 0, ids(bare).join(", "));

console.log(failed === 0 ? "\nPASS" : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
