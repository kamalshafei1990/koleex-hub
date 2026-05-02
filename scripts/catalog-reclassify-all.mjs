/* Re-classify products into their REAL subcategory across every
   parent category. Uses pattern-matching against product_name —
   only products that have a descriptive catalog name (different
   from their model code) get re-classified; products still named
   by model code stay in their default bucket and need manual
   review.

   Rule lists per category are ordered most-specific first so
   "tape cutting" doesn't accidentally match a plain "cutting"
   rule. */

import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await fs.readFile("/Users/kamalshafei/Desktop/Koleex HUB/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* Per-category classification rules. Order = priority (first match wins). */
const RULES_BY_CAT = {
  "industrial-sewing-machines": [
    { sub: "special-machines",         re: /\b(buttonhole|button.?hole|button.?attach|bartack|bar.?tack|blindstitch|blind.?stitch|smocking|shirring|elastic.?band|elastic.?attach|elastic insert|elastic shirring|elastic thread|picot|pleating|fagoting|ultrasonic|tape edge|carpet binding|belt loop|sleeve placket|collar runstitcher|yoke attach|felling|basting|pintuck|zigzag.*shoe|zig.?zag.*shoe)\b/i },
    { sub: "pattern-sewing-machines",  re: /\b(pattern sewing|programmable pattern|electronic pattern|template sewer|tacking station)\b/i },
    { sub: "multi-needle-machines",    re: /\b(multi.?needle|3.?needle|4.?needle|5.?needle|6.?needle|8.?needle|12.?needle|13.?needles|33.?needle|quilting)\b/i },
    { sub: "double-needle-machines",   re: /\b(double.?needle|twin.?needle|2.?needle)\b/i },
    { sub: "interlock-machines",       re: /\b(coverstitch|cover.?stitch|interlock|inter.?lock|flatlock|flat.?lock)\b/i },
    { sub: "overlock-machines",        re: /\b(overlock|over.?lock|over.?seaming|serger|3.?thread.*overedg|edging machine)\b/i },
    { sub: "chainstitch-machines",     re: /\b(chainstitch|chain.?stitch|chain stitch)\b/i },
    { sub: "heavy-duty-machines",      re: /\b(heavy.?duty|jeans special|denim special)\b/i },
    { sub: "lockstitch-machines",      re: /\b(lockstitch|lock.?stitch|direct.?drive sewing|computer.?ised lockstitch|computerized lockstitch)\b/i },
  ],

  "cutting-equipment": [
    { sub: "laser-cutting-machines",      re: /\b(laser.?cut|laser cutting)\b/i },
    { sub: "cnc-cutting-machines",        re: /\b(cnc cut|cnc.?automated|automated cnc)\b/i },
    { sub: "round-knife-cutting-machines",re: /\b(round.?knife|circular knife|round blade)\b/i },
    { sub: "band-knife-cutting-machines", re: /\b(band.?knife|band saw)\b/i },
    { sub: "tape-cutting-machines",       re: /\b(tape cut|tape cutter|hot.*cold.*cut)\b/i },
    { sub: "strip-cutting-machines",      re: /\b(strip cut|slitting machine|slitter|fabric slitting|cloth slitting|rolling.*slitting)\b/i },
    { sub: "fabric-drilling-machines",    re: /\b(drill|drilling)\b/i },
    { sub: "end-cutters",                 re: /\b(end cutter|automatic end|wireless.*end.?cut)\b/i },
    { sub: "straight-knife-cutting-machines", re: /\b(straight.?knife|cutter machine|cutting machine|cloth cutter|fabric cutter)\b/i },
  ],

  "fabric-preparation": [
    { sub: "fabric-inspection-machines",  re: /\b(inspection|inspect)\b/i },
    { sub: "fabric-relaxing-machines",    re: /\b(relax|relaxing)\b/i },
    { sub: "fabric-rolling-machines",     re: /\b(rolling|batching|rewind)\b/i },
    { sub: "fabric-handling-systems",     re: /\b(handling|conveyor|transport)\b/i },
    { sub: "fabric-cutting-tables",       re: /\b(cutting table)\b/i },
    { sub: "spreading-machines",          re: /\b(spreading|spreader)\b/i },
  ],

  "automatic-sewing-systems": [
    { sub: "buttonhole-machines",         re: /\b(buttonhole|button.?hole|eyelet)\b/i },
    { sub: "button-attaching-machines",   re: /\b(button.?attach|button setter|button setting|button stitching|button sewing)\b/i },
    { sub: "bartacking-machines",         re: /\b(bartack|bar.?tack|tacking)\b/i },
    { sub: "pocket-welting-machines",     re: /\b(pocket welt|welting|welt pocket)\b/i },
    { sub: "pocket-setter-machines",      re: /\b(pocket setter|pocket attach|pocket sewing)\b/i },
    { sub: "placket-sewing-units",        re: /\b(placket)\b/i },
    { sub: "sleeve-setting-machines",     re: /\b(sleeve set|sleeve attach)\b/i },
    { sub: "collar-machines",             re: /\b(collar|cuff)\b/i },
    { sub: "hemming-machines",            re: /\b(hemming|hem machine|fitted sheet)\b/i },
    { sub: "side-seam-units",             re: /\b(side seam)\b/i },
  ],

  "leather-footwear-machinery": [
    { sub: "shoe-sewing-machines",        re: /\b(shoe|footwear|boot)\b/i },
    { sub: "bag-sewing-machines",         re: /\b(bag|luggage|suitcase|sack)\b/i },
    { sub: "edge-binding-machines",       re: /\b(edge bind|edge.?binding|binding)\b/i },
    { sub: "tape-attaching-machines",     re: /\b(tape.?attach|tape.?sewing)\b/i },
    { sub: "leather-sewing-machines",     re: /\b(leather|saddle|harness)\b/i },
  ],

  "embroidery-equipment": [
    { sub: "sequin-embroidery-machines",     re: /\b(sequin)\b/i },
    { sub: "cording-beading-machines",       re: /\b(cord|beading|bead)\b/i },
    { sub: "multi-head-embroidery-machines", re: /\b(multi.?head|multihead|6.?head|8.?head|12.?head|24.?head)\b/i },
    { sub: "single-head-embroidery-machines",re: /\b(single.?head|1.?head|cap.?embroidery|garment.?embroidery)\b/i },
    { sub: "computerized-embroidery-machines", re: /\b(embroid|computerized.*embroid)\b/i },
  ],

  "printing-heat-press-equipment": [
    { sub: "digital-textile-printers-dtg", re: /\b(digital.?textile|dtg|digital print|inkjet)\b/i },
    { sub: "sublimation-printers",         re: /\b(sublim)\b/i },
    { sub: "screen-printing-machines",     re: /\b(screen print)\b/i },
    { sub: "rotary-heat-press-machines",   re: /\b(rotary)\b/i },
    { sub: "pneumatic-heat-press-machines",re: /\b(pneumatic)\b/i },
    { sub: "double-station-heat-press-machines", re: /\b(double.?station|dual station|2.?station)\b/i },
    { sub: "heat-press-machines",          re: /\b(heat press|hot press|heat transfer)\b/i },
  ],

  "finishing-equipment": [
    { sub: "thread-sucking-machines",     re: /\b(thread suck|thread vacuum|thread cleaner)\b/i },
    { sub: "form-finishing-machines",     re: /\b(form finish|dummy|garment finisher)\b/i },
    { sub: "fusing-press-machines",       re: /\b(fusing|fuser)\b/i },
    { sub: "vacuum-ironing-tables",       re: /\b(vacuum.*iron|vacuum iron)\b/i },
    { sub: "ironing-tables",              re: /\b(iron(ing)?\s*table|ironing board)\b/i },
    { sub: "collar-cuff-press-machines",  re: /\b(collar press|cuff press)\b/i },
    { sub: "washing-machines",            re: /\b(wash|washing)\b/i },
    { sub: "steam-boilers",               re: /\b(boiler)\b/i },
    { sub: "steam-irons",                 re: /\b(steam iron|steam press|iron press)\b/i },
  ],

  "packing-inspection": [
    { sub: "x-ray-inspection-machines",        re: /\b(x.?ray|xray)\b/i },
    { sub: "metal-detectors",                  re: /\b(metal detect)\b/i },
    { sub: "needle-detectors",                 re: /\b(needle detect|needle inspector)\b/i },
    { sub: "fabric-inspection-machines-final", re: /\b(fabric inspect|cloth inspect)\b/i },
    { sub: "carton-sealing-machines",          re: /\b(carton seal|box seal|case seal)\b/i },
    { sub: "folding-machines",                 re: /\b(fold|folding)\b/i },
    { sub: "packing-tables",                   re: /\b(packing|packaging|pack table)\b/i },
  ],

  "domestic-sewing-machines": [
    { sub: "household-overlock-machines",  re: /\b(overlock|serger)\b/i },
    { sub: "household-embroidery-machines",re: /\b(embroid)\b/i },
    { sub: "portable-sewing-machines",     re: /\b(portable|hand.?held|mini)\b/i },
    { sub: "household-lockstitch-machines",re: /\b(lockstitch|household|domestic|home use)\b/i },
  ],
};

function classify(category, name) {
  if (!name) return null;
  const rules = RULES_BY_CAT[category];
  if (!rules) return null;
  for (const r of rules) if (r.re.test(name)) return r.sub;
  return null;
}

const dryRun = process.argv.includes("--dry");

const { data: products, error } = await supabase
  .from("products")
  .select("id, product_name, slug, category_slug, subcategory_slug, product_models(model_name)");
if (error) throw error;

const before = {};
const after = {};
const updates = [];
let unchanged = 0, unclassified = 0;

for (const p of products) {
  const beforeKey = `${p.category_slug} / ${p.subcategory_slug}`;
  before[beforeKey] = (before[beforeKey] || 0) + 1;

  const modelName = (p.product_models?.[0]?.model_name) || "";
  const hasName = p.product_name && p.product_name.toLowerCase() !== modelName.toLowerCase();
  if (!hasName) {
    after[beforeKey] = (after[beforeKey] || 0) + 1;
    unclassified++;
    continue;
  }
  const newSub = classify(p.category_slug, p.product_name);
  if (!newSub) {
    after[beforeKey] = (after[beforeKey] || 0) + 1;
    unclassified++;
    continue;
  }
  if (newSub === p.subcategory_slug) {
    unchanged++;
    after[beforeKey] = (after[beforeKey] || 0) + 1;
    continue;
  }
  updates.push({ id: p.id, name: p.product_name, cat: p.category_slug, from: p.subcategory_slug, to: newSub });
  const afterKey = `${p.category_slug} / ${newSub}`;
  after[afterKey] = (after[afterKey] || 0) + 1;
}

console.log(`To move:        ${updates.length}`);
console.log(`Already correct: ${unchanged}`);
console.log(`Unclassified:    ${unclassified}\n`);

console.log("AFTER (projected):");
for (const [k, v] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v.toString().padStart(4)}  ${k}`);
}

if (dryRun) {
  console.log("\n── 20 SAMPLE MOVES ──");
  for (const u of updates.slice(0, 20)) {
    console.log(`  [${u.cat}]  ${u.from} → ${u.to}: ${u.name}`);
  }
  process.exit(0);
}

let applied = 0, errs = 0;
for (const u of updates) {
  const { error: e } = await supabase.from("products").update({ subcategory_slug: u.to }).eq("id", u.id);
  if (e) { errs++; console.error(`  ✗ ${u.name}: ${e.message}`); }
  else { applied++; if (applied % 50 === 0) console.log(`  ... ${applied}/${updates.length}`); }
}
console.log(`\nApplied: ${applied}\nErrors:  ${errs}`);
