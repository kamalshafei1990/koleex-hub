import "server-only";

/* ---------------------------------------------------------------------------
   attach-embed — carry extracted attachment text ACROSS turns.

   The original design sent the extracted file text into the model turn only
   and persisted a slim 📎 marker, "so history and later-turn payloads stay
   small". Correct on size, wrong on behaviour: the very next question about
   the same file ("tell me in details this file contents") found nothing in
   history, and the provenance rule then made the assistant refuse — honestly,
   but uselessly.

   ai_messages has no metadata column, and a schema change is not this fix's
   business. The extracted text is instead embedded INSIDE the persisted
   user-message content behind a delimiter that:
     · the conversation GET strips, so bubbles keep showing just the slim
       marker;
     · the agent's history pass resolves — the NEWEST message carrying an
       embed keeps its text (delimiter removed), older embeds are stripped,
       so one big document does not ride every turn forever.
   --------------------------------------------------------------------------- */

/* U+241E SYMBOL FOR RECORD SEPARATOR — visually distinctive, never typed. */
export const ATTACH_SPLIT = "\n␞[[KX-ATTACHED-TEXT]]␞\n";

/** Display form: everything after the delimiter is transport, not message. */
export function stripAttachEmbed(content: string): string {
  const i = content.indexOf(ATTACH_SPLIT);
  return i === -1 ? content : content.slice(0, i).trimEnd();
}

/** Model-history form: keep the newest embed's text in place (the file the
 *  user is most likely still asking about), strip the rest. */
export function resolveHistoryAttachEmbeds<T extends { content: string }>(
  history: T[],
): T[] {
  let lastIdx = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i].content.includes(ATTACH_SPLIT)) lastIdx = i;
  }
  if (lastIdx === -1) return history;
  return history.map((m, i) =>
    i === lastIdx
      ? { ...m, content: m.content.replace(ATTACH_SPLIT, "\n") }
      : { ...m, content: stripAttachEmbed(m.content) },
  );
}
