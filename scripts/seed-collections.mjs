/* Seed starter KOLEEX collections, auto-populated from existing icons. Idempotent by slug. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TENANT = "490fbd4d-f3e8-44fa-83e6-ee26f961d5ca";

// [name, slug, type, category(group), style, description, assetQuery {categories?, style?, limit}]
const COLLECTIONS = [
  ["KOLEEX Core UI", "koleex-core-ui", "ui_system", "Core System", "minimal_outline",
    "Essential interface icons used across every KOLEEX app.", { categories: ["navigation", "actions", "status"], limit: 60 }],
  ["KOLEEX Navigation", "koleex-navigation", "navigation", "Core System", "minimal_outline",
    "Wayfinding & navigation icons for sidebars, tabs and mobile.", { categories: ["navigation"], limit: 40 }],
  ["Finance", "finance-pack", "business_system", "Business", "minimal_outline",
    "Money, billing, payments and accounting icons.", { categories: ["finance"], limit: 40 }],
  ["Inventory & Logistics", "inventory-logistics", "business_system", "Business", "minimal_outline",
    "Warehouse, shipping, tracking and stock icons.", { categories: ["inventory"], limit: 40 }],
  ["Minimal Outline", "minimal-outline", "style_system", "Design", "minimal_outline",
    "The monochrome outline style system — the KOLEEX default.", { style: "outline", limit: 48 }],
];

async function run() {
  for (const [name, slug, type, category, style, description, q] of COLLECTIONS) {
    // upsert collection by slug
    let { data: col } = await supabase.from("visual_collections").select("id").eq("tenant_id", TENANT).eq("slug", slug).maybeSingle();
    if (!col) {
      const code = `COL-${slug.toUpperCase().replace(/-/g, "").slice(0, 12)}`;
      const ins = await supabase.from("visual_collections").insert({
        tenant_id: TENANT, code, name, slug, description, category, collection_type: type, style_type: style, approval_status: "approved",
      }).select("id").maybeSingle();
      col = ins.data;
      if (!col) { console.warn(`skip ${slug}: ${ins.error?.message}`); continue; }
    }
    // pick assets
    let query = supabase.from("visual_assets").select("id, storage_bucket, svg_path").eq("tenant_id", TENANT).not("svg_path", "is", null).limit(q.limit);
    if (q.categories) query = query.in("category", q.categories);
    if (q.style) query = query.eq("style", q.style);
    const { data: assets } = await query;
    const rows = (assets ?? []).map((a, i) => ({ tenant_id: TENANT, collection_id: col.id, asset_id: a.id, role: i === 0 ? "primary" : "secondary", sort_order: i }));
    if (rows.length) {
      await supabase.from("visual_collection_assets").upsert(rows, { onConflict: "collection_id,asset_id", ignoreDuplicates: true });
      // set icon/cover from first asset
      await supabase.from("visual_collections").update({ icon_asset_id: assets[0].id, cover_asset_id: assets[0].id }).eq("id", col.id);
    }
    console.log(`${name}: ${rows.length} assets`);
  }
  const { count } = await supabase.from("visual_collections").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT);
  console.log(`Total collections: ${count}`);
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
