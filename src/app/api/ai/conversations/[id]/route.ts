import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { stripAttachEmbed } from "@/lib/server/ai/attach-embed";
/* Every persisted row carries ai_messages.provider verbatim, so returning
   the history returns the vendor label once per message. Finding N11 —
   see ai/observability/public-provider.ts. */
import { withPublicProvider } from "@/lib/server/ai/observability/public-provider";

/* GET    /api/ai/conversations/:id — conversation + ordered messages
   PATCH  /api/ai/conversations/:id — rename
   DELETE /api/ai/conversations/:id — hard delete (cascades to messages) */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
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
  /* Bubbles show the slim 📎 marker; the embedded extraction text after the
     delimiter is transport for the agent's later turns, not display. */
  const messages = (msgRes.data ?? []).map((m) =>
    withPublicProvider(
      typeof (m as { content?: unknown }).content === "string"
        ? { ...m, content: stripAttachEmbed((m as { content: string }).content) }
        : m,
    ),
  );
  return NextResponse.json({
    conversation: cvRes.data,
    messages,
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: unknown;
    pinned?: unknown;
    project_id?: unknown;
  };

  /* Rename, pin and move-to-folder all land here, and each key is applied only
     when it was actually sent — pinning a chat must not blank its title, and
     renaming must not silently unpin it. */
  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    patch.title = title;
  }

  if (body.pinned !== undefined) {
    if (typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "pinned must be a boolean" }, { status: 400 });
    }
    patch.pinned = body.pinned;
  }

  /* null is a meaningful value here — it means "take this chat out of its
     folder" — so it is distinguished from the key being absent. An id that
     isn't the caller's own is rejected rather than quietly ignored: silently
     dropping a move would look like the app losing the chat. */
  if (body.project_id !== undefined) {
    if (body.project_id === null) {
      patch.project_id = null;
    } else if (typeof body.project_id === "string" && body.project_id) {
      const { data: owned } = await supabaseServer
        .from("ai_projects")
        .select("id")
        .eq("id", body.project_id)
        .eq("tenant_id", auth.tenant_id)
        .eq("account_id", auth.account_id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: "Unknown project" }, { status: 400 });
      patch.project_id = owned.id;
    } else {
      return NextResponse.json({ error: "invalid project_id" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .update(patch)
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
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
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
