#!/usr/bin/env tsx
/* validate:contract-contradictions — proves the engine catches the mistakes
   that actually get contracts rejected, and stays quiet on a clean one.

   A checker that fires on everything is worse than none: people learn to
   click past it. So half of these cases assert SILENCE. */

import { checkContract, blocksSignature, type CheckableTerms } from "../src/lib/contracts/contradictions";

let failed = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  ok    ${name}`);
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};
const ids = (t: CheckableTerms) => checkContract(t).map((f) => f.id);
const has = (t: CheckableTerms, id: string) => ids(t).includes(id);

/* A contract with nothing wrong with it. Every later case starts here and
   breaks exactly one thing, so a finding can only come from that break. */
const CLEAN: CheckableTerms = {
  incoterm: "FOB",
  incotermPlace: "Ningbo, China",
  loadingPort: "Ningbo, China",
  dischargePort: "Chittagong, Bangladesh",
  paymentKind: "tt",
  paymentLabel: "30% T/T deposit, 70% before shipment",
  currency: "USD",
  leadTimeDays: 45,
  leadTimeBasis: "after_deposit",
  warrantyMonths: 12,
  inspection: "seller",
  governingLaw: "Laws of the PRC; disputes settled by CIETAC arbitration in Shanghai",
  documents: ["Commercial Invoice", "Packing List", "Bill of Lading", "Certificate of Origin"],
};

console.log("Baseline — a contract that does not contradict itself");
check("clean contract raises nothing", ids(CLEAN).length === 0, ids(CLEAN).join(", "));
check("clean contract does not block signature", !blocksSignature(checkContract(CLEAN)));

console.log("\nThe payment clock");
check("L/C paid but production counted from a deposit",
  has({ ...CLEAN, paymentKind: "lc", paymentLabel: "100% L/C at sight" }, "lc-vs-deposit"));
check("T/T paid but production counted from a credit",
  has({ ...CLEAN, leadTimeBasis: "after_lc_opening" }, "tt-vs-lc-clock"));
check("L/C with the right clock is silent",
  !has({ ...CLEAN, paymentKind: "lc", leadTimeBasis: "after_lc_opening",
         documents: [...CLEAN.documents!, "Insurance Certificate"] }, "lc-vs-deposit"));
check("missing payment term is an error", has({ ...CLEAN, paymentKind: undefined }, "payment-missing"));
/* The one the real data found: a T/T term that never asks for money up front,
   with production counted from an advance payment that will never arrive. */
check("T/T paid only before shipment cannot start the clock at a deposit",
  has({ ...CLEAN, paymentLabel: "100% T/T before shipment" }, "clock-without-advance"));
check("a staged T/T does start at a deposit",
  !has({ ...CLEAN, paymentLabel: "30% T/T deposit, 70% before shipment" }, "clock-without-advance"));
check("a bare percentage split counts as staged",
  !has({ ...CLEAN, paymentLabel: "20% T/T, 80% against B/L copy" }, "clock-without-advance"));
check("100% in advance counts as an advance",
  !has({ ...CLEAN, paymentLabel: "100% T/T in advance" }, "clock-without-advance"));
check("counting from the contract date instead is silent",
  !has({ ...CLEAN, paymentLabel: "100% T/T before shipment", leadTimeBasis: "after_order" }, "clock-without-advance"));

console.log("\nIncoterms");
check("withdrawn rule DAT is rejected", has({ ...CLEAN, incoterm: "DAT" }, "incoterm-unknown"));
check("withdrawn rule DDU is rejected", has({ ...CLEAN, incoterm: "DDU" }, "incoterm-unknown"));
check("no named place is an error", has({ ...CLEAN, incotermPlace: undefined }, "incoterm-no-place"));
check("no incoterm at all is an error", has({ ...CLEAN, incoterm: undefined }, "incoterm-missing"));
check("EXW with ports named is flagged",
  has({ ...CLEAN, incoterm: "EXW", incotermPlace: "Taizhou" }, "exw-with-ports"));
check("containers on FOB draw the ICC's own advice",
  has({ ...CLEAN, containerType: "1 x 40HQ" }, "container-on-sea-term"));
check("containers on FCA do not",
  !has({ ...CLEAN, incoterm: "FCA", incotermPlace: "Ningbo", containerType: "1 x 40HQ" }, "container-on-sea-term"));

console.log("\nInsurance");
const CIF: CheckableTerms = { ...CLEAN, incoterm: "CIF", incotermPlace: "Chittagong, Bangladesh" };
check("CIF states the 110% Clauses (C) minimum", has(CIF, "insurance-level"));
check("CIF without an insurance document is flagged", has(CIF, "no-insurance-document"));
check("CIF with the certificate listed is not",
  !has({ ...CIF, documents: [...CLEAN.documents!, "Insurance Certificate"] }, "no-insurance-document"));
check("FOB promising insurance in a side condition is flagged",
  has({ ...CLEAN, specialConditions: ["Seller to arrange marine insurance."] }, "insurance-outside-term"));
check("CIF mentioning insurance in a side condition is not",
  !has({ ...CIF, specialConditions: ["Insurance at Clauses (A)."] }, "insurance-outside-term"));

console.log("\nTiming, warranty, documents, law");
check("no delivery time is an error", has({ ...CLEAN, leadTimeDays: undefined }, "no-lead-time"));
check("a lead time past six months is flagged", has({ ...CLEAN, leadTimeDays: 200 }, "long-lead-time"));
check("no warranty is flagged", has({ ...CLEAN, warrantyMonths: 0 }, "no-warranty"));
check("documentary payment with no document list is an error",
  has({ ...CLEAN, paymentKind: "dp", documents: [] }, "no-documents-listed"));
check("T/T with no document list is NOT an error",
  !has({ ...CLEAN, documents: [] }, "no-documents-listed"));
check("no governing law is an error", has({ ...CLEAN, governingLaw: undefined }, "no-governing-law"));
check("a law with no forum is flagged",
  has({ ...CLEAN, governingLaw: "The laws of the People's Republic of China" }, "law-without-forum"));
check("third-party inspection with no certificate is flagged",
  has({ ...CLEAN, inspection: "third_party" }, "inspection-without-certificate"));

console.log("\nSignature gate");
check("errors block signature", blocksSignature(checkContract({ ...CLEAN, governingLaw: undefined })));
check("warnings alone do not block signature",
  !blocksSignature(checkContract({ ...CLEAN, warrantyMonths: 0 })));

console.log("\nEvery finding tells the reader what to do");
for (const f of checkContract({ incoterm: "DAT", paymentKind: "lc", leadTimeBasis: "after_deposit" })) {
  check(`  ${f.id} carries a fix`, !!f.fix && f.fix.length > 10, f.fix);
}

console.log(failed === 0 ? "\nPASS" : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
