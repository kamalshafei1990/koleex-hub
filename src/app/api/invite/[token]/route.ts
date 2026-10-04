import "server-only";

/* /api/invite/[token] — the PUBLIC door. No session, no requireAuth: the
   token IS the credential (36 random hex chars, unique, unguessable).
   A bad token is a 404 with no existence leak, and the payload exposes only
   the event's public facts + the holder's own name and answer.

   GET  → invite payload (records the view once — a messenger preview counts)
   POST { answer: accepted|declined|maybe } → records the RSVP */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { answerPublicInvite, getPublicInvite } from "@/lib/server/invites";
import { isRsvpAnswer } from "@/lib/events/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getPublicInvite(token);
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ invite });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const answer = (body as Record<string, unknown>)?.answer;
  if (!isRsvpAnswer(answer)) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }
  const invite = await answerPublicInvite(token, answer);
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ invite });
}
