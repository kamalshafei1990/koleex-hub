import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/auth/signout — Clear the session cookie.

   Idempotent: safe to call when already signed out.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
