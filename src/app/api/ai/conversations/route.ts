import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { dbError } from "@/lib/server/ai/http/api-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
     six empty rows landed here — the row was made, the answer never reached
     the phone). A retry with the same id finds the row it already made; an
     id that is not a UUID is ignored and the database picks one. */
  const clientId = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id.toLowerCase() : null;

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
      ...(clientId ? { id: clientId } : {}),
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      title: body.title?.trim() || "New chat",
      project_id: projectId,
    })
    .select("*")
    .single();
  if (error) {
    /* The same id again: the first ask landed. It is handed back only when
       it is THIS caller's row; anyone else's id is a conflict, and says
       nothing about the row it names. */
    if (clientId && error.code === "23505") {
      const { data: mine } = await supabaseServer
        .from("ai_conversations")
        .select("*")
        .eq("id", clientId)
        .eq("tenant_id", auth.tenant_id)
        .eq("account_id", auth.account_id)
        .maybeSingle();
      if (mine) return NextResponse.json({ conversation: mine });
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    return dbError("conversations", error);
  }
  return NextResponse.json({ conversation: data });
}
