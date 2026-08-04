import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import {
  normalizeProjectColor,
  normalizeProjectIcon,
  normalizeProjectName,
} from "@/lib/ai-projects";

/* PATCH  /api/ai/projects/:id — rename / recolour / change icon
   DELETE /api/ai/projects/:id — delete the folder, NOT the chats inside it

   The delete is deliberately non-destructive: ai_conversations.project_id is
   ON DELETE SET NULL, so removing a folder returns its conversations to the
   ungrouped list instead of taking them down with it. Losing chats because a
   folder was tidied away would be unforgivable and irreversible. */

const COLUMNS = "id, name, icon, color, sort_order, created_at, updated_at";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    icon?: unknown;
    color?: unknown;
  };

  /* Only the keys actually sent are touched — recolouring must not silently
     rewrite the name to a default. */
  const patch: Record<string, string> = {};
  if (body.name !== undefined) patch.name = normalizeProjectName(body.name);
  if (body.icon !== undefined) patch.icon = normalizeProjectIcon(body.icon);
  if (body.color !== undefined) patch.color = normalizeProjectColor(body.color);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("ai_projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: data });
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
    .from("ai_projects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
