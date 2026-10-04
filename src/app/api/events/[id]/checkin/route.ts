import "server-only";

/* POST /api/events/[id]/checkin — day-of door check-in. Body: { guestId }
   or { token } (the invitation token a guest QR encodes). Module "Events"
   edit + event ownership; the stamp itself is a conditional update, so a
   second scan of the same code answers 409 "Already checked in". */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { checkInGuest, EVENTS_MODULE, requireTenant } from "@/lib/server/events";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const guestId = typeof b.guestId === "string" ? b.guestId : undefined;
  const token = typeof b.token === "string" ? b.token.slice(0, 80) : undefined;
  if (!guestId && !token) {
    return NextResponse.json({ error: "Nothing to check in" }, { status: 400 });
  }

  const result = await checkInGuest(auth, id, { guestId, token });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ guest: result.guest });
}
