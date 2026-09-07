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

/** How the words got into the call. Spoken is the default and the common
 *  case; `text` marks a turn the caller TYPED into a live call, which is
 *  persisted as an ordinary typed message rather than a voice one. */
export type TranscriptVia = "voice" | "text";

/** A product photo a lookup returned during the turn. Kept on the line so the
 *  saved message can carry it; see voice/photos.ts for where it comes from. */
export type TranscriptPhoto = { url: string; label: string };

export type TranscriptUpdate = {
  role: TranscriptRole;
  via?: TranscriptVia;
  photos?: readonly TranscriptPhoto[];
  /** The text of this update. The WHOLE turn so far when `incremental` is
   *  false (the user's transcription: a confirmed prefix plus a tail), and
   *  ONE MORE PIECE of it when `incremental` is true (the assistant's
   *  transcript arrives as increments). See `appendTranscript` for the fold. */
  text: string;
  /** True when `text` is a fragment to be appended to the open turn, not a
   *  replacement for it. THIS FLAG IS WHY THE ASSISTANT'S ANSWERS WERE ONE
   *  WORD LONG: every assistant delta was treated as the whole turn, so each
   *  one replaced the last, and the caption, the saved message and the next
   *  call's "conversation so far" all held the final fragment — "تمام", "ولي
   *  بس." — of answers that were sentences. Found in the saved transcript,
   *  not in a test: the fixture had always used cumulative deltas. */
  incremental?: boolean;
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
/* THE SAME TWO EVENTS UNDER THEIR NEWER NAMES. The realtime protocol's
   general-availability revision renamed the assistant's transcript events
   (`output_audio_transcript`); a vendor on that revision sends these and
   never the ones above. The first call on such a vendor (2026-09-07 17:08)
   transcribed the caller, showed "thinking", and then nothing: the answer
   arrived under names nothing here recognised. Both families are read. */
export const EV_ASSISTANT_DELTA_GA = "response.output_audio_transcript.delta";
export const EV_ASSISTANT_DONE_GA = "response.output_audio_transcript.done";
export const EV_USER_DELTA = "conversation.item.input_audio_transcription.delta";
export const EV_USER_DONE = "conversation.item.input_audio_transcription.completed";

/** The far side also announces the session and its own turn boundaries. Only
 *  the ones a screen reacts to are named; everything else is ignored rather
 *  than guessed at. */
export const EV_SESSION_CREATED = "session.created";
/** The far side accepted the configuration. Its absence within a moment of
 *  sending, followed by an error, is how a rejected configuration shows. */
export const EV_SESSION_UPDATED = "session.updated";
/** The far side refused something. Read only by the client's config
 *  fallback; never rendered, never acted on beyond that. */
export const EV_ERROR = "error";
export const EV_SPEECH_STARTED = "input_audio_buffer.speech_started";
export const EV_SPEECH_STOPPED = "input_audio_buffer.speech_stopped";
export const EV_RESPONSE_DONE = "response.done";

/** What the far side is doing right now, for the orb.
 *
 *  `thinking` is the gap between the caller's last word and the assistant's
 *  first — the vendor has the turn and is composing. It used to be shown as
 *  nothing at all, so a two-second pause read as a frozen call and the owner
 *  asked for "a motion so I know it is thinking". The orb shows it. */
export type VoicePhase = "listening" | "thinking" | "speaking" | null;
export const EV_RESPONSE_CREATED = "response.created";

export type ParsedEvent = {
  /** Null when this event says nothing about the transcript. */
  transcript: TranscriptUpdate | null;
  /** Null when this event does not change what the far side is doing. */
  phase: VoicePhase;
  /** A speaker whose OPEN line this event closes, with the words it has.
   *  The answer is over (`response.done`) or was interrupted (the caller
   *  started speaking): whatever was said, was said. See settleOpenLine. */
  settles?: TranscriptRole;
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
/* ---------------------------------------------------------------------------
   BARGE-IN — what happens to the far side's audio when the caller speaks.

   Over WebRTC the answer's audio rides an RTP track, not the data channel,
   and the receiver holds a few hundred milliseconds of it in a jitter
   buffer (session.ts, JITTER_BUFFER_TARGET_MS). When the caller interrupts,
   the far side stops sending — the vendor's turn detection cancels the
   response — but what is already buffered still plays out over the caller's
   first words. The vendor's own WebRTC sample clears its playback buffer on
   `input_audio_buffer.speech_started` for exactly this reason. A browser
   cannot clear a jitter buffer, but it can silence the element until the
   far side has something new to say — which is what this decides.

   PURE: an event name and the phase the call was in, to one of three words.
   `cut` only while the far side was SPEAKING — a speech start during a
   pause silences nothing, so a phantom start (a cough, the room) in a quiet
   moment changes nothing. `restore` on any sign the far side has the turn
   again, and on the caller falling silent, so the element can never be
   left muted by a start that had no end.
   --------------------------------------------------------------------------- */
export type PlaybackGate = "cut" | "restore" | null;

export function playbackGate(eventType: string | null, phase: VoicePhase): PlaybackGate {
  if (!eventType) return null;
  if (eventType === EV_SPEECH_STARTED) return phase === "speaking" ? "cut" : null;
  /* NOT ON THE CANCELLED ANSWER'S OWN TAIL (audit, 2026-09-07). After the
     cut, the transcript deltas and the `done` of the response being
     cancelled are still in flight and still arrive; restoring on them
     unmuted the element while the buffered audio was playing out — the
     artefact this gate exists to stop. Only a NEW turn restores: the
     caller falling silent, a new response, or the old one finishing. */
  if (
    eventType === EV_SPEECH_STOPPED ||
    eventType === EV_RESPONSE_CREATED ||
    eventType === EV_RESPONSE_DONE
  ) {
    return "restore";
  }
  return null;
}

/** The event's `type`, or null for anything that is not a JSON object with a
 *  string type — the same reading parseVoiceEvent does, exposed so a caller
 *  can dispatch on the name without re-parsing. Never throws. */
export function voiceEventType(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const type = (parsed as Record<string, unknown>).type;
    return typeof type === "string" && type ? type : null;
  } catch {
    return null;
  }
}

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
    case EV_ASSISTANT_DELTA_GA: {
      /* THE ASSISTANT'S DELTA IS A PIECE, NOT THE WHOLE. The vendor sends the
         user's transcription as `text` (confirmed so far) + `stash`, and the
         assistant's as `delta` — the next few characters only. A payload
         carrying `text` is still read as cumulative, so a vendor that sends
         the whole turn is handled too; only a bare `delta` is appended. */
      const cumulative = str(msg.text);
      if (cumulative) {
        return { transcript: { role: "assistant", text: cumulative + str(msg.stash), final: false }, phase: "speaking" };
      }
      return {
        transcript: { role: "assistant", text: str(msg.delta), final: false, incremental: true },
        phase: "speaking",
      };
    }
    case EV_ASSISTANT_DONE:
    case EV_ASSISTANT_DONE_GA:
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
    /* THE CALLER SPOKE OVER THE ANSWER. The far side cancels its response
       and does not always send the transcript's `done` for it — the answer
       stayed open on screen for the rest of the call, and nothing after it
       was saved (persist.ts). What was said before the interruption is the
       turn; it closes here. */
    case EV_SPEECH_STARTED:
      return { transcript: null, phase: "listening", settles: "assistant" };
    /* The caller stopped; the far side has the turn. Composing — a lookup, a
       sentence — is what the orb shows until the first word comes back. */
    case EV_SPEECH_STOPPED:
    case EV_RESPONSE_CREATED:
      return { transcript: null, phase: "thinking" };
    /* THE ANSWER IS OVER; THE CALLER HAS THE TURN. This was NOTHING, which
       left the phase at "speaking" through the silence after every answer:
       the screen said "Speaking", the far-side meter stayed on and the mic
       meter stayed off, so the orb ignored the caller's first words until
       the vendor's turn detection confirmed speech (audit, 2026-09-07). */
    case EV_RESPONSE_DONE:
      return { transcript: null, phase: "listening", settles: "assistant" };
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

export type TranscriptLine = {
  role: TranscriptRole;
  text: string;
  final: boolean;
  via?: TranscriptVia;
  photos?: readonly TranscriptPhoto[];
};

/**
 * Fold one update into the running list.
 *
 * A turn is open while `final` is false. A delta extends the open turn OF THE
 * SAME SPEAKER; anything else starts a new line. That rule is what keeps the
 * assistant's answer from being glued onto the end of the user's question when
 * the two overlap, which they do — the far side starts answering before the
 * user's final transcript lands.
 *
 * THE OPEN TURN IS NOT ALWAYS THE LAST LINE (audit, 2026-09-07). With the
 * user's line still open, the assistant's first delta opens a second line
 * after it; the user's FINAL then arrives. Read only from the last line it
 * belonged to nobody, so it opened a THIRD line — and two unfinished lines
 * ("how many ord", "Fourt") were suddenly "settled", written to the thread
 * as turns, while every later assistant delta opened yet another line. That
 * is where the saved rows "I", "I", "خل", "بال" came from. So an update
 * looks back for the open line of ITS speaker (two lines is the whole
 * overlap), and closes or extends THAT one where it stands.
 */
/** Letters and digits only — punctuation and spacing are what a
 *  re-transcription changes while saying the same thing. Pure. */
function utteranceKey(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}

/** Whether `next` is the same utterance as `prev`, heard further: its
 *  letters begin with prev's letters, and prev has at least a word in it.
 *  Exported for the suite. Pure. */
export function extendsUtterance(prev: string, next: string): boolean {
  const a = utteranceKey(prev);
  const b = utteranceKey(next);
  return a.length >= 2 && b.length >= a.length && b.startsWith(a);
}

/** True for a transcript that is only the transcriber's markers for
 *  non-speech — "[noise]", "[inaudible]", "…" — with no words of the
 *  caller's in it. Pure. */
export function isNonSpeech(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /^(?:\[[^\]]{1,40}\]|\([^)]{1,40}\)|\.{2,}|…|[\s,.])+$/.test(t);
}

export function appendTranscript(
  lines: readonly TranscriptLine[],
  update: TranscriptUpdate,
): TranscriptLine[] {
  const last = lines[lines.length - 1];
  /* "[noise] ..." IS NOT A TURN (a saved caller line, 2026-09-07 19:47).
     A transcriber that heard nothing it could write marks it so; the mark
     is not something the caller said, and a bubble of it in the thread is
     noise about noise. A settled caller line that is only markers is
     dropped — and a caption it had opened is closed without a trace. */
  if (update.role === "user" && update.final && isNonSpeech(update.text)) {
    const openIdx = lines.length > 0 && !last.final && last.role === "user" ? lines.length - 1 : -1;
    return openIdx >= 0 ? lines.slice(0, openIdx) : [...lines];
  }
  /* The open line of this speaker: the last line, or the one before it when
     the other speaker has opened a line on top. */
  let openIdx = -1;
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 2; i--) {
    if (!lines[i].final) {
      if (lines[i].role === update.role) openIdx = i;
      continue;
    }
    break;
  }
  const open = openIdx >= 0 ? lines[openIdx] : undefined;

  /* THE SAME FINAL TWICE IS ONE TURN. The protocol can deliver a completed
     transcript on more than one event, and each copy used to open a new
     line — so the saved conversation held the user's question twice and the
     assistant's "تمام" twice, back to back. A final that matches the last
     settled line of the same speaker is the same turn, and changes nothing. */
  if (update.final && !open && last && last.final && last.role === update.role && update.text && last.text === update.text) {
    return [...lines];
  }
  /* A FINAL THAT GROWS THE LAST ONE IS THE SAME TURN, RE-HEARD. A vendor
     that re-transcribes the whole utterance as its detector extends it
     delivers "إزيك؟", then "إزيك إيه الأخبار؟", then "إزيك، إيه الأخبار؟" —
     three settled events, one thing said (2026-09-07 17:08, three rows in
     the thread). A settled caller line whose words begin with the previous
     settled caller line's words, with nothing said in between, replaces it. */
  if (update.final && !open && last && last.final && last.role === "user" && update.role === "user" && update.text && extendsUtterance(last.text, update.text)) {
    return [...lines.slice(0, -1), { ...last, text: update.text, ...(update.photos && update.photos.length > 0 ? { photos: update.photos } : {}) }];
  }
  /* AN EMPTY FINAL WITH NO OPEN TURN IS NOTHING. A repeated `done` after the
     turn has already closed used to open a new, blank, final line — a row
     with no words in the saved conversation. There is no turn for it to
     close, so there is nothing to record. */
  if (update.final && !update.text && !open) {
    return [...lines];
  }

  if (!open) {
    /* An empty partial opens nothing — a stray delta with no text would
       otherwise leave a blank bubble on screen for the rest of the call. */
    if (!update.text && !update.final) return [...lines];
    const fresh: TranscriptLine = {
      role: update.role,
      text: update.text,
      final: update.final,
      ...(update.via ? { via: update.via } : {}),
      ...(update.photos && update.photos.length > 0 ? { photos: update.photos } : {}),
    };
    /* A LATE USER FINAL GOES BEFORE THE ANSWER IT TRIGGERED. The assistant
       has an open line and the user's turn lands settled with no open line
       of its own: the question precedes its answer in the thread, so it is
       placed before the open assistant line, not after it. */
    if (update.final && update.role === "user" && last && !last.final && last.role === "assistant") {
      return [...lines.slice(0, -1), fresh, last];
    }
    return [...lines, fresh];
  }

  /* A CUMULATIVE update carries the whole turn so far, so replacing is
     correct and idempotent: a repeated event leaves the caption identical.
     An INCREMENTAL one is a piece, and is appended. */
  const merged: TranscriptLine = {
    role: update.role,
    /* A final with no text of its own keeps what the deltas already built,
       rather than blanking a caption the user was reading. */
    text: update.incremental ? open.text + update.text : update.text || open.text,
    final: update.final,
    /* The line keeps how it began. A spoken turn does not become a typed one
       because a later event omitted the field. */
    ...(open.via ?? update.via ? { via: open.via ?? update.via } : {}),
    /* Photos attach once, to the turn the lookup belonged to, and stay. */
    ...((open.photos?.length ? open.photos : update.photos?.length ? update.photos : null)
      ? { photos: open.photos?.length ? open.photos : update.photos }
      : {}),
  };
  const out = [...lines];
  out[openIdx] = merged;
  return out;
}

/**
 * A line the fold can no longer reach is settled. appendTranscript looks
 * back two lines for the open turn of a speaker; anything older is never
 * extended or closed again, so an open line left there — an answer whose
 * `done` never came, then two more turns — stayed dim on screen for the
 * rest of the call and held the persister at that index for ever. It is
 * closed with the words it has, or dropped when it has none. Applied by
 * the caller after every fold; pure and idempotent.
 */
export function settleStaleLines(lines: readonly TranscriptLine[]): TranscriptLine[] {
  let out: TranscriptLine[] | null = null;
  for (let i = lines.length - 3; i >= 0; i--) {
    const line = lines[i];
    if (line.final) continue;
    out ??= [...lines];
    if (line.text.trim()) out[i] = { ...line, final: true };
    else out.splice(i, 1);
  }
  return out ?? [...lines];
}

/**
 * Close the open line of one speaker, keeping its words. The answer ended
 * (`response.done`) or was cut off by the caller: either way no more of it
 * is coming, and a line left open is a line the persister waits on for
 * ever. A speaker with no open line, or an open line with no words, is
 * left as it is — an empty open line is dropped, not settled into a blank
 * row. Same two-line look-back as appendTranscript. Pure.
 */
export function settleOpenLine(lines: readonly TranscriptLine[], role: TranscriptRole): TranscriptLine[] {
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 2; i--) {
    const line = lines[i];
    if (line.final) continue;
    if (line.role !== role) continue;
    const out = [...lines];
    if (!line.text.trim()) {
      out.splice(i, 1);
      return out;
    }
    out[i] = { ...line, final: true };
    return out;
  }
  return [...lines];
}
