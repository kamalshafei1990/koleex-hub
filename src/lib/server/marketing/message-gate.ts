import "server-only";

/* The door of every /api/marketing/messages/[id]/* route, in this order:
   signed in (a write refuses view-as), the conversation is this tenant's,
   the caller has the action on the Roles module of its account's space.
   Nothing is read or written for a caller who fails a step. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction, type ModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { loadConversation } from "@/lib/server/marketing/messages";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConversationGate {
  auth: ServerAuthContext;
  conversation: NonNullable<Awaited<ReturnType<typeof loadConversation>>>;
}

export async function gateConversation(req: Request, id: string, action: ModuleAction): Promise<ConversationGate | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  const conversation = await loadConversation(auth.tenant_id, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const denied = await requireModuleAction(auth, SPACE_MODULE[conversation.space], action);
  if (denied) return denied;
  return { auth, conversation };
}
