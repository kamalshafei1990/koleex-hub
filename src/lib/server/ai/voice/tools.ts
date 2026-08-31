import "server-only";

/* ---------------------------------------------------------------------------
   Which tools a VOICE call may use, and why the list is this short.

   A voice call has no confirmation step. There is no draft to read, no button
   to press, no diff to check — the model decides, and by the time the user
   hears about it the thing has happened. The standing rule is that there are
   no uncontrolled autonomous writes, and a spoken "yes" is not a confirmation
   the server can verify: it is audio the model transcribed, arriving through
   the same channel as the request.

   So: READ-ONLY, and only the reads whose worst case is a wasted second.

     · search_web — the reason this exists. The model's knowledge has a
       cut-off and a lot of ordinary questions do not. Asked about today's
       weather or this week's rate, a voice call with no tools answers from
       training data and sounds exactly as confident as if it knew.

   NOT HERE, deliberately:
     · every create, update and delete tool — a write with no confirmation;
     · createQuotationDraft — a write, and a commercial one;
     · remember_about_user / forget_about_user — writes to the user's own
       record, and ones they cannot see happening;
     · the customer, product, inventory and pricing reads — they are not
       unsafe, but they carry Koleex data into a channel whose transcript is
       not yet persisted anywhere the owner can audit. They can be added once
       that is decided; adding them now would be deciding it by accident.

   THIS LIST IS THE SECURITY BOUNDARY, and it lives on the server because the
   standing rule is that the client never determines a permission. The browser
   relays a NAME it received from the model; both the model and the browser
   are outside the trust boundary, so the name is a claim. It is checked here,
   against this list, before anything runs — and then checked AGAIN by
   dispatchTool's own permission gates, which is where a user who may not use
   a tool is stopped even if it is on this list.
   --------------------------------------------------------------------------- */

import { getTool } from "@/lib/server/ai-agent/tool-registry";

/** The only tool names a voice call may invoke. */
export const VOICE_TOOL_NAMES: readonly string[] = ["search_web"];

/**
 * How many tool calls one voice session may make.
 *
 * A CAP, NOT A RATE LIMIT, and it is here because a model that can call a
 * tool and then be asked to speak again can do that forever. The standing
 * rule is no uncontrolled agent loops; this is what makes it true for voice.
 * Generous enough that a real conversation never notices — a caller asking
 * follow-up questions for ten minutes stays well inside it.
 */
export const VOICE_TOOL_CALLS_PER_SESSION = 12;

/** True when a name may be invoked over voice. Nothing else may be. */
export function isVoiceTool(name: string): boolean {
  return VOICE_TOOL_NAMES.includes(name);
}

/**
 * The tool schemas the SERVER puts in session.update.
 *
 * Built from the live registry rather than retyped, so a tool whose
 * description or parameters change cannot end up described one way to the
 * text lane and another way to voice. A name on the list that is not in the
 * registry is dropped rather than invented: this must never advertise a tool
 * that cannot run.
 */
export function voiceToolSchemas(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: unknown;
}> {
  const out: Array<{ type: "function"; name: string; description: string; parameters: unknown }> = [];
  for (const name of VOICE_TOOL_NAMES) {
    const tool = getTool(name);
    if (!tool) continue;
    out.push({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });
  }
  return out;
}
