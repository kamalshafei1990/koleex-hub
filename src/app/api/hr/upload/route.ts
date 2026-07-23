import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   POST /api/hr/upload — attach a document or photo to an HR record.

   Unlike /api/todos/upload this writes to a PRIVATE bucket and returns the
   storage PATH, not a public URL: leave attachments are medical certificates,
   marriage certificates and the like, and a public bucket would make every one
   of them readable by anyone holding the link. Viewers mint a short-lived
   signed URL through /api/storage/signed-url, which verifies the tenant prefix
   before signing.

   Path: `${tenant_id}/${folder}/${uuid}.${ext}` — tenant-prefixed so the
   storage-tenant guard can reject cross-tenant reads, random so it cannot be
   enumerated.
   --------------------------------------------------------------------------- */

const BUCKET = "hr-documents";
const MAX_BYTES = 10 * 1024 * 1024;

/** Photos of a paper certificate are the common case, so images matter as
 *  much as PDFs here. HEIC included — it is what an iPhone camera produces. */
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

/** Folders the HR app may write into — keeps the bucket organised and stops
 *  an arbitrary client-supplied path from shaping storage layout. */
const FOLDERS = new Set(["leave", "documents", "payroll", "training"]);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "create");
  if (deny) return deny;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const type = file.type;
  const ext = MIME_EXT[type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: images, PDF, Word, Excel, TXT." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 400 });
  }

  const folderRaw = (form.get("folder") as string | null)?.toString() ?? "leave";
  const folder = FOLDERS.has(folderRaw) ? folderRaw : "leave";
  const name =
    (form.get("name") as string | null)?.toString().slice(0, 200) || `document.${ext}`;

  const path = `${auth.tenant_id}/${folder}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: type });

  if (error) {
    console.error("[api/hr/upload]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  return NextResponse.json({
    attachment: { bucket: BUCKET, path: data.path, name, type, size: file.size },
  });
}
