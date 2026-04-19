import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET  /api/ai/conversations — list caller's conversations (most-recent first)
   POST /api/ai/conversations — create a new empty conversation */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, last_preview, message_count, created_at, updated_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .insert({
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      title: body.title?.trim() || "New chat",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
