import "server-only";

/* POST /api/me/hr/upload — a leave attachment (medical certificate, ticket)
   uploaded by the employee for their OWN request. Same private bucket, same
   tenant-prefixed random path as /api/hr/upload, but no HR permission: the
   file only ever becomes visible by being attached to a request the caller
   files for themselves. Folder is fixed to `leave` — the employee cannot
   write into documents/payroll. */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";

const BUCKET = "hr-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const ext = MIME_EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported file type. Allowed: images, PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 400 });

  const path = `${auth.tenant_id}/leave/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseServer.storage.from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) {
    console.error("[api/me/hr/upload]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
  const name = (form.get("name") as string | null)?.toString().slice(0, 200) || `document.${ext}`;
  return NextResponse.json({ attachment: { bucket: BUCKET, path: data.path, name, type: file.type, size: file.size } });
}
