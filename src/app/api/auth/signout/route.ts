import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/auth/signout — Clear the session cookie.

   Idempotent: safe to call when already signed out.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { clearSessionCookie, clearViewAsCookie } from "@/lib/server/session";

export async function POST() {
  await clearSessionCookie();
  /* Also drop any active view-as cookies so they can't linger after sign-out
     and be presented by the next account to log in on the same browser. */
  await clearViewAsCookie();
  return NextResponse.json({ ok: true });
}
