import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

/* GET /api/calendar/events/[id]
   One event by id. Same boundary as PATCH and DELETE: the caller's tenant is
   applied in the query, so a cross-tenant id is a 404 rather than a leak of
   its existence, and only the owner or a Super Admin may read it — Calendar is
   a Type C (Personal) module, where a role's Scope=All has deliberately NO
   effect.

   This exists so the browser stops reading the table directly. CalendarApp
   needs the base event of a recurring series when you edit one occurrence, and
   that was the last read in the Calendar going straight from the browser to
   the database — a cross-border round trip on the owner's link, to fetch one
   row the server could have handed over in the same region. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  /* The events list mixes in VIRTUAL entries whose id is prefixed — a to-do
     shown on the calendar arrives as `todo:<uuid>`. Those are not rows in this
     table, and handing one to Postgres raises `invalid input syntax for type
     uuid` and a 500. A malformed id is a not-found, not a server fault. */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await (() => {
    let q = supabaseServer.from("koleex_calendar_events").select("*").eq("id", id);
    if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
    return q.maybeSingle();
  })();

  if (error) {
    console.error("[api/calendar/events GET one]", error.message);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = data as { account_id: string };
  if (row.account_id !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ event: data });
}

/* PATCH /api/calendar/events/[id]
   Update a single event. Caller must own the calendar (account_id = me)
   or be Super Admin. The event's tenant is enforced server-side — a
   cross-tenant edit returns 404 (looks like not-found rather than a
   leak of existence). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "edit");
  if (deny) return deny;

  const existing = await loadEvent(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownsCalendar = existing.account_id === auth.account_id;
  if (!ownsCalendar && !auth.is_super_admin) {
    return NextResponse.json(
      { error: "Cannot edit another account's event" },
      { status: 403 },
    );
  }

  const patch = (await req.json()) as Record<string, unknown>;
  // Strip server-managed fields that a client must never rewrite.
  delete patch.tenant_id;
  delete patch.id;
  delete patch.created_at;

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/calendar/events PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}

/* DELETE /api/calendar/events/[id] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "delete");
  if (deny) return deny;

  const existing = await loadEvent(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownsCalendar = existing.account_id === auth.account_id;
  if (!ownsCalendar && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("koleex_calendar_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[api/calendar/events DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function loadEvent(
  id: string,
  tenantId: string | null,
): Promise<{ id: string; account_id: string; tenant_id: string | null } | null> {
  let query = supabaseServer
    .from("koleex_calendar_events")
    .select("id, account_id, tenant_id")
    .eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data } = await query.maybeSingle();
  return (
    (data as {
      id: string;
      account_id: string;
      tenant_id: string | null;
    } | null) ?? null
  );
}
