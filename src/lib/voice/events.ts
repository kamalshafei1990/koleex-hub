/* ---------------------------------------------------------------------------
   voice/events — what the far side says, turned into something a screen can
   show.

   THE BUG THIS CLOSES. A call worked, both sides spoke, and the screen stayed
   empty. Two separate causes, and only fixing both puts words on it:

     1. The user's OWN speech was never transcribed. `input_audio_transcription`
        is what asks for it, and the first session configuration omitted it —
        so the far side understood the audio and answered it, but never sent a
        single word back about what was said. No amount of parsing recovers
        text that was never requested.

     2. The assistant's transcript DID arrive and nothing read it. The events
        reached the DataChannel handler, were passed through untouched, and
        were dropped by a caller that had nothing to do with them.

   WHY A PURE MODULE. Node has no WebRTC, so the connection cannot be tested
   here — but this can. Parsing is where the mistakes live: a wrong event name
   is silence, and silence is exactly what a screen shows when nothing at all
   is wired. Every event name below is asserted against a literal string, so a
   rename fails loudly rather than quietly showing an empty transcript.

   TREAT EVERY FIELD AS UNTRUSTED. This is text that came off a network socket
   and is about to be rendered. It is DATA, never instruction — the standing
   rule that external content may not override system policy applies to a
   transcript as much as to an uploaded document. Nothing here interprets,
   dispatches, or acts on any of it; it produces strings for display.
   --------------------------------------------------------------------------- */

/** Who said it. The UI colours and aligns on this and nothing else. */
export type TranscriptRole = "user" | "assistant";

export type TranscriptUpdate = {
  role: TranscriptRole;
  /** The text so far for this turn. Always the WHOLE turn, never a fragment —
   *  see `append` below for why the caller is not asked to accumulate. */
  text: string;
  /** False while more is coming. A caller may render partial text differently
   *  (dimmed, no timestamp) but must never drop it: partial text arriving as
   *  the user speaks is the entire point of showing it live. */
  final: boolean;
};

/* The four names the vendor actually sends, confirmed against its published
   event list rather than assumed from a similar API. Held as constants so a
   typo is a compile error at the one place it can be made, and so the suite
   can assert the exact strings. */
export const EV_ASSISTANT_DELTA = "response.audio_transcript.delta";
export const EV_ASSISTANT_DONE = "response.audio_transcript.done";
export const EV_USER_DELTA = "conversation.item.input_audio_transcription.delta";
export const EV_USER_DONE = "conversation.item.input_audio_transcription.completed";

/** The far side also announces the session and its own turn boundaries. Only
 *  the ones a screen reacts to are named; everything else is ignored rather
 *  than guessed at. */
export const EV_SESSION_CREATED = "session.created";
export const EV_SPEECH_STARTED = "input_audio_buffer.speech_started";
export const EV_SPEECH_STOPPED = "input_audio_buffer.speech_stopped";
export const EV_RESPONSE_DONE = "response.done";

/** What the far side is doing right now, for the orb. */
export type VoicePhase = "listening" | "speaking" | null;

export type ParsedEvent = {
  /** Null when this event says nothing about the transcript. */
  transcript: TranscriptUpdate | null;
  /** Null when this event does not change what the far side is doing. */
  phase: VoicePhase;
};

const NOTHING: ParsedEvent = { transcript: null, phase: null };

/** Pull a string out of an unknown payload, or "" — never undefined, and never
 *  a non-string coerced into one. A number where text was expected is a
 *  protocol change, not something to stringify and render. */
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/* A transcript delta can carry an unconfirmed tail. The vendor documents
   `text` as the confirmed prefix and `stash` as the suffix still being
   revised, which is what makes live captions read smoothly instead of
   rewriting themselves word by word. Both are shown while partial; only the
   confirmed half survives into the final. */
function deltaText(payload: Record<string, unknown>): string {
  const confirmed = str(payload.text) || str(payload.delta);
  const unconfirmed = str(payload.stash);
  return confirmed + unconfirmed;
}

/**
 * Turn one raw DataChannel message into what the screen should do about it.
 *
 * Returns `NOTHING` for anything unrecognised — including malformed JSON.
 * A call must not fall over because one event of forty was a shape we had not
 * seen; the audio keeps flowing and the caption simply does not advance.
 */
export function parseVoiceEvent(raw: string): ParsedEvent {
  let msg: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NOTHING;
    msg = parsed as Record<string, unknown>;
  } catch {
    return NOTHING;
  }

  const type = str(msg.type);
  if (!type) return NOTHING;

  switch (type) {
    case EV_ASSISTANT_DELTA:
      return { transcript: { role: "assistant", text: deltaText(msg), final: false }, phase: "speaking" };
    case EV_ASSISTANT_DONE:
      /* `transcript` is the field the done event names; the delta fields are
         accepted too so a turn that only ever produced deltas still finishes
         with text rather than blanking. */
      return {
        transcript: { role: "assistant", text: str(msg.transcript) || deltaText(msg), final: true },
        phase: null,
      };
    case EV_USER_DELTA:
      return { transcript: { role: "user", text: deltaText(msg), final: false }, phase: "listening" };
    case EV_USER_DONE:
      return {
        transcript: { role: "user", text: str(msg.transcript) || deltaText(msg), final: true },
        phase: null,
      };
    case EV_SPEECH_STARTED:
      return { transcript: null, phase: "listening" };
    case EV_SPEECH_STOPPED:
    case EV_RESPONSE_DONE:
      return NOTHING;
    default:
      return NOTHING;
  }
}

/* ---------------------------------------------------------------------------
   ACCUMULATION LIVES HERE, NOT IN THE COMPONENT.

   Deltas arrive as fragments and a caption is the running total of them. Doing
   that sum inside a React state updater is where the subtle bugs are: a
   dropped fragment, a doubled one on a re-render, or a new turn appended to
   the previous speaker's sentence. It is ordinary reducer logic, so it lives
   in a function the suite can drive one event at a time.
   --------------------------------------------------------------------------- */

export type TranscriptLine = { role: TranscriptRole; text: string; final: boolean };

/**
 * Fold one update into the running list.
 *
 * A turn is open while `final` is false. A delta extends the open turn OF THE
 * SAME SPEAKER; anything else starts a new line. That rule is what keeps the
 * assistant's answer from being glued onto the end of the user's question when
 * the two overlap, which they do — the far side starts answering before the
 * user's final transcript lands.
 */
export function appendTranscript(
  lines: readonly TranscriptLine[],
  update: TranscriptUpdate,
): TranscriptLine[] {
  const last = lines[lines.length - 1];
  const extendsOpenTurn = last && !last.final && last.role === update.role;

  if (!extendsOpenTurn) {
    /* An empty partial opens nothing — a stray delta with no text would
       otherwise leave a blank bubble on screen for the rest of the call. */
    if (!update.text && !update.final) return [...lines];
    return [...lines, { role: update.role, text: update.text, final: update.final }];
  }

  /* A delta carries the whole turn so far, not the increment. Replacing rather
     than concatenating is therefore correct AND idempotent: a repeated event
     leaves the caption identical instead of doubling it. */
  const merged: TranscriptLine = {
    role: update.role,
    /* A final with no text of its own keeps what the deltas already built,
       rather than blanking a caption the user was reading. */
    text: update.text || last.text,
    final: update.final,
  };
  return [...lines.slice(0, -1), merged];
}
