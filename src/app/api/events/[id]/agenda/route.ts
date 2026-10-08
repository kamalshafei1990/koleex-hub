import "server-only";

/* POST /api/events/[id]/agenda — add a session to the day's program.
   Module "Events" edit + event ownership. */
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

  const { error } = await requireOwnedEvent(auth, id);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "A session title is required" }, { status: 400 });

  const str = (v: unknown, max: number) =>
    v === undefined || v === null ? null : String(v).slice(0, max);

  /* sort_order: explicit when sent; otherwise lands after the current last. */
  let sortOrder = 0;
  if (b.sort_order !== undefined && Number.isFinite(Number(b.sort_order))) {
    sortOrder = Number(b.sort_order);
  } else {
    const { data: last } = await supabaseServer
      .from("koleex_event_agenda_items")
      .select("sort_order")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  }

  const { data, error: dbErr } = await supabaseServer
    .from("koleex_event_agenda_items")
    .insert({
      tenant_id: auth.tenant_id,
      event_id: id,
      title,
      description: str(b.description, 2000),
      speaker: str(b.speaker, 200),
      location: str(b.location, 200),
      starts_at: localToIso(b.starts_at as string | null),
      ends_at: localToIso(b.ends_at as string | null),
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (dbErr || !data) {
    console.error("[events] agenda create:", dbErr?.message);
    return NextResponse.json({ error: "Could not add session" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
