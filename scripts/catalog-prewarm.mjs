/* Pre-warm Supabase Storage image transforms for every product photo.
   Hits the thumbnail (160 px), card (480 px) and gallery (1400 px)
   transforms once each so the first user that views the list / detail
   pages gets the cached version instead of paying the cold-render
   cost on a 9 MB source PNG.

   Runs in parallel batches of 16 to keep things tame on the free tier. */

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

function thumb(url)   { return swap(url, "?width=160&quality=75&resize=contain"); }
function card(url)    { return swap(url, "?width=480&quality=75&resize=contain"); }

function swap(url, query) {
  if (!url || !url.includes(OBJECT)) return url;
  return url.replace(OBJECT, RENDER) + query;
}

async function warmOne(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return { url, status: res.status, size: Number(res.headers.get("content-length") || 0) };
  } catch (e) {
    return { url, error: String(e) };
  }
}

const { data: media, error } = await supabase
  .from("product_media")
  .select("url")
  .eq("type", "main_image");
if (error) throw error;

const urls = media.map(m => m.url).filter(Boolean);
console.log(`Pre-warming ${urls.length} photos × 2 sizes (thumb + card) = ${urls.length * 2} requests`);

const tasks = urls.flatMap(u => [thumb(u), card(u)]);

const BATCH = 16;
let done = 0;
let bytes = 0;
let errors = 0;

for (let i = 0; i < tasks.length; i += BATCH) {
  const batch = tasks.slice(i, i + BATCH);
  const results = await Promise.all(batch.map(warmOne));
  for (const r of results) {
    done++;
    if (r.error || (r.status && r.status >= 400)) errors++;
    else bytes += r.size || 0;
  }
  if (done % 100 < BATCH) {
    process.stdout.write(`  ... ${done} / ${tasks.length} (${(bytes / 1024 / 1024).toFixed(1)} MB warmed, ${errors} errors)\n`);
  }
}

console.log(`\nDone. ${done} requests, ${(bytes / 1024 / 1024).toFixed(1)} MB cached, ${errors} errors.`);
