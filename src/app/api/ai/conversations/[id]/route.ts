import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET    /api/ai/conversations/:id — conversation + ordered messages
   PATCH  /api/ai/conversations/:id — rename
   DELETE /api/ai/conversations/:id — hard delete (cascades to messages) */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const [cvRes, msgRes] = await Promise.all([
    supabaseServer
      .from("ai_conversations")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .maybeSingle(),
    supabaseServer
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (cvRes.error) return NextResponse.json({ error: cvRes.error.message }, { status: 500 });
  if (!cvRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    conversation: cvRes.data,
    messages: msgRes.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await req.json()) as { title?: string };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .update({ title: body.title.trim() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { error } = await supabaseServer
    .from("ai_conversations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
