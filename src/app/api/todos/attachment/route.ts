import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { TODO_ATTACHMENT_BUCKET, isTodoAttachmentPath } from "@/lib/server/todo-attachments";

/* GET /api/todos/attachment?path=<tenant>/<uuid>.<ext>
   Opens a task attachment through the session: the caller must be signed in,
   have the To-do module, and the object must sit under THEIR tenant's prefix
   with the exact shape the upload route writes (no "..", no other folder).
   Answers with a redirect to a short-lived signed URL, so it works as an
   <img src> or <a href> and keeps working once the bucket is made private
   (supabase/migrations/20260926_todo_audit.sql, step 3). */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!auth.tenant_id || !isTodoAttachmentPath(path, auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer.storage
    .from(TODO_ATTACHMENT_BUCKET)
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
