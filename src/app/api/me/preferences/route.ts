import "server-only";

/* ===========================================================================
   GET  /api/me/preferences    user experience snapshot
   PATCH /api/me/preferences   partial update (dashboard_role / ui_mode /
                                 favorite_apps / pinned_workflows)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience, updateUserPreferences, type PreferencesPatch } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const experience = await getUserExperience(auth);
  return NextResponse.json({ experience });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as PreferencesPatch | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  const r = await updateUserPreferences(auth.account_id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  const experience = await getUserExperience(auth);
  return NextResponse.json({ ok: true, experience });
}
