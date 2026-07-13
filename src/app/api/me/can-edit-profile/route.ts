import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { callerMayEditPeople } from "@/lib/server/people-access";

/* GET /api/me/can-edit-profile — may the signed-in user edit person
   (identity) records? The Settings → Profile tab uses this to decide
   between the editable form and the read-only "maintained by HR" view.
   Same rule as PATCH /api/people/[id], so the UI can never promise an
   edit the server would reject. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const allowed = await callerMayEditPeople(auth);
  return NextResponse.json(
    { allowed },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
