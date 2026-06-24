import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   POST /api/todos/upload — attach a file/screenshot to a task.

   Writes to the public `todo-attachments` bucket under a tenant-scoped path
   `${tenant_id}/${uuid}.${ext}` and returns the metadata the TaskModal stores
   on the task (koleex_todos.metadata.attachments[]). Public read keeps the
   client simple; the path is tenant-prefixed + random so it's unguessable.

   Images (png/jpg/webp/gif) + common docs (pdf, doc/x, xls/x, csv, txt),
   10 MB max. Requires To-do create permission.
   --------------------------------------------------------------------------- */

const BUCKET = "todo-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
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
      { error: "Unsupported file type. Allowed: images, PDF, Word, Excel, CSV, TXT." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 400 });
  }

  const rawName =
    (form.get("name") as string | null)?.toString().slice(0, 200) || `file.${ext}`;
  const path = `${auth.tenant_id}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: type });
  if (error) {
    console.error("[api/todos/upload]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { data: pub } = supabaseServer.storage.from(BUCKET).getPublicUrl(data.path);
  return NextResponse.json({
    attachment: {
      path: data.path,
      url: pub.publicUrl,
      name: rawName,
      type,
      size: file.size,
    },
  });
}
