/* ---------------------------------------------------------------------------
   validate:ai-product-price — the selling price tool, and where it is wired.

   Run: npm run -s validate:ai-product-price

   WHAT IS PROVED. The two resolvers (country, customer type) as pure
   functions; that the tool's payload can carry no cost, margin or level by
   construction (its result type); and, by reading source, that the tool is
   registered, declared in the skills catalogue, allowed on a call, trusted
   by the pricing seal, and named in both lanes' instructions.

   WHAT IS NOT. The engine run itself needs the policy tables and a product
   row; this environment has neither. computePolicyPrice has its own suite.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}`); }
}

async function main() {
  const { resolveCountryCode, resolveTierCode, getProductPrice } = await import("../src/lib/server/ai-agent/tools/product-price");

  console.log("── 1. The country the caller named ──");
  check("an ISO-2 code, any case", resolveCountryCode("eg")?.code === "EG" && resolveCountryCode("US")?.name === "United States");
  check("the English name, any case, with or without 'the'", resolveCountryCode("egypt")?.code === "EG" && resolveCountryCode("The United Arab Emirates")?.code === "AE");
  check("the ways callers actually say it — UAE, USA, UK, KSA", resolveCountryCode("UAE")?.code === "AE" && resolveCountryCode("usa")?.code === "US" && resolveCountryCode("UK")?.code === "GB" && resolveCountryCode("KSA")?.code === "SA");
  check("in Arabic and Chinese", resolveCountryCode("مصر")?.code === "EG" && resolveCountryCode("السعودية")?.code === "SA" && resolveCountryCode("中国")?.code === "CN" && resolveCountryCode("美国")?.code === "US");
  check("a unique prefix resolves; an ambiguous or unknown one does not", resolveCountryCode("Egyp")?.code === "EG" && resolveCountryCode("Un") === null && resolveCountryCode("Atlantis") === null);
  check("empty is null, never a default country", resolveCountryCode("") === null && resolveCountryCode(null) === null && resolveCountryCode("  ") === null);

  console.log("\n── 2. The customer type the caller named ──");
  const tiers = [
    { code: "end_user", name: "End User", real_name: "Personal Buyer" },
    { code: "silver", name: "Silver", real_name: "Dealer / Small Trader" },
    { code: "gold", name: "Gold", real_name: "Distributor" },
    { code: "platinum", name: "Platinum", real_name: "Agent / Major Distributor" },
    { code: "diamond", name: "Diamond", real_name: "Sole Agent / Strategic" },
  ];
  check("the tenant's own code, name or real name, any case", resolveTierCode("GOLD", tiers) === "gold" && resolveTierCode("platinum", tiers) === "platinum" && resolveTierCode("Distributor", tiers) === "gold");
  check("the words people use: distributor → gold, agent → platinum, dealer → silver, end user → end_user, sole agent → diamond",
    resolveTierCode("a distributor", tiers) === "gold" && resolveTierCode("an agent", tiers) === "platinum" && resolveTierCode("dealer", tiers) === "silver" && resolveTierCode("end-user", tiers) === "end_user" && resolveTierCode("sole agent", tiers) === "diamond");
  check("  …'major distributor' is the agent rung, not the distributor one; 'exclusive' is diamond", resolveTierCode("major distributor", tiers) === "platinum" && resolveTierCode("exclusive agent", tiers) === "diamond");
  check("  …in Arabic and Chinese", resolveTierCode("وكيل", tiers) === "platinum" && resolveTierCode("موزع", tiers) === "gold" && resolveTierCode("مستخدم نهائي", tiers) === "end_user" && resolveTierCode("分销商", tiers) === "gold" && resolveTierCode("代理", tiers) === "platinum");
  check("a word the tenant has no rung for is null — the engine then prices at the best channel and the tool says so",
    resolveTierCode("agent", [tiers[0], tiers[2]]) === null && resolveTierCode("wizard", tiers) === null && resolveTierCode("", tiers) === null);

  console.log("\n── 3. The tool, as declared ──");
  check("named, described as a SELLING price in USD FOB, and gated on Products/view like the other product reads",
    getProductPrice.name === "getProductPrice" && /SELLING price/.test(getProductPrice.description) && /USD, FOB/.test(getProductPrice.description) && /Never a cost or margin/.test(getProductPrice.description) && getProductPrice.requiredModule === "Products" && getProductPrice.requiredAction === "view");
  check("its parameters are a product (id or code) and the two optional questions — country and customer type — nothing else",
    Object.keys(getProductPrice.parameters.properties).sort().join(",") === "code,country,customerType,productId" && !getProductPrice.parameters.required?.length);
  const src = readFileSync("src/lib/server/ai-agent/tools/product-price.ts", "utf8");
  const resultType = src.slice(src.indexOf("export interface ProductPriceResult"), src.indexOf("export const getProductPrice"));
  check("the result type has no room for a cost, a margin, a level or a supplier",
    !/cost|margin|level|supplier|cny|uplift|fx/i.test(resultType) && /fob_price_usd: number \| null;/.test(resultType) && /unit_price: number \| null;/.test(resultType));
  check("  …the engine's breakdown is read for three fields and the rest never leaves the handler",
    /global\.breakdown\.globalFobUsd/.test(src) && /specific\.unitPriceUsd/.test(src) && /specific\.approvalRequired/.test(src) && !/breakdown\.(factoryCostCny|netInternalCost|baseMarginPercent|productLevel|effectiveMargin|commission)/.test(src));
  check("the exact price for a country or customer type is gated on Quotations/view INSIDE the handler; the FOB is not",
    /const canQuote = checkModule\(ctx, QUOTATIONS_MODULE, "view"\);\s*if \(!canQuote\.allowed\) \{[\s\S]*?permissionStatus: "limited"/.test(src) && src.indexOf("if (!wantsSpecific)") < src.indexOf("const canQuote"));
  check("on request, or no cost, or an engine that cannot price: nulls and a message to say so — never a made-up number",
    /pricingMode === "on_request" \|\| cost == null/.test(src) && (src.match(/fob_price_usd: null, unit_price: null, price: null/g) ?? []).length >= 3);
  check("without a country or type the tool tells the model what to ASK",
    /ask: "If they want the exact price for a deal, ask which country and which customer type \(end user, dealer, distributor, agent, sole agent\)\."/.test(src));
  check("an unpublished product is 'no product' for a catalogue account, as in every other product read", /hasProductDataAccess\(ctx\.auth\)/.test(src) && /published = String\(row\.status/.test(src));
  check("the cost resolution is the FOB route's: primary link, any link, model cost_price; mode from the primary model",
    /if \(l\.is_primary \|\| cost == null\) cost = landed;/.test(src) && /const pricingMode = models\[0\]\?\.pricing_mode \|\| "fixed";/.test(src));

  console.log("\n── 4. Wired everywhere it must be ──");
  const registry = readFileSync("src/lib/server/ai-agent/tool-registry.ts", "utf8");
  check("registered", /import \{ productPriceTools \} from "\.\/tools\/product-price";/.test(registry) && /\.\.\.productPriceTools,/.test(registry));
  const catalog = readFileSync("src/lib/server/ai/skills/catalog.ts", "utf8");
  check("declared in the skills catalogue as a read-only product tool", /getProductPrice: \{ domain: "products", risk: "read_only" \}/.test(catalog));
  const voice = readFileSync("src/lib/server/ai/voice/tools.ts", "utf8");
  check("allowed on a call, after the product reads and before the printed index",
    (() => { const m = voice.match(/export const VOICE_TOOL_NAMES[\s\S]*?\];/); const list = m ? m[0] : ""; return /"getProductPrice",/.test(list) && list.indexOf('"getProductDetails"') < list.indexOf('"getProductPrice"') && list.indexOf('"getProductPrice"') < list.indexOf('"searchCatalog"'); })());
  check("  …and the deny rationale names it as the one exception, with the reason", /THE ONE EXCEPTION, by the owner's decision: getProductPrice/.test(voice));
  const seal = readFileSync("src/lib/server/ai/seals/pricing.ts", "utf8");
  check("trusted by the pricing seal — its figures may reach the user; on-request nulls are still no evidence",
    /const PRICING_TOOLS = new Set<string>\(\[\s*"calculateQuotationPricing",[\s\S]*?"getProductPrice",\s*\]\);/.test(seal) && /"unit_price",/.test(seal) && /"price",/.test(seal));
  const prompts = readFileSync("src/lib/server/ai/prompts/index.ts", "utf8");
  check("the written lane routes price questions to it and allows its numbers under Pricing Discipline",
    /PRICE questions about a Koleex product[^\n]*getProductPrice\(productId or code; optional country, customerType\)/.test(prompts) && /ask WHICH COUNTRY and WHICH CUSTOMER TYPE \(end user, dealer, distributor, agent, sole agent\)/.test(prompts) && /"calculateQuotationPricing" or the tool "getProductPrice"/.test(prompts));
  const session = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
  check("the call is told: never a price from memory; FOB in USD by default; then ask country and customer type",
    /PRICES: for the price of a Koleex product call getProductPrice — never say a price from memory, never estimate/.test(session) && /ASK which country and which customer type \(end user, dealer,[\s"+]*distributor, agent, sole agent\)/.test(session) && /say it is on request and that sales can send a quotation/.test(session));

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n" + failures.map((f) => "  · " + f).join("\n")); process.exit(1); }
  console.log("NOT proved here: an engine run over real policy tables — computePolicyPrice has its own suite; the handler's SQL needs a database.");
}

void main().catch((e) => { console.error(e); process.exit(1); });
