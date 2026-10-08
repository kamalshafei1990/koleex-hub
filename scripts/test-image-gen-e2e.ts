/* End-to-end proof of the KOLEEX AI image adapter, using the REAL code path:
   src/lib/server/ai/image-gen.ts generateImage() + real Supabase media bucket store,
   mirroring what tools/image-gen.ts does in production. */
import { generateImage, EXT_FOR, type ImageMime } from "../src/lib/server/ai/image-gen";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function store(bytes: Uint8Array, mime: ImageMime): Promise<string | null> {
  const path = `ai-generated/test-run/adapter-proof/${crypto.randomUUID()}.${EXT_FOR[mime]}`;
  const { error } = await admin.storage.from("media").upload(path, bytes, {
    contentType: mime, upsert: false, cacheControl: "31536000",
  });
  if (error) { console.error("store failed:", error.message); return null; }
  const { data } = admin.storage.from("media").getPublicUrl(path);
  return data.publicUrl || null;
}

async function main() {
  const outcome = await generateImage(
    "A single minimalist black sewing machine icon on a pure white background, flat design",
    { fetch: globalThis.fetch, store },
  );
  console.log("configured:", outcome.configured);
  if (outcome.configured && outcome.ok) {
    console.log("OK url:", outcome.url);
    console.log("mime:", outcome.mime, "bytes:", outcome.bytes, "ms:", outcome.ms);
  } else if (outcome.configured) {
    console.log("FAILED:", outcome.error, "ms:", outcome.ms);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
