import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  cleanMeetingUrl,
  eventAttendeeIds,
  isEventOwner,
  loadCalendarEvent,
} from "@/lib/server/calendar-access";
import { accountTimezone, notifyEventChanged } from "@/lib/server/calendar-notify";
import { loadExceptions, saveException } from "@/lib/server/calendar-exceptions";
import { isOccurrenceOf } from "@/lib/calendar-recurrence";

/* POST /api/calendar/events/[id]/occurrences — change ONE occurrence of a
   recurring event ("This event" in the editor, and a drag on the grid).

     { occurrence_start, action: "skip" }
         the occurrence is deleted; the rest of the series stays.
     { occurrence_start, action: "override", title?, start_at?, end_at?,
       location?, meeting_url? }
         the occurrence takes its own values; a key left out keeps what the
         occurrence already had (an earlier override, else the series).

   `occurrence_start` is the occurrence's ORIGINAL start, exactly as the
   feed hands it out (CalendarFeedEvent.occurrence_start) — a time the series
   never has is refused. Owner or Super Admin, like editing the series.
   Guests who have not declined are told, with the occurrence named, and the
   reminder cron picks the new time up (lib/calendar-recurrence
   nextEffectiveOccurrence). 503 until the 2026-09-26 migration has run. */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  const action = body.action;
  if (action !== "skip" && action !== "override") {
    return NextResponse.json({ error: "action must be skip or override" }, { status: 400 });
  }
  const deny = await requireModuleAction(auth, "Calendar", action === "skip" ? "delete" : "edit");
  if (deny) return deny;

  const ev = await loadCalendarEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEventOwner(ev, { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin })) {
    return NextResponse.json({ error: "Cannot edit another account's event" }, { status: 403 });
  }
  if (!ev.recurrence) return NextResponse.json({ error: "Not a recurring event" }, { status: 400 });

  const occMs = typeof body.occurrence_start === "string" ? Date.parse(body.occurrence_start) : NaN;
  if (!Number.isFinite(occMs)) return NextResponse.json({ error: "occurrence_start must be an ISO datetime" }, { status: 400 });
  const occISO = new Date(occMs).toISOString();
  const tz = await accountTimezone(ev.account_id);
  if (!isOccurrenceOf(ev.start_at, ev.end_at, ev.recurrence, ev.recurrence_until, occISO, tz)) {
    return NextResponse.json({ error: "No such occurrence" }, { status: 400 });
  }

  /* What the occurrence is now: an earlier override, else the series. */
  const prev = (await loadExceptions([id])).get(id)?.find((e) => e.occurrence_start === occISO);
  if (prev?.kind === "skip") return NextResponse.json({ error: "That occurrence was deleted" }, { status: 409 });
  const durationMs = Math.max(0, Date.parse(ev.end_at) - Date.parse(ev.start_at));
  const before = {
    title: prev?.title ?? ev.title,
    start_at: prev?.start_at ?? occISO,
    end_at: prev?.end_at ?? new Date(occMs + durationMs).toISOString(),
    location: prev?.location != null ? prev.location || null : ev.location ?? null,
    meeting_url: prev?.meeting_url ?? ev.meeting_url ?? null,
  };
  const guests = await eventAttendeeIds(id, { excludeDeclined: true });

  if (action === "skip") {
    const res = await saveException({ event_id: id, tenant_id: ev.tenant_id, occurrence_start: occISO, kind: "skip" });
    if (!res.ok) return unavailableOr500(res.unavailable);
    await notifyEventChanged(
      { ...ev, title: before.title, start_at: before.start_at, end_at: before.end_at },
      guests, auth.account_id, "cancelled", { occurrence: occISO },
    );
    return NextResponse.json({ ok: true });
  }

  /* Override: validate what was sent; merge with what the occurrence had. */
  const next = { ...before };
  if ("title" in body) {
    const t = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (!t) return NextResponse.json({ error: "title must not be empty" }, { status: 400 });
    next.title = t;
  }
  for (const k of ["start_at", "end_at"] as const) {
    if (k in body) {
      const ms = typeof body[k] === "string" ? Date.parse(body[k] as string) : NaN;
      if (!Number.isFinite(ms)) return NextResponse.json({ error: `${k} must be an ISO datetime` }, { status: 400 });
      next[k] = new Date(ms).toISOString();
    }
  }
  if ("start_at" in body && !("end_at" in body)) {
    next.end_at = new Date(Date.parse(next.start_at) + (Date.parse(before.end_at) - Date.parse(before.start_at))).toISOString();
  }
  if (Date.parse(next.end_at) < Date.parse(next.start_at)) {
    return NextResponse.json({ error: "end_at must not be before start_at" }, { status: 400 });
  }
  if ("location" in body) {
    if (body.location !== null && typeof body.location !== "string") return NextResponse.json({ error: "location must be text" }, { status: 400 });
    next.location = typeof body.location === "string" ? body.location.trim().slice(0, 300) || null : null;
  }
  if ("meeting_url" in body) {
    const v = cleanMeetingUrl(body.meeting_url);
    if (v === undefined) return NextResponse.json({ error: "meeting_url must be an https link (max 500 characters)" }, { status: 400 });
    next.meeting_url = v;
  }

  const res = await saveException({
    event_id: id, tenant_id: ev.tenant_id, occurrence_start: occISO, kind: "override",
    /* Stored only where the occurrence differs from the series. */
    title: next.title !== ev.title ? next.title : null,
    start_at: next.start_at,
    end_at: next.end_at,
    /* "" = this occurrence has no place (NULL would mean "as the series"). */
    location: next.location !== (ev.location ?? null) ? next.location ?? "" : null,
    meeting_url: next.meeting_url !== (ev.meeting_url ?? null) ? next.meeting_url : null,
  });
  if (!res.ok) return unavailableOr500(res.unavailable);

  const timeChanged = next.start_at !== before.start_at || next.end_at !== before.end_at;
  const placeChanged = next.location !== before.location;
  const linkChanged = next.meeting_url !== before.meeting_url;
  if (timeChanged || placeChanged || linkChanged) {
    await notifyEventChanged(
      { ...ev, ...next },
      guests, auth.account_id,
      timeChanged ? "rescheduled" : placeChanged ? "moved" : "link",
      { occurrence: occISO },
    );
  }
  return NextResponse.json({ ok: true, occurrence: { occurrence_start: occISO, ...next } });
}

function unavailableOr500(unavailable: boolean) {
  return unavailable
    ? NextResponse.json({ error: "Changing a single occurrence is not available yet", unavailable: true }, { status: 503 })
    : NextResponse.json({ error: "Failed to save the occurrence" }, { status: 500 });
}
