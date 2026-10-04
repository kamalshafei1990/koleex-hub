import "server-only";

/* PATCH/DELETE /api/events/[id]/agenda/[itemId] — edit or drop one session.
   Same mutation rule as everything else on the event. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { localToIso } from "@/lib/events/types";
import {
  EVENTS_MODULE,
  requireOwnedEvent,
  requireTenant,
} from "@/lib/server/events";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "edit");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.title !== undefined) {
    const title = String(b.title).trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: "A session title is required" }, { status: 400 });
    patch.title = title;
  }
  for (const key of ["description", "speaker", "location"] as const) {
    if (b[key] !== undefined) patch[key] = b[key] === null ? null : String(b[key]).slice(0, 2000);
  }
  if (b.starts_at !== undefined) patch.starts_at = localToIso(b.starts_at as string | null);
  if (b.ends_at !== undefined) patch.ends_at = localToIso(b.ends_at as string | null);
  if (b.sort_order !== undefined && Number.isFinite(Number(b.sort_order))) {
    patch.sort_order = Number(b.sort_order);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error: upErr } = await supabaseServer
    .from("koleex_event_agenda_items")
    .update(patch)
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", itemId);
  if (upErr) {
    console.error("[events] agenda patch:", upErr.message);
    return NextResponse.json({ error: "Could not update session" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "delete");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  const { error: delErr } = await supabaseServer
    .from("koleex_event_agenda_items")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", itemId);
  if (delErr) {
    console.error("[events] agenda delete:", delErr.message);
    return NextResponse.json({ error: "Could not delete session" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
