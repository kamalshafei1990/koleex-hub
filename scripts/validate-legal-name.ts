#!/usr/bin/env tsx

/* ===========================================================================
   validate-legal-name — the company's formal English name has ONE source.

   Owner, 27/09/2026: the formal name is "KOLEEX INTERNATIONAL CORPORATION
   (TAIZHOU) CO., LTD." from 01/10/2026; every document keeps the name that
   was in force when it was made; the bank's beneficiary name never changes;
   a signed contract keeps the name it was signed under.

   1. The rule itself: legalNameEn() on either side of the change date.
   2. No spelling of the name is typed anywhere in src/ except lib/legal-name.
   3. Each formal document asks for the name by its own date.
   =========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BANK_BENEFICIARY_NAME, EVERYDAY_NAME_EN, LEGAL_NAME_EN, LEGAL_NAME_HISTORY, legalNameEn } from "../src/lib/legal-name";

const ROOT = join(__dirname, "..");
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};

const OLD = "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.";

/* 1 · The rule */
check(LEGAL_NAME_EN === "KOLEEX INTERNATIONAL CORPORATION (TAIZHOU) CO., LTD.", "today's formal name is the owner's exact spelling");
check(LEGAL_NAME_HISTORY.some((h) => h.en === OLD), "the old spelling is kept in the history");
check(legalNameEn("2026-09-27T10:00:00+08:00") === OLD, "a document made on 27/09/2026 keeps the old name");
check(legalNameEn("2026-09-30T23:59:59+08:00") === OLD, "a document made on 30/09/2026, 23:59 Taizhou time, keeps the old name");
check(legalNameEn("2026-10-01T00:00:00+08:00") === LEGAL_NAME_EN, "a document made on 01/10/2026 takes the new name");
check(legalNameEn("2026-09-30") === OLD, "a September payslip (period end 2026-09-30) keeps the old name");
check(legalNameEn("not a date") === legalNameEn(), "an unreadable date means now");
check(BANK_BENEFICIARY_NAME === "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO. LTD.", "the bank's beneficiary name is exactly as the bank holds it");
check(EVERYDAY_NAME_EN === "Koleex International Group", "the everyday name is the owner's exact spelling");

/* 2 · One source */
const NAME_PATTERN = /CORPORATION[ ,(]*TAIZHOU|Corporation[ ,(]*Taizhou/;
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
};
const typed = walk(join(ROOT, "src"))
  .filter((p) => !p.endsWith(join("lib", "legal-name.ts")))
  .filter((p) => NAME_PATTERN.test(readFileSync(p, "utf8")))
  .map((p) => p.slice(ROOT.length + 1));
check(typed.length === 0, `no file in src/ types the legal name${typed.length ? ` — found in: ${typed.join(", ")}` : ""}`);

/* 3 · Every formal document asks by its own date */
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const DOCS: Array<[string, RegExp, string]> = [
  ["src/components/brand/DocumentBrandStrips.tsx", /legalNameEn\(madeAt\)/, "the black company strip prints the name of the document's day"],
  ["src/components/brand/DocumentBrandStrips.tsx", /<div dir="ltr" style=\{\{ borderRadius: 12/, "the company strip reads left to right on an Arabic paper too"],
  ["src/components/quotations/QuotationA4Preview.tsx", /madeAt=\{current\.createdAt\}/, "quotations and invoices: the strip gets the creation date"],
  ["src/components/quotations/QuotationA4Preview.tsx", /legalNameEn\(current\.createdAt\)/, "quotations and invoices: the seller card by creation date"],
  ["src/components/quotations/QuotationA4Preview.tsx", /value=\{BANK_BENEFICIARY_NAME\}/, "quotations and invoices: the bank row prints the bank's own spelling"],
  ["src/components/contracts/ContractA4.tsx", /legalNameEn\(frozen\?\.frozenAt\)/, "sales contract: the seller as signed; a draft today's name"],
  ["src/components/contracts/ContractA4.tsx", /madeAt=\{frozen\?\.frozenAt\}/, "sales contract: the strip as signed"],
  ["src/components/documents/PackingListDoc.tsx", /legalNameEn\(initial\?\.created_at\)/, "packing list: by creation date"],
  ["src/components/documents/DocumentsApp.tsx", /doc\.createdAt = initial\.created_at/, "Documents app: a sheet without a date takes its row's creation date"],
  ["src/components/hr/payslip/PayslipDoc.tsx", /madeAt=\{slip\.periodEnd\}/, "payslip: by the end of its pay period"],
  ["src/lib/excel-export.ts", /legalNameEn\(doc\.madeAt\)/, "Excel export: by the document's creation date"],
  ["src/app/api/sales-contracts/[id]/route.ts", /name: legalNameEn\(\)/, "signing freezes the name in force at that moment"],
  ["src/lib/contracts/general-terms.ts", /"Seller" means \$\{legalNameEn\(\)\}/, "the contract's definition of Seller reads the same source"],
];
for (const [file, re, label] of DOCS) check(re.test(read(file)), label);
for (const caller of ["src/components/quotations/Quotations.tsx", "src/components/invoices-doc/InvoicesDoc.tsx", "src/components/documents/DocumentsApp.tsx", "src/components/documents/PackingListDoc.tsx"]) {
  check(/madeAt:/.test(read(caller)), `Excel export from ${caller.split("/").pop()} passes the creation date`);
}

console.log(failures ? `\nvalidate-legal-name: ${failures} failed` : "\nvalidate-legal-name: OK");
process.exit(failures ? 1 : 0);
