import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { NOTES_BUCKET, NOTES_IMAGE_NAME_RE } from "@/lib/notes-policy";
import { canRead, getNoteAccess, noteImagePrefix } from "@/lib/notes-server";

/* GET /api/notes/[id]/images/[name] — serve one private note image.
   Checks the caller can read the note (owner, or a sharee while the note is
   not in the trash), then redirects to a short-lived signed URL. The stable
   first-party URL is what the note body stores, so access is re-evaluated
   on every view and revoking a share revokes its images too. */

const TTL_SECONDS = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  if (!NOTES_IMAGE_NAME_RE.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const access = await getNoteAccess(id, auth.account_id);
  if (!access.note || !canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = `${noteImagePrefix(access.note.tenant_id, id)}/${name}`;
  const { data, error } = await supabaseServer.storage
    .from(NOTES_BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${TTL_SECONDS - 60}` },
  });
}
