import "server-only";

import { NextResponse } from "next/server";
import type { ServerAuthContext } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   requireInternalUser — hard gate for every Koleex AI endpoint.

   Koleex AI is an INTERNAL assistant: its tool layer is role-scoped, but
   the assistant itself (chat, conversations, feedback, copy/translate
   helpers) must never be reachable by non-internal account types at all
   — future customer-portal logins share the accounts table, and "the
   tools would deny anyway" is not an acceptable exposure (owner
   directive 2026-08-03). Defense in depth: block at the door.
   --------------------------------------------------------------------------- */
export function requireInternalUser(auth: ServerAuthContext): NextResponse | null {
  if (auth.user_type === "internal") return null;
  return NextResponse.json(
    { error: "Koleex AI is available to internal Koleex accounts only." },
    { status: 403 },
  );
}
