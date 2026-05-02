/* Retry the 2 files that failed in the main import. */
import fs from "node:fs/promises";
import path from "node:path";
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

const RETRIES = [
  {
    fullPath: "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos/Household Sewing Machines/XSH-510.png",
    stem: "XSH-510",
    cat: "domestic-sewing-machines",
    sub: "household-lockstitch-machines",
  },
  {
    fullPath: "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos/Industrial Sewing Machines/XSI-7787A-35W.png",
    stem: "XSI-7787A-35W",
    cat: "industrial-sewing-machines",
    sub: "lockstitch-machines",
  },
];

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

for (const r of RETRIES) {
  try {
    const photoBytes = await fs.readFile(r.fullPath);
    const ext = path.extname(r.fullPath).toLowerCase();
    const slug = toSlug(r.stem);
    const storagePath = `products/${Date.now()}_${slug}${ext}`;

    console.log(`Trying ${r.stem} (${(photoBytes.length / 1024 / 1024).toFixed(2)} MB)...`);

    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(storagePath, photoBytes, {
        contentType: ext === ".png" ? "image/png" : "image/jpeg",
        upsert: true,
      });
    if (upErr) {
      console.error(`  upload failed: ${upErr.message} (status=${upErr.statusCode})`);
      continue;
    }

    const { data: pub } = supabase.storage.from("media").getPublicUrl(storagePath);

    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .insert({
        product_name: r.stem,
        slug,
        division_slug: "garment-machinery",
        category_slug: r.cat,
        subcategory_slug: r.sub,
        status: "draft",
        visible: false,
      })
      .select("id")
      .single();
    if (prodErr) {
      console.error(`  product insert failed: ${prodErr.message}`);
      continue;
    }

    const { error: mediaErr } = await supabase.from("product_media").insert({
      product_id: prod.id,
      type: "main_image",
      url: pub.publicUrl,
      file_path: storagePath,
      order: 0,
    });
    if (mediaErr) {
      console.error(`  media insert failed: ${mediaErr.message}`);
      continue;
    }

    console.log(`  ✓ imported ${r.stem}`);
  } catch (e) {
    console.error(`  exception: ${e.message || e}`);
  }
}
