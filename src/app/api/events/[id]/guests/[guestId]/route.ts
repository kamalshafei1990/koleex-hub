import "server-only";

/* PATCH/DELETE /api/events/[id]/guests/[guestId] — edit one guest (details or
   their invitation answer) or remove them. Same rule as every other event
   mutation: module "Events" edit + event ownership. Tenant from session. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  EVENTS_MODULE,
  guestStatusPatch,
  readGuestFields,
  requireOwnedEvent,
  requireTenant,
} from "@/lib/server/events";
import type { EventGuestRow, GuestStatus } from "@/lib/events/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { id, guestId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "edit");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  const { data: row, error: loadErr } = await supabaseServer
    .from("koleex_event_guests")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", guestId)
    .maybeSingle();
  if (loadErr) {
    console.error("[events] guest load:", loadErr.message);
    return NextResponse.json({ error: "Could not load guest" }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fields, error: fieldErr } = readGuestFields(body);
  if (fieldErr) return NextResponse.json({ error: fieldErr }, { status: 400 });
  if (!fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const prev = row as unknown as EventGuestRow;
  const patch: Record<string, unknown> = { ...fields };
  if (fields.status && fields.status !== prev.status) {
    Object.assign(
      patch,
      guestStatusPatch(prev.status, fields.status as GuestStatus, prev),
    );
  }

  const { error: upErr } = await supabaseServer
    .from("koleex_event_guests")
    .update(patch)
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", guestId);
  if (upErr) {
    console.error("[events] guest patch:", upErr.message);
    return NextResponse.json({ error: "Could not update guest" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { id, guestId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "delete");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  const { error: delErr } = await supabaseServer
    .from("koleex_event_guests")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", id)
    .eq("id", guestId);
  if (delErr) {
    console.error("[events] guest delete:", delErr.message);
    return NextResponse.json({ error: "Could not remove guest" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
