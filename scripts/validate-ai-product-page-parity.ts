#!/usr/bin/env node
/* validate:ai-product-page-parity — Koleex AI knows exactly what the product
 * page shows, because it reads the same loader (rebuild phase 6, 19/09/2026).
 *
 *   §1 source: buildProductTabs() loads the page through
 *      loadPublicSchemaProduct and hands `sections` through whole — not a
 *      hand-picked subset that would drift the next time a section is added.
 *      Failure direction exercised on a mutated copy.
 *   §2 live (read-only, real database): for a real active product with buyer
 *      options, `tabs.page` equals the loader's output field for field for
 *      the internal audience with cost permission; for a customer audience
 *      the price sheet is null and supplier/price are withheld; for a public
 *      audience there is no Global FOB and no option price.
 *
 * Runs with --conditions=react-server (the loader is `server-only`) and
 * reads .env.local for the database, like validate:access.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const code = (src: string) => stripComments(src);

/* ── env ── */
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
} catch { /* the live half will say so */ }

async function main(): Promise<void> {
  console.log("\n§1 the AI reads the page through the page's loader");
  const pk = fs.readFileSync(path.join(ROOT, "src/lib/server/ai-agent/product-knowledge.ts"), "utf8");
  const pkCode = code(pk);
  expect(/import \{[^}]*loadPublicSchemaProduct[^}]*\} from "\.\.\/product-detail"/.test(pkCode), "product-knowledge imports loadPublicSchemaProduct from product-detail");
  expect(/loadPublicSchemaProduct\(productId,\s*\{\s*allowUnpublished:\s*true,\s*audience:\s*pageAudience\(who\)/.test(pkCode), "buildProductTabs loads the page in the caller's audience, drafts included");
  expect(/const \{ modelPrices, logistics: _raw, \.\.\.rest \} = sections;/.test(pkCode) && /\.\.\.rest,/.test(pkCode), "pageKnowledge hands `sections` through whole (rest spread), not a hand-picked subset");
  expect(/tabs\.page = pageKnowledge\(loaded, who, costOk\)/.test(pkCode), "tabs.page is the page");
  {
    const mutated = pkCode.replace("...rest,", "packing: rest.packing,");
    expect(!/\.\.\.rest,/.test(mutated), "  (the rule sees the failure direction)");
  }

  console.log("\n§2 live parity on a real product");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    fail("no database in the environment — the live half did not run", "set .env.local or SUPABASE_URL");
  } else {
    const { supabaseServer } = await import("../src/lib/server/supabase-server");
    const { loadPublicSchemaProduct } = await import("../src/lib/server/product-detail");
    const { buildProductTabs } = await import("../src/lib/server/ai-agent/product-knowledge");

    const { data: pick } = await supabaseServer
      .from("product_options").select("product_id").eq("active", true).limit(1).maybeSingle();
    const productId = (pick as { product_id?: string } | null)?.product_id ?? null;
    if (!productId) {
      fail("no product with active buyer options exists — the live half has nothing to compare", "add an option in Product Data, then re-run");
    } else {
      const { data: prow } = await supabaseServer.from("products").select("*").eq("id", productId).maybeSingle();
      const { data: models } = await supabaseServer.from("product_models").select("*").eq("product_id", productId).order("order", { ascending: true });
      const product = (prow ?? {}) as Record<string, unknown>;
      const ms = (models ?? []) as Array<Record<string, unknown>>;

      const internal = await buildProductTabs({ productId, product, models: ms, who: "internal", costOk: true });
      const page = internal.tabs.page as Record<string, unknown> | null;
      expect(!!page, `internal: tabs.page present for ${String(product.slug)}`);
      if (page) {
        const loaded = await loadPublicSchemaProduct(productId, { allowUnpublished: true, audience: "internal" });
        const same = JSON.stringify(page.options) === JSON.stringify(loaded?.sections.options);
        expect(same, "internal: page.options is the loader's options, byte for byte");
        expect(JSON.stringify(page.packing) === JSON.stringify(loaded?.sections.packing ?? null), "internal: page.packing is the loader's packing");
        expect(JSON.stringify(page.classification) === JSON.stringify(loaded?.sections.classification), "internal: page.classification is the loader's classification");
        expect("modelPrices" in page && "fob" in page && "compliance" in page && "highlights" in page && "featureCards" in page, "internal: every section key travels (fob, modelPrices, compliance, highlights, featureCards…)");
        /* Two loader calls, two array objects — compare content, not identity. */
        expect(JSON.stringify(page.modelPrices) === JSON.stringify(loaded?.sections.modelPrices ?? null), "internal with cost: the price sheet is the loader's (may be null when no list prices exist)");
      }

      const customer = await buildProductTabs({ productId, product, models: ms, who: "customer", costOk: false });
      const cpage = customer.tabs.page as Record<string, unknown> | null;
      expect(!!cpage && cpage.modelPrices === null, "customer: no internal price sheet");
      expect(customer.withheld.includes("supplier") && customer.withheld.includes("price") && customer.withheld.includes("page.modelPrices"), "customer: supplier, price and page.modelPrices are declared withheld");
      expect(!!cpage && "fob" in cpage, "customer: sees the Global FOB (a Hub account sees it on the page)");

      const pub = await buildProductTabs({ productId, product, models: ms, who: "public", costOk: false });
      const ppage = pub.tabs.page as Record<string, unknown> | null;
      expect(!!ppage && ppage.fob === null, "public: no Global FOB");
      const pubOpts = (ppage?.options as Array<{ values: Array<{ priceDeltaUsd: number | null }> }> | undefined) ?? [];
      expect(pubOpts.every((o) => o.values.every((v) => v.priceDeltaUsd === null)), "public: no option price deltas");
      const raw = JSON.stringify(ppage ?? {});
      expect(!/cost_price|unit_cost_cny|price_delta_cny|supplier_id/.test(raw), "public: no cost column name anywhere in the page payload");
    }
  }

  console.log(failed ? `\n✗ ai product-page parity: ${failed} check(s) failed\n` : "\n✓ ai product-page parity: all checks passed\n");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
