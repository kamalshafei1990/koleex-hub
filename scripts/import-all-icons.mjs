/* ---------------------------------------------------------------------------
   import-all-icons.mjs — import the ENTIRE General Icons pack (5,047) into the
   Visual Library as a browsable Draft pool.

   · Maps each of the 49 Flaticon folders → one of the 20 KOLEEX categories
     (off-domain folders → "Miscellaneous" so they don't pollute the real ones).
   · Normalizes every SVG (fill=currentColor, strip width/height) and uploads to
     media/visual-library/pack/<category>/<basename>.svg.
   · Inserts a registry row per icon: approval_status='draft', source='flaticon-pack',
     subcategory = original folder label, is_variant for -alt / numeric siblings.
   · Idempotent: skips files already imported (by source_name). Unique slug per tenant.

   Run:  node scripts/import-all-icons.mjs
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = "490fbd4d-f3e8-44fa-83e6-ee26f961d5ca";
const PACK_ROOT = "/tmp/icon_full/General Icons/svg";
const BUCKET = "media";
const CONCURRENCY = 24;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Flaticon folder → { cat (KOLEEX key), code }. Off-domain → misc.
const CAT = {
  navigation: "NAV", actions: "ACT", status: "STAT", communication: "COMM", users: "USR",
  finance: "FIN", inventory: "INV", analytics: "ANL", ai: "AI", files: "FILE", security: "SEC",
  business: "BIZ", commerce: "COM", manufacturing: "MFG", time: "TIME", devices: "DEV",
  database: "SYS", maps: "MAP", documents: "DOC", misc: "MISC",
};
const FOLDER_MAP = {
  "Arrows-and-Direction": "navigation", "UI-and-Interface": "actions", "Editing-and-Text": "actions",
  "Symbols-and-Signs": "status", "Security-and-Safety": "security", "Communication": "communication",
  "People-and-Users": "users", "Hands-and-Gestures": "users",
  "Business-and-Finance": "finance", "Money-and-Currency": "finance",
  "Charts-and-Analytics": "analytics", "Shopping-and-E-commerce": "commerce",
  "Transportation-and-Vehicles": "inventory", "Maps-and-Location": "maps",
  "Buildings-and-Real-Estate": "business", "Files-and-Folders": "files",
  "Photography-and-Camera": "files", "Multimedia-Controls": "files", "Music-and-Audio": "files",
  "Technology-and-Computing": "devices", "Devices-and-Hardware": "devices",
  "Time-and-Calendar": "time", "Tools-and-Construction": "manufacturing", "Science-and-Lab": "manufacturing",
  "Office-and-Stationery": "documents", "Education-and-Learning": "documents", "Law-and-Justice": "documents",
  "Travel-and-Tourism": "maps",
  // Off-domain → misc
  "Animals-and-Pets": "misc", "Astronomy-and-Space": "misc", "Beauty-and-Cosmetics": "misc",
  "Body-and-Anatomy": "misc", "Clothing-and-Fashion": "misc", "Drinks-and-Beverages": "misc",
  "Faces-and-Emojis": "misc", "Food-and-Cooking": "misc", "Fruits-and-Vegetables": "misc",
  "Games-and-Toys": "misc", "Holidays-and-Celebrations": "misc", "Home-and-Furniture": "misc",
  "Medical-and-Health": "misc", "Nature-and-Plants": "misc", "Numbers-and-Letters": "misc",
  "Religion-and-Spirituality": "misc", "Sports-and-Fitness": "misc", "Weather": "misc",
  "Energy-and-Environment": "misc", "Other": "misc",
};
const folderLabel = (f) => f.replace(/-and-/g, " & ").replace(/-/g, " ");

function normalizeSvg(raw) {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}
const viewboxOf = (raw) => (raw.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? "0 0 24 24";
const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const codeName = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20) || "ICON";

async function pool(items, n, fn) {
  let i = 0; const results = [];
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return results;
}

async function run() {
  if (!existsSync(PACK_ROOT)) { console.error("Pack not found:", PACK_ROOT); process.exit(1); }

  // Build the work list
  const files = [];
  for (const folder of readdirSync(PACK_ROOT)) {
    let list; try { list = readdirSync(join(PACK_ROOT, folder)); } catch { continue; }
    for (const f of list) {
      if (!f.endsWith(".svg")) continue;
      files.push({ folder, file: f, base: f.replace(/^fi-rr-/, "").replace(/\.svg$/, "").toLowerCase() });
    }
  }
  console.log(`Pack files: ${files.length}`);

  // Existing rows (idempotency + slug uniqueness)
  const existing = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("visual_assets").select("slug, source_name")
      .eq("tenant_id", TENANT).range(from, from + 999);
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < 1000) break;
  }
  const haveSource = new Set(existing.map((r) => (r.source_name || "").toLowerCase()).filter(Boolean));
  const usedSlugs = new Set(existing.map((r) => r.slug).filter(Boolean));
  console.log(`Existing rows: ${existing.length}`);

  const todo = files.filter((f) => !haveSource.has(`fi-rr-${f.base}`) && !haveSource.has(f.base));
  console.log(`To import: ${todo.length}`);

  const seqByCat = {};
  const rows = [];
  let uploaded = 0, upErrors = 0;

  await pool(todo, CONCURRENCY, async (f) => {
    const cat = FOLDER_MAP[f.folder] ?? "misc";
    const catCode = CAT[cat] ?? "MISC";
    // unique slug
    let slug = f.base;
    if (usedSlugs.has(slug)) slug = `${f.base}-${catCode.toLowerCase()}`;
    let n = 2; while (usedSlugs.has(slug)) slug = `${f.base}-${n++}`;
    usedSlugs.add(slug);

    let raw; try { raw = readFileSync(join(PACK_ROOT, f.folder, f.file), "utf8"); } catch { return; }
    const norm = normalizeSvg(raw);
    const path = `visual-library/pack/${cat}/${slug}.svg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(norm, "utf8"), {
      contentType: "image/svg+xml", upsert: true,
    });
    if (error) { upErrors++; return; }
    uploaded++;
    if (uploaded % 500 === 0) console.log(`  uploaded ${uploaded}…`);

    seqByCat[catCode] = (seqByCat[catCode] ?? 0) + 1;
    const isVariant = /-alt$|-\d+$/.test(f.base);
    rows.push({
      tenant_id: TENANT,
      visual_asset_code: `ICO-${catCode}-${codeName(f.base)}-${String(seqByCat[catCode]).padStart(4, "0")}`,
      slug,
      source_name: `fi-rr-${f.base}`,
      title: titleCase(f.base),
      asset_type: "icon",
      category: cat,
      subcategory: folderLabel(f.folder),
      flaticon_folder: f.folder,
      keywords: f.base.split("-").filter(Boolean).slice(0, 6),
      tags: [cat, ...f.base.split("-").filter(Boolean)].slice(0, 6),
      search_aliases: [f.base, `fi-rr-${f.base}`],
      style: "outline",
      file_type: "svg",
      storage_bucket: BUCKET,
      svg_path: path,
      viewbox: viewboxOf(raw),
      mime_type: "image/svg+xml",
      file_size: Buffer.byteLength(norm),
      is_variant: isVariant,
      source: "flaticon-pack",
      approval_status: "draft",
    });
  });

  console.log(`Uploaded ${uploaded} (errors ${upErrors}). Inserting ${rows.length} rows…`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("visual_assets").insert(chunk);
    if (error) { console.warn(`  insert chunk @${i} failed: ${error.message}`); }
    else { inserted += chunk.length; }
  }

  const { count } = await supabase.from("visual_assets").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT);
  console.log(`\nDone. inserted=${inserted} total-in-registry=${count}`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
