import "server-only";

/* GET /api/events — the list for /events. ?filter=all|upcoming|past|archived
   &q=term. Module "Events" view required; rows are tenant-scoped. */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  EVENTS_MODULE,
  listFilterOf,
  loadEventList,
  readEventFields,
  requireTenant,
} from "@/lib/server/events";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, EVENTS_MODULE);
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  try {
    const url = new URL(req.url);
    const { rows, counts } = await loadEventList(
      auth,
      listFilterOf(url.searchParams.get("filter")),
      url.searchParams.get("q") ?? "",
    );
    return NextResponse.json({ rows, counts });
  } catch (e) {
    console.error("[events] list:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not load events" }, { status: 500 });
  }
}

/* POST /api/events — create. Module "Events" create required. The caller
   owns the new event; tenant comes from the session, never the body. */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, EVENTS_MODULE, "create");
  if (deny) return deny;
  const tenantErr = requireTenant(auth);
  if (tenantErr) return tenantErr;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { fields, error } = readEventFields(body);
  if (error || !fields?.title) {
    return NextResponse.json({ error: error ?? "Title is required" }, { status: 400 });
  }

  const { data, error: dbErr } = await supabaseServer
    .from("koleex_events")
    .insert({
      tenant_id: auth.tenant_id,
      title: fields.title,
      type: fields.type ?? "exhibition",
      status: fields.status ?? "idea",
      start_at: fields.start_at ?? null,
      end_at: fields.end_at ?? null,
      location: fields.location ?? null,
      city: fields.city ?? null,
      country: fields.country ?? null,
      description: fields.description ?? null,
      budget_total: fields.budget_total ?? null,
      expected_guests: fields.expected_guests ?? null,
      booth: fields.booth ?? null,
      website: fields.website ?? null,
      owner_account_id: auth.account_id,
      created_by: auth.account_id,
    })
    .select("id")
    .single();
  if (dbErr || !data) {
    console.error("[events] create:", dbErr?.message);
    return NextResponse.json({ error: "Could not create event" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
