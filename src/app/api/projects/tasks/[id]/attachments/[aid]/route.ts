import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskWrite } from "@/lib/server/project-access";
import { removeTaskAttachmentFiles } from "@/lib/server/project-files";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; aid: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, aid } = await params;
  const gate = await assertTaskWrite(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data: row } = await supabaseServer
    .from("project_task_attachments")
    .select("file_path")
    .eq("id", aid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("project_task_attachments")
    .delete()
    .eq("id", aid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/tasks/:id/attachments/:aid DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
  /* Row first, object second: a failed row delete must not leave a row
     pointing at a missing object. */
  await removeTaskAttachmentFiles([row.file_path as string]);
  return NextResponse.json({ ok: true });
}
