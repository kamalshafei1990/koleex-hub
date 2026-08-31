import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/session-config — the session the far side runs, authored HERE.

   WHY THIS MOVED OFF THE CLIENT. `session.update` is one event, and it carries
   the audio formats, the turn detection, the voice — and `instructions`, the
   system prompt, and eventually the tool definitions. The first version let
   the browser compose it. That was fine while it held nothing but transport
   settings and stops being fine the moment anything in it is policy: a browser
   that writes its own instructions is a browser that can rewrite them, and the
   standing rule is that the client never determines this. The server decides;
   the client relays.

   THE VOICE IS THE FIRST FIELD THAT FORCED IT. A user picking a voice is a
   user changing what goes in that event, so either the browser composes the
   event — and could then compose anything else in it — or the server does.
   This is the second.

   WHAT STILL REACHES THE BROWSER, said plainly: the vendor's voice id travels
   inside the config, because the client is the end of the DataChannel and
   there is no other way to put it on that channel. What does NOT travel is the
   ability to choose one that was not offered, or to add a field that was not
   authored here. The client relays an object it cannot extend.

   AND THE INSTRUCTIONS ARE WHY THIS MATTERED. Shipped without them, the model
   answered "who are you" with a vendor's name — the exact disclosure the
   standing identity rule forbids, spoken aloud to a user. A voice session
   carries no history and no system message unless this event supplies one, so
   an empty `instructions` is not a neutral default: it is the model's own
   idea of itself, which is not ours to leave to chance.
   --------------------------------------------------------------------------- */

import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { type VoiceOption } from "./config";

/* Transport settings. The formats follow from what a browser can capture and
   play, and turn detection is server-side because that is the only mode this
   transport offers — there is no push-to-talk here.

   `threshold` is the vendor's documented default. A noisy room — a factory
   floor — wants it higher, which is a number to find in a real room rather
   than invent at a desk, so it is left at the default and noted. */
const TRANSPORT = {
  modalities: ["text", "audio"],
  input_audio_format: "pcm",
  output_audio_format: "pcm",
  /* Without this the user's own words are never transcribed: the far side
     understands the audio and answers it while the screen shows one half of
     the conversation. Asking is opt-in and the omission is invisible. */
  input_audio_transcription: { enabled: true },
  turn_detection: {
    type: "server_vad",
    threshold: 0.5,
    silence_duration_ms: 800,
  },
} as const;

/* THE SAME RULE THE TEXT PATH USES, imported rather than restated. Two copies
   of an identity policy drift, and the copy that drifts is the one nobody is
   looking at — which for a spoken answer is worse, because there is no
   message bubble anyone can screenshot before it is gone.

   Voice adds one line of its own: spoken answers are heard, not read, so the
   deflection has to be short enough to say out loud without sounding like a
   recital. */
const VOICE_INSTRUCTIONS =
  "You are Koleex AI, speaking with a colleague by voice." +
  AI_PROVENANCE_RULE +
  " SPOKEN STYLE: keep answers short and natural — this is a conversation, not a document." +
  " No markdown, no lists, no headings: everything you say is heard, not read." +
  " If the identity question comes up, answer it in one short sentence and carry on.";

export type SessionUpdate = {
  type: "session.update";
  session: Record<string, unknown>;
};

/**
 * Build the event the client will relay.
 *
 * `voice` is applied only when a voice was resolved — an absent field means
 * the vendor's default, which is the correct behaviour when the owner has
 * configured no catalogue at all.
 */
export function buildSessionUpdate(voice: VoiceOption | null): SessionUpdate {
  return {
    type: "session.update",
    session: {
      ...TRANSPORT,
      /* NOT OPTIONAL AND NOT CONFIGURABLE. An operator who could switch this
         off could switch off the identity rule, so it is not an environment
         variable — it is what the product is. */
      instructions: VOICE_INSTRUCTIONS,
      ...(voice ? { voice: voice.vendorId } : {}),
    },
  };
}

/** What a client may know about the catalogue: a key to send back and a label
 *  to show. Never the vendor id — a browser that cannot name a voice cannot
 *  ask for one that was not offered. */
export function publicVoiceList(voices: readonly VoiceOption[]): Array<{ key: string; label: string }> {
  return voices.map((v) => ({ key: v.key, label: v.label }));
}
