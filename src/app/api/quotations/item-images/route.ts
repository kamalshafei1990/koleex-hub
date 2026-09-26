import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/quotations/item-images — one product photo for a quotation line.

   The editor used to keep every line photo INSIDE the document as a base64
   data URL (compressed to ≤300px, still ~10 KB each). Fifty-nine photos made
   the quotation JSON half a megabyte, moved in full on every open, save,
   list refresh and PDF render — the "opening takes long, and the items too"
   the owner reported. Photos now land in the public media bucket and the
   document stores the URL; the browser fetches and caches them in parallel.

   multipart: file=<image>. Answers { url }. Needs Quotations edit OR create
   (the person saving the document is the one uploading its photos).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

const BUCKET = "media";
const MAX_BYTES = 2 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denyEdit = await requireModuleAction(auth, "Quotations", "edit");
  if (denyEdit) {
    const denyCreate = await requireModuleAction(auth, "Quotations", "create");
    if (denyCreate) return denyCreate;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 2 MB." }, { status: 413 });
  }
  const mime = (file as File).type || "image/jpeg";
  const ext = EXT[mime];
  if (!ext) {
    return NextResponse.json({ error: "Only PNG, JPEG or WebP images." }, { status: 415 });
  }

  const path = `quotation-items/${auth.tenant_id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[api/quotations/item-images]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
  const url = supabaseServer.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}
