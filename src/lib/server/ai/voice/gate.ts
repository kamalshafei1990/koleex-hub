import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/gate — who may use voice at all, decided once, used everywhere.

   THIS WAS A PRIVATE FUNCTION INSIDE THE SESSION ROUTE, and that was right
   while one route needed it. A second voice route now exists (the transcript
   writer), and a second copy of a three-step chain is a second place for a
   step to be dropped — the step most easily dropped being requireInternalUser,
   which was already omitted from the session route once. Route files may only
   export handlers, so the shared version lives here.

   THE CHAIN, IN ORDER, AND WHY THE ORDER IS NOT NEGOTIABLE:

     1. requireAuth        — a real signed-in account, or a 401.
     2. requireInternalUser — the door. Owner directive 2026-08-03: Koleex AI
                              must not be REACHABLE by a non-internal account
                              type; "the tools would deny anyway" is not
                              acceptable exposure.
     3. checkModule        — deny by default. No row for "AI Voice" means no.

   The tenant travels with the account: every knowledge read and every write
   a voice route makes is scoped by it, and a null passed where a tenant
   belongs is one tenant's data read into another's call.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { buildUserContext, checkModule } from "@/lib/server/ai-agent/permissions";

export type VoiceGate = { accountId: string; tenantId: string | null };

export async function authorizeVoice(req: Request): Promise<NextResponse | VoiceGate> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const internal = requireInternalUser(auth);
  if (internal) return internal;

  const ctx = await buildUserContext(auth);
  const decision = checkModule(ctx, "AI Voice", "view");
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason ?? "You don't have access to voice." },
      { status: 403 },
    );
  }

  return { accountId: auth.account_id, tenantId: auth.tenant_id ?? null };
}
