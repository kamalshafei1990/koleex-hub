import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* PATCH /api/qa/comments/[id] — edit a comment's message (author or admin).
   Stamps edited_at so the UI can show "(edited)". */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("qa_issue_comments")
    .update({ message: message.slice(0, 8000), edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ comment: data });
}

/* DELETE /api/qa/comments/[id] — remove a comment (admin). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const { error } = await supabaseServer
    .from("qa_issue_comments")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
