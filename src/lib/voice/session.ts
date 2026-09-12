/* ---------------------------------------------------------------------------
   lib/voice/session — the browser side of a realtime voice call.

   Phase 15 step 2. Deliberately NOT a React component: the connection is a
   state machine with a teardown obligation, and that is the part worth
   testing. A component that owned it would put the logic somewhere no
   assertion can reach — the same reason latencyStats() left its route.

   NOTHING IN THE PRODUCT RENDERS THIS YET. It is wired to no screen. A voice
   button appears when the call works end to end, not before.

   WHAT IT KNOWS ABOUT THE VENDOR: nothing. It posts an offer to our own route
   and applies the answer that comes back. It never learns an endpoint, a model
   id, a region or a key, and there is no field it could read them from. That
   is the whole point of brokering the handshake server-side, and it is
   asserted rather than assumed.

   EVERY DEPENDENCY IS INJECTED — the peer connection, the microphone, fetch.
   Not for purity: WebRTC does not exist in Node, so injection is the only way
   this logic gets tested at all rather than being verified by reading it.

   THE MICROPHONE IS THE SAFETY-CRITICAL PART. Every exit path — success,
   failure, refusal, timeout, caller stop — must stop the captured tracks. A
   voice feature that leaves the mic live after an error is a privacy defect,
   not a bug in a feature nobody is using yet, and it is the one thing here
   that can hurt someone.
   --------------------------------------------------------------------------- */

/* The only imports this module has are pure ones: no DOM, no network,
   no browser globals. Everything else arrives through VoiceDeps, which is
   what makes this file testable in Node at all. */
import {
  parseToolCallEvent,
  buildToolOutputMessage,
  RESPONSE_CREATE_MESSAGE,
  responseFunctionCalls,
  ToolCallNames,
  type VoiceToolCall,
} from "./tool-calls";
import { EV_SESSION_CREATED, EV_SESSION_UPDATED, EV_ERROR, EV_RESPONSE_DONE, EV_RESPONSE_CREATED } from "./events";

/** The event's `type`, for the diagnostics line — or "" when it has none. */
function eventTypeOf(raw: string): string {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && typeof (v as { type?: unknown }).type === "string" ? (v as { type: string }).type : "";
  } catch {
    return "";
  }
}
import { buildTextTurnMessages, buildNoteMessage, buildResponseRequest } from "./text-turn";
import { createBrowserWsAudio, type WsAudio, type WsAudioStats } from "./ws-audio";

/** True when a DataChannel message is exactly this event.
 *
 *  Malformed JSON is not an event: the far side sends well-formed messages,
 *  and guessing at a broken one is how a substring match got here in the
 *  first place. */
function isEventType(raw: string, type: string): boolean {
  try {
    const payload: unknown = JSON.parse(raw);
    return (
      !!payload &&
      typeof payload === "object" &&
      (payload as { type?: unknown }).type === type
    );
  } catch {
    return false;
  }
}

export type VoiceState =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "live"
  /** The connection dropped and may come back on its own. WebRTC recovers
   *  from a brief interruption without help, so this is not a failure yet —
   *  but a call that silently freezes while the user keeps talking is worse
   *  than one that says what is happening. */
  | "reconnecting"
  | "ended"
  /** Reached the vendor or our route and was refused. `reason` says which. */
  | "failed";

export type VoiceFailure =
  /** The user declined the microphone, or the device has none. */
  | "no-microphone"
  /** Signed in, but not permitted to use voice. */
  | "not-allowed"
  /** Too many calls started in a short window. Its OWN reason because the
   *  first version folded every unexpected status into "handshake failed",
   *  and a rate limit reported as a broken handshake is a debugging session
   *  spent in the wrong file — which is exactly what it cost. */
  | "too-many-calls"
  /** The session is no longer valid. Also folded in before, and also needs a
   *  different action from the user: sign in again, not try again. */
  | "signed-out"
  /** Voice is switched off on the server, or the vendor is unreachable. */
  | "unavailable"
  /** The handshake did not complete. */
  | "handshake-failed"
  /** The connection was established and then lost for good — a network that
   *  changed underneath the call rather than one that never worked. */
  | "connection-lost"
  /* The voice service did not answer at all: the route timed out or could not
     reach it. Network, region or egress — nothing the caller did. */
  | "service-unreachable"
  /* The voice service answered and REFUSED: credential, quota, workspace or
     model. Nothing the caller can retry their way out of, and the one class
     an owner can actually fix. */
  | "service-refused"
  /** Connected, but the far side would not accept the session configuration —
   *  distinguished from a failed handshake because the two need different
   *  fixes and the first version reported both the same way. */
  | "config-rejected";

/** Ten hex characters, once per call: enough to tell a week's calls apart,
 *  short enough to read off a log line. Never throws. */
export function newCallId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 10);
  } catch {
    /* fall through */
  }
  return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 10);
}

export type VoiceDiagnostics = {
  elapsed_ms: number;
  ice: string;
  dc: string;
  last_event: string;
  tool_calls: number;
  region: "primary" | "alt";
  ice_ever_connected: boolean;
  /** The last failure's cause, `Name: message`, bounded — "handshake
   *  failed" alone sent an investigation to the wrong place twice. */
  err: string;
  /** "type:count,…" — every event name the far side sent. Names only. */
  events: string;
  /** Socket lane: how many times the socket was redialled on this call, and
   *  the last close code the socket reported. */
  ws_reconnects: number;
  ws_close: string;
  /** The canary GET's outcome beside a slow socket-lane handshake ("" when
   *  none ran), and the far side's reason for the last answer that ended
   *  without completing ("" when every answer completed). */
  canary: string;
  resp_err: string;
  /** The longest wait, in one call, from a response's creation to the tool
   *  call it carried being complete — the "thinking" the caller sat through. */
  tool_wait_ms: number;
  /** THE CALL'S OWN ID (plan G1): minted when the call starts, on every
   *  beacon it sends, so one call's lines read together in the log. */
  call: string;
  /** SOCKET LANE, THE MICROPHONE'S SIDE (2026-09-09 03:09): frames this
   *  call sent up, the reader that made them with the context's state and
   *  rate, the frames it read and the context's state when it started
   *  ("worklet:running:48000:f1512:srunning", ":stalled" when both readers
   *  read nothing), the loudest sample the reader saw
   *  (0..1), and the microphone track's own state ("live:open:on" —
   *  readyState, muted or open, enabled or off). "" / 0 on the other lane. */
  up_frames: number;
  capture: string;
  mic_peak: number;
  mic: string;
};

export type VoiceEvents = {
  onState?: (state: VoiceState, failure?: VoiceFailure) => void;
  /** The assistant's audio. The caller attaches it to an <audio> element —
   *  playback is DOM, and this module deliberately touches no DOM. */
  onRemoteStream?: (stream: MediaStream) => void;
  /** The user's own microphone, handed out for METERING ONLY — an orb that
   *  reacts to your voice needs the amplitude, and measuring it is Web Audio,
   *  which is DOM. Never played back: routing a microphone to a speaker in the
   *  same room is feedback, and the far side already hears it. */
  onLocalStream?: (stream: MediaStream) => void;
  /** One decoded DataChannel message, passed through untouched. */
  onMessage?: (data: string) => void;
  /** THE FAR SIDE ACCEPTED THE SESSION CONFIGURATION, so it is now listening
   *  as Koleex AI and not as a blank vendor session. `live` is the transport;
   *  this is the moment the caller may actually speak. Fired once per call.
   *  Not fired when the configuration had to be resent in its compact form —
   *  the caller's own fallback timer covers that path. */
  onReady?: () => void;
  /** A tool call was made and answered — for a UI that wants to say
   *  "checking…" rather than leaving a silence the caller cannot read. */
  onToolCall?: (name: string) => void;
  /** What the server answered a tool call with, as the model is about to
   *  hear it. For a screen that wants to SHOW what was looked up — a product
   *  photo — rather than only let the model describe it. Data, not
   *  instruction: nothing here acts on it. */
  onToolResult?: (name: string, output: unknown) => void;
  /** A write tool answered with a PREVIEW (roadmap D1): the arguments its
   *  confirming phase needs, for a card the caller can tap. The server put
   *  them beside the model's envelope; nothing here acts on them. */
  onPendingWrite?: (name: string, pending: { tool: string; args: Record<string, unknown> }, message: string) => void;
  /** SOMETHING NAMED ITSELF A FUNCTION CALL AND COULD NOT BE READ.
   *
   *  This exists because the alternative is silence: if the vendor's event
   *  names differ from the protocol ones, the model asks to search, nothing
   *  happens, and it answers from memory sounding just as certain. A caller
   *  that logs this turns a wrong guess into something findable in a minute
   *  instead of a bug report about "the AI is out of date". */
  onToolProtocolMismatch?: (eventType: string) => void;
};

/** What the session needs of the thing it sends events on. An
 *  RTCDataChannel satisfies it as it is; the WebSocket lane wraps its
 *  socket into the same shape (a socket's readyState is a number). */
export type VoiceChannel = {
  readonly readyState: string;
  send(data: string): void;
};

/** Which road the call takes: WebRTC through our SDP route (the mainland
 *  lane, the product's original), or a WebSocket the browser opens to the
 *  vendor with a short-lived secret our server minted (the lane for callers
 *  outside mainland China — ai/voice/grok.ts). The SERVER says which, on
 *  the voices GET; the client never chooses a vendor. */
export type VoiceTransport = "rtc" | "ws";

/** The socket, as the session sees it — the browser's WebSocket satisfies
 *  this; the suite's double does too. */
export type VoiceSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

export type VoiceDeps = {
  createPeerConnection: () => RTCPeerConnection;
  getMicrophone: () => Promise<MediaStream>;
  fetchFn: typeof fetch;
  /** The WebSocket lane. Absent means the lane cannot be used from this
   *  runtime; the session then fails a "ws" call as unavailable. */
  createWebSocket?: (url: string, protocols: string[]) => VoiceSocket;
  /** The WebSocket lane's audio (ws-audio.ts). Absent in a runtime with no
   *  Web Audio — the suite — and the call then carries events only. */
  createWsAudio?: (sampleRate: number) => WsAudio;
  /** Test seam. Production uses the constant below. */
  iceTimeoutMs?: number;
  /** Test seam. Eight real seconds per assertion would make the recovery
   *  window the slowest thing in the suite, and a suite slow enough to skip
   *  proves nothing. */
  reconnectGraceMs?: number;
  /** Test seam for the window a call that WAS up gets to come back. */
  liveGraceMs?: number;
  /** Test seam for the socket lane's wait for the far side's first event. */
  wsFirstEventMs?: number;
  /** Test seam for the per-call cap, so the loop guard can be proved without
   *  making a dozen round trips. */
  maxToolCallsPerSession?: number;
  /** Test seam for the socket keepalive's period. */
  wsKeepaliveMs?: number;
};

/* ICE gathering normally finishes in well under a second on a local network
   and can take a few seconds behind a restrictive one. It can also never
   finish at all — a candidate that hangs leaves the state at "gathering"
   indefinitely. Sending a partial offer beats waiting forever: the candidates
   already collected are usually enough, and a call that never starts is worse
   than one that starts with fewer paths to try. */
/* SIX SECONDS, NOT THREE, and the extra three are close to free. Gathering
   finishes as soon as it is done — the timeout only bites on a network slow
   enough not to have finished, which is exactly the tunnelled or congested
   one this needs to tolerate. Cutting a slow network off early produces an
   offer with too few candidates: it negotiates, and then connects to nothing. */
const ICE_GATHER_TIMEOUT_MS = 6_000;

/* THE LOOP GUARD, at source. Generous enough that a real conversation never
   reaches it — a caller asking follow-up questions for ten minutes stays well
   inside — and finite, because "no uncontrolled agent loops" has to be true
   of the voice path too. The server enforces its own budget independently,
   which is what survives a page that has been tampered with. */
/* SIXTY, NOT TWELVE. Twelve was spent in four minutes of one real call: the
   model reaches for three or four tools per question (a search that finds
   nothing, a broader one, the product's details, its price), and after the
   twelfth every "show me its picture" was answered from memory — the caller
   heard "the picture shows a small machine" and saw no picture, then "no
   photo" for a stadium. The server's per-minute budget is the rate limit;
   this is only the ceiling that keeps a runaway loop finite. */
const MAX_TOOL_CALLS_PER_SESSION = 60;

/* HOW LONG A DROPPED CONNECTION MAY TRY TO COME BACK. `disconnected` is
   routinely transient — a handover between networks, a VPN re-establishing a
   tunnel — and WebRTC reconnects on its own without any help from us. Failing
   instantly would end calls that were about to recover; waiting forever leaves
   a user talking into a call that is never coming back. */
const RECONNECT_GRACE_MS = 8_000;
/* HOW LONG A CALL THAT WAS UP MAY TRY TO COME BACK. Longer than the window
   above, on purpose. The owner (2026-09-07): "when we talk suddenly it out
   of conversation" — a call in progress, ended under them. ICE reports
   `disconnected` on a phone for a handover between Wi-Fi and cellular, a
   tunnel re-keying, a walk to the lift; the browser itself allows about
   thirty seconds before it calls the pair failed, and most of those come
   back inside ten. Eight seconds ended calls that were about to recover.
   Twenty keeps the screen honest ("reconnecting") without ending a
   conversation that a person is still having; a link that is truly gone
   reports `failed` and ends the call at once, whatever this says. */
const LIVE_GRACE_MS = 20_000;
/** How long the WebSocket lane waits for its socket to open before the
 *  button's fall-back gets the call. See armReconnectTimer. */
const WS_OPEN_GRACE_MS = 4_000;
/** Our own deadline on the handshake POST; the route waits at most 45 s. */
const HANDSHAKE_TIMEOUT_MS = 50_000;
/* THE SOCKET LANE'S HANDSHAKE IS OUR OWN ROUTE, NOT THE MAINLAND VENDOR
   (2026-09-08 03:40: "Still connecting" on the screen for as long as the
   owner cared to wait; the route had answered in seconds, the answer never
   reached the phone). Fifty seconds is the mainland lane's allowance for
   a slow SDP exchange across a border. This lane's route mints a secret
   (eight seconds at most) and reads two tables (a second and a half):
   an answer that has not arrived in fifteen is not coming, and the caller
   is better served by the fall-back lane than by a longer wait. */
export const WS_HANDSHAKE_TIMEOUT_MS = 15_000;
/* A CANARY BESIDE A SLOW HANDSHAKE (2026-09-08 05:52–05:56: four socket-lane
   handshakes from the owner's phone, and not one reached our route, while
   the SDP handshake and the beacons — seconds apart, same origin — all did.
   The beacons said "aborted after fifteen seconds" and nothing else, and
   "our origin was unreachable" and "this one request went nowhere" are
   different faults with different fixes). When the POST has had no answer
   in four seconds, one small GET to our own origin runs beside it, and its
   outcome rides in the failure beacon as `canary`: status and time, or
   timeout, or error. */
const WS_CANARY_AFTER_MS = 4_000;
const WS_CANARY_TIMEOUT_MS = 5_000;
export const CANARY_PATH = "/api/version";
/* A SOCKET THAT OPENS AND SAYS NOTHING IS NOT A CALL (2026-09-08 06:21: the
   socket to the vendor opened — readyState 1 — and for ninety-six seconds
   not one event came down it, while the screen said "Still connecting" and
   the caller waited; the canary to our own origin timed out in the same
   seconds. A stalled tunnel keeps a connection "open" and moves nothing on
   it.) On this lane the transport is up when the far side has SPOKEN — its
   first event — not when the socket says open. A first dial whose socket
   has said nothing in this long is the service not answering: the call
   fails as such, and the button's fall-back to the mainland lane runs. */
export const WS_FIRST_EVENT_MS = 7_000;
/** The pause before the one retry of a handshake the link dropped. */
const HANDSHAKE_RETRY_DELAY_MS = 800;
/* ONE response.create PER RESPONSE, HOWEVER MANY CALLS IT MADE (tool-calls.ts,
   responseFunctionCalls: the brief's three lookups drew three answers).
   The set of a response's calls is known from its response.done; an output
   sent before that event waits for it, and a vendor that never sends the
   event still has its answer asked for after this long — one request for
   the outputs so far, not one per output. */
export const TOOL_RESPONSE_CREATE_FALLBACK_MS = 1_200;
/** How many more waits the fallback takes while a response is still being
 *  spoken (armToolResponseFallback). Two: the filler is a sentence. */
export const TOOL_RESPONSE_MAX_DEFERRALS = 2;

/** `Name: message`, bounded and without anything that is not a word — a
 *  cause for the log line, never a body or a token. "" for no cause. */
export function describeError(e: unknown): string {
  if (!e) return "";
  const name = e instanceof Error ? e.name : typeof e === "object" ? (e as { name?: unknown }).name : "";
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return `${String(name || "Error")}: ${String(message ?? "")}`.replace(/[^\w .:()/-]/g, "").slice(0, 100);
}

function isTimeoutError(e: unknown): boolean {
  const name = e && typeof e === "object" ? String((e as { name?: unknown }).name ?? "") : "";
  return name === "TimeoutError" || name === "AbortError";
}
/* Milliseconds of audio the receiver is asked to hold before playing. 400
   is a third of a second of steadiness against a jittery tunnel, and well
   under what a person notices as a delay in a conversation. */
const JITTER_BUFFER_TARGET_MS = 400;

/* The label is ours to choose — the vendor's sample notes the name is
   customizable. Named for what travels on it rather than after any vendor. */
const DATA_CHANNEL_LABEL = "koleex-events";

/* ---------------------------------------------------------------------------
   THE SESSION CONFIGURATION IS NO LONGER BUILT HERE.

   It used to be, and while it held nothing but audio formats that was
   defensible. It stopped being defensible the moment a user could pick a
   voice: the same `session.update` carries `instructions` and, soon, tool
   definitions, so a browser that composes it is a browser that can compose
   those too. The server now authors it and hands it over with the answer SDP;
   this module relays an object it cannot extend.

   A connected call is still a SILENT call until it is sent — that has not
   changed, only who writes it.
   --------------------------------------------------------------------------- */

/** Resolve when the connection has finished gathering candidates, or when the
 *  budget runs out. Never rejects — a timeout here is a degraded offer, not a
 *  failed call. */
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pc.removeEventListener?.("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener?.("icegatheringstatechange", onChange);
  });
}

/** SDP requires CRLF line endings. An answer that arrived as a text body may
 *  carry bare newlines, and setRemoteDescription rejects those. */
/** Bytes, not characters. A limit is in bytes and the identity rule is not
 *  ASCII in every language — measuring `.length` would under-count exactly
 *  where the message is largest. */
function byteLength(s: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : s.length;
}

export function normalizeSdp(sdp: string): string {
  const out = String(sdp).trim().replace(/\r?\n/g, "\r\n");
  return out.endsWith("\r\n") ? out : out + "\r\n";
}

/** Our own route. A constant, because the ONE thing a caller must never be
 *  able to influence is where the offer goes: that request carries the key on
 *  the other side of it. */
/** Where the browser relays a tool call. Fixed, for the same reason the
 *  handshake path is: a caller that could name this endpoint could route the
 *  model's requests somewhere we did not choose. */
/* How long after sending the full configuration an `error` is read as its
   refusal. The far side answers a session.update within a round trip; a
   refusal that took longer than this is something else's. */
const CONFIG_ACK_WINDOW_MS = 5_000;

export const TOOL_PATH = "/api/ai/voice/tool";

export const HANDSHAKE_PATH = "/api/ai/voice/session";
/* The WebSocket lane's own three events — the ones that are audio rather
   than protocol. Everything else on the socket is the shared protocol. */
const EV_WS_AUDIO_DELTA = "response.audio.delta";
/* The same frame under the protocol's newer name (see events.ts, the GA
   revision): a vendor on it sends this and never the one above. */
const EV_WS_AUDIO_DELTA_GA = "response.output_audio.delta";
/** How many distinct event types the histogram keeps. */
const EVENT_TYPES_MAX = 40;
const EV_WS_SPEECH_STARTED = "input_audio_buffer.speech_started";
const EV_WS_RESPONSE_CANCELLED = "response.cancelled";
const EV_WS_RESPONSE_CREATED = "response.created";

/** The route's statuses, mapped to what the screen can act on — the same
 *  table connect() applies inline (kept there so its pins hold). Pure. */
export function failureForStatus(status: number): VoiceFailure {
  return status === 403 ? "not-allowed"
    : status === 401 ? "signed-out"
    : status === 429 ? "too-many-calls"
    : status === 503 ? "unavailable"
    : status === 504 ? "service-unreachable"
    : status === 502 ? "service-refused"
    : "handshake-failed";
}

/** The WebSocket lane's handshake: no offer in, a socket and a secret out. */
export const WS_SESSION_PATH = "/api/ai/voice/ws-session";
/* THE SOCKET IS DIALLED AGAIN, AT ONCE, WHEN IT DROPS (owner, 2026-09-08
   02:4x: "again and again when I talk suddenly it closes the conversation
   by itself"). The metrics of that call show the phone's network going
   offline for five seconds mid-call; the socket died with it, and the
   session sat in "reconnecting" until the twenty-second deadline ended the
   call — nothing ever tried to dial again. Now a dropped socket on a call
   that WAS up is redialled immediately, then with a short backoff, for as
   long as the deadline allows: a new secret, a new socket, the same
   microphone, the same audio, the same screen. The far side's history
   comes back from the server with the new session. */
export const WS_RECONNECT_DELAYS_MS: readonly number[] = [0, 1_500, 3_000, 6_000];
/* THE KEEPALIVE (2026-09-11 15:07 UTC: the socket to the relay died twice at
   exactly 36 s, `client-closed 1006`, with audio frames flowing the whole
   time — the shape of a proxy on the phone's path that cuts a WebSocket it
   sees no application traffic on, protocol pings notwithstanding). While a
   socket to OUR relay is open, one small text frame goes up every ten
   seconds; the relay answers it and never forwards it (the vendor must not
   see an event it does not know), and the echo is not an event here: it
   makes nothing live and is not counted. Only when the handshake says the
   socket is the relay's (`keepalive: true`). */
export const WS_KEEPALIVE_MS = 10_000;
export const WS_KEEPALIVE_MESSAGE = JSON.stringify({ type: "koleex.keepalive" });

/** The close code a socket reports, as text for a beacon. Pure. */
export function closeCodeOf(ev: unknown): string {
  const code = ev && typeof ev === "object" ? (ev as { code?: unknown }).code : undefined;
  return typeof code === "number" ? String(code) : "";
}

/** The event histogram as one bounded string — THE NOTABLE KEYS FIRST
 *  (2026-09-11: every beacon of the day was cut at "respon…" — the ordinary
 *  events came first in arrival order and the six hundred characters ran
 *  out before `response.done.cancelled` or `error` could appear, which are
 *  the ones a cut sentence is diagnosed from). Cancellations, errors and
 *  the statuses of answers that did not complete lead; the rest follow in
 *  the order they were first seen. Pure; exported for the suite. */
export const NOTABLE_EVENT = /cancel|error|incomplete|fail|truncat|\.done\./i;
export function eventHistogram(counts: ReadonlyMap<string, number>): string {
  const entries = [...counts.entries()];
  const notable = entries.filter(([k]) => NOTABLE_EVENT.test(k));
  const rest = entries.filter(([k]) => !NOTABLE_EVENT.test(k));
  return [...notable, ...rest].map(([k, v]) => `${k}:${v}`).join(",").slice(0, 600);
}

export class VoiceSession {
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  /** The channel we opened. Step 3 sends session.update and tool results
   *  through it; nothing writes to it yet. */
  private channel: VoiceChannel | null = null;
  /* THE WEBSOCKET LANE'S TWO OBJECTS — null on the WebRTC lane. */
  private ws: VoiceSocket | null = null;
  /** Redial bookkeeping for a dropped socket (WS_RECONNECT_DELAYS_MS). */
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsReconnects = 0;
  private wsOutageAttempt = 0;
  private wsCloseCode = "";
  /** The socket keepalive (WS_KEEPALIVE_MS): whether this handshake allows
   *  it, and the interval while the socket is open. */
  private wsKeepalive = false;
  private wsKeepaliveTimer: ReturnType<typeof setInterval> | null = null;
  /** A microphone a failed call kept alive for the call that resumes it —
   *  see fail(). A phone asks no second permission for a stream it holds. */
  private orphanMic: MediaStream | null = null;
  /** Identifies the in-flight WebSocket handshake, so a stop() during it is
   *  honoured the way `this.pc !== pc` honours one on the other lane. */
  private wsAttempt: object | null = null;
  private wsAudio: WsAudio | null = null;
  /* THE CUT ANSWER MUST STAY CUT (owner, 2026-09-07: "when I speak I hear
     strange voices from Koleex AI, it seems to glitch"). A barge-in flushes
     what is queued — but frames of the answer being cut are still in flight
     on the socket and kept arriving for a moment after the flush, each one
     played the instant it landed: half-syllables of a sentence nobody is
     finishing, over the caller's own words. So after a barge-in every voice
     frame is dropped until the far side opens its NEXT response; frames that
     name the cut response are dropped even after that. */
  private wsResponseId: string | null = null;
  private wsSilencedResponse: string | null = null;
  private wsSilenced = false;
  /* The configuration is sent exactly once. Two triggers race to send it — the
     channel opening and `session.created` arriving — because the order of
     those two is the vendor's business and not something to depend on. */
  private configSent = false;
  /* THE FULL CONFIGURATION CAN BE REFUSED FOR ITS CONTENT, not only its size.
     A field the far side does not know — a transcription language hint, say
     — comes back as an `error` event, not a thrown send(), and the size
     fallback never saw it: the call stayed up, unconfigured, with the model's
     own idea of itself. So: after the full configuration goes out, an error
     that arrives before the far side has acknowledged it, or shown any
     progress, gets the compact configuration once. Any later error is the
     call's business, not the configuration's. */
  private configAckPending = false;
  private compactRetried = false;
  /** onReady is once per call: a second acknowledgement is not a second call. */
  private readyFired = false;
  private configSentAt = 0;
  /* Authored by the server, received with the answer, relayed unchanged. Null
     until the handshake completes — there is nothing to send before then. */
  private sessionUpdate: string | null = null;
  /* The same session in fewer words, authored by the server for the case where
     the channel will not carry the long one. */
  private sessionUpdateCompact: string | null = null;
  /* Cleared when the connection recovers, fires when it does not. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Has ICE ever actually connected? Decides whether "failed" is final. */
  private iceEverConnected = false;
  /** `Name: message` of the exception behind the last fail(), if any. */
  private lastError = "";
  /** The canary's outcome beside a slow socket-lane handshake (see
   *  WS_CANARY_AFTER_MS): "" until one ran. */
  private canary = "";
  /** The socket lane's wait for the far side's first event (WS_FIRST_EVENT_MS). */
  private wsFirstEventTimer: ReturnType<typeof setTimeout> | null = null;
  /** What the far side said about the last answer that did not complete:
   *  its status_details, bounded. "" until one did not. */
  private lastResponseError = "";
  /** THE WAIT FOR A LOOKUP (2026-09-08 07:06: forty-two seconds between the
   *  caller's question and the far side finishing the tool call's
   *  arguments — "thinking", and no answer). When the last response was
   *  created, and the longest gap from there to a parsed tool call. */
  private lastResponseCreatedAt = 0;
  private toolWaitMs = 0;
  /** Socket lane: `input_audio_buffer.append` frames sent on this call. */
  private wsFramesUp = 0;
  /* THE OTHER REGION. The server may hold a second endpoint (see the
     server's voice/config.ts for why). It tells this client two things with
     the answer: which SLOT served — a neutral word, never a host — and
     whether another exists. If this call's media never connects, which is
     what a VPN does to a mainland endpoint, the handshake is done ONCE more
     asking for the other slot. The server decides what that is. */
  private servedRegion: "primary" | "alt" = "primary";
  private altAvailable = false;
  private regionHint: "primary" | "alt" | null = null;
  private regionRetried = false;
  /** Mirrors the mic tracks' enabled flag, so the UI has one thing to read. */
  private muted = false;
  /** call_id → tool name, because the protocol sends the two halves apart. */
  private toolNames = new ToolCallNames();
  /** Calls already answered, so a repeated event does not run a tool twice.
   *  The protocol can deliver the same finished call on more than one event
   *  (the streamed one and response.done), and running a search twice is
   *  wasted money and a duplicated answer. */
  private answeredCalls = new Set<string>();
  /** THE LOOP GUARD. A model that can call a tool and then be asked to speak
   *  again can do that forever; the standing rule is no uncontrolled agent
   *  loops. The server caps this too — this one just stops the traffic at
   *  source. */
  private toolCallCount = 0;
  /* THE GATE ON response.create (TOOL_RESPONSE_CREATE_FALLBACK_MS). Outputs
     already sent whose response.done has not yet named their response;
     each response's calls still unanswered once it has; the one timer for
     a response.done that never comes. */
  private toolOutputsAwaitingDone = new Set<string>();
  private toolCallsOpenByResponse = new Map<string, Set<string>>();
  private toolResponseCreateTimer: ReturnType<typeof setTimeout> | null = null;
  /* NEVER INTO AN ANSWER STILL BEING SPOKEN (owner, 2026-09-11: "when the
     voice starts to think or find something the end of the sentence is
     cut"). A response.create that lands while the far side is still
     streaming its filler's audio cancels that response — the tail of
     "one moment, let me see" is what went missing. The response set on
     response.done is the ordinary gate; the fallback below now also waits,
     a bounded number of times, for the active response to finish. */
  private responseActive = false;
  private toolResponseDeferrals = 0;
  private state: VoiceState = "idle";
  /* FOR THE BEACON. When a call ends by itself nobody can say why from the
     server: the audio never touched it. These few facts travel with the
     failure so the next "it stopped by itself" has a cause attached. No
     content, no transcript — states and counts only. */
  private startedAt = 0;
  private callId = "";
  private lastEventType = "";
  /* EVERY EVENT TYPE THE FAR SIDE SENT, COUNTED. Names only, never payloads.
     A vendor on a different protocol revision is invisible from the
     server and indistinguishable from a silent one on the screen; the
     histogram in the end-of-call beacon is what says "it sent
     response.output_audio.delta 212 times and we were listening for
     response.audio.delta". Bounded: the first EVENT_TYPES_MAX distinct
     names, the rest counted under "…". */
  private eventCounts = new Map<string, number>();

  constructor(
    private readonly deps: VoiceDeps,
    private readonly events: VoiceEvents = {},
    /** Which voice to ask for. Opaque — this module never learns the vendor's
     *  own identifier, and cannot ask for one that was not offered. */
    private readonly voiceKey: string | null = null,
    /** The conversation this call continues, if it continues one. Sent to the
     *  server, which decides whether the caller owns it and what of it the
     *  call may hear; nothing of the thread is read here. */
    private readonly conversationId: string | null = null,
    /** The caller's UI language, as a hint for transcribing their speech.
     *  Sent as a code the server allow-lists; the server writes the session. */
    private readonly sttLanguage: string | null = null,
    /** Where the LAST call from this screen was served, when this one
     *  continues it (a resume after a drop, a voice switch). Two allow-listed
     *  words the server maps to endpoints it owns; the server may still
     *  choose otherwise. Without it a resume started from the configured
     *  order and could spend the whole reconnect budget timing out on a
     *  region the previous call had already found unreachable. */
    initialRegion: "primary" | "alt" | null = null,
    /** Which lane, as the server said on the voices GET. */
    private readonly transport: VoiceTransport = "rtc",
  ) {
    if (initialRegion) this.regionHint = initialRegion;
  }

  /* ---------------------------------------------------------------------
     TYPE INTO THE CALL. A model code, a quantity, a name in another alphabet
     — some things are easier typed than said. The text goes on the same
     DataChannel the configuration went on, as the user's turn, followed by
     the request to answer it (turn detection fires on audio only, so a typed
     turn would otherwise sit unanswered).

     RETURNS WHETHER IT WENT. False when there is no open channel yet or the
     text was empty, so the screen can say so rather than swallow it.
     --------------------------------------------------------------------- */
  /** Tell the model something the screen did, without asking it to answer
   *  (roadmap D1). Same channel, same cap, one message. */
  sendNote(text: string): boolean {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") return false;
    const message = buildNoteMessage(text);
    if (!message) return false;
    try {
      channel.send(message);
      return true;
    } catch {
      return false;
    }
  }

  /** How loud each side is, measured inside the socket lane's own audio
   *  context (WsAudio.levels). Null on the other lane. */
  levels(): { mic: number; far: number } | null {
    return this.wsAudio ? this.wsAudio.levels() : null;
  }

  /** Play a voice sample through the socket lane's own audio context —
   *  see WsAudio.playSample. Null on the other lane, where there is none. */
  previewAudio(bytes: ArrayBuffer): Promise<boolean> | null {
    return this.wsAudio ? this.wsAudio.playSample(bytes) : null;
  }

  /** Ask the far side to speak now, to these instructions, with no user
   *  turn added — a word from a newly chosen voice (text-turn.ts). */
  requestResponse(instructions: string): boolean {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") return false;
    const message = buildResponseRequest(instructions);
    if (!message) return false;
    try {
      channel.send(message);
      return true;
    } catch {
      return false;
    }
  }

  sendText(text: string): boolean {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") return false;
    const messages = buildTextTurnMessages(text);
    if (!messages) return false;
    try {
      for (const m of messages) channel.send(m);
      return true;
    } catch {
      return false;
    }
  }

  /* ---------------------------------------------------------------------
     MUTE — track.enabled, not track.stop() and not a closed connection.

     A disabled track stays in the peer connection and keeps sending silence,
     so the call, the negotiated media and the far side's own audio all carry
     on untouched; flipping it back is instant. Stopping the track instead
     would release the microphone, drop the m-line and need a renegotiation
     to undo, and would turn the browser's recording indicator off and on,
     which reads as "the call ended".

     THE INDICATOR STAYS LIT WHILE MUTED, and that is correct: the microphone
     IS still open, and a UI implying otherwise would be lying about hardware.
     What mute promises is that nothing you say is transmitted, and a disabled
     track is exactly that promise.
     --------------------------------------------------------------------- */
  setMuted(muted: boolean): void {
    this.muted = muted;
    /* Audio tracks only. There is no video here today, and a future one
       should not be silenced by a control labelled "mute". */
    for (const track of this.mic?.getAudioTracks() ?? []) track.enabled = !muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getState(): VoiceState {
    return this.state;
  }

  /** States and counts only — what a log line needs to explain a failure. */
  diagnostics(): VoiceDiagnostics {
    const capture = this.captureStats();
    return {
      elapsed_ms: this.startedAt ? Date.now() - this.startedAt : 0,
      ice: this.pc?.iceConnectionState ?? (this.ws ? `ws${this.ws.readyState}` : "none"),
      dc: this.channel?.readyState ?? "none",
      last_event: this.lastEventType.slice(0, 60),
      tool_calls: this.toolCallCount,
      region: this.servedRegion,
      ice_ever_connected: this.iceEverConnected,
      err: this.lastError,
      events: eventHistogram(this.eventCounts),
      ws_reconnects: this.wsReconnects,
      ws_close: this.wsCloseCode,
      canary: this.canary,
      resp_err: this.lastResponseError,
      tool_wait_ms: this.toolWaitMs,
      up_frames: this.wsFramesUp,
      capture: capture ? `${capture.path}:${capture.ctx}:${capture.rate}:f${capture.frames}:s${capture.start}${capture.stalled ? ":stalled" : ""}` : "",
      mic_peak: capture?.peak ?? 0,
      mic: this.micState(),
      call: this.callId,
    };
  }

  /** The socket-lane reader's own account (WsAudio.stats). Null on the
   *  other lane, and null rather than a throw for a double without stats(). */
  private captureStats(): WsAudioStats | null {
    const audio = this.wsAudio;
    if (!audio || typeof audio.stats !== "function") return null;
    try {
      return audio.stats();
    } catch {
      return null;
    }
  }

  /** "live:open:on" — the first audio track's readyState, muted or open,
   *  enabled or off. "none" without a microphone. */
  private micState(): string {
    const track = this.mic?.getAudioTracks?.()[0];
    if (!track) return "none";
    return `${track.readyState}:${track.muted ? "muted" : "open"}:${track.enabled ? "on" : "off"}`;
  }

  /** The microphone a call that lost its connection kept for the call that
   *  resumes it. Taken once; null when there is none. */
  takeMicrophone(): MediaStream | null {
    const mic = this.orphanMic;
    this.orphanMic = null;
    return mic;
  }

  private setState(next: VoiceState, failure?: VoiceFailure) {
    this.state = next;
    this.events.onState?.(next, failure);
  }

  /** Give up the microphone and the connection. Safe to call at any point,
   *  including twice — every failure path calls it, and so does the caller. */
  stop(): void {
    /* A pending timer on a call the user already ended would report a failure
       for a connection nobody is waiting on. */
    this.clearReconnectTimer();
    this.clearToolResponseTimer();
    /* TRACKS FIRST, and the order matters. Closing the peer connection does
       not stop a capture track; the recording light stays on and the browser
       keeps the device held. */
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    this.orphanMic?.getTracks().forEach((t) => t.stop());
    this.orphanMic = null;
    try {
      this.pc?.close();
    } catch {
      /* already closed — teardown must not throw over a cleanup detail */
    }
    this.pc = null;
    this.closeWs();
    this.channel = null;
    if (this.state !== "failed") this.setState("ended");
  }

  /** Tear down the WebSocket lane's objects, silently: a close the session
   *  itself asked for must not read as the far side hanging up. */
  private closeWs(): void {
    this.stopKeepalive();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      try {
        ws.close();
      } catch { /* already closed */ }
    }
    const audio = this.wsAudio;
    this.wsAudio = null;
    if (audio) {
      try {
        audio.close();
      } catch { /* teardown must not throw */ }
    }
  }

  /** Send the session configuration, at most once, and only on an open
   *  channel. A send on a connecting channel throws and would take the call
   *  down over a race that resolves itself a moment later. */
  private sendSessionConfig(channel: VoiceChannel): void {
    if (this.configSent || channel.readyState !== "open") return;
    /* Nothing to relay yet. Not a failure: the handshake has simply not landed,
       and the open handler will be called again by `session.created` or by the
       explicit send once it has. */
    if (!this.sessionUpdate) return;
    this.configSent = true;

    /* CHOOSE BY THE NEGOTIATED LIMIT, and choose only between the two objects
       the server wrote. A DataChannel refuses a message larger than the size
       agreed with the far side, and `send()` THROWS rather than truncating —
       which is how adding a thousand characters of identity policy turned a
       working call into "could not start the call".

       `maxMessageSize` is not implemented everywhere, so a missing value means
       "no reason to think it will not fit" rather than a guess at a number. */
    const limit = (channel as { maxMessageSize?: number }).maxMessageSize;
    const preferCompact =
      typeof limit === "number" && limit > 0 &&
      byteLength(this.sessionUpdate) > limit &&
      this.sessionUpdateCompact !== null;

    const first = preferCompact && this.sessionUpdateCompact ? this.sessionUpdateCompact : this.sessionUpdate;
    const second = first === this.sessionUpdate ? this.sessionUpdateCompact : null;

    try {
      channel.send(first);
      /* THE ACKNOWLEDGEMENT IS AWAITED FOR EITHER VERSION. It used to be
         awaited only after a full send, so a call that went compact-first
         never fired onReady and sat on "connecting" until the fallback timer
         (audit, 2026-09-07). A compact-first send simply has no compact
         retry left, which is what compactRetried records. */
      this.configAckPending = true;
      this.compactRetried = first !== this.sessionUpdate;
      this.configSentAt = Date.now();
      return;
    } catch {
      /* Fall through. The limit may be unreported, or reported wrongly, or the
         far side may simply have refused this payload. */
    }

    if (second) {
      try {
        channel.send(second);
        return;
      } catch {
        /* Both refused — the size was not the problem. */
      }
    }

    /* A connected but unconfigured call is the silent line this exists to
       prevent, so it is still a failure — but its OWN failure, because
       "the handshake did not complete" sent us looking in the wrong place. */
    this.configSent = false;
    this.fail("config-rejected");
  }

  /** The vendor announces the session before it will accept configuration.
   *  Wired alongside the open handler rather than instead of it. */
  private onChannelMessage(raw: string, channel: VoiceChannel): void {
    /* A message arrived, so the path it arrived on is up — whatever the ICE
       state property says (see markTransportUp). This is also what brings a
       "reconnecting" call back to live when the state watcher never says
       "connected" again: the far side is talking to us. */
    this.markTransportUp();
    /* THE EVENT'S `type`, NOT A SUBSTRING OF THE WHOLE MESSAGE. This read
       `raw.includes("session.created")`, which is true of any message that
       happens to contain those characters anywhere — an error body naming
       the event, a transcript of someone reading it aloud. Everything else
       in this file parses the JSON and switches on `type`; this one line
       did not, and it was also why the shared EV_SESSION_CREATED constant
       existed while nothing used it. Two copies of an event name is how one
       of them gets updated alone. */
    if (!this.configSent && isEventType(raw, EV_SESSION_CREATED)) {
      this.sendSessionConfig(channel);
    }
    if (this.configAckPending) {
      if (isEventType(raw, EV_ERROR)) {
        /* Refused for content, inside the window, and not yet retried: the
           compact configuration goes out once. Outside the window the error
           belongs to something else and the configuration stands. */
        if (!this.compactRetried && this.sessionUpdateCompact && Date.now() - this.configSentAt <= CONFIG_ACK_WINDOW_MS) {
          this.compactRetried = true;
          this.configAckPending = false;
          try {
            channel.send(this.sessionUpdateCompact);
          } catch {
            /* Nothing further to try; the size path already covers this. */
          }
        }
      } else if (isEventType(raw, EV_SESSION_UPDATED) || !isEventType(raw, EV_SESSION_CREATED)) {
        /* An acknowledgement, or any progress at all, means it was accepted. */
        this.configAckPending = false;
        if (!this.readyFired) {
          this.readyFired = true;
          this.events.onReady?.();
        }
      }
    }
    this.lastEventType = eventTypeOf(raw);
    {
      const t = this.lastEventType || "?";
      const key = this.eventCounts.has(t) || this.eventCounts.size < EVENT_TYPES_MAX ? t : "…";
      this.eventCounts.set(key, (this.eventCounts.get(key) ?? 0) + 1);
    }
    if (this.lastEventType === EV_RESPONSE_DONE) {
      this.noteResponseDone(raw);
      this.responseActive = false;
    }
    if (this.lastEventType === EV_RESPONSE_CREATED) {
      this.lastResponseCreatedAt = Date.now();
      this.responseActive = true;
    }
    if (this.lastEventType === "response.cancelled") this.responseActive = false;
    this.events.onMessage?.(raw);

    /* UNTRUSTED. This came off a network socket and describes something the
       model wants done. Nothing is executed here: the name is relayed to the
       server, which decides against its own allow-list whether it may run. */
    /* A FINISHED RESPONSE NAMES EVERY CALL IT MADE. Read whole: the calls
       are dispatched (once each — runToolCall de-duplicates by id) and the
       set is what gates the ONE response.create for this response. */
    if (this.lastEventType === EV_RESPONSE_DONE) {
      const done = responseFunctionCalls(raw, this.toolNames);
      if (!done || done.calls.length === 0) return;
      this.noteResponseCalls(done.responseId, done.calls.map((c) => c.callId), channel);
      for (const call of done.calls) {
        if (!call.name) {
          this.events.onToolProtocolMismatch?.(`${EV_RESPONSE_DONE} (function_call item)`);
          continue;
        }
        if (this.lastResponseCreatedAt) this.toolWaitMs = Math.max(this.toolWaitMs, Date.now() - this.lastResponseCreatedAt);
        void this.runToolCall(call, channel);
      }
      return;
    }
    const parsed = parseToolCallEvent(raw, this.toolNames);
    if (parsed.unreadable) {
      this.events.onToolProtocolMismatch?.(parsed.unreadable);
      return;
    }
    if (parsed.call) {
      if (this.lastResponseCreatedAt) this.toolWaitMs = Math.max(this.toolWaitMs, Date.now() - this.lastResponseCreatedAt);
      void this.runToolCall(parsed.call, channel);
    }
  }

  /**
   * Relay one tool call to the server and hand the answer back to the model.
   *
   * NEVER RUNS ANYTHING ITSELF. The browser is a courier: it carries the
   * request to a route that authenticates, checks the name against the
   * server's allow-list, checks the caller's permissions, and audits. That is
   * the whole reason this is a round trip rather than a fetch to a search API
   * from the page.
   */
  private async runToolCall(call: VoiceToolCall, channel: VoiceChannel): Promise<void> {
    /* Once per call_id. The protocol can deliver the same finished call on
       more than one event, and a search run twice costs money and produces a
       duplicated answer. */
    if (this.answeredCalls.has(call.callId)) return;
    this.answeredCalls.add(call.callId);
    this.toolNames.forget(call.callId);

    const cap = this.deps.maxToolCallsPerSession ?? MAX_TOOL_CALLS_PER_SESSION;
    if (this.toolCallCount >= cap) {
      /* ANSWERED, NOT IGNORED. A call left unanswered leaves the model waiting
         and the caller in silence; telling it plainly lets it say so out loud
         and carry on. */
      this.sendToolResult(channel, call.callId, {
        ok: false,
        message: "This call has used all its lookups. Tell the caller plainly that you cannot look anything else up on this call and that a new call resets it — never answer from memory as if you had looked.",
      });
      return;
    }
    this.toolCallCount++;
    this.events.onToolCall?.(call.name);

    let output: unknown;
    try {
      const res = await this.deps.fetchFn(TOOL_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: call.name,
          call_id: call.callId,
          arguments: call.argumentsJson,
          /* Which call this lookup belongs to, for the ledger and the audit
             table. The server checks ownership; an id is not a permission. */
          ...(this.conversationId ? { conversation_id: this.conversationId } : {}),
        }),
      });
      if (!res.ok) {
        /* The route's own body is not forwarded: it is written for a screen,
           and on a refusal it may name a limit. The model gets something it
           can say. */
        output = { ok: false, message: "That lookup could not be completed just now." };
      } else {
        const body = (await res.json()) as { output?: unknown; pending?: { tool?: unknown; args?: unknown } };
        output = body.output ?? { ok: false, message: "That lookup returned nothing." };
        const p = body.pending;
        if (p && typeof p.tool === "string" && p.args && typeof p.args === "object" && !Array.isArray(p.args)) {
          const msg = (output as { message?: unknown } | null)?.message;
          this.events.onPendingWrite?.(call.name, { tool: p.tool, args: p.args as Record<string, unknown> }, typeof msg === "string" ? msg : "");
        }
      }
    } catch {
      output = { ok: false, message: "That lookup could not be completed just now." };
    }

    /* The screen sees it as the model does, and at the same moment. */
    this.events.onToolResult?.(call.name, output);
    this.sendToolResult(channel, call.callId, output);
  }

  /** The output item, then — once every call of its response is answered —
   *  the one request for the model to carry on. */
  private sendToolResult(channel: VoiceChannel, callId: string, output: unknown): void {
    if (channel.readyState !== "open") return;
    try {
      channel.send(buildToolOutputMessage(callId, output));
    } catch {
      /* The call may have ended while the lookup was in flight. Nothing to
         recover: there is no longer anyone waiting for this answer. */
      return;
    }
    this.noteToolOutputSent(callId, channel);
  }

  /** A response's calls, from its response.done. The ones already answered
   *  are struck off; when none is left the answer is asked for at once,
   *  otherwise the rest wait for their outputs (noteToolOutputSent). */
  private noteResponseCalls(responseId: string, callIds: string[], channel: VoiceChannel): void {
    if (callIds.length === 0) return;
    const open = new Set<string>();
    for (const id of callIds) {
      if (this.toolOutputsAwaitingDone.delete(id)) continue;
      open.add(id);
    }
    if (this.toolOutputsAwaitingDone.size === 0) this.clearToolResponseTimer();
    if (open.size === 0) {
      this.sendResponseCreate(channel);
      return;
    }
    this.toolCallsOpenByResponse.set(responseId || `call:${callIds[0]}`, open);
  }

  /** An output went out. Its response's set, when known, loses it — and the
   *  last one out asks for the answer. Unknown yet (response.done still on
   *  its way): it waits, briefly, so a vendor that never sends the event
   *  still gets ONE request for whatever was answered. */
  private noteToolOutputSent(callId: string, channel: VoiceChannel): void {
    for (const [rid, open] of this.toolCallsOpenByResponse) {
      if (!open.delete(callId)) continue;
      if (open.size === 0) {
        this.toolCallsOpenByResponse.delete(rid);
        this.sendResponseCreate(channel);
      }
      return;
    }
    this.toolOutputsAwaitingDone.add(callId);
    if (this.toolResponseCreateTimer !== null) return;
    this.toolResponseDeferrals = 0;
    this.armToolResponseFallback(channel);
  }

  /** The fallback: after the wait, ONE response.create for the outputs
   *  whose response.done never came — unless the far side is still
   *  speaking its response, in which case the wait is taken again, up to
   *  TOOL_RESPONSE_MAX_DEFERRALS times, and then sent regardless (a vendor
   *  that never sends response.done must not silence the call). */
  private armToolResponseFallback(channel: VoiceChannel): void {
    this.toolResponseCreateTimer = setTimeout(() => {
      this.toolResponseCreateTimer = null;
      if (this.toolOutputsAwaitingDone.size === 0) return;
      if (this.responseActive && this.toolResponseDeferrals < TOOL_RESPONSE_MAX_DEFERRALS) {
        this.toolResponseDeferrals++;
        this.armToolResponseFallback(channel);
        return;
      }
      this.toolOutputsAwaitingDone.clear();
      this.sendResponseCreate(channel);
    }, TOOL_RESPONSE_CREATE_FALLBACK_MS);
  }

  private sendResponseCreate(channel: VoiceChannel): void {
    if (channel.readyState !== "open") return;
    try {
      channel.send(RESPONSE_CREATE_MESSAGE);
    } catch {
      /* The call ended under the answer; nobody is waiting. */
    }
  }

  private clearToolResponseTimer(): void {
    if (this.toolResponseCreateTimer !== null) {
      clearTimeout(this.toolResponseCreateTimer);
      this.toolResponseCreateTimer = null;
    }
  }

  private armReconnectTimer(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      /* Armed from "reconnecting", or from a "live" call whose media never
         connected (the watchdog set at the end of connect()). */
      if (this.state !== "reconnecting" && !(this.state === "live" && !this.iceEverConnected)) return;
      /* NEVER UP, AND THERE IS ANOTHER REGION: try it, once. A call whose
         media never connected through this endpoint is the shape a VPN
         produces, and the other endpoint is the one thing that changes it. A
         call that WAS up and dropped is a different failure — the network
         went away — and a second region does not bring it back. */
      /* A SOCKET THAT NEVER OPENED is the service not answering, not a
         connection that dropped: the button must not offer to resume a
         call that never was. */
      if (!this.iceEverConnected && this.transport === "ws") {
        this.fail("service-unreachable");
        return;
      }
      if (!this.iceEverConnected && this.altAvailable && !this.regionRetried) {
        this.regionRetried = true;
        this.regionHint = this.servedRegion === "alt" ? "primary" : "alt";
        void this.reconnectViaOtherRegion();
        return;
      }
      /* Still not back. A call that has been silent this long is over, and
         saying so beats leaving a live-looking screen in front of someone. */
      this.fail("connection-lost");
    }, this.iceEverConnected
      ? (this.deps.liveGraceMs ?? this.deps.reconnectGraceMs ?? LIVE_GRACE_MS)
      : this.transport === "ws" && this.deps.reconnectGraceMs === undefined
        /* A SOCKET THAT WILL OPEN OPENS IN A SECOND. One that a network
           blocks is reset at once or never answers; either way, four seconds
           is enough to know, and the mainland lane is waiting behind the
           fall-back. Eight was a caller staring at "connecting". */
        ? WS_OPEN_GRACE_MS
        : (this.deps.reconnectGraceMs ?? RECONNECT_GRACE_MS));
  }

  /** THE TRANSPORT IS UP — by whichever sign arrives first.

      The call was watched through `iceConnectionState` alone, and that is
      where a working call was ended (owner, 2026-09-07: "suddenly it out
      of conversation"). Safari does not always report `connected` on that
      property for a connection that is plainly carrying audio and data;
      the never-connected watchdog then saw a "live" call whose media had
      "never come up", switched region — onto the endpoint that refuses
      this account — and ended a conversation that was mid-sentence.

      A DataChannel cannot open, and no event can arrive on it, unless ICE,
      DTLS and SCTP have all come up underneath: an open channel or a single
      message IS the media path connected, whatever the state property says.
      So every one of those signs marks the call connected: the ICE state,
      the connection state, the channel opening, the first message. From
      here, "failed" is final and "disconnected" gets the live window. */
  private markTransportUp(): void {
    /* THE SOCKET LANE IS UP WHEN THE FAR SIDE HAS SPOKEN (WS_FIRST_EVENT_MS):
       the first event ends the wait and makes the call live. An open socket
       alone made nothing live — see the constant. */
    if (this.transport === "ws" && this.state === "connecting") {
      this.clearReconnectTimer();
      this.wsOutageAttempt = 0;
      this.iceEverConnected = true;
      this.setState("live");
      return;
    }
    if (!this.iceEverConnected) this.iceEverConnected = true;
    if (this.state === "reconnecting" || (this.state === "live" && this.reconnectTimer !== null)) {
      this.clearReconnectTimer();
      if (this.state === "reconnecting") {
        this.wsOutageAttempt = 0;
        this.setState("live");
      }
    }
  }

  /** The data channel closed under a call that was up. */
  private onChannelClosed(): void {
    if (this.state !== "live" && this.state !== "reconnecting") return;
    if (this.state === "live") this.setState("reconnecting");
    this.armReconnectTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wsReconnectTimer !== null) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.wsFirstEventTimer !== null) {
      clearTimeout(this.wsFirstEventTimer);
      this.wsFirstEventTimer = null;
    }
  }

  private fail(reason: VoiceFailure, cause?: unknown): void {
    /* A CALL THE USER ALREADY ENDED CANNOT FAIL. The handshake keeps running
       after stop(): its fetch resolves, the answer is applied to a closed
       connection, that throws — and the caller who hung up while
       "connecting" was told "could not start the call" for a call they
       ended themselves (production, 2026-09-07 15:01, a beacon with no
       session behind it). Ended is final. */
    if (this.state === "ended") return;
    this.lastError = describeError(cause);
    this.clearReconnectTimer();
    this.clearToolResponseTimer();
    /* A CALL THAT WAS UP AND LOST ITS LINE KEEPS THE MICROPHONE for the call
       that resumes it (takeMicrophone): stopping the tracks here made the
       resume ask the phone for the microphone again, outside any tap, and
       a phone can refuse that — the resume died before it dialled. The
       button either hands the stream to the next session or stops it. */
    if (reason === "connection-lost" && this.iceEverConnected && this.mic) {
      this.orphanMic = this.mic;
    } else {
      this.mic?.getTracks().forEach((t) => t.stop());
    }
    this.mic = null;
    try {
      this.pc?.close();
    } catch { /* see stop() */ }
    this.pc = null;
    this.closeWs();
    this.channel = null;
    this.setState("failed", reason);
  }

  /** Open a call. Resolves when the handshake is applied, or after failing —
   *  the outcome is the STATE, not a thrown error, because every caller of
   *  this needs to render a reason rather than catch one. */
  async start(): Promise<void> {
    if (this.state === "connecting" || this.state === "live") return;

    this.setState("requesting-mic");
    this.startedAt = Date.now();
    this.callId = newCallId();
    let mic: MediaStream;
    try {
      mic = await this.deps.getMicrophone();
    } catch {
      /* A refused permission and a machine with no microphone are the same
         thing to the user: they cannot talk. */
      this.fail("no-microphone");
      return;
    }
    /* HUNG UP WHILE THE PERMISSION PROMPT WAS OPEN. stop() ran first — the
       state is ended and nothing holds this session any more — and then the
       prompt resolved with a live capture stream. Kept, it would light the
       recording indicator on a call nobody can end; dialled, it would bring
       a screen back for a call the caller already left (audit, 2026-09-11). */
    if (this.state !== "requesting-mic") {
      mic.getTracks().forEach((t) => t.stop());
      return;
    }
    this.mic = mic;

    /* A NEW CALL ALWAYS STARTS UNMUTED. Without this the flag survives into
       the next call: the user speaks into a session that looks live, hears
       nothing back, and has no reason to connect it to a mute they set
       minutes ago in a different call. Applied to the tracks too, because a
       browser can hand back the same stream object. */
    this.muted = false;
    for (const track of this.mic.getAudioTracks()) track.enabled = true;

    /* Announced before the connection is attempted: the orb should react to
       the user's voice from the moment the microphone is live, not only once
       a far-end connection exists. */
    this.events.onLocalStream?.(this.mic);

    if (this.transport === "ws") await this.connectWs();
    else await this.connect();
  }

  /* ---------------------------------------------------------------------
     THE WEBSOCKET LANE. One POST to our route returns the socket url, the
     subprotocol carrying a short-lived secret, the audio rate, and the same
     server-authored session the other lane gets. The browser opens the
     socket to the vendor; microphone frames go up as
     `input_audio_buffer.append`, the voice comes down as
     `response.audio.delta`, and every other event is the protocol the rest
     of this class already speaks — the same onChannelMessage, the same
     tool relay, the same config-and-acknowledge. Nothing above the
     transport knows which lane it is on.
     --------------------------------------------------------------------- */
  private async connectWs(): Promise<void> {
    await this.dialWs(true);
  }

  /** One dial of the socket lane: our route for a secret and a session,
   *  then the socket to the vendor. `first` is the call's own handshake —
   *  its failures END the call. A redial's failures do not: the caller
   *  schedules the next attempt until the deadline (armReconnectTimer)
   *  says the line is gone. Resolves true once a socket object exists;
   *  whether it opens is the socket's own story (onopen / onclose). */
  private async dialWs(first: boolean): Promise<boolean> {
    if (!this.mic) {
      if (first) this.fail("no-microphone");
      return false;
    }
    if (!this.deps.createWebSocket) {
      if (first) this.fail("unavailable");
      return false;
    }
    /* Ended is final: a call the caller already left is not dialled. */
    if (this.state === "ended") return false;
    if (first) this.setState("connecting");
    const marker = {};
    this.wsAttempt = marker;
    const alive = () => this.wsAttempt === marker && this.state === (first ? "connecting" : "reconnecting");

    let url = "";
    let protocols: string[] = [];
    let sampleRate = 24_000;
    try {
      const query = new URLSearchParams();
      if (this.voiceKey) query.set("voice", this.voiceKey);
      if (this.conversationId) query.set("conversation", this.conversationId);
      if (this.sttLanguage) query.set("stt", this.sttLanguage);
      const qs = query.toString();
      const path = qs ? `${WS_SESSION_PATH}?${qs}` : WS_SESSION_PATH;
      /* THE REQUEST CARRIES A BODY (2026-09-08 05:52–05:56: four handshakes
         from the owner's phone, and not one of them reached our route — the
         SDP handshake and the beacons, seconds apart on the same origin,
         all did. The one difference on the wire: this POST carried nothing,
         no body and no content type, and so did the lane probe's. Whatever
         sits between that phone and us — a tunnel's local proxy, a
         middlebox — held or dropped the empty POSTs and passed the rest.)
         The same three fields as the query, as JSON; the route reads
         either, so an older page keeps working. */
      const handshakeBody = JSON.stringify({
        ...(this.voiceKey ? { voice: this.voiceKey } : {}),
        ...(this.conversationId ? { conversation: this.conversationId } : {}),
        ...(this.sttLanguage ? { stt: this.sttLanguage } : {}),
      });
      /* Same retry rule as the other lane: once, on a bare network error,
         never on our own deadline, never after a hang-up. */
      const post = () => this.deps.fetchFn(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: handshakeBody,
        ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(WS_HANDSHAKE_TIMEOUT_MS) } : {}),
        credentials: "include",
      });
      /* The canary runs only beside the call's own handshake — a redial's
         slowness is the outage the redial is already about. */
      const disarmCanary = first ? this.armCanary() : () => {};
      let res: Response;
      try {
        try {
          res = await post();
        } catch (firstErr) {
          if (!(firstErr instanceof TypeError) || isTimeoutError(firstErr) || !alive()) throw firstErr;
          await new Promise((r) => setTimeout(r, HANDSHAKE_RETRY_DELAY_MS));
          if (!alive()) throw firstErr;
          res = await post();
        }
      } finally {
        disarmCanary();
      }
      if (!alive()) return false;
      if (!res.ok) {
        if (first) this.fail(failureForStatus(res.status));
        return false;
      }
      const body = (await res.json()) as {
        url?: unknown; protocols?: unknown; session?: unknown; session_compact?: unknown; audio?: { sample_rate?: unknown };
      };
      url = typeof body.url === "string" ? body.url : "";
      protocols = Array.isArray(body.protocols) ? body.protocols.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
      const rate = body.audio?.sample_rate;
      if (typeof rate === "number" && rate >= 8_000 && rate <= 48_000) sampleRate = rate;
      this.wsKeepalive = (body as { keepalive?: unknown }).keepalive === true;
      if (body.session && typeof body.session === "object") this.sessionUpdate = JSON.stringify(body.session);
      if (body.session_compact && typeof body.session_compact === "object") this.sessionUpdateCompact = JSON.stringify(body.session_compact);
      /* Only a secure socket, only with a secret to present. */
      if (!/^wss:\/\//i.test(url) || protocols.length === 0 || !this.sessionUpdate) {
        if (first) this.fail("handshake-failed");
        return false;
      }
    } catch (e) {
      if (first) this.fail(isTimeoutError(e) ? "service-unreachable" : "handshake-failed", e);
      return false;
    }
    if (!alive()) return false;

    let ws: VoiceSocket;
    try {
      ws = this.deps.createWebSocket(url, protocols);
    } catch (e) {
      if (first) this.fail("handshake-failed", e);
      return false;
    }
    /* A redial replaces the dead socket silently: its close is not news. */
    this.stopKeepalive();
    const prev = this.ws;
    if (prev && prev !== ws) {
      prev.onclose = null;
      prev.onmessage = null;
      prev.onerror = null;
      prev.onopen = null;
      try {
        prev.close();
      } catch { /* already closed */ }
    }
    this.ws = ws;
    const channel: VoiceChannel = {
      get readyState() {
        return ws.readyState === 1 ? "open" : ws.readyState === 0 ? "connecting" : "closed";
      },
      send: (data: string) => ws.send(data),
    };
    this.channel = channel;
    /* THE AUDIO OUTLIVES THE SOCKET. One context, one microphone reader,
       one far-side stream for the whole call; a redial changes only the
       socket the frames travel on. (A second context under a live
       microphone is what garbled the microphone — ws-audio.ts.)

       AND IT IS BUILT INSIDE A CATCH (2026-09-09 02:24). The factory threw
       (ws-audio.ts has the line), this dial threw with it — after the
       socket existed and before its handlers were attached — and the call
       sat in "connecting" for ever with an open, silent socket. A factory
       that fails is now a NAMED failure the beacon carries, and the button's
       fall-back to the mainland lane runs; a redial keeps the audio it has. */
    if (!this.wsAudio && this.deps.createWsAudio) {
      try {
        this.wsAudio = this.deps.createWsAudio(sampleRate);
      } catch (e) {
        if (first) this.fail("handshake-failed", e);
        else this.closeWs();
        return false;
      }
    }
    const audio = this.wsAudio;
    /* The new session is configured afresh. */
    this.configSent = false;
    this.configAckPending = false;
    this.compactRetried = false;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      if (this.wsKeepalive) this.startKeepalive(ws);
      /* AN OPEN SOCKET IS NOT THE TRANSPORT UP. The far side's first event
         is (markTransportUp, from onChannelMessage) — an open socket that
         says nothing is what a stalled tunnel looks like (WS_FIRST_EVENT_MS).
         The session goes out and the microphone reader starts now, so the
         far side has something to answer. */
      this.sendSessionConfig(channel);
      if (audio && first) {
        this.events.onRemoteStream?.(audio.stream);
        if (this.mic) {
          audio.startCapture(this.mic, (b64) => {
            /* Whichever socket is current — a redial keeps the reader. */
            const live = this.ws;
            if (!live || live.readyState !== 1) return;
            try {
              live.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
              this.wsFramesUp += 1;
            } catch {
              /* The socket closed under a frame; onclose handles the call. */
            }
          });
        }
      }
    };
    ws.onmessage = (m) => {
      if (this.ws !== ws || typeof m.data !== "string") return;
      /* The relay's echo of our own keepalive: not the far side speaking. */
      if (m.data === WS_KEEPALIVE_MESSAGE) return;
      this.onWsAudioEvent(m.data, this.wsAudio);
      this.onChannelMessage(m.data, channel);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.wsCloseCode = closeCodeOf(ev);
      /* The call's own socket, closed before the far side said a word: the
         service did not answer (refused, blocked, a dead network). Said now,
         not after the wait — the fall-back runs sooner. */
      if (this.state === "connecting") {
        this.fail("service-unreachable");
        return;
      }
      /* A LIVE call that drops starts the deadline (onChannelClosed) once;
         a redial that dies while already reconnecting must not push the
         deadline out — it simply schedules the next attempt. */
      if (this.state === "live") this.onChannelClosed();
      this.scheduleWsReconnect();
    };
    ws.onerror = () => {
      /* A close follows an error; the close is what the call acts on. */
    };

    if (first) {
      /* NOT LIVE YET. Live is the far side's first event (markTransportUp);
         a socket that has said nothing by the deadline — never opened, or
         opened onto a stalled tunnel — is the service not answering. */
      this.clearReconnectTimer();
      this.wsFirstEventTimer = setTimeout(() => {
        this.wsFirstEventTimer = null;
        if (this.state === "connecting" && this.ws === ws) this.fail("service-unreachable");
      }, this.deps.wsFirstEventMs ?? WS_FIRST_EVENT_MS);
    }
    return true;
  }

  private startKeepalive(ws: VoiceSocket): void {
    this.stopKeepalive();
    this.wsKeepaliveTimer = setInterval(() => {
      if (this.ws !== ws || ws.readyState !== 1) {
        this.stopKeepalive();
        return;
      }
      try {
        ws.send(WS_KEEPALIVE_MESSAGE);
      } catch {
        /* The socket is closing; its close handler owns what happens next. */
      }
    }, this.deps.wsKeepaliveMs ?? WS_KEEPALIVE_MS);
  }

  private stopKeepalive(): void {
    if (this.wsKeepaliveTimer !== null) {
      clearInterval(this.wsKeepaliveTimer);
      this.wsKeepaliveTimer = null;
    }
  }

  /** Arm the canary (WS_CANARY_AFTER_MS): after the delay, one GET to our
   *  own origin, its outcome kept for the beacon. Returns the disarm; a
   *  handshake that answers in time never sends one. A canary already in
   *  flight finishes on its own — its answer is still worth having. */
  private armCanary(): () => void {
    const timer = setTimeout(() => {
      const t0 = Date.now();
      const took = () => `${Date.now() - t0}ms`;
      Promise.resolve()
        .then(() => this.deps.fetchFn(CANARY_PATH, {
          method: "GET",
          cache: "no-store",
          ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(WS_CANARY_TIMEOUT_MS) } : {}),
        }))
        .then((r) => { this.canary = `${r.status}/${took()}`; })
        .catch((e) => { this.canary = `${isTimeoutError(e) ? "timeout" : "error"}/${took()}`; });
    }, WS_CANARY_AFTER_MS);
    return () => clearTimeout(timer);
  }

  /** AN ANSWER THAT ENDED BADLY IS COUNTED BY HOW (2026-09-08 05:54, the
   *  mainland lane's other region: four answers, three finished their
   *  audio, the fourth ended with response.done and nothing after it —
   *  and the histogram could not say whether the far side failed it, cut
   *  it short or cancelled it). A status other than completed becomes one
   *  more histogram key, `response.done.<status>`, and the far side's
   *  reason — words, bounded — is kept for the beacon. */
  private noteResponseDone(raw: string): void {
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      return;
    }
    const resp = (v as { response?: { status?: unknown; status_details?: { type?: unknown; reason?: unknown; error?: { type?: unknown; code?: unknown; message?: unknown } } } } | null)?.response;
    const status = typeof resp?.status === "string" ? resp.status.replace(/[^a-z_]/gi, "").slice(0, 16) : "";
    if (!status || status === "completed") return;
    const key = `${EV_RESPONSE_DONE}.${status}`;
    this.eventCounts.set(key, (this.eventCounts.get(key) ?? 0) + 1);
    const d = resp?.status_details;
    const parts = [d?.reason, d?.type, d?.error?.code, d?.error?.message].filter((p): p is string => typeof p === "string" && p.length > 0);
    if (parts.length) this.lastResponseError = parts.join(" ").slice(0, 120);
  }

  /** The next redial, after the outage's backoff — only on the socket lane,
   *  only for a call that was up, only while it is still reconnecting. */
  private scheduleWsReconnect(): void {
    if (this.transport !== "ws" || !this.iceEverConnected || this.state !== "reconnecting") return;
    if (this.wsReconnectTimer !== null) return;
    const delay = WS_RECONNECT_DELAYS_MS[Math.min(this.wsOutageAttempt, WS_RECONNECT_DELAYS_MS.length - 1)];
    this.wsOutageAttempt++;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.state !== "reconnecting") return;
      this.wsReconnects++;
      void this.dialWs(false).then((dialled) => {
        if (!dialled) this.scheduleWsReconnect();
      });
    }, delay);
  }

  /** The two events that are SOUND on this lane and nothing else: a frame of
   *  the far side's voice, and the caller starting to speak over it. */
  private onWsAudioEvent(raw: string, audio: WsAudio | null): void {
    if (!audio) return;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      return;
    }
    if (!v || typeof v !== "object") return;
    const type = (v as { type?: unknown }).type;
    if (type === EV_WS_RESPONSE_CREATED) {
      const id = (v as { response?: { id?: unknown } }).response?.id;
      this.wsResponseId = typeof id === "string" ? id : null;
      this.wsSilenced = false;
      return;
    }
    if (type === EV_WS_AUDIO_DELTA || type === EV_WS_AUDIO_DELTA_GA) {
      const rid = (v as { response_id?: unknown }).response_id;
      /* A late frame of an answer the caller cut: not a sound. */
      if (this.wsSilenced || (typeof rid === "string" && rid === this.wsSilencedResponse)) return;
      const delta = (v as { delta?: unknown }).delta;
      if (typeof delta === "string" && delta) {
        try {
          audio.play(delta);
        } catch {
          /* One bad frame is a click, not a dropped call. */
        }
      }
      return;
    }
    if (type === EV_WS_SPEECH_STARTED || type === EV_WS_RESPONSE_CANCELLED) {
      audio.flush();
      this.wsSilencedResponse = this.wsResponseId;
      this.wsSilenced = true;
    }
  }

  /** The handshake again, on the other region, with the microphone kept.
   *  Everything the first connection negotiated is discarded: a new peer
   *  connection, a new channel, a session configuration to be sent afresh. */
  private async reconnectViaOtherRegion(): Promise<void> {
    if (!this.mic || this.state === "ended" || this.state === "failed") return;
    try {
      this.pc?.close();
    } catch { /* see stop() */ }
    this.pc = null;
    this.channel = null;
    this.configSent = false;
    this.configAckPending = false;
    this.compactRetried = false;
    this.readyFired = false;
    this.sessionUpdate = null;
    this.sessionUpdateCompact = null;
    this.iceEverConnected = false;
    await this.connect();
  }

  /** Negotiate one connection: peer connection, offer, our route, answer.
   *  Resolves when the answer is applied or after failing — the outcome is
   *  the STATE. Requires the microphone to be held already. */
  private async connect(): Promise<void> {
    /* Ended is final: a call the caller already left is not dialled. */
    if (this.state === "ended") return;
    if (!this.mic) {
      this.fail("no-microphone");
      return;
    }
    this.setState("connecting");
    let pc: RTCPeerConnection;
    try {
      pc = this.deps.createPeerConnection();
      this.pc = pc;
      for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);

      /* NOTHING WATCHED THE CONNECTION AFTER IT WENT LIVE, and on an unstable
         network that is the failure a user actually meets: the call freezes,
         the screen still says it is live, and they keep talking to a line that
         died. WebRTC reports this and we were not listening. */
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === "disconnected") {
          /* Transient until proven otherwise. */
          if (this.state === "live") this.setState("reconnecting");
          this.armReconnectTimer();
          return;
        }
        if (st === "failed") {
          /* "FAILED" IS NOT FINAL UNTIL THE CALL HAS ACTUALLY BEEN UP, and
             conflating the two broke every call on some networks.

             The session goes `live` as soon as the SDP is exchanged — ICE is
             still working at that moment. So this watcher runs with the state
             already "live" while the connection is being ESTABLISHED, and ICE
             legitimately reports "failed" mid-setup when the first candidate
             pairs lose and later ones (trickled in with the answer) have not
             been tried yet. Killing the call there turns a routine retry into
             "could not start the call" — which is exactly what it did.

             Before this watcher existed, nothing looked at ICE and those calls
             connected. So the pre-connection case gets the same grace window a
             mid-call wobble gets: honest state, bounded wait, and a real
             failure only if it never comes up. */
          if (!this.iceEverConnected) {
            if (this.state === "live") this.setState("reconnecting");
            this.armReconnectTimer();
            return;
          }
          this.clearReconnectTimer();
          this.fail("connection-lost");
          return;
        }
        if (st === "connected" || st === "completed") {
          /* From here on, "failed" means a call that WAS up has gone down. */
          this.markTransportUp();
        }
      };
      /* THE SECOND OPINION. `connectionState` folds ICE and DTLS together and
         is the property Safari keeps current; it says "connected" for calls
         whose `iceConnectionState` never leaves "checking". Read for the
         same two facts only: up, and gone. Optional, because the double the
         suite drives (and one old engine) has no such property. */
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") {
          this.markTransportUp();
          return;
        }
        if (st === "failed" && this.iceEverConnected) {
          this.clearReconnectTimer();
          this.fail("connection-lost");
        }
      };

      /* The assistant's voice. Handed out as a stream rather than played here,
         so this module stays testable and the UI owns the audio element. */
      pc.ontrack = (ev: RTCTrackEvent) => {
        /* THE VOICE THAT SPEEDS UP AND SLOWS DOWN. The owner: "the speed of
           the voice suddenly changes, too slow or too quick". That is the
           browser's jitter buffer catching up and holding back on a link
           whose packets arrive unevenly — a tunnel out of the country is
           exactly that link. A larger buffer target trades a little delay
           for steady playback. Best-effort: older engines have neither
           property, and a missing setter must never touch the call. */
        try {
          const r = ev.receiver as unknown as Record<string, unknown>;
          if ("jitterBufferTarget" in r) r.jitterBufferTarget = JITTER_BUFFER_TARGET_MS;
          else if ("playoutDelayHint" in r) r.playoutDelayHint = JITTER_BUFFER_TARGET_MS / 1000;
        } catch {
          /* A browser that refuses the hint plays as it did before. */
        }
        const stream = ev.streams?.[0];
        if (stream) this.events.onRemoteStream?.(stream);
      };
      /* THE CLIENT CREATES THE CHANNEL. This is not a convenience — the
         vendor's own sample calls it out: *"Create a DataChannel to trigger
         SDP negotiation"*. Without one the offer carries no data m-line, the
         negotiation completes for audio alone, and every event the model sends
         — transcripts, and every tool call — has nowhere to arrive. The first
         version of this file only listened for a server-initiated channel and
         would have connected to a silent line. */
      const local = pc.createDataChannel?.(DATA_CHANNEL_LABEL);
      if (local) {
        /* A CONNECTED CALL IS A SILENT CALL UNTIL THIS IS SENT. And an open
           channel is a connected call — see markTransportUp. */
        local.onopen = () => {
          this.markTransportUp();
          this.sendSessionConfig(local);
        };
        local.onmessage = (m: MessageEvent) => {
          if (typeof m.data === "string") this.onChannelMessage(m.data, local);
        };
        /* THE FAR SIDE CAN CLOSE THE CHANNEL WITH THE AUDIO STILL UP — a
           session the vendor ended, a limit reached on its side. Nothing
           watched for it: the screen said live, the model heard nothing, and
           the call "stopped by itself". Treated like a dropped connection:
           reconnecting, the grace window, then a failure the button can
           resume from — never a live-looking dead line. */
        local.onclose = () => this.onChannelClosed();
        /* Already open is possible in a test double and cheap to cover. */
        this.sendSessionConfig(local);
        this.channel = local;
      }
      /* The server may also open its own. Both are wired to the same handler
         rather than assuming which one carries the events. */
      pc.ondatachannel = (ev: RTCDataChannelEvent) => {
        const remote = ev.channel;
        remote.onopen = () => {
          this.markTransportUp();
          this.sendSessionConfig(remote);
        };
        remote.onmessage = (m: MessageEvent) => {
          if (typeof m.data === "string") this.onChannelMessage(m.data, remote);
        };
        this.sendSessionConfig(remote);
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      /* WAIT FOR ICE GATHERING, and this is not optional. The SDP produced by
         setLocalDescription does not yet carry the candidates — the addresses
         the far side needs to reach this browser. Sending it early produces an
         offer that negotiates and then connects to nothing.

         The first version of this file did exactly that. The vendor's own
         guidance is explicit: *"Wait for iceGatheringState === 'complete'
         before using the SDP. At that point, the SDP contains all ICE
         candidate information."* */
      await waitForIceGathering(pc, this.deps.iceTimeoutMs ?? ICE_GATHER_TIMEOUT_MS);

      /* The client asks; the server decides. An unknown key is ignored server
         side rather than rejected, so a stale preference degrades to the
         default voice instead of refusing to place a call. */
      const query = new URLSearchParams();
      if (this.voiceKey) query.set("voice", this.voiceKey);
      /* The id only. The server checks ownership and reads the thread itself;
         a browser that sent the messages could send any messages. */
      if (this.conversationId) query.set("conversation", this.conversationId);
      /* A hint, not a setting: the server allow-lists the code and decides. */
      if (this.sttLanguage) query.set("stt", this.sttLanguage);
      /* "The other one" — two allow-listed words the server maps to endpoints
         it owns. Sent only after a call through the served region never
         connected its media. */
      if (this.regionHint) query.set("region", this.regionHint);
      const qs = query.toString();
      const path = qs ? `${HANDSHAKE_PATH}?${qs}` : HANDSHAKE_PATH;
      /* ONE RETRY ON A LINK THAT DROPPED THE REQUEST. A handshake dies as a
         bare TypeError when the connection underneath is cut — the network a
         phone is on while its other sockets are flapping (production,
         2026-09-07 15:08: a 200 from our route that never arrived whole).
         The offer is still valid, the peer connection is still in
         have-local-offer, so the same POST is made once more after a short
         pause. A timeout, a refusal and a hang-up are not retried. */
      const post = () => this.deps.fetchFn(path, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        /* A ceiling on our own route, above the server's longest honest wait
           (45 s across two regions): past it the caller is told the service
           did not answer rather than left on "connecting" (audit, 2026-09-07). */
        ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(HANDSHAKE_TIMEOUT_MS) } : {}),
        /* Read back from the connection, not from the offer object: the
           candidates were added to the local description, not to the value
           createOffer returned. */
        body: pc.localDescription?.sdp ?? offer.sdp ?? "",
        credentials: "include",
      });
      let res: Response;
      try {
        res = await post();
      } catch (first) {
        if (!(first instanceof TypeError) || isTimeoutError(first) || this.state !== "connecting" || this.pc !== pc) throw first;
        await new Promise((r) => setTimeout(r, HANDSHAKE_RETRY_DELAY_MS));
        if (this.state !== "connecting" || this.pc !== pc) throw first;
        res = await post();
      }
      /* Hung up while the answer was on its way: nothing to apply, nothing
         to report — the call is over, by the caller's hand. */
      if (this.state !== "connecting" || this.pc !== pc) return;

      if (!res.ok) {
        /* Mapped to a reason the UI can act on. The RESPONSE BODY IS NEVER
           READ on a failure: our route already refuses to forward the
           vendor's, and reading it here would create a second place for one to
           reach a screen. */
        /* EVERY STATUS THIS ROUTE CAN RETURN, MAPPED. The first version handled
           403 and 503 and swept the rest into "handshake failed" — so a 429
           from our own rate limiter, and a 401 from an expired session, both
           read as "could not start the call". Each of those needs a different
           thing from the user, and telling all three the same story is how a
           rate limit got investigated as a WebRTC bug. */
        this.fail(
          res.status === 403 ? "not-allowed"
          : res.status === 401 ? "signed-out"
          : res.status === 429 ? "too-many-calls"
          : res.status === 503 ? "unavailable"
          /* 504 AND 502 ARE DIFFERENT FAULTS AND WERE ONE MESSAGE. The route
             returns 504 when the service did not answer and 502 when it
             answered and refused — a dead endpoint versus a rejected
             credential. Both read as "could not start the call", which sends
             an owner looking for a WebRTC bug when the real answer is an
             expired key. Exactly the mistake the comment above records about
             429; made again one line below it. */
          : res.status === 504 ? "service-unreachable"
          : res.status === 502 ? "service-refused"
          : "handshake-failed",
        );
        return;
      }

      /* The response is now an envelope: the answer SDP beside a session
         configuration the server authored. Read defensively — a proxy or an
         older deployment could return something else, and a call that dies on
         JSON.parse looks identical to a call the vendor refused. */
      let answer = "";
      try {
        const body: unknown = await res.json();
        const env = body as { sdp?: unknown; session?: unknown; session_compact?: unknown; region?: unknown; alt_available?: unknown };
        answer = typeof env.sdp === "string" ? env.sdp : "";
        /* Which slot served, and whether there is another. Two words; a
           value that is neither reads as the primary with no alternative,
           which is the behaviour before the second region existed. */
        this.servedRegion = env.region === "alt" ? "alt" : "primary";
        this.altAvailable = env.alt_available === true;
        /* Serialised here, once, so what goes on the wire is exactly what the
           server sent and this module never reshapes it. */
        if (env.session && typeof env.session === "object") {
          this.sessionUpdate = JSON.stringify(env.session);
        }
        if (env.session_compact && typeof env.session_compact === "object") {
          this.sessionUpdateCompact = JSON.stringify(env.session_compact);
        }
      } catch (e) {
        this.fail("handshake-failed", e);
        return;
      }
      if (!answer.startsWith("v=")) {
        this.fail("handshake-failed");
        return;
      }
      /* SDP REQUIRES CRLF, and an answer that has travelled through a proxy,
         a log or a text body may arrive with bare newlines. setRemoteDescription
         rejects those, and the failure looks like a bad answer rather than a
         line-ending problem. Normalised here for the same reason the vendor's
         own sample does it. */
      await pc.setRemoteDescription({ type: "answer", sdp: normalizeSdp(answer) });
      /* Hung up while the answer was being applied: the same exit as above,
         one await later. Without it the ended call was marked live and
         failed eight seconds on, with a toast for a call nobody was on
         (audit, 2026-09-11). */
      if (this.state !== "connecting" || this.pc !== pc) return;

      /* The channel can have opened while the handshake was in flight, in
         which case its `onopen` already fired and found nothing to relay. */
      if (this.channel) this.sendSessionConfig(this.channel);
    } catch (e) {
      /* Our own deadline on the handshake reads as the service not answering
         — which is what it is — rather than a bad handshake. */
      this.fail(isTimeoutError(e) ? "service-unreachable" : "handshake-failed", e);
      return;
    }

    this.setState("live");
    /* NEVER CONNECTED IS WATCHED FROM THE START. ICE can sit in "checking"
       for ever on a network where the media path never arrives, and the
       state watcher only arms the grace timer on "disconnected"/"failed" —
       so a call whose ICE never transitioned at all was never failed over
       and never ended (audit, 2026-09-07). The timer is cleared the moment
       the media connects; if it never does, the other region is tried, then
       the call is ended honestly. */
    if (!this.iceEverConnected) this.armReconnectTimer();
  }
}

/** The real dependencies. Separated so the constructor above never has to
 *  mention a browser global, which is what lets the suite drive it in Node. */
export function browserVoiceDeps(): VoiceDeps {
  return {
    createPeerConnection: () =>
      /* Empty on purpose, and the vendor says why: "No ICE servers need to be
         configured (the server handles NAT traversal)." */
      new RTCPeerConnection({ iceServers: [] }),
    getMicrophone: () =>
      navigator.mediaDevices.getUserMedia({
        /* Audio only. A voice call has no reason to ask for a camera, and
           asking would put a second permission prompt in front of the user
           for a capability nothing here uses. */
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      }),
    fetchFn: (...args) => fetch(...args),
    createWebSocket: (url, protocols) => new WebSocket(url, protocols) as unknown as VoiceSocket,
    createWsAudio: (sampleRate) => createBrowserWsAudio(sampleRate),
  };
}
