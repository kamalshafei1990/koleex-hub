/* Resize every imported source PNG to max 2000 px on the larger
   side, overwriting the file in Supabase Storage. After this, the
   /render/image/ transforms run much faster (small source → small
   resize) and bandwidth drops 5–10× on the hero / gallery views. */

import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
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

// Map storage file_path back to the original on disk via product_name
// (we set product_name = filename stem during import; storage path is
// "products/<timestamp>_<slug>.png", and the source on disk lives in
// catalog Photos/<folder>/<product_name>.<ext>).
const ROOT = "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos";
const FOLDER_BY_CAT = {
  "industrial-sewing-machines":   "Industrial Sewing Machines",
  "automatic-sewing-systems":     "Automatic Sewing Systems",
  "cutting-equipment":            "Cutting Equipment",
  "embroidery-equipment":         "Embroidery Equipment",
  "fabric-preparation":           "Fabric Preparation",
  "finishing-equipment":          "Finishing Equipment",
  "domestic-sewing-machines":     "Household Sewing Machines",
  "leather-footwear-machinery":   "Leather & Footwear Machinery",
  "packing-inspection":           "Packing & Inspection",
  "printing-heat-press-equipment":"Printing & Heat Press Equipment",
};

const { data: rows, error } = await supabase
  .from("product_media")
  .select("file_path, product_id, products(product_name, category_slug)")
  .eq("type", "main_image");
if (error) throw error;

console.log(`Resizing ${rows.length} source photos…`);
const tmp = os.tmpdir();
let done = 0, failed = 0, totalBefore = 0, totalAfter = 0;

const CONCURRENCY = 4;
const queue = [...rows];

async function worker() {
  while (queue.length) {
    const r = queue.shift();
    if (!r) break;
    const productName = r.products?.product_name;
    const catSlug = r.products?.category_slug;
    const folder = FOLDER_BY_CAT[catSlug];
    if (!productName || !folder) {
      failed++;
      console.error(`  ✗ ${r.file_path}: missing product / category`);
      continue;
    }

    // Find original on disk — the filename equals product_name with
    // some extension (.png/.jpg/.jpeg/.webp).
    const folderPath = path.join(ROOT, folder);
    let srcPath = null;
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      const cand = path.join(folderPath, productName + ext);
      try { await fs.access(cand); srcPath = cand; break; } catch {}
    }
    if (!srcPath) {
      failed++;
      console.error(`  ✗ ${productName} (${catSlug}): source not found`);
      continue;
    }

    const beforeStat = await fs.stat(srcPath);
    totalBefore += beforeStat.size;

    // Skip if already small (< 1.5 MB).
    if (beforeStat.size < 1.5 * 1024 * 1024) {
      const bytes = await fs.readFile(srcPath);
      const ext = path.extname(srcPath).toLowerCase();
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(r.file_path, bytes, {
          contentType: ext === ".png" ? "image/png" : "image/jpeg",
          upsert: true,
        });
      if (upErr) { failed++; console.error(`  ✗ ${productName}: upload ${upErr.message}`); continue; }
      totalAfter += bytes.length;
      done++;
      if (done % 25 === 0) console.log(`  ... ${done}/${rows.length}`);
      continue;
    }

    // Resize via sips → max 2000 px on the larger side. Preserve PNG
    // (so transparency survives the future transforms).
    const out = path.join(tmp, "resz_" + path.basename(r.file_path));
    try {
      execFileSync("sips", ["-Z", "2000", srcPath, "--out", out], { stdio: "ignore" });
    } catch (e) {
      failed++;
      console.error(`  ✗ ${productName}: sips ${e.message}`);
      continue;
    }
    const bytes = await fs.readFile(out);
    totalAfter += bytes.length;

    const ext = path.extname(srcPath).toLowerCase();
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(r.file_path, bytes, {
        contentType: ext === ".png" ? "image/png" : "image/jpeg",
        upsert: true,
      });
    if (upErr) { failed++; console.error(`  ✗ ${productName}: upload ${upErr.message}`); continue; }

    await fs.unlink(out).catch(() => {});
    done++;
    if (done % 25 === 0) {
      const beforeMB = (totalBefore / 1024 / 1024).toFixed(0);
      const afterMB  = (totalAfter  / 1024 / 1024).toFixed(0);
      console.log(`  ... ${done}/${rows.length}   (${beforeMB} MB → ${afterMB} MB so far)`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

console.log(`\nDone. ${done} resized + uploaded. ${failed} failed.`);
console.log(`Storage: ${(totalBefore/1024/1024).toFixed(0)} MB → ${(totalAfter/1024/1024).toFixed(0)} MB`);
