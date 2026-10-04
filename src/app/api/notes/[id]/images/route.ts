import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { NOTES_BUCKET, checkNotesImage, notesImageExt } from "@/lib/notes-policy";
import { canWrite, getNoteAccess, noteImagePrefix } from "@/lib/notes-server";

/* POST /api/notes/[id]/images — upload an image into a note.

   Images used to go to the PUBLIC `media` bucket under a guessable path, so
   a private note's pictures were world-readable. Now they land in the
   private NOTES_BUCKET at `<tenant_id>/<note_id>/<uuid>.<ext>` and the note
   stores a first-party URL (/api/notes/<id>/images/<name>) that re-checks
   note access on every view. Size + MIME are enforced HERE (the editor's
   `accept` is UX only) and again by the bucket's own limits. */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;

  const access = await getNoteAccess(id, auth.account_id);
  if (!access.note || !canWrite(access.role) || access.note.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const verdict = checkNotesImage({ size: file.size, type: file.type });
  if (!verdict.ok) {
    return NextResponse.json(
      { error: verdict.reason === "type" ? "File type not supported" : "File is too large", reason: verdict.reason },
      { status: verdict.reason === "type" ? 415 : 413 },
    );
  }

  const ext = notesImageExt(file.type) as string;
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `${noteImagePrefix(access.note.tenant_id, id)}/${name}`;

  const { error } = await supabaseServer.storage
    .from(NOTES_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (error) {
    console.error("[api/notes/[id]/images POST]", error.message);
    return NextResponse.json({ error: "Upload failed", reason: "upload" }, { status: 500 });
  }

  return NextResponse.json({ src: `/api/notes/${id}/images/${name}` });
}
