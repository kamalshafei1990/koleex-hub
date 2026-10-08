import "server-only";

/* ---------------------------------------------------------------------------
   calendar-guests — replace an event's guest list. Written once; the
   attendees route (PUT) and the AI agent's create/update tools call it, so a
   guest added by the assistant is checked and invited exactly like one added
   in the event editor.

   Guests are ACTIVE INTERNAL accounts of the event's tenant, never the
   organizer, at most 100. The newly added are invited (inbox + push); the
   removed have their unread invitation withdrawn. The caller has already
   checked that the actor may manage the event.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { internalAccountIds } from "@/lib/server/internal-accounts";
import { notifyInvited, withdrawInvites } from "@/lib/server/calendar-notify";
import type { CalendarEventCore } from "@/lib/server/calendar-access";

const ATTENDEES = "koleex_calendar_event_attendees";

export type GuestReplace =
  | { ok: true; count: number; added: number; removed: number }
  | { ok: false };

export async function replaceGuests(
  ev: CalendarEventCore,
  requestedIds: unknown[],
  actorId: string,
): Promise<GuestReplace> {
  const requested = requestedIds
    .filter((x): x is string => typeof x === "string" && !!x)
    .filter((x) => x !== ev.account_id) // the organizer is never their own guest
    .slice(0, 100);
  const wanted = await internalAccountIds(requested, ev.tenant_id);

  const { data: current, error: readErr } = await supabaseServer.from(ATTENDEES).select("account_id").eq("event_id", ev.id);
  if (readErr) return { ok: false };
  const currentIds = new Set((current ?? []).map((r) => (r as { account_id: string }).account_id));
  const wantedSet = new Set(wanted);
  const toAdd = wanted.filter((a) => !currentIds.has(a));
  const toRemove = [...currentIds].filter((a) => !wantedSet.has(a));

  if (toRemove.length) {
    const { error } = await supabaseServer.from(ATTENDEES).delete().eq("event_id", ev.id).in("account_id", toRemove);
    if (error) return { ok: false };
    await withdrawInvites(ev.id, toRemove);
  }
  if (toAdd.length) {
    const { error } = await supabaseServer.from(ATTENDEES).insert(
      toAdd.map((account_id) => ({ event_id: ev.id, account_id, status: "invited", tenant_id: ev.tenant_id })),
    );
    if (error) return { ok: false };
    await notifyInvited(ev, toAdd, actorId);
  }
  return { ok: true, count: wanted.length, added: toAdd.length, removed: toRemove.length };
}
