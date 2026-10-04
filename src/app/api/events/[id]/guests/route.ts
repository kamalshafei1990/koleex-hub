import "server-only";

/* POST /api/events/[id]/guests — add a guest to the event's list.
   Module "Events" edit + event ownership required (a guest list is part of
   the event). Duplicate names are rejected by the DB unique constraint. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  EVENTS_MODULE,
  readGuestFields,
  requireOwnedEvent,
  requireTenant,
} from "@/lib/server/events";

export async function POST(
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

  const { event, error } = await requireOwnedEvent(auth, id);
  if (error) return error;
  void event;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fields, error: fieldErr } = readGuestFields(body);
  if (fieldErr || !fields?.name) {
    return NextResponse.json({ error: fieldErr ?? "Name is required" }, { status: 400 });
  }

  const status = fields.status ?? "listed";
  const now = new Date().toISOString();
  const { data, error: dbErr } = await supabaseServer
    .from("koleex_event_guests")
    .insert({
      tenant_id: auth.tenant_id,
      event_id: id,
      source: "manual",
      name: fields.name,
      company: fields.company ?? null,
      email: fields.email ?? null,
      phone: fields.phone ?? null,
      category: fields.category ?? "guest",
      status,
      invited_at: status === "listed" ? null : now,
      responded_at: ["accepted", "declined", "maybe", "attended"].includes(status) ? now : null,
      notes: fields.notes ?? null,
    })
    .select("id")
    .single();
  if (dbErr || !data) {
    const msg = dbErr?.message ?? "";
    if (msg.includes("keg_event_name_uniq")) {
      return NextResponse.json({ error: "A guest with this name already exists" }, { status: 409 });
    }
    console.error("[events] guest create:", msg);
    return NextResponse.json({ error: "Could not add guest" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
