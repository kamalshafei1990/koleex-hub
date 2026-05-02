/* Three source photos exceed Supabase image-transform's 25 MB limit
   so the CDN /render/image/ endpoint returns 400 for them. Use the
   built-in macOS `sips` tool to resize each to max 2000 px wide,
   re-encode as JPEG, and overwrite the original in Supabase Storage. */

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

const FIXES = [
  {
    src: "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos/Industrial Sewing Machines/004Pro.png",
    storagePath: "products/1777239593248_004pro.png",
  },
  {
    src: "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos/Industrial Sewing Machines/004Lite.png",
    storagePath: "products/1777239573390_004lite.png",
  },
  {
    src: "/Users/kamalshafei/Desktop/Koleex HUB/catalog Photos/Industrial Sewing Machines/XSI-1404PMD.png",
    storagePath: "products/1777239692037_xsi-1404pmd.png",
  },
];

const tmp = os.tmpdir();

for (const f of FIXES) {
  const out = path.join(tmp, path.basename(f.storagePath));

  // sips: resample to max 2000 px on the larger side (preserves aspect ratio).
  // PNG → PNG with reduced size keeps the alpha channel intact.
  execFileSync("sips", [
    "-Z", "2000",                   // resample-to bounding box (max larger side)
    f.src,
    "--out", out,
  ], { stdio: "ignore" });

  const bytes = await fs.readFile(out);
  console.log(`${path.basename(f.src)}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB after resize`);

  const { error } = await supabase.storage
    .from("media")
    .upload(f.storagePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    console.error(`  upload failed: ${error.message}`);
    continue;
  }
  console.log(`  ✓ overwritten in storage`);
}
