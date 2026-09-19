#!/usr/bin/env node
/* validate:product-page-coverage — every fact Product Data holds for a
 * customer has a home on the product page, or is excluded BY NAME with a
 * reason. Owner rule (19/09/2026): "anything adjusted or added in Product
 * Data should be fully synced to the product app." Sync is not only cache
 * freshness; a field that is saved and never shown is out of sync forever.
 *
 * Three links in the chain, each checked, each with its failure direction:
 *
 *   1. CUSTOMER-VISIBLE COLUMNS → THE LOADER. The freshness trigger
 *      (migration 20260919_products_freshness.sql) names every products
 *      column whose change a customer can notice. Each must be selected by
 *      product-detail.ts (PRODUCT_PUBLIC_COLUMNS), or sit in EXCLUDED_COLUMNS
 *      here with a reason.
 *   2. THE LOADER'S SELECT → ITS OUTPUT. Every column in PRODUCT_PUBLIC_COLUMNS
 *      is read somewhere in product-detail.ts as `product.<col>`. A column
 *      selected and never read is bytes for nothing and a field nobody shows.
 *   3. THE LOADER'S OUTPUT → THE PAGE. Every key of ProductDetailSections is
 *      referenced in the product-preview client tree (`sections?.<key>` /
 *      `sections.<key>`), or sits in EXCLUDED_SECTIONS with a reason.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* Excluded WITH A REASON. Adding a name here is a decision, not a shortcut. */
const EXCLUDED_COLUMNS: Record<string, string> = {
  tags: "search facets; the page shows classification, not tags (owner spec lists none)",
  level: "internal product level; drives pricing uplift, never shown to a customer",
  alternate_names: "search aliases (Chinese names) — the page shows the localized name via translations",
  brand_mark_url: "distributed-brand artwork; the page draws BrandMark (logo or name), phase 7 website may use it",
  warranty_type: "folded into the Compliance warranty line via `warranty` / `warranty_months`",
  warranty_coverage: "long-form warranty text — belongs to the print brochure (phase 5), not the screen",
  moq: "internal commercial term (MODEL_INTERNAL_FIELDS); customers get it in a quotation",
  lead_time: "internal commercial term; customers get it in a quotation",
  supports_head_only: "purchase form flag; surfaces as a price column in the internal price sheet only",
  supports_complete_set: "purchase form flag; surfaces as a price column in the internal price sheet only",
  specs: "legacy typed specs; the page reads schema_specs (readers split, see product-data memory)",
};
const EXCLUDED_SECTIONS: Record<string, string> = {
  logistics: "raw jsonb kept for the AI (phase 6); the page renders the derived `packing` view",
  description: "long description is the print brochure's body (phase 5); the screen shows tagline + excerpt",
};

const migration = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260919_products_freshness.sql"), "utf8");
const loader = fs.readFileSync(path.join(ROOT, "src/lib/server/product-detail.ts"), "utf8");
const tree = ["ProductPreview", "ProductHero", "ProductHighlights", "ProductOptions", "ProductPacking", "ProductCompliance", "ProductPriceInternal", "ProductKeyFigures", "ProductSpecs", "ProductKnowledge", "ProductMedia", "ProductCompare", "ProductRail"]
  .map((n) => code(fs.readFileSync(path.join(ROOT, `src/components/product-preview/${n}.tsx`), "utf8"))).join("\n");

/* ── 1. customer-visible columns (from the trigger) → loader select ── */
function triggerColumns(sql: string): string[] {
  const fn = sql.slice(sql.indexOf("products_freshness_touch()"), sql.indexOf("drop trigger if exists trg_products_freshness"));
  return [...fn.matchAll(/old\.([a-z_]+)\s+is distinct from new\.\1/g)].map((m) => m[1]).filter((c) => c !== "status");
}
function selectedColumns(src: string): string[] {
  const block = src.slice(src.indexOf("const PRODUCT_PUBLIC_COLUMNS"), src.indexOf(";", src.indexOf("const PRODUCT_PUBLIC_COLUMNS")));
  return [...code(block).matchAll(/"([^"]+)"/g)].flatMap((m) => m[1].split(",").map((c) => c.trim()).filter(Boolean));
}
console.log("\n§1 customer-visible columns reach the loader");
const visible = triggerColumns(migration);
const selected = selectedColumns(loader);
expect(visible.length >= 20, `the trigger names ${visible.length} customer-visible columns (27 on 19/09/2026)`, "the parser found too few — is the migration's watched list where it was?");
expect(selected.length >= 25, `the loader selects ${selected.length} columns`);
const missing = visible.filter((c) => !selected.includes(c) && !(c in EXCLUDED_COLUMNS));
expect(missing.length === 0, "every customer-visible column is selected or excluded with a reason", missing.join(", "));
const staleExclusions = Object.keys(EXCLUDED_COLUMNS).filter((c) => selected.includes(c));
expect(staleExclusions.length === 0, "no excluded column is secretly selected (an exclusion must be true)", staleExclusions.join(", "));
{
  const mutated = migration.replace("old.product_name       is distinct from new.product_name", "old.product_name       is distinct from new.product_name\n     or old.brand_new_column is distinct from new.brand_new_column");
  const m2 = triggerColumns(mutated).filter((c) => !selected.includes(c) && !(c in EXCLUDED_COLUMNS));
  expect(m2.length === 1 && m2[0] === "brand_new_column", "  (the rule sees the failure direction)");
}

/* ── 2. loader select → loader output ── */
console.log("\n§2 every selected column is read by the loader");
const loaderCode = code(loader);
/* `row.` covers isPublic(row) — status/visible are read there, not on `product`. */
const unread = selected.filter((c) => !new RegExp(`\\b(product|row)\\.${c}\\b`).test(loaderCode) && !["id", "tenant_id", "schema_id", "schema_version", "schema_visibility"].includes(c));
expect(unread.length === 0, "no column is selected and never mapped", unread.join(", "));
{
  const m = selectedColumns(loader.replace('"description, highlights,', '"description, ghost_column, highlights,'));
  expect(m.includes("ghost_column") && !/\b(product|row)\.ghost_column\b/.test(loaderCode), "  (the rule sees the failure direction)");
}

/* ── 3. loader output → the page ── */
console.log("\n§3 every section the loader emits has a home on the page");
function sectionKeys(src: string): string[] {
  const start = src.indexOf("export interface ProductDetailSections");
  const end = src.indexOf("\n}", start);
  return [...code(src.slice(start, end)).matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
}
const keys = sectionKeys(loader);
expect(keys.length >= 10, `ProductDetailSections has ${keys.length} keys`);
const homeless = keys.filter((k) => !new RegExp(`sections\\??\\.${k}\\b`).test(tree) && !(k in EXCLUDED_SECTIONS));
expect(homeless.length === 0, "every section key is read by the page or excluded with a reason", homeless.join(", "));
{
  const mutated = loader.replace("  options: ProductOptionView[];", "  options: ProductOptionView[];\n  orphanSection: string;");
  const m = sectionKeys(mutated).filter((k) => !new RegExp(`sections\\??\\.${k}\\b`).test(tree) && !(k in EXCLUDED_SECTIONS));
  expect(m.length === 1 && m[0] === "orphanSection", "  (the rule sees the failure direction)");
}

/* ── 4. the public surface (phase 7): no price, no Hub tool ── */
console.log("\n§4 the public (website) reader gets no price and no Hub tool");
const heroSrc = code(fs.readFileSync(path.join(ROOT, "src/components/product-preview/ProductHero.tsx"), "utf8"));
const previewSrc = code(fs.readFileSync(path.join(ROOT, "src/components/product-preview/ProductPreview.tsx"), "utf8"));
expect(/PRICE_AUDIENCES[^\n]*new Set\(\["internal", "customer"\]\)/.test(loaderCode), "PRICE_AUDIENCES is exactly internal + customer (no print, no public)");
expect(/isPublicReader = audience === "public"/.test(previewSrc) && /showAskAi=\{!isPublicReader\}/.test(previewSrc), "ProductPreview hides Ask AI for the public audience");
expect(/a\.key === "ask_ai" && !p\.showAskAi\) return null/.test(heroSrc), "ProductHero honours showAskAi");
expect(/if \(isPublicReader\) \{[\s\S]*mailto:\$\{KOLEEX_COMPANY\.email\}/.test(previewSrc), "public Quote is a written request to the company inbox");
{
  const mutated = loaderCode.replace('new Set(["internal", "customer"])', 'new Set(["internal", "customer", "public"])');
  expect(!/PRICE_AUDIENCES[^\n]*new Set\(\["internal", "customer"\]\)/.test(mutated), "  (the rule sees the failure direction)");
}

console.log(failed ? `\n✗ product page coverage: ${failed} check(s) failed\n` : "\n✓ product page coverage: all checks passed\n");
process.exit(failed ? 1 : 0);
