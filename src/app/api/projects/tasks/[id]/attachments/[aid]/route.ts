import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; aid: string }> };

const BUCKET = "project-attachments";

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, aid } = await params;

  const { data: row } = await supabaseServer
    .from("project_task_attachments")
    .select("file_path")
    .eq("id", aid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabaseServer.storage.from(BUCKET).remove([row.file_path as string]);

  const { error } = await supabaseServer
    .from("project_task_attachments")
    .delete()
    .eq("id", aid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
