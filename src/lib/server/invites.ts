import "server-only";

/* ---------------------------------------------------------------------------
   invites — the invitation behind a guest's public RSVP link.

   Two doors, two rules:
     · ORGANIZERS (authed): create/mark-sent through the event APIs, which
       enforce module permission + event ownership before touching anything.
     · GUESTS (public): the token IS the credential. /api/invite/[token]
       never calls requireAuth; it resolves the invitation by token and
       exposes only the event's public facts + that guest's own answer.
       A wrong token is a plain 404 — no existence leak.

   The guest row (koleex_event_guests.status) stays the funnel's single
   source of truth: sending, viewing and answering all write THROUGH to it,
   so the funnel card and the guests tab never disagree with the link.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import type {
  EventGuestRow,
  GuestInvitation,
  GuestStatus,
  PublicInvite,
  RsvpAnswer,
} from "@/lib/events/types";
import { requireOwnedEvent } from "@/lib/server/events";

/* ── Organizer side ───────────────────────────────────────────────────────── */

export interface InviteResult {
  invitation?: GuestInvitation & { id: string; guest_id: string };
  error?: string;
  status?: number;
}

/** Create the invitation for a guest if missing; optionally mark it sent.
 *  Caller has already checked module permission + ownership. */
export async function inviteGuest(
  auth: ServerAuthContext,
  eventId: string,
  guestId: string,
  opts: { send: boolean; note?: string | null },
): Promise<InviteResult> {
  const owned = await requireOwnedEvent(auth, eventId);
  if (owned.error) return { error: "Event not found", status: 404 };

  /* The guest must belong to this event (and tenant). */
  const { data: guest, error: gErr } = await supabaseServer
    .from("koleex_event_guests")
    .select("id, status, invited_at, tenant_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", eventId)
    .eq("id", guestId)
    .maybeSingle();
  if (gErr) return { error: "Could not load guest", status: 500 };
  if (!guest) return { error: "Guest not found", status: 404 };

  /* Upsert on the guest's unique slot — re-inviting refreshes, never stacks. */
  const base = {
    tenant_id: auth.tenant_id,
    event_id: eventId,
    guest_id: guestId,
    ...(opts.note ? { note: opts.note } : {}),
  };
  const { data: inv, error: iErr } = await supabaseServer
    .from("koleex_event_invitations")
    .upsert(base, { onConflict: "guest_id" })
    .select("id, token, status, sent_at, viewed_at, answered_at")
    .single();
  if (iErr || !inv) return { error: "Could not create invitation", status: 500 };

  if (opts.send) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: "sent",
      sent_at: (inv as { sent_at: string | null }).sent_at ?? now,
      sent_by: auth.account_id,
    };
    const { data: sent } = await supabaseServer
      .from("koleex_event_invitations")
      .update(patch)
      .eq("id", (inv as { id: string }).id)
      .select("id, token, status, sent_at, viewed_at, answered_at")
      .single();
    if (sent) Object.assign(inv, sent);

    /* The funnel follows: invited + stamp. */
    const g = guest as { status: GuestStatus; invited_at: string | null };
    if (g.status === "listed") {
      await supabaseServer
        .from("koleex_event_guests")
        .update({ status: "invited", invited_at: g.invited_at ?? now })
        .eq("id", guestId);
    }
  }

  return { invitation: inv as GuestInvitation & { id: string; guest_id: string } };
}

/* ── Guest side (token is the credential) ─────────────────────────────────── */

type InviteRow = {
  id: string;
  token: string;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  answered_at: string | null;
  guest: {
    id: string;
    name: string;
    status: string;
    event: {
      title: string;
      type: string;
      start_at: string | null;
      end_at: string | null;
      location: string | null;
      city: string | null;
      country: string | null;
      description: string | null;
    } | null;
  } | null;
};

const INVITE_SELECT =
  "id, token, status, sent_at, viewed_at, answered_at, " +
  "guest:koleex_event_guests!inner(id, name, status, " +
  "event:koleex_events!inner(title, type, start_at, end_at, location, city, country, description))";

async function loadByToken(token: string): Promise<InviteRow | null> {
  const { data } = await supabaseServer
    .from("koleex_event_invitations")
    .select(INVITE_SELECT)
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as InviteRow;
  const unwrap = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;
  return {
    ...row,
    guest: row.guest
      ? { ...row.guest, event: unwrap(row.guest.event) }
      : null,
  };
}

function toPublic(row: InviteRow): PublicInvite {
  const g = row.guest!;
  const ev = g.event!;
  return {
    event: {
      title: ev.title,
      type: ev.type as PublicInvite["event"]["type"],
      start_at: ev.start_at,
      end_at: ev.end_at,
      location: ev.location,
      city: ev.city,
      country: ev.country,
      description: ev.description,
    },
    guestName: g.name,
    answer: ["accepted", "declined", "maybe", "attended"].includes(g.status)
      ? (g.status as PublicInvite["answer"])
      : null,
    inviteStatus: row.status as PublicInvite["inviteStatus"],
    answeredAt: row.answered_at,
  };
}

/** GET: what the guest page may show. Also records the view once — a
 *  messenger preview counts as a view, which is honest for the funnel. */
export async function getPublicInvite(token: string): Promise<PublicInvite | null> {
  const row = await loadByToken(token);
  if (!row || !row.guest?.event) return null;
  if (!row.viewed_at) {
    await supabaseServer
      .from("koleex_event_invitations")
      .update({
        viewed_at: new Date().toISOString(),
        ...(row.status === "sent" ? { status: "viewed" } : {}),
      })
      .eq("id", row.id);
    /* Reflect the view in this response, not just the next one. */
    row.viewed_at = new Date().toISOString();
    if (row.status === "sent") row.status = "viewed";
  }
  return toPublic(row);
}

/** POST the guest's answer. Re-answering is allowed (minds change); the
 *  first answer keeps the original timestamp. */
export async function answerPublicInvite(
  token: string,
  answer: RsvpAnswer,
): Promise<PublicInvite | null> {
  const row = await loadByToken(token);
  if (!row || !row.guest?.event) return null;
  const now = new Date().toISOString();

  const gPatch: Record<string, unknown> = { status: answer };
  const g = row.guest as unknown as Pick<EventGuestRow, "status" | "invited_at">;
  if (!g.invited_at) gPatch.invited_at = now;
  gPatch.responded_at = row.answered_at ?? now;
  await supabaseServer.from("koleex_event_guests").update(gPatch).eq("id", row.guest.id);

  await supabaseServer
    .from("koleex_event_invitations")
    .update({
      status: "rsvped",
      answered_at: row.answered_at ?? now,
      ...(row.status === "draft" ? { sent_at: row.sent_at ?? now } : {}),
    })
    .eq("id", row.id);

  const fresh = await loadByToken(token);
  return fresh ? toPublic(fresh) : null;
}
