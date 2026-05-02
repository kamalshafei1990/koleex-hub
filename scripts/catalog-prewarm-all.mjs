/* Re-pre-warm thumb + card + hero for every product after the
   source-shrink pass. Earlier prewarm cached transforms based on
   the OLD big sources — Supabase usually re-renders when the source
   has been overwritten, but explicitly hitting each URL once
   guarantees the new compact transforms are at the edge. */

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

const OBJECT = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";
const swap = (url, q) => url.replace(OBJECT, RENDER) + q;

const { data: media } = await supabase.from("product_media").select("url").eq("type", "main_image");

const sizes = [
  ["thumb",   "?width=160&quality=75&resize=contain"],
  ["card",    "?width=480&quality=75&resize=contain"],
  ["hero",    "?width=1400&quality=78&resize=contain"],
];

const tasks = [];
for (const m of media) {
  for (const [, q] of sizes) tasks.push(swap(m.url, q));
}

console.log(`Pre-warming ${media.length} products × ${sizes.length} sizes = ${tasks.length} requests`);

let done = 0, errors = 0, bytes = 0;
const BATCH = 12;
for (let i = 0; i < tasks.length; i += BATCH) {
  const batch = tasks.slice(i, i + BATCH);
  const results = await Promise.all(batch.map(async u => {
    try {
      const r = await fetch(u);
      if (!r.ok) return { error: r.status };
      const ab = await r.arrayBuffer();
      return { size: ab.byteLength };
    } catch (e) { return { error: String(e) }; }
  }));
  for (const r of results) {
    done++;
    if (r.error) errors++;
    else bytes += r.size;
  }
  if (done % 200 < BATCH) {
    process.stdout.write(`  ... ${done} / ${tasks.length}  (${(bytes/1024/1024).toFixed(0)} MB cached, ${errors} err)\n`);
  }
}

console.log(`\nDone. ${done} requests, ${(bytes/1024/1024).toFixed(0)} MB cached, ${errors} errors.`);
