/* ---------------------------------------------------------------------------
   Catalog photo bulk import.

   Reads every photo in /catalog Photos/<Category>/<filename> and creates:
     · a product row (status=draft, visible=false so they don't go live)
     · a product_media row pointing at the uploaded photo
     · the photo itself uploaded to the Supabase Storage `media` bucket

   Conventions:
     · `product_name` and `model_name` come from the filename (sans ext)
     · `slug` is the kebab-case lowercase form, deduped on collision
     · `division_slug` is always "garment-machinery"
     · `category_slug` + default `subcategory_slug` come from the folder map

   Skip rules (per user):
     · skip the entire "Accessories Spare Parts" folder
     · skip files whose stem is purely numeric (01, 02, 1, 2, 3)
     · skip files whose stem contains parentheses (descriptive labels)
     · skip files whose stem starts with "Image-" or "image" (auto-named)

   Run:
     node scripts/catalog-import.mjs
   --------------------------------------------------------------------------- */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Load env vars from .env.local
const envPath = "/Users/kamalshafei/Desktop/Koleex HUB/.env.local";
const envText = await fs.readFile(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROOT = "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos";

/* Folder → (category_slug, default subcategory_slug) map.
   "Accessories Spare Parts" intentionally absent — skipped entirely. */
const FOLDER_MAP = {
  "Industrial Sewing Machines":      { cat: "industrial-sewing-machines",   sub: "lockstitch-machines" },
  "Automatic Sewing Systems":        { cat: "automatic-sewing-systems",     sub: "bartacking-machines" },
  "Cutting Equipment":               { cat: "cutting-equipment",            sub: "straight-knife-cutting-machines" },
  "Embroidery Equipment":            { cat: "embroidery-equipment",         sub: "computerized-embroidery-machines" },
  "Fabric Preparation":              { cat: "fabric-preparation",           sub: "spreading-machines" },
  "Finishing Equipment":             { cat: "finishing-equipment",          sub: "steam-irons" },
  "Household Sewing Machines":       { cat: "domestic-sewing-machines",     sub: "household-lockstitch-machines" },
  "Leather & Footwear Machinery":    { cat: "leather-footwear-machinery",   sub: "leather-sewing-machines" },
  "Packing & Inspection":            { cat: "packing-inspection",           sub: "packing-tables" },
  "Printing & Heat Press Equipment": { cat: "printing-heat-press-equipment",sub: "heat-press-machines" },
};

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function shouldSkipFile(stem) {
  if (/^\d+$/.test(stem)) return "purely-numeric";
  if (/[()]/.test(stem)) return "descriptive-with-parens";
  if (/^Image[-_\s]/i.test(stem) || stem === "image") return "auto-named";
  if (stem.length < 2) return "too-short";
  return null;
}

function toSlug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function main() {
  const folders = await fs.readdir(ROOT);
  const dryRun = process.argv.includes("--dry");
  const limit = parseInt(process.argv.find(a => a.startsWith("--limit="))?.slice(8) || "0", 10);

  const stats = { imported: 0, skipped: 0, byCategory: {}, errors: [] };
  const usedSlugs = new Set();

  for (const folder of folders) {
    if (folder.startsWith(".")) continue;
    if (folder === "Accessories Spare Parts") {
      console.log(`SKIP folder (per user): ${folder}`);
      continue;
    }
    const map = FOLDER_MAP[folder];
    if (!map) {
      console.log(`UNMAPPED folder: ${folder}`);
      continue;
    }
    const folderPath = path.join(ROOT, folder);
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(folderPath);
    let folderImported = 0, folderSkipped = 0;

    for (const file of files) {
      if (file.startsWith(".")) continue;
      const fullPath = path.join(folderPath, file);
      const fileStat = await fs.stat(fullPath);
      if (fileStat.isDirectory()) {
        // Skip nested subdirs (Spare Parts has 1/ 2/ 3/ — already excluded above)
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const stem = path.basename(file, ext).trim();

      const skipReason = shouldSkipFile(stem);
      if (skipReason) {
        folderSkipped++;
        stats.skipped++;
        continue;
      }

      // Build a unique slug
      let slug = toSlug(stem);
      let n = 2;
      while (usedSlugs.has(slug)) {
        slug = `${toSlug(stem)}-${n++}`;
      }
      usedSlugs.add(slug);

      if (dryRun) {
        console.log(`DRY  ${folder} → ${stem} → slug=${slug} → cat=${map.cat}/${map.sub}`);
        folderImported++;
        stats.imported++;
        continue;
      }

      try {
        // 1. Upload photo to media bucket
        const photoBytes = await fs.readFile(fullPath);
        const storagePath = `products/${Date.now()}_${slug}${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(storagePath, photoBytes, {
            contentType:
              ext === ".png" ? "image/png" :
              ext === ".webp" ? "image/webp" :
              "image/jpeg",
            upsert: false,
          });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const { data: pub } = supabase.storage.from("media").getPublicUrl(storagePath);
        const photoUrl = pub.publicUrl;

        // 2. Insert product (status=draft, visible=false)
        const { data: prod, error: prodErr } = await supabase
          .from("products")
          .insert({
            product_name: stem,
            slug,
            division_slug: "garment-machinery",
            category_slug: map.cat,
            subcategory_slug: map.sub,
            status: "draft",
            visible: false,
          })
          .select("id")
          .single();
        if (prodErr) throw new Error(`product: ${prodErr.message}`);

        // 3. Insert product_media row pointing at the upload
        const { error: mediaErr } = await supabase
          .from("product_media")
          .insert({
            product_id: prod.id,
            type: "main_image",
            url: photoUrl,
            file_path: storagePath,
            order: 0,
          });
        if (mediaErr) throw new Error(`media: ${mediaErr.message}`);

        folderImported++;
        stats.imported++;
        if (stats.imported % 25 === 0) {
          console.log(`  ... ${stats.imported} imported, ${stats.skipped} skipped`);
        }
        if (limit && stats.imported >= limit) break;
      } catch (e) {
        stats.errors.push({ folder, file, error: String(e) });
        console.error(`ERR  ${folder}/${file}: ${e.message || e}`);
      }
    }
    console.log(`${folder}: imported ${folderImported}, skipped ${folderSkipped}`);
    stats.byCategory[folder] = { imported: folderImported, skipped: folderSkipped };
    if (limit && stats.imported >= limit) break;
  }

  console.log("\n══ SUMMARY ══");
  console.log(`Imported: ${stats.imported}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log(`Errors:   ${stats.errors.length}`);
  if (stats.errors.length) console.log(JSON.stringify(stats.errors.slice(0, 10), null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
