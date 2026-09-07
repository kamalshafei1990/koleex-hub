/* ---------------------------------------------------------------------------
   voice/text-turn — a typed message, sent into a live call.

   WHY. A caller sometimes has something that is easier to type than to say:
   a model code, a quantity, a name in another alphabet. ChatGPT lets you type
   inside voice mode; without this, a person on a Koleex call had to hang up
   to do it.

   THE PROTOCOL IS TWO MESSAGES. `conversation.item.create` puts the text into
   the session as the user's turn; `response.create` asks the model to answer
   it — server-side turn detection only fires on AUDIO, so a typed turn would
   otherwise sit unanswered. Both go on the DataChannel the configuration went
   on; nothing here touches the network directly.

   THE TEXT IS THE USER'S OWN, and it is still capped: a paste of a document
   into a call is a size problem on the one transport with a hard limit.
   --------------------------------------------------------------------------- */

export const EV_ITEM_CREATE = "conversation.item.create";
export const EV_RESPONSE_CREATE = "response.create";
export const MAX_TYPED_TURN_CHARS = 2_000;

/** ONE wire message: text into the session as the user's turn, with NO
 *  response asked for. For what the screen did that the model should know
 *  without answering — a task confirmed by a tap, a card dismissed. The
 *  next thing the caller says is answered with this in view. */
export function buildNoteMessage(text: string): string | null {
  const trimmed = text.trim().slice(0, MAX_TYPED_TURN_CHARS);
  if (!trimmed) return null;
  return JSON.stringify({
    type: EV_ITEM_CREATE,
    item: { type: "message", role: "user", content: [{ type: "input_text", text: trimmed }] },
  });
}

/** Both wire messages, in order, or null when there is nothing to send. */
export function buildTextTurnMessages(text: string): string[] | null {
  const trimmed = text.trim().slice(0, MAX_TYPED_TURN_CHARS);
  if (!trimmed) return null;
  return [
    JSON.stringify({
      type: EV_ITEM_CREATE,
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: trimmed }],
      },
    }),
    JSON.stringify({ type: EV_RESPONSE_CREATE }),
  ];
}

/* ── A word from the new voice ──────────────────────────────────────────
   The owner (2026-09-07): choosing a voice "takes time until it talks". A
   switch rebuilds the session, and the rebuilt call then WAITED for the
   caller to speak before the new voice was heard at all — seconds of a
   screen saying ready and a phone saying nothing. So the moment the new
   session is acknowledged, one response is asked for with instructions and
   no user turn: a single short sentence, in the conversation's language,
   that the voice is here. The caller hears the choice at once and the
   thread gains one honest line. Nothing about who is speaking is stated —
   the product is Koleex AI on every voice. */
export const VOICE_SWITCH_GREETING =
  "The caller just switched to a different voice for you. Say ONE short, warm sentence in the language of the conversation so far (match the caller's last turn; Arabic in Egyptian dialect), letting them know you're here with this voice and ready to continue. No question, no summary, no mention of settings or technology.";

/** ONE wire message: ask the far side for a response to these instructions,
 *  with no user turn added. Null for empty instructions. */
export function buildResponseRequest(instructions: string): string | null {
  const trimmed = instructions.trim().slice(0, MAX_TYPED_TURN_CHARS);
  if (!trimmed) return null;
  return JSON.stringify({ type: EV_RESPONSE_CREATE, response: { instructions: trimmed } });
}
