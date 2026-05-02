/* v2 reclassifier — fixes regex word-boundary bugs + adds keyword
   coverage. Earlier rules failed to match suffixed forms like
   "bartacking" (because \b after "bartack" rejected next char "i")
   and "button holing" / "button attaching". Switched to substring
   matching against a hand-curated keyword list per category. */

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

/* Per-category classifier as a sequence of (subSlug, keywords[]) tuples.
   First tuple whose keyword list hits wins. Order = priority. */
const CLASSIFIERS = {
  "industrial-sewing-machines": [
    ["multi-needle-machines", [
      "multi-needle", "multi needle",
      "3 needle", "4 needle", "5 needle", "6 needle", "8 needle", "12 needle", "13 needles", "16 needle", "32 needle", "33 needle",
      "3-needle", "4-needle", "5-needle", "6-needle", "8-needle", "12-needle", "13-needle", "16-needle", "32-needle", "33-needle",
      "quilting",
    ]],
    ["double-needle-machines", [
      "double-needle", "double needle", "twin-needle", "twin needle",
      "2-needle", "2 needle",
    ]],
    ["pattern-sewing-machines", [
      "pattern sewing", "programmable pattern", "electronic pattern",
      "template sewer", "tacking station", "automatic round collar",
      "labeling machine", "auto sleeve setter",
    ]],
    ["special-machines", [
      // Buttonhole family (every form)
      "buttonhol", "button hol", "button-hol", "button hole",
      // Button attach family
      "button attach", "button-attach", "buttonattach",
      "button setter", "button setting", "button stitch", "button sewing",
      "button machine", "motor type button",
      // Bartack family
      "bartack", "bar tack", "bar-tack",
      // Blindstitch
      "blindstitch", "blind stitch", "blind-stitch",
      // Decorative / utility heads
      "smocking", "shirring",
      "elastic band", "elastic-band", "elastic attach", "elastic-attach",
      "elastic insert", "elastic shirring", "elastic thread",
      "picot", "pleating", "fagoting", "ultrasonic",
      "tape edge", "carpet binding", "belt loop", "belt-loop",
      "sleeve placket", "collar runstitcher", "yoke attach",
      "felling", "basting", "pintuck",
      // Zigzag — specialty stitch class
      "zigzag", "zig zag", "zig-zag",
      // Misc cycle / specialty heads in the catalog
      "cushion hole", "cushion-hole",
      "scarf machine", "automatic scarf",
      "cloth receiving",
      "letter recognition",
      "eyelet button",
    ]],
    ["interlock-machines", [
      "coverstitch", "cover stitch", "cover-stitch",
      "interlock", "inter-lock", "inter lock",
      "flatlock", "flat lock", "flat-lock",
    ]],
    ["overlock-machines", [
      "overlock", "over-lock", "over lock",
      "over-seaming", "over seaming",
      "overedging", "over-edging", "over edging",
      "serger",
      "3-thread", "3 thread", "4-thread", "4 thread", "5-thread", "5 thread", "6 thread", "6-thread",
      "edging machine",
      "rolled-hem", "rolled hem", "narrow edge",
    ]],
    ["chainstitch-machines", [
      "chainstitch", "chain stitch", "chain-stitch",
    ]],
    ["heavy-duty-machines", [
      "heavy-duty", "heavy duty",
    ]],
    // Lockstitch is the fall-through if "sewing machine" appears
    ["lockstitch-machines", [
      "lockstitch", "lock stitch", "lock-stitch",
      "direct-drive sewing", "direct drive sewing",
      "sewing machine", "feed-of-the-arm", "feed of the arm",
    ]],
  ],

  "cutting-equipment": [
    ["laser-cutting-machines",      ["laser cut", "laser-cut", "laser cutting"]],
    ["cnc-cutting-machines",        ["cnc cut", "cnc cutting", "cnc-cut"]],
    ["round-knife-cutting-machines",["round knife", "round-knife", "circular knife"]],
    ["band-knife-cutting-machines", ["band knife", "band-knife"]],
    ["tape-cutting-machines",       ["tape cut", "tape-cut", "hot and cold", "belt cutting"]],
    ["strip-cutting-machines",      ["strip cut", "strip-cut", "slitting", "slitter", "slit machine"]],
    ["fabric-drilling-machines",    ["drilling", "drill machine"]],
    ["end-cutters",                 ["end cutter", "end-cutter"]],
    ["straight-knife-cutting-machines", [
      "straight knife", "straight-knife", "auto-sharpening", "auto sharpening",
      "cutter machine", "cutting machine", "cloth cutter", "fabric cutter", "eastman cutter",
    ]],
  ],

  "fabric-preparation": [
    ["fabric-inspection-machines",  ["inspection", "inspect"]],
    ["fabric-relaxing-machines",    ["relaxing", "relax machine"]],
    ["fabric-rolling-machines",     ["rolling", "batching", "rewind", "roll machine"]],
    ["fabric-handling-systems",     ["handling system", "conveyor"]],
    ["fabric-cutting-tables",       ["cutting table"]],
    ["spreading-machines",          ["spreading", "spreader"]],
  ],

  "automatic-sewing-systems": [
    ["buttonhole-machines",         ["buttonhol", "button hol", "eyelet"]],
    ["button-attaching-machines",   ["button attach", "button setter", "button setting", "button stitch", "button sewing"]],
    ["bartacking-machines",         ["bartack", "bar tack", "bar-tack", "tacking"]],
    ["pocket-welting-machines",     ["pocket welt", "welting", "welt pocket"]],
    ["pocket-setter-machines",      ["pocket setter", "pocket attach", "pocket sewing", "pocket curling"]],
    ["placket-sewing-units",        ["placket"]],
    ["sleeve-setting-machines",     ["sleeve set", "sleeve attach"]],
    ["collar-machines",             ["collar", "cuff"]],
    ["hemming-machines",            ["hemming", "hem machine", "fitted sheet", "pillowcase"]],
    ["side-seam-units",             ["side seam"]],
  ],

  "leather-footwear-machinery": [
    ["shoe-sewing-machines",        ["shoe", "footwear", "boot"]],
    ["bag-sewing-machines",         ["bag sewing", "bag-sewing", "luggage", "suitcase", "sack"]],
    ["edge-binding-machines",       ["edge bind", "edge-binding", " binding "]],
    ["tape-attaching-machines",     ["tape attach", "tape-attach", "tape sewing"]],
    ["leather-sewing-machines",     ["leather", "saddle", "harness"]],
  ],

  "embroidery-equipment": [
    ["sequin-embroidery-machines",     ["sequin"]],
    ["cording-beading-machines",       ["cording", "beading", "bead "]],
    ["multi-head-embroidery-machines", ["multi-head", "multi head", "multihead", "6 head", "8 head", "12 head", "24 head"]],
    ["single-head-embroidery-machines",["single-head", "single head", "1 head", "cap embroidery", "garment embroidery"]],
    ["computerized-embroidery-machines", ["embroid", "computerized embroid"]],
  ],

  "printing-heat-press-equipment": [
    ["digital-textile-printers-dtg", ["digital textile", "dtg", "digital print", "inkjet"]],
    ["sublimation-printers",         ["sublim"]],
    ["screen-printing-machines",     ["screen print"]],
    ["rotary-heat-press-machines",   ["rotary"]],
    ["pneumatic-heat-press-machines",["pneumatic"]],
    ["double-station-heat-press-machines", ["double station", "double-station", "dual station", "2 station"]],
    ["heat-press-machines",          ["heat press", "hot press", "heat transfer"]],
  ],

  "finishing-equipment": [
    ["thread-sucking-machines",     ["thread suck", "thread vacuum", "thread cleaner"]],
    ["form-finishing-machines",     ["form finish", "dummy", "garment finisher"]],
    ["fusing-press-machines",       ["fusing", "fuser"]],
    ["vacuum-ironing-tables",       ["vacuum iron", "vacuum-iron"]],
    ["ironing-tables",              ["ironing table", "ironing board", "iron table"]],
    ["collar-cuff-press-machines",  ["collar press", "cuff press"]],
    ["washing-machines",            ["washing"]],
    ["steam-boilers",               ["boiler"]],
    ["steam-irons",                 ["steam iron", "steam press", "iron press"]],
  ],

  "packing-inspection": [
    ["x-ray-inspection-machines",        ["x-ray", "xray"]],
    ["metal-detectors",                  ["metal detect"]],
    ["needle-detectors",                 ["needle detect", "needle inspector"]],
    ["fabric-inspection-machines-final", ["fabric inspect", "cloth inspect"]],
    ["carton-sealing-machines",          ["carton seal", "box seal", "case seal"]],
    ["folding-machines",                 ["folding", "fold machine"]],
    ["packing-tables",                   ["packing"]],
  ],

  "domestic-sewing-machines": [
    ["household-overlock-machines",  ["overlock", "serger"]],
    ["household-embroidery-machines",["embroid"]],
    ["portable-sewing-machines",     ["portable", "hand-held", "handheld", "mini "]],
    ["household-lockstitch-machines",["lockstitch", "household", "domestic", "home use"]],
  ],
};

function classify(category, name) {
  if (!name) return null;
  const rules = CLASSIFIERS[category];
  if (!rules) return null;
  const n = name.toLowerCase();
  for (const [sub, keywords] of rules) {
    for (const k of keywords) {
      if (n.includes(k)) return sub;
    }
  }
  return null;
}

const dryRun = process.argv.includes("--dry");

const { data: products, error } = await supabase
  .from("products")
  .select("id, product_name, category_slug, subcategory_slug, product_models(model_name)");
if (error) throw error;

const updates = [];
let unchanged = 0;
let unclassified = 0;
const moveLog = {};

for (const p of products) {
  const modelName = (p.product_models?.[0]?.model_name) || "";
  const hasName = p.product_name && p.product_name.toLowerCase() !== modelName.toLowerCase();
  if (!hasName) { unclassified++; continue; }
  const newSub = classify(p.category_slug, p.product_name);
  if (!newSub) { unclassified++; continue; }
  if (newSub === p.subcategory_slug) { unchanged++; continue; }
  updates.push({ id: p.id, name: p.product_name, cat: p.category_slug, from: p.subcategory_slug, to: newSub });
  const k = `${p.category_slug}: ${p.subcategory_slug} → ${newSub}`;
  moveLog[k] = (moveLog[k] || 0) + 1;
}

console.log(`To move:        ${updates.length}`);
console.log(`Already correct: ${unchanged}`);
console.log(`Unclassified:    ${unclassified}\n`);

console.log("MOVES BY (cat: from → to):");
for (const [k, v] of Object.entries(moveLog).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v.toString().padStart(4)}  ${k}`);
}

if (dryRun) {
  console.log("\n── 25 SAMPLE MOVES ──");
  for (const u of updates.slice(0, 25)) {
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
