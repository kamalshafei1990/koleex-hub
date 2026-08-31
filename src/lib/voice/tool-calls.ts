/* ---------------------------------------------------------------------------
   voice/tool-calls — turning the far side's function-call events into
   something the client can act on, and nothing else.

   WHY A PURE MODULE, AGAIN. Node has no WebRTC, so the connection cannot be
   tested — but this can, and parsing is where the mistakes live. The
   transcript parser exists because a wrong event name shipped once and the
   symptom was an empty screen: silence looks identical to "nothing happened".
   A wrong name here has the same symptom, and it is worse, because the user
   asked a question about today's weather and got a confident answer from
   training data instead of "let me look".

   THE PROTOCOL RISK, STATED PLAINLY. Every realtime event this product
   already relies on — session.update, response.audio_transcript.delta,
   conversation.item.input_audio_transcription.completed, server_vad — is the
   OpenAI realtime shape, and the vendor implements that protocol. Function
   calling in that protocol is:

     response.output_item.added         → item.type "function_call", carries
                                          call_id and name
     response.function_call_arguments.delta / .done
                                        → the JSON arguments, by call_id
     response.done                      → output[] may also carry the finished
                                          function_call item

   That is strong evidence rather than certainty: the vendor's own realtime
   documentation is not reachable from the build environment. So this parser
   accepts BOTH routes to a call (the streamed one and the response.done one),
   and — the part that matters — reports anything that looks like a function
   call it could not understand, instead of dropping it. An unrecognised shape
   becomes a visible signal rather than a call that never happens.
   --------------------------------------------------------------------------- */

/** A tool call the far side is waiting on. */
export type VoiceToolCall = {
  /** Correlates the result back to the model's pending call. */
  callId: string;
  name: string;
  /** Raw JSON text as the model produced it. Parsed server-side, never here. */
  argumentsJson: string;
};

export type ToolCallParse = {
  /** A complete call, ready to execute. */
  call: VoiceToolCall | null;
  /**
   * An event that named itself a function call and could not be read.
   *
   * THE WHOLE POINT of this field: if the vendor's event names differ from
   * the ones above, the failure mode without it is silence — the model asks
   * to search, nothing happens, and it answers from memory sounding just as
   * sure. This turns that into something a log and a test can see.
   */
  unreadable: string | null;
};

const NOTHING: ToolCallParse = { call: null, unreadable: null };

export const EV_OUTPUT_ITEM_ADDED = "response.output_item.added";
export const EV_FN_ARGS_DONE = "response.function_call_arguments.done";
export const EV_RESPONSE_DONE = "response.done";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Remembers which name belongs to which call_id.
 *
 * NEEDED BECAUSE THE TWO HALVES ARRIVE SEPARATELY: the name comes on
 * `response.output_item.added` and the arguments on
 * `response.function_call_arguments.done`, which carries the call_id but not
 * always the name. A parser that only read the second event would produce
 * calls with no name — and a nameless call cannot be checked against an
 * allow-list, which is the one check that must never be skippable.
 */
export class ToolCallNames {
  private names = new Map<string, string>();

  remember(callId: string, name: string): void {
    if (callId && name) this.names.set(callId, name);
  }

  nameFor(callId: string): string {
    return this.names.get(callId) ?? "";
  }

  /** A call is finished with; keeping it would grow for the life of the call. */
  forget(callId: string): void {
    this.names.delete(callId);
  }

  get size(): number {
    return this.names.size;
  }
}

/**
 * Read one DataChannel message.
 *
 * UNTRUSTED INPUT. This came off a network socket. Nothing here dispatches on
 * it, executes it, or trusts it: it returns strings and the caller decides.
 * The tool NAME in particular is a claim, not an authorisation — the server
 * checks it against its own allow-list regardless of what arrives here.
 */
export function parseToolCallEvent(raw: string, names: ToolCallNames): ToolCallParse {
  let payload: Record<string, unknown> | null;
  try {
    payload = asRecord(JSON.parse(raw));
  } catch {
    return NOTHING;
  }
  if (!payload) return NOTHING;

  const type = str(payload.type);
  if (!type) return NOTHING;

  /* The name half. */
  if (type === EV_OUTPUT_ITEM_ADDED) {
    const item = asRecord(payload.item);
    if (item && str(item.type) === "function_call") {
      const callId = str(item.call_id) || str(item.id);
      const name = str(item.name);
      if (callId && name) names.remember(callId, name);
      /* Some servers put the arguments on this event too when they are short
         enough not to stream. Taking them here is harmless: the .done event
         below is idempotent from the caller's side because the call_id is the
         same, and a caller that de-duplicates on call_id sees one call. */
      const args = str(item.arguments);
      if (callId && name && args) return { call: { callId, name, argumentsJson: args }, unreadable: null };
    }
    return NOTHING;
  }

  /* The arguments half — the usual completion point. */
  if (type === EV_FN_ARGS_DONE) {
    const callId = str(payload.call_id);
    /* `name` is not guaranteed on this event; the remembered one is the
       fallback, and a call with neither is reported rather than run. */
    const name = str(payload.name) || names.nameFor(callId);
    const argumentsJson = str(payload.arguments) || "{}";
    if (!callId || !name) return { call: null, unreadable: type };
    return { call: { callId, name, argumentsJson }, unreadable: null };
  }

  /* The fallback route: a finished response carrying the call in its output.
     Kept because a server that never streams arguments would otherwise
     produce no call at all through the path above. */
  if (type === EV_RESPONSE_DONE) {
    const response = asRecord(payload.response);
    const output = response && Array.isArray(response.output) ? response.output : [];
    for (const entry of output) {
      const item = asRecord(entry);
      if (!item || str(item.type) !== "function_call") continue;
      const callId = str(item.call_id) || str(item.id);
      const name = str(item.name) || names.nameFor(callId);
      const argumentsJson = str(item.arguments) || "{}";
      if (!callId || !name) return { call: null, unreadable: `${type} (function_call item)` };
      return { call: { callId, name, argumentsJson }, unreadable: null };
    }
    return NOTHING;
  }

  /* ANYTHING ELSE THAT CALLS ITSELF A CALL TO A TOOL. If the vendor's names
     differ from the three above, this is what stops the difference from being
     invisible. Deliberately last, so a recognised event never reaches it.

     BOTH VOCABULARIES, because the net is useless if it only catches the
     naming we already handle: "function_call" is the OpenAI realtime word and
     "tool_call" is what the chat-completions API and several implementations
     say. A vendor using the second would have slipped through in silence —
     which is precisely the failure this field exists to make visible. */
  if (/(function|tool)[_.]call/i.test(type)) {
    /* The delta streams are expected and not a problem: they are the partial
       arguments, and the .done event carries the whole thing. Reporting them
       would fire many times per call and drown the signal. */
    if (/arguments\.delta$/i.test(type)) return NOTHING;
    return { call: null, unreadable: type };
  }

  return NOTHING;
}

/**
 * The message that hands a result back to the model.
 *
 * Two events, in this order, exactly as the protocol wants them: the output
 * item, then a request for the model to carry on speaking. Built here so the
 * shape is testable without a browser.
 *
 * `output` is a STRING in this protocol, not an object — a caller that passes
 * an object gets it serialised here rather than silently sending `[object
 * Object]`.
 */
export function buildToolResultMessages(callId: string, output: unknown): string[] {
  const text = typeof output === "string" ? output : JSON.stringify(output ?? null);
  return [
    JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: text },
    }),
    JSON.stringify({ type: "response.create" }),
  ];
}
