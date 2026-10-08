import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   ONE PLACE THAT WRITES A NEW CONVERSATION ROW — for POST
   /api/ai/conversations and for the first turn of /api/ai/agent, which makes
   the chat itself when the app names one it has not been told exists yet.

   Owner, 2026-09-26, from the phone in the mainland: the chat was made, but
   the answer to "make a chat" was lost on the link twice before the third
   ask got through — twenty seconds before the question even left. The first
   message now carries the chat's id with it, so that round trip is gone.

   The client may NAME the row (a UUID it chose), so asking twice makes one
   chat: the same id again finds the row the first ask made — and only when
   it is the caller's own. Anyone else's id is a conflict, and says nothing
   about the row it names.
   --------------------------------------------------------------------------- */

export const CONVERSATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client-chosen id when it is a UUID, lower-cased; otherwise null. */
export function clientConversationId(value: unknown): string | null {
  return typeof value === "string" && CONVERSATION_ID_RE.test(value) ? value.toLowerCase() : null;
}

type Owner = { tenant_id: string; account_id: string };

export type NewConversationResult =
  | { ok: true; row: Record<string, unknown> & { id: string } }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; error: PostgrestError };

export async function insertConversation(
  auth: Owner,
  opts: { id?: string | null; title?: string; projectId?: unknown },
): Promise<NewConversationResult> {
  /* Starting a chat from inside a project drops it straight into that folder.
     The id is verified to belong to this caller first — an unowned or unknown
     id yields an ungrouped chat rather than a foreign-key error the user
     would see as "failed to start chat". */
  let projectId: string | null = null;
  if (typeof opts.projectId === "string" && opts.projectId) {
    const { data: owned } = await supabaseServer
      .from("ai_projects")
      .select("id")
      .eq("id", opts.projectId)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .maybeSingle();
    projectId = owned?.id ?? null;
  }

  const { data, error } = await supabaseServer
    .from("ai_conversations")
    .insert({
      ...(opts.id ? { id: opts.id } : {}),
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      title: opts.title?.trim() || "New chat",
      project_id: projectId,
    })
    .select("*")
    .single();
  if (!error && data) return { ok: true, row: data };

  /* The same id again: the first ask landed. */
  if (opts.id && error?.code === "23505") {
    const { data: mine } = await supabaseServer
      .from("ai_conversations")
      .select("*")
      .eq("id", opts.id)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .maybeSingle();
    if (mine) return { ok: true, row: mine };
    return { ok: false, conflict: true };
  }
  return { ok: false, conflict: false, error: error as PostgrestError };
}
