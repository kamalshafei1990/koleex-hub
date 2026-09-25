import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyTaskComment } from "@/lib/server/project-notify";
import { assertTaskAccess, assertTaskWrite } from "@/lib/server/project-access";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_task_comments")
    .select(`*, author:author_account_id ( id, username )`)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/projects/tasks/:id/comments GET]", error.message);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskWrite(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_task_comments")
    .insert({
      tenant_id: auth.tenant_id,
      task_id: id,
      author_account_id: auth.account_id,
      body: body.trim().slice(0, 5000),
    })
    .select(`*, author:author_account_id ( id, username )`)
    .single();
  if (error) {
    console.error("[api/projects/tasks/:id/comments POST]", error.message);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }

  // After the response: ping the task's assignee + followers (inbox + push).
  after(() => notifyTaskComment(auth, id, body));

  return NextResponse.json({ comment: data });
}
