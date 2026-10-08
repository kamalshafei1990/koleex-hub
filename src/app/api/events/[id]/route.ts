import "server-only";

/* /api/events/[id] — one event's workspace payload (event + guests + agenda
   in one request), update, and delete. Edit/delete: module action + owner
   (or Super Admin). Tenant always from the session. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  canManageEvent,
  EVENTS_MODULE,
  loadEventDetail,
  readEventFields,
  requireTenant,
} from "@/lib/server/events";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, EVENTS_MODULE);
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  try {
    const { detail, error } = await loadEventDetail(auth, id);
    if (error) return error;
    return NextResponse.json({ event: detail });
  } catch (e) {
    console.error("[events] detail:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not load event" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "edit");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  /* Load first — the owner check needs the row, and the update stays
     tenant-scoped regardless of what the client sends. */
  const { data: ev, error: loadErr } = await supabaseServer
    .from("koleex_events")
    .select("owner_account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    console.error("[events] patch load:", loadErr.message);
    return NextResponse.json({ error: "Could not load event" }, { status: 500 });
  }
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!canManageEvent(auth, (ev as { owner_account_id: string }).owner_account_id)) {
    return NextResponse.json({ error: "Only the owner can edit this event" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fields, error } = readEventFields(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error: upErr } = await supabaseServer
    .from("koleex_events")
    .update(fields)
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id);
  if (upErr) {
    console.error("[events] patch:", upErr.message);
    return NextResponse.json({ error: "Could not update event" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "delete");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { data: ev, error: loadErr } = await supabaseServer
    .from("koleex_events")
    .select("owner_account_id, title")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    console.error("[events] delete load:", loadErr.message);
    return NextResponse.json({ error: "Could not load event" }, { status: 500 });
  }
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!canManageEvent(auth, (ev as { owner_account_id: string }).owner_account_id)) {
    return NextResponse.json({ error: "Only the owner can delete this event" }, { status: 403 });
  }

  /* Guests and agenda cascade at the DB level (ON DELETE CASCADE); delete
     the event row itself and they go with it. No orphan cleanup needed. */
  const { error: delErr } = await supabaseServer
    .from("koleex_events")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id);
  if (delErr) {
    console.error("[events] delete:", delErr.message);
    return NextResponse.json({ error: "Could not delete event" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
