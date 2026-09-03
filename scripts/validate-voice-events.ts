/* ---------------------------------------------------------------------------
   validate:voice-events — the layer between the wire and the screen.

   WHY THIS SUITE EXISTS AT ALL. A call worked, both sides spoke, and the
   screen stayed empty. Nothing threw, nothing logged, no test went red — the
   failure mode of this layer is SILENCE, and silence is indistinguishable
   from "not wired yet". So every event name is asserted against a literal
   string here rather than against the constant that produces it: comparing a
   constant to itself would pass through a rename that breaks the product.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  parseVoiceEvent,
  appendTranscript,
  EV_ASSISTANT_DELTA,
  EV_ASSISTANT_DONE,
  EV_USER_DELTA,
  EV_USER_DONE,
  EV_SESSION_UPDATED,
  EV_ERROR,
  EV_SPEECH_STARTED,
  type TranscriptLine,
} from "../src/lib/voice/events";

let pass = 0;
const failures: string[] = [];
/* A CONDITION MAY THROW, AND A THROW MUST BE A NAMED FAILURE. Twice already a
   mutation that broke the product crashed the suite instead of failing it —
   an index into a line the mutation stopped creating, and a parser that let
   malformed JSON escape. Both fail CI, but a Node stack trace does not say
   which guarantee broke, which is the whole job of a suite. Conditions are
   accepted as thunks so the throw happens inside this guard. */
function check(label: string, cond: boolean | (() => boolean)) {
  let ok: boolean;
  try {
    ok = typeof cond === "function" ? cond() : cond;
  } catch (e) {
    ok = false;
    label = `${label} — threw: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}
const ev = (o: Record<string, unknown>) => JSON.stringify(o);

console.log("\n── 1. The event names, pinned to literals ──");
{
  /* NOT compared to the constants — that would be a tautology. These are the
     strings the vendor documents, written out again by hand. */
  check("assistant streaming name", EV_ASSISTANT_DELTA === "response.audio_transcript.delta");
  check("assistant final name", EV_ASSISTANT_DONE === "response.audio_transcript.done");
  check("user streaming name", EV_USER_DELTA === "conversation.item.input_audio_transcription.delta");
  check("user final name", EV_USER_DONE === "conversation.item.input_audio_transcription.completed");
  check("speech-started name", EV_SPEECH_STARTED === "input_audio_buffer.speech_started");

  /* The four are distinct. A copy-paste that pointed two names at one string
     would silently merge two speakers into one. */
  const names = [EV_ASSISTANT_DELTA, EV_ASSISTANT_DONE, EV_USER_DELTA, EV_USER_DONE];
  check("the four transcript names are all different", new Set(names).size === 4);
}

{
  check("the acknowledgement and error names are pinned to literals",
    EV_SESSION_UPDATED === "session.updated" && EV_ERROR === "error");
}

console.log("\n── 2. Each event produces the right side of the conversation ──");
{
  const a = parseVoiceEvent(ev({ type: EV_ASSISTANT_DELTA, delta: "Hello" }));
  check("an assistant delta is attributed to the assistant", a.transcript?.role === "assistant");
  check("and is marked partial", a.transcript?.final === false);
  check("and reports that it is speaking", a.phase === "speaking");

  const u = parseVoiceEvent(ev({ type: EV_USER_DELTA, text: "how many" }));
  check("a user delta is attributed to the USER, not the assistant",
    u.transcript?.role === "user");
  check("and reports listening", u.phase === "listening");

  const ud = parseVoiceEvent(ev({ type: EV_USER_DONE, transcript: "how many orders today" }));
  check("a user final carries the final text",
    ud.transcript?.text === "how many orders today" && ud.transcript?.final === true);

  const ad = parseVoiceEvent(ev({ type: EV_ASSISTANT_DONE, transcript: "Fourteen." }));
  check("an assistant final carries its text",
    ad.transcript?.text === "Fourteen." && ad.transcript?.final === true);
  check("a finished turn stops claiming to be speaking", ad.phase === null);

  check("speech_started sets listening with no transcript", () =>
parseVoiceEvent(ev({ type: EV_SPEECH_STARTED })).phase === "listening" &&
    parseVoiceEvent(ev({ type: EV_SPEECH_STARTED })).transcript === null);
}

console.log("\n── 3. The confirmed prefix and the unconfirmed tail ──");
{
  /* The vendor sends `text` as settled and `stash` as still being revised.
     Showing only the settled half makes captions lag a word behind the
     speaker; showing both and replacing on the next delta reads smoothly. */
  const p = parseVoiceEvent(ev({ type: EV_USER_DELTA, text: "show me the ", stash: "invoic" }));
  check("a partial shows the confirmed text AND the unconfirmed tail",
    p.transcript?.text === "show me the invoic");

  const settled = parseVoiceEvent(ev({ type: EV_USER_DELTA, text: "show me the invoice" }));
  check("with no tail, only the confirmed text is shown",
    settled.transcript?.text === "show me the invoice");
}

console.log("\n── 4. Nothing unrecognised may take the call down ──");
{
  check("malformed JSON is ignored, not thrown", () =>
parseVoiceEvent("{not json").transcript === null);
  check("a JSON array is ignored", () =>
parseVoiceEvent("[1,2,3]").transcript === null);
  check("a bare string is ignored", () =>
parseVoiceEvent('"hello"').transcript === null);
  check("null is ignored", () =>
parseVoiceEvent("null").transcript === null);
  check("an event with no type is ignored", () =>
parseVoiceEvent(ev({ delta: "x" })).transcript === null);
  check("an unknown event type is ignored", () =>
parseVoiceEvent(ev({ type: "response.function_call_arguments.delta", delta: "{" })).transcript === null);

  /* A number where text belongs is a protocol change. Rendering "42" as
     speech would be worse than rendering nothing. */
  check("a non-string text field is not coerced and rendered", () =>
parseVoiceEvent(ev({ type: EV_USER_DELTA, text: 42 })).transcript?.text === "");
}

console.log("\n── 5. Folding fragments into lines ──");
{
  let lines: TranscriptLine[] = [];
  const feed = (raw: string) => {
    const t = parseVoiceEvent(raw).transcript;
    if (t) lines = appendTranscript(lines, t);
  };

  feed(ev({ type: EV_USER_DELTA, text: "how" }));
  feed(ev({ type: EV_USER_DELTA, text: "how many" }));
  feed(ev({ type: EV_USER_DELTA, text: "how many orders" }));
  check("streaming deltas extend ONE line rather than stacking", () => lines.length === 1);
  check("and the line holds the latest whole text", () => lines[0].text === "how many orders");

  feed(ev({ type: EV_USER_DONE, transcript: "how many orders today" }));
  check("the final closes the same line", () => lines.length === 1 && lines[0].final === true);
  check("and replaces the text with the final version", () => lines[0].text === "how many orders today");

  /* THE OVERLAP THAT MATTERS. The far side starts answering before the user's
     final transcript lands, so an assistant delta can arrive while the user's
     turn is still open. Gluing it on would attribute the answer to the user. */
  lines = [{ role: "user", text: "how many orders", final: false }];
  feed(ev({ type: EV_ASSISTANT_DELTA, delta: "Fourteen" }));
  check("a different speaker starts a NEW line even mid-turn", () => lines.length === 2);
  check("and the new line is the assistant's", () => lines[1].role === "assistant");
  check("the user's open line is left intact", () => lines[0].text === "how many orders");
}

console.log("\n── 5b. How the words got in — spoken or typed — survives the fold ──");
{
  /* A typed turn is appended as a settled user line marked via:"text", and the
     persister writes it as a TYPED message. A spoken one carries no via and is
     written as voice. The fold must keep each as it began. */
  let lines: TranscriptLine[] = [];
  lines = appendTranscript(lines, { role: "user", text: "KX-180", final: true, via: "text" });
  check("a typed turn keeps its via on the new line", () => lines[0].via === "text");
  lines = appendTranscript(lines, { role: "assistant", text: "Sure", final: false });
  check("a spoken turn carries no via", () => lines[1].via === undefined && !("via" in lines[1]));
  lines = appendTranscript(lines, { role: "assistant", text: "Sure, the KX-180.", final: true });
  check("  …and gains none when it settles", () => lines[1].via === undefined && lines[1].final);
  let typed: TranscriptLine[] = [{ role: "user", text: "KX", final: false, via: "text" }];
  typed = appendTranscript(typed, { role: "user", text: "KX-180", final: true });
  check("a line that began typed stays typed when a later update omits the field",
    () => typed.length === 1 && typed[0].via === "text");
}

console.log("\n── 5c. A photo attaches to the turn that showed it, and stays ──");
{
  const pic = [{ url: "https://cdn.example/kx180.jpg", label: "KX-180" }];
  let lines: TranscriptLine[] = [];
  lines = appendTranscript(lines, { role: "assistant", text: "The KX", final: false, photos: pic });
  check("photos ride on the new line", () => lines[0].photos?.[0].url === pic[0].url);
  lines = appendTranscript(lines, { role: "assistant", text: "The KX-180 spreads 1.8 m.", final: true });
  check("  …and survive the deltas and the final that omit them", () => lines[0].photos?.length === 1 && lines[0].final);
  lines = appendTranscript(lines, { role: "user", text: "and the price?", final: true });
  check("the next turn carries none", () => lines[1].photos === undefined && !("photos" in lines[1]));
  const bare = appendTranscript([], { role: "assistant", text: "hi", final: false, photos: [] });
  check("an empty list adds no field", () => !("photos" in bare[0]));
}

console.log("\n── 5d. The assistant's transcript arrives in PIECES, and the pieces add up ──");
{
  /* FOUND IN THE SAVED TRANSCRIPT, NOT IN A TEST. Every assistant turn was
     saved as its last fragment — "تمام", "ولي بس." — because the vendor's
     assistant delta carries `delta` (the next few characters) and the fold
     treated it as the whole turn. The fixture had always used cumulative
     text, so the suite was green while every caption was one word long. */
  let lines: TranscriptLine[] = [];
  const feed = (raw: string) => { const t = parseVoiceEvent(raw).transcript; if (t) lines = appendTranscript(lines, t); };
  feed(ev({ type: EV_ASSISTANT_DELTA, delta: "The KX" }));
  feed(ev({ type: EV_ASSISTANT_DELTA, delta: "-180 spreads" }));
  feed(ev({ type: EV_ASSISTANT_DELTA, delta: " 1.8 metres." }));
  check("assistant deltas ACCUMULATE", () => lines.length === 1 && lines[0].text === "The KX-180 spreads 1.8 metres.");
  check("  …and the update says so", parseVoiceEvent(ev({ type: EV_ASSISTANT_DELTA, delta: "x" })).transcript?.incremental === true);
  feed(ev({ type: EV_ASSISTANT_DONE }));
  check("a done event with no transcript keeps what the pieces built", () => lines[0].final && lines[0].text === "The KX-180 spreads 1.8 metres.");
  feed(ev({ type: EV_ASSISTANT_DONE }));
  check("  …and a repeated done neither doubles nor blanks it", () => lines.length === 1 && lines[0].text === "The KX-180 spreads 1.8 metres.");

  /* A vendor that sends the WHOLE turn as `text` is still handled: text is
     cumulative, delta is a piece. */
  let cum: TranscriptLine[] = [];
  const feedC = (raw: string) => { const t = parseVoiceEvent(raw).transcript; if (t) cum = appendTranscript(cum, t); };
  feedC(ev({ type: EV_ASSISTANT_DELTA, text: "Hel" }));
  feedC(ev({ type: EV_ASSISTANT_DELTA, text: "Hello there" }));
  check("a cumulative assistant delta still replaces", () => cum[0].text === "Hello there");
  check("  …and is not marked incremental", parseVoiceEvent(ev({ type: EV_ASSISTANT_DELTA, text: "Hello" })).transcript?.incremental !== true);
  feedC(ev({ type: EV_ASSISTANT_DONE, transcript: "Hello there." }));
  check("a done event WITH a transcript is authoritative", () => cum[0].text === "Hello there.");

  /* The user's transcription is unchanged: confirmed prefix plus tail,
     replaced each time. */
  let usr: TranscriptLine[] = [];
  const feedU = (raw: string) => { const t = parseVoiceEvent(raw).transcript; if (t) usr = appendTranscript(usr, t); };
  feedU(ev({ type: EV_USER_DELTA, text: "how many", stash: " ord" }));
  feedU(ev({ type: EV_USER_DELTA, text: "how many orders" }));
  check("the user's deltas still replace — they were never fragments", () => usr[0].text === "how many orders");
}

console.log("\n── 5e. The same final twice is one turn ──");
{
  /* Also from the saved transcript: the user's question and the assistant's
     "تمام" each appeared twice, back to back, because the protocol delivered
     the completed event twice and each copy opened a new line. */
  let lines: TranscriptLine[] = [];
  const feed = (raw: string) => { const t = parseVoiceEvent(raw).transcript; if (t) lines = appendTranscript(lines, t); };
  feed(ev({ type: EV_USER_DONE, transcript: "كلميني بالمصري" }));
  feed(ev({ type: EV_USER_DONE, transcript: "كلميني بالمصري" }));
  check("a repeated user final adds no line", () => lines.length === 1);
  feed(ev({ type: EV_ASSISTANT_DELTA, delta: "تمام" }));
  feed(ev({ type: EV_ASSISTANT_DONE, transcript: "تمام" }));
  feed(ev({ type: EV_ASSISTANT_DONE, transcript: "تمام" }));
  check("nor a repeated assistant final", () => lines.length === 2 && lines[1].text === "تمام");
  feed(ev({ type: EV_USER_DONE, transcript: "كلميني بالمصري" }));
  check("but the same words said AGAIN later are a new turn — only a back-to-back copy is dropped",
    () => lines.length === 3);
  feed(ev({ type: EV_USER_DONE, transcript: "" }));
  check("an empty final is not mistaken for a duplicate", () => lines.length === 3);
}

console.log("\n── 6. The awkward cases a live call actually produces ──");
{
  /* A repeated event — a retransmit, or React replaying a handler — must not
     double the caption. Replacing rather than concatenating makes this free. */
  let lines: TranscriptLine[] = [];
  const u = { role: "user" as const, text: "hello there", final: false };
  lines = appendTranscript(lines, u);
  lines = appendTranscript(lines, u);
  check("a repeated delta does not double the caption",
    () => lines.length === 1 && lines[0].text === "hello there");

  /* A final that carries no text of its own must keep what the deltas built,
     not blank a caption the user is reading. */
  lines = [{ role: "assistant", text: "Fourteen orders.", final: false }];
  lines = appendTranscript(lines, { role: "assistant", text: "", final: true });
  check("an empty final keeps the text the deltas already built",
    () => lines[0].text === "Fourteen orders." && lines[0].final === true);

  /* A stray empty partial must not leave a blank bubble on screen. */
  lines = appendTranscript([], { role: "user", text: "", final: false });
  check("an empty partial opens no line at all", lines.length === 0);

  /* After a turn closes, the next delta from the same speaker is a NEW turn. */
  lines = [{ role: "user", text: "first question", final: true }];
  lines = appendTranscript(lines, { role: "user", text: "second", final: false });
  check("a closed turn is never reopened", () => lines.length === 2 && lines[1].text === "second");

  /* Immutability: the caller holds React state. */
  const before: TranscriptLine[] = [{ role: "user", text: "a", final: true }];
  const after = appendTranscript(before, { role: "assistant", text: "b", final: false });
  check("the input array is never mutated", before.length === 1 && after.length === 2);
}

console.log("\n── 7. The session must ASK for the user's transcript ──");
{
  /* THE OTHER HALF OF THE EMPTY SCREEN, and the half no parser can fix. The
     far side only sends the user's words when the session configuration asks
     for them; without this the audio is understood and answered while the
     user's own speech is never reported at all.

     ASSERTED AGAINST THE SERVER MODULE, because that is where the
     configuration now lives: once a user could pick a voice, the browser could
     no longer be the thing composing an event that also carries instructions.
     The guarantee did not move, only its address. */
  const src = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
  check("the session configuration requests input transcription",
    () => /input_audio_transcription:\s*\{[^}]*enabled:\s*true/.test(src));

  const cfg = src.slice(src.indexOf("const TRANSPORT"), src.indexOf("} as const;"));
  check("and it is inside the object that is sent",
    () => /input_audio_transcription/.test(cfg));
  /* The TRANSPORT block still holds no policy — the identity instructions are
     a sibling field added at build time, deliberately kept out of the block
     that describes audio formats and turn detection. */
  check("the transport block still carries no policy",
    () => !/instructions/.test(cfg) && !/tools:/.test(cfg));

  /* And the client must no longer be composing one of its own. */
  const client = readFileSync("src/lib/voice/session.ts", "utf8");
  check("the client composes no session configuration at all",
    () => !/input_audio_transcription/.test(client) && !/turn_detection/.test(client));
  check("it relays what the server authored",
    () => /this\.sessionUpdate/.test(client));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: that the vendor sends these names. They are transcribed from its published event list; a real call is the only confirmation.");
