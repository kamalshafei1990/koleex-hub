import "server-only";
import type { AiPersonalization } from "@/lib/ai-personalization";

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

/** Who is on the call, as the text lanes already know them (the viewer
 *  block every written prompt carries). Null name means "use the username". */
export type VoiceViewer = {
  name: string | null;
  username: string;
  role: string | null;
  department: string | null;
  isSuperAdmin: boolean;
  /** Their Settings → Koleex AI preferences; null in older fixtures. */
  personalization?: AiPersonalization | null;
};

export type VoiceGate = { accountId: string; tenantId: string | null; viewer: VoiceViewer };

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

  return {
    accountId: auth.account_id,
    tenantId: auth.tenant_id ?? null,
    /* FROM THE SIGNED-IN SESSION, not from what the caller says. A voice
       session used to carry nothing about who was speaking: asked "do you
       know who I am", it did not, and told a super admin it could not tell
       what they were allowed to see. The text lanes fixed this as finding
       N7; the call gets the same block, from the same context. */
    viewer: {
      name: ctx.viewer.name,
      username: ctx.viewer.username,
      role: ctx.viewer.role,
      department: ctx.viewer.department,
      isSuperAdmin: ctx.viewer.isSuperAdmin,
      personalization: ctx.personalization ?? null,
    },
  };
}
