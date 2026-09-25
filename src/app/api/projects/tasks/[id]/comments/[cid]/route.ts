import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskAccess, canModerate } from "@/lib/server/project-access";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; cid: string }> };

/* DELETE — the comment's author, the project manager or a super admin. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, cid } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data: row } = await supabaseServer
    .from("project_task_comments")
    .select("id, author_account_id")
    .eq("id", cid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.author_account_id !== auth.account_id && !canModerate(auth, gate.project)) {
    return NextResponse.json({ error: "Only the author or the project manager can delete this comment" }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("project_task_comments")
    .delete()
    .eq("id", cid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/tasks/:id/comments/:cid DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
