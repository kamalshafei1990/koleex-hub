import "server-only";

/* POST /api/events/[id]/guests/[guestId]/invite — create (or refresh) the
   guest's invitation and, with { send: true }, mark it sent. Module
   "Events" edit + event ownership enforced here; the invite helper re-checks
   ownership before writing (defense in depth, same rule everywhere). */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { inviteGuest } from "@/lib/server/invites";
import { EVENTS_MODULE, requireTenant } from "@/lib/server/events";

export async function POST(
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

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* empty body = { send: false } */
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const note = typeof b.note === "string" ? b.note.slice(0, 500) : null;

  const result = await inviteGuest(auth, id, guestId, { send: b.send === true, note });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }
  return NextResponse.json({ invitation: result.invitation });
}
