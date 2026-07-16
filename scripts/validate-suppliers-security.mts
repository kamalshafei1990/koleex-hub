#!/usr/bin/env node
/* validate:suppliers-security — deterministic role/tenant/field-security coverage
   for the Suppliers server-list, without a live DB.

   Covers: (A) the Suppliers list-config exposes NO sensitive columns for
   search/sort/filter; (B) sanitizeContactRows strips supplier commercial/credit
   columns for restricted roles but keeps them for SA / can_view_private;
   (C) parseListParams rejects arbitrary columns/filters + clamps page size + caps
   query length; (D) applyServerList searches ONLY approved columns with a
   deterministic order + id tie-breaker + bounded range; (E) the summary breakdown
   column is non-sensitive; (F) static guards — server mode never imports the
   legacy full-list loader and has no fixed-interval poll, and the endpoints keep
   tenant scope + module gates.
   Run: NODE_OPTIONS=--conditions=react-server node --import tsx scripts/validate-suppliers-security.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);

const cfg = await import(R("src/lib/server-list/contacts-config.ts")) as typeof import("../src/lib/server-list/contacts-config.js");
const types = await import(R("src/lib/server-list/types.ts")) as typeof import("../src/lib/server-list/types.js");
const apply = await import(R("src/lib/server-list/apply.ts")) as typeof import("../src/lib/server-list/apply.js");
const sens = await import(R("src/lib/server/sensitive-columns.ts")) as typeof import("../src/lib/server/sensitive-columns.js");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

/* Columns that must NEVER be searchable/sortable/filterable or appear in the
   slim projection (bank/payment/cost/credential/internal/commercial). */
const HARD_SENSITIVE = [
  "payment_info", "payment_terms", "bank_account", "bank_iban", "bank_swift", "iban", "swift",
  "cost", "cost_price", "internal_notes", "notes", "reliability_score", "rating",
  "commission_rate", "max_discount_allowed", "special_pricing_agreement", "contract_pricing_expiry",
  "credit_rating_internal", "credit_rating_external", "kyc_status", "ssn_no", "passport_no",
  "days_sales_outstanding", "overdue_balance",
];

const S = cfg.SUPPLIERS_LIST_CONFIG;

// ── (A) config exposes no sensitive columns ──
check("supplier search columns contain no sensitive column",
  !S.searchColumns.some((c) => HARD_SENSITIVE.includes(c)));
check("supplier sort columns contain no sensitive column",
  !Object.values(S.sortFields).some((c) => HARD_SENSITIVE.includes(c)));
check("supplier filter columns contain no sensitive column",
  !Object.values(S.filters).some((f) => HARD_SENSITIVE.includes(f.column)));
check("supplier config default sort is company_name asc", S.sortFields[S.defaultSort.field] === "company_name" && S.defaultSort.dir === "asc");
check("configForType('supplier') is the supplier config", cfg.configForType("supplier") === S);
check("configForType(other) is NOT the supplier config", cfg.configForType("customer") !== S && cfg.configForType(null) !== S);
// slim projection: none of the HARD sensitive names present (credit_limit/total_revenue/outstanding_balance are present but stripped by sanitize — asserted in B)
const slim = cfg.SLIM_LIST_COLUMNS.split(",").map((s) => s.trim());
check("slim projection contains no bank/payment/cost/internal/kyc column",
  !slim.some((c) => HARD_SENSITIVE.includes(c)));
check("slim projection carries supplier_type + company_name_en/cn (list needs)",
  slim.includes("supplier_type") && slim.includes("company_name_en") && slim.includes("company_name_cn"));

// ── (B) sanitizeContactRows strips commercial/credit for restricted roles ──
const supplierRow = {
  id: "s1", company_name: "Acme", supplier_type: "manufacturer", country: "CN",
  payment_terms: "NET30", credit_limit: 1000, outstanding_balance: 50,
  commission_rate: 5, special_pricing_agreement: "secret", total_revenue: 999,
};
const asAuth = (o: Record<string, unknown>) => o as unknown as import("../src/lib/server/auth").ServerAuthContext;
const restricted = sens.sanitizeContactRows(asAuth({ is_super_admin: false, can_view_private: false }), [supplierRow])[0] as Record<string, unknown>;
for (const k of ["payment_terms", "credit_limit", "outstanding_balance", "commission_rate", "special_pricing_agreement", "total_revenue"]) {
  check(`restricted role: '${k}' stripped`, !(k in restricted));
}
check("restricted role: non-sensitive fields kept (company_name, supplier_type, country)",
  restricted.company_name === "Acme" && restricted.supplier_type === "manufacturer" && restricted.country === "CN");
const sa = sens.sanitizeContactRows(asAuth({ is_super_admin: true, can_view_private: false }), [supplierRow])[0] as Record<string, unknown>;
check("super admin: commercial/credit fields kept", sa.payment_terms === "NET30" && sa.credit_limit === 1000 && sa.commission_rate === 5);
const priv = sens.sanitizeContactRows(asAuth({ is_super_admin: false, can_view_private: true }), [supplierRow])[0] as Record<string, unknown>;
check("can_view_private role: commercial/credit fields kept", priv.payment_terms === "NET30" && priv.special_pricing_agreement === "secret");

// ── (C) parseListParams validation (supplier config) ──
const parse = (q: Record<string, string>) => types.parseListParams(new URLSearchParams(q), S);
check("unknown sort key → default (name)", parse({ sort: "supplier_cost" }).sort === "name");
check("approved sort key accepted (country)", parse({ sort: "country" }).sort === "country");
check("pageSize clamped to max 100", parse({ pageSize: "9999" }).pageSize === 100);
check("negative page → 1", parse({ page: "-5" }).page === 1);
check("unknown filter dropped", parse({ cost: "5" }).filters.cost === undefined);
check("supplierType filter accepted", parse({ supplierType: "trader" }).filters.supplierType === "trader");
check("status invalid value rejected", parse({ status: "maybe" }).filters.status === undefined);
check("status valid value accepted", parse({ status: "false" }).filters.status === "false");
check("query length capped at 100", parse({ q: "x".repeat(500) }).q.length === 100);
check("CJK query preserved (NFC, not stripped)", parse({ q: "缝纫机" }).q === "缝纫机");
check("Arabic query preserved", parse({ q: "مورد" }).q === "مورد");

// ── (D) applyServerList only searches approved columns + deterministic order ──
type Call = { or?: string; eq?: [string, string]; order?: [string, boolean]; range?: [number, number] };
const calls: Call[] = [];
const mk = () => {
  const b: Record<string, (...a: never[]) => unknown> = {
    or: (f: string) => { calls.push({ or: f }); return b; },
    eq: (c: string, v: string) => { calls.push({ eq: [c, v] }); return b; },
    order: (c: string, o: { ascending: boolean }) => { calls.push({ order: [c, o.ascending] }); return b; },
    range: (a: number, z: number) => { calls.push({ range: [a, z] }); return b; },
  };
  return b;
};
const req = types.parseListParams(new URLSearchParams({ q: "acme", supplierType: "trader", sort: "name", dir: "asc", page: "2" }), S);
apply.applyServerList(mk(), req, S);
const orCall = calls.find((c) => c.or)?.or ?? "";
const orCols = orCall.split(",").map((t) => t.split(".ilike")[0]);
check("apply: OR search references ONLY approved supplier columns",
  orCols.length > 0 && orCols.every((c) => S.searchColumns.includes(c)));
check("apply: OR search includes no sensitive column", !orCols.some((c) => HARD_SENSITIVE.includes(c)));
check("apply: supplierType filter applied as eq on supplier_type",
  calls.some((c) => c.eq && c.eq[0] === "supplier_type" && c.eq[1] === "trader"));
check("apply: deterministic id tie-breaker order present",
  calls.some((c) => c.order && c.order[0] === "id" && c.order[1] === true));
check("apply: bounded range for page 2 (offset 50..99)",
  calls.some((c) => c.range && c.range[0] === 50 && c.range[1] === 99));

// ── (E) summary breakdown column is non-sensitive ──
check("summary breakdown for supplier = supplier_type", cfg.summaryBreakdownColumn("supplier") === "supplier_type");
check("summary breakdown for others = customer_type", cfg.summaryBreakdownColumn("customer") === "customer_type");
check("summary breakdown column not sensitive", !HARD_SENSITIVE.includes(cfg.summaryBreakdownColumn("supplier")));

// ── (F) static source guards ──
const suppUi = fs.readFileSync(R("src/components/suppliers/SuppliersServerList.tsx"), "utf8");
check("guard: server-list UI does NOT import the legacy full-list loader (fetchContactsByType)",
  !/fetchContactsByType/.test(suppUi));
check("guard: server-list UI does NOT import legacy Contacts component",
  !/components\/contacts\/Contacts/.test(suppUi));
check("guard: server-list UI has no fixed-interval poll (setInterval)",
  !/setInterval\s*\(/.test(suppUi));
check("guard: server-list UI mutates via updateContact/deleteContact then refetch (no full reload)",
  /deleteContact/.test(suppUi) && /list\.refetch\(\)/.test(suppUi));
const route = fs.readFileSync(R("src/app/api/contacts/route.ts"), "utf8");
check("guard: paged + summary branches keep tenant scope (.eq tenant_id)",
  (route.match(/\.eq\("tenant_id", auth\.tenant_id\)/g) ?? []).length >= 2);
check("guard: route enforces module access via moduleForType",
  /requireModuleAccess\(auth, moduleForType\(/.test(route));
const idRoute = fs.readFileSync(R("src/app/api/contacts/[id]/route.ts"), "utf8");
check("guard: DELETE enforces module 'delete' action", /requireModuleAction\(auth, moduleForType\([^)]*\), "delete"\)/.test(idRoute));
check("guard: PATCH enforces module 'edit' action", /requireModuleAction\(auth, moduleForType\([^)]*\), "edit"\)/.test(idRoute));
const page = fs.readFileSync(R("src/app/suppliers/page.tsx"), "utf8");
check("guard: /suppliers gate uses trusted suppliersServerList bootstrap flag",
  /data\?\.suppliersServerList === true/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
