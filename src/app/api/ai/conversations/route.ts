import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { dbError } from "@/lib/server/ai/http/api-error";
import { clientConversationId, insertConversation } from "@/lib/server/ai/new-conversation";

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
  if (error) return dbError("conversations", error);
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    project_id?: unknown;
    id?: unknown;
  };

  /* THE CLIENT MAY NAME THE ROW, so asking twice makes one chat (owner,
     2026-09-26, from the phone: "couldn't start a new chat" six times while
     six empty rows landed here). lib/server/ai/new-conversation holds the
     rules; the first turn of /api/ai/agent uses the same ones. */
  const made = await insertConversation(auth, {
    id: clientConversationId(body.id),
    title: body.title,
    projectId: body.project_id,
  });
  if (made.ok) return NextResponse.json({ conversation: made.row });
  if (made.conflict) return NextResponse.json({ error: "conflict" }, { status: 409 });
  return dbError("conversations", made.error);
}
