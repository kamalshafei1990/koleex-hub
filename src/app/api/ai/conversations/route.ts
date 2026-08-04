import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";

/* GET  /api/ai/conversations — list caller's conversations (most-recent first)
   POST /api/ai/conversations — create a new empty conversation */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .select(
      "id, title, last_preview, message_count, created_at, updated_at, pinned, project_id",
    )
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    /* Pinned first, then most-recent. The sidebar re-groups client-side, but
       ordering here means a pinned chat is already at the top of the cached
       payload on a cold start, before any grouping runs. */
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    project_id?: unknown;
  };

  /* Starting a chat from inside a project drops it straight into that folder.
     The id is verified to belong to this caller first — an unowned or unknown
     id yields an ungrouped chat rather than a foreign-key error the user
     would see as "failed to start chat". */
  let projectId: string | null = null;
  if (typeof body.project_id === "string" && body.project_id) {
    const { data: owned } = await supabaseServer
      .from("ai_projects")
      .select("id")
      .eq("id", body.project_id)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .maybeSingle();
    projectId = owned?.id ?? null;
  }

  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .insert({
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      title: body.title?.trim() || "New chat",
      project_id: projectId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
