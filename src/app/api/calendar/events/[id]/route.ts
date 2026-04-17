import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

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
  const deny = await requireModuleAccess(auth, "Calendar");
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
  const deny = await requireModuleAccess(auth, "Calendar");
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
