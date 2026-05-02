/* Re-run with error logging so we know which 7 thumbnails failed. */
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

const { data: media } = await supabase.from("product_media").select("url, file_path, product_id").eq("type", "main_image");

const errors = [];
for (let i = 0; i < media.length; i += 8) {
  const batch = media.slice(i, i + 8);
  await Promise.all(batch.map(async m => {
    try {
      const r = await fetch(swap(m.url, "?width=160&quality=75&resize=contain"));
      if (r.status >= 400) errors.push({ status: r.status, file_path: m.file_path });
    } catch (e) {
      errors.push({ error: String(e), file_path: m.file_path });
    }
  }));
}
console.log(`${errors.length} errors:`);
console.log(JSON.stringify(errors, null, 2));
