import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  TODO_ATTACHMENT_BUCKET,
  TODO_ATTACHMENT_MAX_BYTES,
  TODO_ATTACHMENT_TYPES,
  cleanAttachmentName,
  contentMatchesType,
  todoAttachmentUrl,
} from "@/lib/server/todo-attachments";

/* ---------------------------------------------------------------------------
   POST /api/todos/upload — attach a file/screenshot to a task.

   Writes to the `todo-attachments` bucket under a tenant-scoped path
   `${tenant_id}/${uuid}.${ext}` and returns the metadata the TaskModal stores
   on the task (koleex_todos.metadata.attachments[]).

   `url` is the SESSION-GATED link /api/todos/attachment?path=… — it signs a
   short-lived URL for a signed-in member of the same tenant, so it keeps
   working once the bucket is private. `public_url` is the bucket's public
   URL, returned while the bucket is still public for older screens.

   Images (png/jpg/webp/gif) + common docs (pdf, doc/x, xls/x, csv, txt),
   10 MB max, and the first bytes must match the declared type. Requires
   To-do create permission.
   --------------------------------------------------------------------------- */

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;
  /* The tenant prefix is the object's only scoping; a session without one
     must not upload under the literal folder "null". */
  if (!auth.tenant_id) {
    return NextResponse.json({ error: "No tenant on this session." }, { status: 403 });
  }

  /* Refuse an oversized body before parsing it into memory. */
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > TODO_ATTACHMENT_MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const type = file.type;
  const ext = TODO_ATTACHMENT_TYPES[type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: images, PDF, Word, Excel, CSV, TXT." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > TODO_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 413 });
  }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!contentMatchesType(ext, head)) {
    return NextResponse.json({ error: "The file's contents do not match its type." }, { status: 400 });
  }

  const name = cleanAttachmentName(form.get("name") ?? (file instanceof File ? file.name : ""), `file.${ext}`);
  const path = `${auth.tenant_id}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseServer.storage
    .from(TODO_ATTACHMENT_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: type });
  if (error) {
    console.error("[api/todos/upload]", error.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { data: pub } = supabaseServer.storage.from(TODO_ATTACHMENT_BUCKET).getPublicUrl(data.path);
  return NextResponse.json({
    attachment: {
      path: data.path,
      url: todoAttachmentUrl(data.path),
      public_url: pub.publicUrl,
      name,
      type,
      size: file.size,
    },
  });
}
