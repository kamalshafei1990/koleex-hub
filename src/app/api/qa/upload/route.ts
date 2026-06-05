import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   POST /api/qa/upload — screenshot for a QA issue report.

   Any authenticated user may upload. The file goes to the private
   `qa-screenshots` bucket under a tenant-scoped path:
       ${tenant_id}/${uuid}.${ext}
   Returns { path } — the report submit stores this path; the admin API
   resolves it to a short-lived signed URL on read, so screenshots never leak
   across tenants. Images only (png/jpeg/webp), 5 MB max.
   --------------------------------------------------------------------------- */

const BUCKET = "qa-screenshots";
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  // No `req` passed → uploading a screenshot is allowed even while viewing-as.
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const type = file.type;
  if (!MIME_EXT[type]) {
    return NextResponse.json(
      { error: "Only PNG, JPG or WEBP images are allowed." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Screenshot is too large (max 5 MB)." },
      { status: 400 },
    );
  }

  const path = `${auth.tenant_id}/${randomUUID()}.${MIME_EXT[type]}`;
  const { data, error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: type });

  if (error) {
    console.error("[api/qa/upload]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
  return NextResponse.json({ path: data.path });
}
