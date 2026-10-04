import "server-only";

/* ---------------------------------------------------------------------------
   Which write tools a TAP in the chat may confirm (tasks phase 2, 2026-09-13).

   The text lane confirmed writes by typing "yes": the model re-sent the same
   arguments with confirm:true and the ledger matched them. A card with a
   Save button does the same thing without the model in the loop — the page
   POSTs the preview's own arguments with confirm:true and via:"tap" to
   /api/ai/agent/confirm. The list below is the explicit, reviewed set of
   tools that route will dispatch; the ledger remains the real check (a tap
   without a recorded preview is refused inside dispatchTool like any other
   fabricated confirm). Read-only tools are refused here by name AND by the
   catalogue: a tool the catalogue calls read_only has no confirm phase and
   nothing to tap.
   --------------------------------------------------------------------------- */

import { skillMeta } from "@/lib/server/ai/skills/catalog";

export const CHAT_CONFIRM_TOOLS: readonly string[] = ["createTodo", "updateTodo", "completeTodo", "reassignTodo", "deleteTodo"];

export function isChatConfirmTool(name: string): boolean {
  if (!CHAT_CONFIRM_TOOLS.includes(name)) return false;
  const meta = skillMeta(name);
  return meta ? meta.risk !== "read_only" : false;
}

/** The body cap, as the voice tool route's: a preview's arguments are ids,
 *  short strings and ISO times. */
export const CHAT_CONFIRM_MAX_ARGS_BYTES = 8 * 1024;
