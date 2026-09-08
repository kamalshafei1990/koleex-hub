/* ---------------------------------------------------------------------------
   validate:voice-client — Phase 15 step 2, the browser side.

   WebRTC does not exist in Node, which is exactly why VoiceSession takes its
   peer connection, its microphone and its fetch as arguments. Injection here
   is not a purity exercise — it is the difference between testing this logic
   and reading it.

   THE ASSERTION THAT MATTERS MOST IS THE MICROPHONE. Every exit path — a
   refusal, a 403, a 503, a malformed answer, a thrown peer connection, the
   caller stopping — must stop the captured tracks. A voice feature that leaves
   the mic live after an error is a privacy defect, and it is the one thing in
   this module that can actually hurt someone. It is checked on EVERY path
   rather than on the happy one.
   --------------------------------------------------------------------------- */

import { VoiceSession, describeError, HANDSHAKE_PATH, WS_SESSION_PATH, failureForStatus, type VoiceSocket, waitForIceGathering, normalizeSdp, type VoiceDeps, type VoiceState, type VoiceFailure,
  TOOL_PATH,
} from "../src/lib/voice/session";
import { TranscriptPersister, TRANSCRIPT_PATH, MAX_TURNS_PER_POST, MAX_POST_FAILURES, type SavedTurn } from "../src/lib/voice/persist";
import { buildTextTurnMessages, EV_ITEM_CREATE, EV_RESPONSE_CREATE, MAX_TYPED_TURN_CHARS } from "../src/lib/voice/text-turn";
import { type TranscriptLine } from "../src/lib/voice/events";
import { extractProductPhotos, photosMarkdown, stripImageMarkdown, imageUrlsIn, MAX_PHOTOS_PER_RESULT, MAX_WEB_PHOTOS_PER_RESULT } from "../src/lib/voice/photos";
import { CallTones, scheduleTone, READY_TONE, RECOVERED_TONE, TONE_GAIN, type ToneContextLike, type ToneOscillatorLike, type ToneGainLike } from "../src/lib/voice/tones";
import { stepLevel, LEVEL_ATTACK, LEVEL_RELEASE } from "../src/lib/voice/level";

let pass = 0;
const failures: string[] = [];
/* A CONDITION MAY THROW, AND A THROW MUST BE A NAMED FAILURE — the same guard
   the other voice suites carry, for the same reason. */
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

const ANSWER = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n";

/* A SUITE THAT ASSERTS "BOUNDED" MUST NOT ITSELF HANG. Removing the ICE
   timeout — the exact defect the bounded-wait assertion exists for — made an
   earlier version of this file run until CI killed it, which is
   indistinguishable from a stuck machine and diagnoses nothing. The assertion
   could never fire because the code never returned to reach it. Every start()
   that could block is raced against a watchdog; losing that race IS the
   failure. Learned the same way in validate:ai-transport-timeout. */
const HUNG = Symbol("start() did not return");
async function within<T>(ms: number, work: Promise<T>): Promise<T | typeof HUNG> {
  return Promise.race([work, new Promise<typeof HUNG>((r) => setTimeout(() => r(HUNG), ms))]);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* A PENDING TIMER IS A RESOURCE, AND NODE WILL TELL YOU ABOUT IT. Needed
   because the reconnect timer's disarming has NO effect on any state this
   suite can read: arming self-clears the previous timer, and the callback
   refuses to act unless the session is still reconnecting, so a leaked timer
   fires into a no-op. Two mutations — "recovery does not clear the timer" and
   "hanging up leaves it running" — survived every behavioural assertion for
   exactly that reason. What leaks is the TIMER, so the timer is what gets
   counted. Sample it synchronously: an await would let the suite's own
   timers move underneath the reading. */
const pendingTimers = () =>
  process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

/** A microphone whose tracks record whether they were stopped. */
function fakeMic() {
  /* `enabled` is what mute actually flips, and the first version of this
     double had no such field — so a setMuted() that did nothing to the tracks
     would have passed. */
  const tracks = [{ stopped: false, enabled: true, stop() { this.stopped = true; }, kind: "audio" }];
  return {
    stream: {
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    } as unknown as MediaStream,
    allStopped: () => tracks.every((t) => t.stopped),
    allEnabled: () => tracks.every((t) => t.enabled),
    noneEnabled: () => tracks.every((t) => !t.enabled),
  };
}

/* A DataChannel double with the two things the real one has that matter here:
   a readyState that gates sending, and a send() that records. The previous
   double had neither, so a client that sent nothing at all passed. */
type FakeChannel = {
  label?: string;
  readyState: string;
  /* A real channel refuses anything larger than the size negotiated with the
     far side, and THROWS rather than truncating. The first version of this
     double had no limit at all, so a payload that could never be delivered
     looked identical to one that could — which is how a thousand characters of
     identity policy shipped and broke every call. */
  maxMessageSize?: number;
  onopen: (() => void) | null;
  onmessage: ((m: { data: unknown }) => void) | null;
  send: (data: string) => void;
  /** Test helper: transition to open and fire the handler, as a browser does. */
  open: () => void;
};

function makeChannel(
  sink: { sent: string[] },
  startOpen: boolean,
  sendThrows: boolean,
  maxMessageSize?: number,
  enforceLimit = true,
): FakeChannel {
  const ch: FakeChannel = {
    readyState: startOpen ? "open" : "connecting",
    maxMessageSize,
    onopen: null,
    onmessage: null,
    send: (data: string) => {
      if (sendThrows) throw new Error("channel closed");
      /* The real error a browser raises when a message exceeds the negotiated
         size. Modelled, because this is the failure that shipped.

         `enforceLimit: false` reports a limit without enforcing it, which is
         how the SIZE CHECK can be tested apart from the catch-and-retry — the
         two recover the same call, so each hides the other's absence unless
         one of them is isolated. */
      if (enforceLimit && typeof maxMessageSize === "number" &&
          new TextEncoder().encode(data).length > maxMessageSize) {
        throw new Error("Message too large");
      }
      sink.sent.push(data);
    },
    open: () => { ch.readyState = "open"; ch.onopen?.(); },
  };
  return ch;
}

function fakePc(opts: { iceState?: string; gatherLater?: boolean; channelOpen?: boolean; sendThrows?: boolean; maxMessageSize?: number; enforceLimit?: boolean } = {}) {
  const calls = {
    closed: 0, added: 0, remoteSdp: "", channels: [] as string[],
    /* Everything the client puts on the wire, in order. A connected call that
       sends nothing is the exact bug this records. */
    sent: [] as string[],
    channel: null as FakeChannel | null,
    /* ORDERING, NOT WALL-CLOCK. The assertion this feeds used to read
       `Date.now() - started >= 5` against a gathering timer that also fires
       at 5ms — the two raced, and the suite failed roughly one run in ten on
       a loaded machine for no reason connected to the product. What the test
       actually means is "the offer was not posted until gathering finished",
       which is an ORDER. Recording the order says it exactly, and says it the
       same way every time. */
    gathered: false,
    postedAfterGathering: null as boolean | null,
  };
  const listeners: Record<string, Array<() => void>> = {};
  const pc = {
    /* The candidates land on the LOCAL DESCRIPTION, not on the object
       createOffer returned. A client that posts the latter sends an offer
       with no candidates — the bug this fake exists to expose. */
    localDescription: { sdp: "v=0\r\nOFFER-WITH-CANDIDATES\r\n" },
    iceGatheringState: opts.iceState ?? "complete",
    addEventListener: (ev: string, fn: () => void) => { (listeners[ev] ??= []).push(fn); },
    removeEventListener: () => {},
    addTrack: () => { calls.added++; },
    createDataChannel: (label: string) => {
      calls.channels.push(label);
      const ch = makeChannel(calls, opts.channelOpen ?? false, opts.sendThrows ?? false, opts.maxMessageSize, opts.enforceLimit ?? true);
      calls.channel = ch;
      return ch as unknown as RTCDataChannel;
    },
    createOffer: async () => ({ type: "offer", sdp: "v=0\r\nBARE-OFFER\r\n" }),
    setLocalDescription: async () => {
      if (opts.gatherLater) {
        setTimeout(() => {
          (pc as unknown as { iceGatheringState: string }).iceGatheringState = "complete";
          calls.gathered = true;
          for (const fn of listeners["icegatheringstatechange"] ?? []) fn();
        }, 5);
      }
    },
    setRemoteDescription: async (d: { sdp: string }) => { calls.remoteSdp = d.sdp; },
    close: () => { calls.closed++; },
    /* A REAL CONNECTION REPORTS WHEN IT DROPS, and the first version of this
       double did not — so a client that watched nothing after going live
       passed every assertion here while freezing on a real unstable network. */
    iceConnectionState: "new",
    /* The second property Safari keeps current when the first stays on
       "checking" (session.ts markTransportUp). */
    connectionState: "new",
    ontrack: null,
    ondatachannel: null,
    oniceconnectionstatechange: null,
    onconnectionstatechange: null,
  } as unknown as RTCPeerConnection;
  /** Drive the connection the way a browser does: set the state, then notify. */
  const ice = (state: string) => {
    (pc as unknown as { iceConnectionState: string }).iceConnectionState = state;
    (pc as unknown as { oniceconnectionstatechange: (() => void) | null }).oniceconnectionstatechange?.();
  };
  const conn = (state: string) => {
    (pc as unknown as { connectionState: string }).connectionState = state;
    (pc as unknown as { onconnectionstatechange: (() => void) | null }).onconnectionstatechange?.();
  };
  return { pc, calls, ice, conn };
}

type Recorded = { url: string; init?: RequestInit };

function deps(opts: {
  micThrows?: boolean;
  status?: number;
  body?: string;
  pcThrows?: boolean;
  recorded?: Recorded[];
  iceState?: string;
  gatherLater?: boolean;
  channelOpen?: boolean;
  sendThrows?: boolean;
  envelope?: unknown;
  session?: unknown;
  sessionCompact?: unknown;
  maxMessageSize?: number;
  enforceLimit?: boolean;
  voiceKey?: string | null;
  reconnectGraceMs?: number;
  liveGraceMs?: number;
}): { deps: VoiceDeps; mic: ReturnType<typeof fakeMic>; ice: (state: string) => void; conn: (state: string) => void; pcCalls: { closed: number; added: number; remoteSdp: string; channels: string[]; sent: string[]; channel: FakeChannel | null; gathered: boolean; postedAfterGathering: boolean | null } } {
  const bodyReads: number[] = [];
  void bodyReads;
  const mic = fakeMic();
  const { pc, calls, ice, conn } = fakePc({ iceState: opts.iceState, gatherLater: opts.gatherLater, channelOpen: opts.channelOpen, sendThrows: opts.sendThrows, maxMessageSize: opts.maxMessageSize, enforceLimit: opts.enforceLimit });
  return {
    mic,
    ice,
    conn,
    pcCalls: calls,
    deps: {
      getMicrophone: async () => {
        if (opts.micThrows) throw new Error("denied");
        return mic.stream;
      },
      createPeerConnection: () => {
        if (opts.pcThrows) throw new Error("no webrtc");
        return pc;
      },
      iceTimeoutMs: 60,
      reconnectGraceMs: opts.reconnectGraceMs ?? 80,
      liveGraceMs: opts.liveGraceMs ?? opts.reconnectGraceMs ?? 80,
    fetchFn: (async (url: string, init?: RequestInit) => {
        opts.recorded?.push({ url: String(url), init });
        /* First post only: later ones (the tool relay) are not this question. */
        if (calls.postedAfterGathering === null) calls.postedAfterGathering = calls.gathered;
        return {
          ok: (opts.status ?? 200) < 400,
          status: opts.status ?? 200,
          /* THE ENVELOPE THE SERVER NOW RETURNS: the answer SDP beside a
             session configuration the server authored. The client relays the
             latter; it no longer composes one. */
          json: async () =>
            opts.envelope ?? {
              sdp: opts.body ?? ANSWER,
              session_compact: opts.sessionCompact ?? { type: "session.update", session: { modalities: ["text", "audio"] } },
              session: opts.session ?? {
                type: "session.update",
                session: {
                  modalities: ["text", "audio"],
                  input_audio_format: "pcm",
                  output_audio_format: "pcm",
                  input_audio_transcription: { enabled: true },
                  turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 800 },
                },
              },
            },
          text: async () => { bodyReads.push(1); return opts.body ?? ANSWER; },
        } as unknown as Response;
      }) as unknown as typeof fetch,
    },
  };
}

async function run(opts: Parameters<typeof deps>[0] & { watchdogMs?: number }) {
  const d = deps(opts);
  const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
  const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
  const outcome = await within(opts.watchdogMs ?? 4000, s.start());
  return { session: s, states, hung: outcome === HUNG, ...d };
}

async function main() {
  console.log("\n── 1. A call that works ──");
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded });
    check("ends live", r.session.getState() === "live");
    check("the microphone track was added to the connection", r.pcCalls.added === 1);
    /* The one thing a caller must never influence. */
    check("the offer goes to OUR route and nowhere else",
      recorded.length === 1 && recorded[0].url === HANDSHAKE_PATH);
    check("the request carries the session cookie", recorded[0].init?.credentials === "include");
    /* THE BUG THIS CATCHES. The first version posted `offer.sdp` — the value
       createOffer returned, before any candidate was gathered. The candidates
       land on localDescription, so that offer described a peer nobody could
       reach. */
    check("the posted offer is the GATHERED one, not the bare createOffer result",
      recorded[0].init?.body === "v=0\r\nOFFER-WITH-CANDIDATES\r\n");
    check("the state sequence is legible to a UI",
      r.states.map(([s]) => s).join(">") === "requesting-mic>connecting>live");

    r.session.stop();
    check("stopping releases the microphone", r.mic.allStopped());
    check("and closes the connection", r.pcCalls.closed === 1);
    r.session.stop();
    check("stopping twice does not throw", true);
  }

  console.log("\n── 2. Every failure path, and the microphone on each ──");
  {
    const cases: Array<[string, Parameters<typeof deps>[0], VoiceFailure]> = [
      ["the user refuses the microphone", { micThrows: true }, "no-microphone"],
      ["the server refuses this account", { status: 403 }, "not-allowed"],
      ["voice is switched off server-side", { status: 503 }, "unavailable"],
      /* 502 AND 504 ARE DIFFERENT FAULTS. The route returns 504 when the
         voice service did not answer and 502 when it answered and refused —
         a dead endpoint versus a rejected credential or an exhausted quota.
         Both used to read "could not start the call", which is what sent a
         real outage to be investigated as a WebRTC bug. */
      ["the service answers and refuses", { status: 502 }, "service-refused"],
      ["the service does not answer at all", { status: 504 }, "service-unreachable"],
      ["an unmapped status is still reported", { status: 418 }, "handshake-failed"],
      ["the answer is not an SDP", { body: "<html>nope</html>" }, "handshake-failed"],
      ["the peer connection cannot be created", { pcThrows: true }, "handshake-failed"],
    ];
    for (const [label, opts, expected] of cases) {
      const r = await run(opts);
      const last = r.states[r.states.length - 1];
      check(`${label} → failed(${expected})`, last[0] === "failed" && last[1] === expected);
      /* THE POINT OF THIS SECTION. Not the happy path — every one of them. */
      check(`  …and the microphone is released`,
        opts.micThrows ? true : r.mic.allStopped());
    }
  }

  console.log("\n── 3. Nothing vendor-shaped can reach the caller ──");
  {
    /* A failing handshake must not read the vendor's body. Our route already
       refuses to forward it; reading it here would open a second path to a
       screen. Proved by making the body throw if touched. */
    const mic = fakeMic();
    const { pc } = fakePc();
    let bodyRead = false;
    const s = new VoiceSession(
      {
        getMicrophone: async () => mic.stream,
        createPeerConnection: () => pc,
        fetchFn: (async () => ({
          ok: false,
          status: 502,
          text: async () => { bodyRead = true; return "vendor-host.internal quota exceeded"; },
        })) as unknown as typeof fetch,
      },
      {},
    );
    await s.start();
    check("a failed handshake never reads the vendor's response body", bodyRead === false);
    check("and still releases the microphone", mic.allStopped());
  }

    console.log("\n── 4. ICE gathering and SDP shape — the two the vendor's guide is explicit about ──");
  {
    /* Explicit vendor guidance: "Wait for iceGatheringState === 'complete'
       before using the SDP." Skipping it produces an offer with no candidates,
       which negotiates and then connects to nothing. */
    const r = await run({ iceState: "gathering", gatherLater: true });
    check("it waits for gathering to complete before posting",
      r.session.getState() === "live" && r.pcCalls.postedAfterGathering === true);

    /* And never forever. A candidate that hangs leaves the state at
       "gathering" indefinitely; a partial offer beats a call that never
       starts. */
    const t0 = Date.now();
    const stuck = await run({ iceState: "gathering", watchdogMs: 1500 });
    const waited = Date.now() - t0;
    /* The watchdog is the assertion. Without it, an unbounded wait does not
       FAIL this check — it prevents the check from ever running. */
    check("a connection that never finishes gathering still returns", !stuck.hung);
    check("and proceeds rather than giving up", stuck.session.getState() === "live");
    check("on a bounded wait, not forever", waited < 1500);

    /* SDP requires CRLF. An answer carrying bare newlines is rejected by
       setRemoteDescription, and the failure looks like a bad answer. */
    check("normalizeSdp converts bare newlines to CRLF",
      normalizeSdp("v=0\no=- 0 0") === "v=0\r\no=- 0 0\r\n");
    check("and leaves an already-correct SDP alone",
      normalizeSdp("v=0\r\no=- 0 0\r\n") === "v=0\r\no=- 0 0\r\n");
    const norm = await run({ body: "v=0\nANSWER" });
    check("the answer is normalised before it reaches the connection",
      norm.pcCalls.remoteSdp === "v=0\r\nANSWER\r\n");

    check("waiting on an already-complete gathering resolves without hanging",
      await (async () => {
        const { pc } = fakePc({ iceState: "complete" });
        await waitForIceGathering(pc, 50);
        return true;
      })());
  }

  console.log("\n── 5. The DataChannel the client must open itself ──");
  {
    /* THE THIRD DEFECT FOUND BY READING THE VENDOR'S SAMPLE RATHER THAN
       ASSUMING. Its comment is explicit: "Create a DataChannel to trigger SDP
       negotiation". Without one the offer carries no data m-line, negotiation
       completes for audio alone, and every event the model sends — transcripts
       and every tool call — has nowhere to arrive. An earlier version only
       listened for a server-initiated channel and would have connected to a
       line that could never speak. */
    const r = await run({});
    check("the client opens a DataChannel of its own", r.pcCalls.channels.length === 1);
    check("and it is opened BEFORE the offer is created",
      r.session.getState() === "live");
    /* Ours to name, per the vendor's note that the label is customizable —
       so it is named for what travels on it, not after a vendor. */
    check("the label carries no vendor identity", !/oai|openai|qwen|dashscope/i.test(r.pcCalls.channels[0] ?? ""));

    const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
    check("a server-opened channel is still wired, rather than assumed away",
      /pc\.ondatachannel = /.test(code));
    /* THREE: stop, fail, and the re-handshake on the other region, which
       discards the first connection's channel before negotiating a new one. */
    check("the channel is dropped on teardown like every other handle",
      (code.match(/this\.channel = null/g) ?? []).length === 3);
  }

  console.log("\n── 6. The module cannot be pointed anywhere else ──");
  {
    const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /* THE GUARANTEE, not its old shape. A voice choice is now appended as a
       query parameter, so the call is no longer literally `fetchFn(CONST,`.
       What must remain true is that the BASE is a constant this module owns —
       nothing a caller passes can point the handshake somewhere else. */
    check("the handshake path is built from a constant, never from an argument",
      /export const HANDSHAKE_PATH = "\/api\/ai\/voice\/session"/.test(code) &&
      /`\$\{HANDSHAKE_PATH\}\?\$\{qs\}`/.test(code) &&
      /: HANDSHAKE_PATH;/.test(code) &&
      /fetchFn\(path,/.test(code));
    /* Both query values go through URLSearchParams, which encodes; section 13
       proves the encoding on a real session rather than naming the function. */
    check("the query is built by URLSearchParams, never by interpolating a value",
      /new URLSearchParams\(\)/.test(code) && /query\.set\("voice", this\.voiceKey\)/.test(code) &&
      /query\.set\("conversation", this\.conversationId\)/.test(code) &&
      !/\$\{this\.voiceKey\}|\$\{this\.conversationId\}/.test(code));
    /* Vendor identity has no field to arrive in, and the absence is the check. */
    check("no vendor concept appears anywhere in the client",
      !/dashscope|aliyun|qwen|api[_-]?key|Bearer/i.test(code));
    check("it asks for audio only — no second permission prompt for a camera",
      /video: false/.test(code) && /audio: \{/.test(code));
    check("teardown stops tracks before closing the connection, not after",
      code.indexOf("getTracks().forEach((t) => t.stop())") < code.indexOf("this.pc?.close()"));
  }

  console.log("\n── 7. The client RELAYS a configuration; it no longer writes one ──");
  {
    /* A connected call is still a silent call until the configuration is sent.
       What changed is who authors it: `session.update` carries the voice today
       and `instructions` tomorrow, so a browser that composes it is a browser
       that can compose those. The server authors; this relays. */
    const authored = {
      type: "session.update",
      session: { modalities: ["text", "audio"], voice: "SomeVendorVoice" },
    };
    const r = deps({ status: 200, session: authored });
    const s1 = new VoiceSession(r.deps);
    await s1.start();

    check("nothing is sent while the channel is still connecting",
      () => r.pcCalls.sent.length === 0);

    r.pcCalls.channel!.open();
    check("the configuration is relayed once the channel opens",
      () => r.pcCalls.sent.length === 1);
    check("and it is EXACTLY what the server sent, byte for byte",
      () => r.pcCalls.sent[0] === JSON.stringify(authored));

    /* A relayed object this module can extend is a composed object wearing a
       disguise. */
    check("the client adds no field of its own", () => {
      const parsed = JSON.parse(r.pcCalls.sent[0]) as { session: Record<string, unknown> };
      return Object.keys(parsed.session).sort().join(",") === "modalities,voice";
    });

    r.pcCalls.channel!.open();
    check("it is relayed once, not on every open", () => r.pcCalls.sent.length === 1);
  }

  {
    /* An envelope with no configuration must send NOTHING rather than invent
       one — a fabricated default is this module composing policy by another
       name. */
    const r = deps({ status: 200, envelope: { sdp: "v=0\r\nANSWER\r\n" } });
    const s2 = new VoiceSession(r.deps);
    await s2.start();
    r.pcCalls.channel!.open();
    check("with no configuration from the server, nothing is invented",
      () => r.pcCalls.sent.length === 0);
  }

  {
    const recorded: Recorded[] = [];
    const r = deps({ status: 200, recorded });
    const s3 = new VoiceSession(r.deps, {}, "v2");
    await s3.start();
    check("the requested voice reaches the server", recorded[0]?.url.includes("voice=v2") === true);

    const recorded2: Recorded[] = [];
    const r2 = deps({ status: 200, recorded: recorded2 });
    const s4 = new VoiceSession(r2.deps);
    await s4.start();
    check("and with no choice, no voice parameter is sent",
      recorded2[0]?.url.includes("voice=") === false);
  }

  {
    const r = deps({ status: 200, envelope: { nothing: true } });
    const states: string[] = [];
    const s5 = new VoiceSession(r.deps, { onState: (st) => states.push(st) });
    await s5.start();
    check("an envelope with no sdp is a failed handshake", states.includes("failed"));
    check("and the microphone is released", r.mic.allStopped());
  }

  console.log("\n── 7a. Every status this route returns says something different ──");
  {
    /* THE FAILURE THAT COST A DEBUGGING SESSION. The route rate-limits voice
       to a handful of calls a minute and returns 429. The first version of
       this mapping handled 403 and 503 and swept everything else into
       "handshake failed" — so a rate limit, an expired session and a genuinely
       broken handshake all told the user the same thing, and the investigation
       went looking at WebRTC for a problem that was a counter.

       Each status needs a DIFFERENT action from the user, so each gets its own
       reason. */
    const cases: Array<[number, string]> = [
      [401, "signed-out"],
      [403, "not-allowed"],
      [429, "too-many-calls"],
      [503, "unavailable"],
      /* 502 AND 504 USED TO SIT HERE AS "handshake-failed", and this matrix
         is where that conflation was written down and kept. The route returns
         504 when the voice service did not answer and 502 when it answered
         and REFUSED — a dead endpoint versus a rejected credential, an
         exhausted quota or a wrong model. They need different actions from
         different people, and one message for both is what sent a real
         service outage to be investigated as a WebRTC bug. Same mistake as
         429, recorded in the comment above, made again two lines below it. */
      [502, "service-refused"],
      [504, "service-unreachable"],
      /* Anything genuinely unclassified still lands somewhere honest. */
      [500, "handshake-failed"],
      [418, "handshake-failed"],
    ];
    for (const [status, expected] of cases) {
      const r = deps({ status });
      const seen: string[] = [];
      const s = new VoiceSession(r.deps, { onState: (_st, f) => { if (f) seen.push(f); } });
      await s.start();
      check(`${status} is reported as ${expected}`, seen.includes(expected));
    }

    /* THE STATUSES THAT NEED DIFFERENT ACTIONS MUST NOT SHARE A MESSAGE, and
       this is asserted from the MAPPING rather than from a hand-written list:
       a literal Set of names is true by construction and would have stayed
       green through the whole 502/504 conflation. */
    const actionable = cases.filter(([st]) => st !== 500 && st !== 418);
    const reasons = new Set(actionable.map(([, r]) => r));
    check(
      `each status a person can act on has its own reason (${actionable.length} statuses, ${reasons.size} reasons)`,
      reasons.size === actionable.length,
    );

    /* And every reason must have copy in every language, or a user meets a
       blank. Enforced by the type, asserted here so a reader can see it. */
    const btn = (await import("node:fs")).readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    for (const reason of ["too-many-calls", "signed-out", "config-rejected"]) {
      check(`"${reason}" has copy in all three languages`,
        (btn.match(new RegExp(`"${reason}":`, "g")) ?? []).length === 3);
    }
    /* A rate limit must tell the user to WAIT — "try again" invites the retry
       that deepens the hole. */
    check("the rate-limit message asks the user to wait rather than retry",
      /Wait about a minute/.test(btn) && /استنى دقيقة/.test(btn));
  }

  console.log("\n── 7b. A channel that will not carry the long configuration ──");
  {
    /* THE BUG THIS SECTION EXISTS FOR. The session configuration was about two
       hundred bytes until a thousand characters of identity policy were added
       to it. A DataChannel refuses anything larger than the size it negotiated
       and THROWS rather than truncating — so the first call after that change
       reported "could not start the call", and the reason was a byte count. */
    const long = { type: "session.update", session: { instructions: "x".repeat(2000) } };
    const short = { type: "session.update", session: { instructions: "short" } };

    const r = deps({ status: 200, session: long, sessionCompact: short, maxMessageSize: 256 });
    const s1 = new VoiceSession(r.deps);
    await s1.start();
    r.pcCalls.channel!.open();

    check("something is sent even though the long one will not fit",
      () => r.pcCalls.sent.length === 1);
    check("and it is the SERVER's compact version, not a truncation",
      () => r.pcCalls.sent[0] === JSON.stringify(short));
    check("the client never edits a configuration to make it fit",
      () => !r.pcCalls.sent[0].includes("x".repeat(50)));

    /* The identity guarantee must survive the cut — a compact policy that
       dropped the rule would be worse than a failed call. */
    const compactSrc = (await import("node:fs")).readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
    const compact = compactSrc.slice(compactSrc.indexOf("const COMPACT_INSTRUCTIONS"), compactSrc.indexOf("export type SessionUpdate"));
    check("the compact version still names Koleex AI and its maker",
      /Koleex AI/.test(compact) && /Koleex International Group/.test(compact));
    check("and still forbids naming any model or provider",
      /Never name, confirm or hint at any model, provider or company/.test(compact));
    check("and still closes the guess-and-confirm route",
      /guesses a name and asks you to confirm/.test(compact));
  }

  {
    /* THE SIZE CHECK, ALONE. This channel reports a small limit and accepts
       anything — so nothing throws, the fallback can never run, and only the
       pre-check can choose correctly. Without this case, deleting the size
       check passed: the catch-and-retry quietly recovered the same call. */
    const long = { type: "session.update", session: { instructions: "x".repeat(2000) } };
    const short = { type: "session.update", session: { instructions: "short" } };
    const r = deps({ status: 200, session: long, sessionCompact: short, maxMessageSize: 256, enforceLimit: false });
    const s = new VoiceSession(r.deps);
    await s.start();
    r.pcCalls.channel!.open();
    check("a reported limit is respected BEFORE anything is thrown",
      () => r.pcCalls.sent[0] === JSON.stringify(short));
  }

  {
    /* THE FALLBACK, ALONE. No limit is reported, so the pre-check cannot fire,
       but the channel still refuses the long one. Only catching the throw and
       retrying can save this call. Without this case, deleting the fallback
       passed: the pre-check had already chosen compact. */
    const long = { type: "session.update", session: { instructions: "x".repeat(2000) } };
    const short = { type: "session.update", session: { instructions: "short" } };
    const r = deps({ status: 200, session: long, sessionCompact: short });
    const ch = r.pcCalls;
    const s = new VoiceSession(r.deps);
    await s.start();
    /* Refuse the long one without ever having advertised a size. */
    const real = ch.channel!.send;
    ch.channel!.send = (d: string) => {
      if (d.length > 500) throw new Error("Message too large");
      real(d);
    };
    ch.channel!.open();
    check("an unadvertised refusal is recovered by falling back",
      () => ch.sent.length === 1 && ch.sent[0] === JSON.stringify(short));
  }

  {
    /* A generous limit must not downgrade anyone: the full policy is the
       default and the short one is a fallback, not a replacement. */
    const long = { type: "session.update", session: { instructions: "x".repeat(2000) } };
    const short = { type: "session.update", session: { instructions: "short" } };
    const r = deps({ status: 200, session: long, sessionCompact: short, maxMessageSize: 65536 });
    const s2 = new VoiceSession(r.deps);
    await s2.start();
    r.pcCalls.channel!.open();
    check("with room to spare, the FULL configuration is sent",
      () => r.pcCalls.sent[0] === JSON.stringify(long));
  }

  {
    /* A browser that does not report the limit must not be guessed at. */
    const long = { type: "session.update", session: { instructions: "x".repeat(2000) } };
    const r = deps({ status: 200, session: long });
    const s3 = new VoiceSession(r.deps);
    await s3.start();
    r.pcCalls.channel!.open();
    check("an unreported limit means send the full one rather than assume a number",
      () => r.pcCalls.sent[0] === JSON.stringify(long));
  }

  {
    /* When BOTH are refused the size was not the problem, and saying
       "the handshake did not complete" sent us looking in the wrong place. */
    const r = deps({ status: 200, sendThrows: true });
    const states: string[] = [];
    const failures: string[] = [];
    const s4 = new VoiceSession(r.deps, {
      onState: (st, f) => { states.push(st); if (f) failures.push(f); },
    });
    await s4.start();
    r.pcCalls.channel!.open();
    check("a configuration nothing will accept is still a failure", states.includes("failed"));
    check("and it is reported as its OWN failure, not as a failed handshake",
      failures.includes("config-rejected") && !failures.includes("handshake-failed"));
    check("and the microphone is released", r.mic.allStopped());
  }

  console.log("\n── 8. The two orderings of that handshake, and a failed send ──");
  {
    /* The vendor announces `session.created` first. Whether that arrives
       before or after the channel reports open is its business, so both
       trigger the send and a guard keeps it to one. */
    const r = deps({ status: 200, body: "v=0\r\nANSWER\r\n" });
    const seen: string[] = [];
    const s2 = new VoiceSession(r.deps, { onMessage: (d) => seen.push(d) });
    await s2.start();

    const ch = r.pcCalls.channel!;
    ch.readyState = "open";
    ch.onmessage?.({ data: JSON.stringify({ type: "session.created" }) });
    check("session.created triggers the configuration even if onopen never fired",
      r.pcCalls.sent.length === 1);
    check("and the announcement still reaches the caller untouched",
      seen.length === 1 && seen[0].includes("session.created"));

    ch.open();
    check("a later open does not send it a second time", r.pcCalls.sent.length === 1);

    /* An ordinary message must not be mistaken for the announcement. */
    ch.onmessage?.({ data: JSON.stringify({ type: "response.audio.delta" }) });
    check("an unrelated event sends nothing", r.pcCalls.sent.length === 1);
    check("but is still passed through", seen.length === 2);
  }

  {
    /* A send that throws leaves a connected, unconfigured, silent call. That
       is the failure this whole section is about, so it must surface. */
    const r = deps({ status: 200, body: "v=0\r\nANSWER\r\n", channelOpen: true, sendThrows: true });
    const states: string[] = [];
    const s3 = new VoiceSession(r.deps, { onState: (st) => states.push(st) });
    await s3.start();
    check("a failed configuration send is reported, not left as a silent call",
      states.includes("failed"));
    check("and the microphone is released when it fails", r.mic.allStopped());
  }

  console.log("\n── 9. The call button's cleanup contract (source read, not a browser) ──");
  {
    /* SAID PLAINLY: these are source assertions. The render harness cannot run
       effects, so the guarantees below — the ones that decide whether a
       microphone stays captured — cannot be exercised here. Reading for them
       is worth more than not checking, and less than a browser test. */
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");

    /* THE ONE THING HERE THAT CAN HURT SOMEONE. Navigating away from a live
       call without stopping the session leaves the capture track running and
       the browser's recording indicator lit. */
    /* The stop must be the FIRST statement of the returned cleanup. A looser
       pattern matched across the closing brace into hangUp's own stop call and
       passed with the cleanup emptied — the exact regression it was written to
       catch. Anchored, so only a real cleanup satisfies it. */
    check("unmount stops the session — after the beacon that says it happened",
      /return \(\) => \{\s*window\.removeEventListener\("pagehide", onPageHide\);\s*beacon\("unmounted"\);\s*sessionRef\.current\?\.stop\(\);/.test(src));
    check("that cleanup belongs to a mount-only effect, so it cannot re-run early",
      /window\.addEventListener\("pagehide", onPageHide\);\s*return \(\) => \{[\s\S]{0,200}?sessionRef\.current\?\.stop\(\);[\s\S]{0,400}?\}, \[\]\);/.test(src));
    /* THE LAST TURN IS OFTEN STILL QUEUED WHEN THE SCREEN GOES. */
    check("  …and that same cleanup flushes the transcript writer",
      /beacon\("unmounted"\);\s*sessionRef\.current\?\.stop\(\);[\s\S]{0,300}?persisterRef\.current\?\.finish\(\);[\s\S]{0,120}?\}, \[\]\);/.test(src));

    /* A DROPPED CONNECTION IS STILL AN OPEN CALL, and the button decides what
       is on screen. The call screen mounts on "live or busy"; `reconnecting`
       is neither, so the recovery state would have UNMOUNTED the entire call
       screen the moment a VPN wobbled — the screen vanishing mid-sentence,
       with the microphone still held by a session nothing was rendering. A
       worse outcome than the freeze the recovery state exists to fix. */
    check("reconnecting counts as an open call, not as no call",
      /const connected = live \|\| reconnecting;/.test(src));
    /* Through a portal to the body now — see the button for why a fixed
       screen inside a transformed ancestor was sitting under the header. */
    check("so the call screen stays mounted through a wobble",
      /\{\(connected \|\| busy \|\| swapping\) && typeof document !== "undefined" && createPortal\(/.test(src));
    check("  …and it is rendered at the document body, above every piece of app chrome",
      /createPortal\(\s*<VoiceCallScreen[\s\S]{0,1200}?document\.body,/.test(src) && /import \{ createPortal \} from "react-dom";/.test(src));
    check("and the control still ends the call rather than starting a second one",
      /onClick=\{connected \|\| busy \? hangUp/.test(src));
    /* A parent that unmutes its own speech synthesis mid-wobble talks over the
       call the instant it recovers. */
    check("the parent is not told the call ended when it is only recovering",
      /onLiveChangeRef\.current\?\.\(next === "live" \|\| next === "reconnecting"\)/.test(src));

    /* A failed session has already torn itself down. Keeping the handle would
       make the next tap reuse a dead connection, which presents to a user as a
       button that silently stopped working. */
    check("a failure clears the session handle so a retry starts fresh",
      /next === "failed"[\s\S]{0,1800}?sessionRef\.current = null/.test(src));
    check("hanging up clears the handle too — through the release it is built on",
      /const releaseCall[\s\S]{0,400}?sessionRef\.current = null/.test(src) && /const hangUp = useCallback\(\(\) => \{[\s\S]{0,900}?releaseCall\(\);\s*setState\("idle"\);/.test(src));
    check("starting twice is refused rather than leaking the first session",
      /if \(sessionRef\.current\) return;/.test(src));
    check("hanging up detaches the stream from the audio element",
      /audioRef\.current\.srcObject = null/.test(src));

    /* Autoplay can be refused even after a gesture. A rejected play() nobody
       reports is indistinguishable from a dead call. */
    /* Audit 2026-09-07: the call is live and the far side can hear; only the
       speaker is held back by autoplay policy. A "could not start" toast sent
       the owner looking for a dead call. What fixes it is a tap. */
    check("a refused autoplay offers a tap to turn on sound rather than a failure toast",
      /\.play\(\)\.then\(\(\) => setSoundBlocked\(false\)\)\.catch\(\(\) => \{[\s\S]{0,500}?setSoundBlocked\(true\);/.test(src) &&
      /soundBlocked=\{soundBlocked\}\s*onEnableSound=\{enableSound\}/.test(src) && !/\.play\(\)\.catch\(\(\) => \{[\s\S]{0,200}?onErrorRef\.current/.test(src));
    check("  …and the speaker is unlocked inside the tap that starts the call",
      /const startCall = useCallback\(async \(opts\?: \{ resume\?: boolean; mic\?: MediaStream \| null \}\) => \{\s*if \(sessionRef\.current\) return;[\s\S]{0,700}?if \(!opts\?\.resume\) void audioRef\.current\?\.play\(\)\.catch\(\(\) => \{\}\);/.test(src));

    /* The session fires from network events and outlives any single render. */
    check("callbacks are held in refs, so the session never calls a stale one",
      /onErrorRef/.test(src) && /onMessageRef/.test(src) && /onLiveChangeRef/.test(src));

    /* Tool calls arrive on the DataChannel. Routing them through the
       permission engine is the next step; today this component must not act. */
    /* THE GUARANTEE, NOT ITS SHAPE. The previous version of this pinned the
       exact one-liner and went red the moment captions were added beside it,
       even though the guarantee — the raw stream reaches the caller untouched
       — was intact. What matters is that the pass-through is UNCONDITIONAL and
       happens BEFORE any parsing: the tool bridge will read that stream and
       must not depend on whether a caption was produced from it. */
    const handler = src.slice(src.indexOf("onMessage: (data) =>"), src.indexOf("});", src.indexOf("onMessage: (data) =>")));
    check("the raw message reaches the caller untouched",
      /onMessageRef\.current\?\.\(data\)/.test(handler));
    check("and does so BEFORE anything is parsed from it",
      handler.indexOf("onMessageRef.current?.(data)") < handler.indexOf("parseVoiceEvent"));
    check("the pass-through is not gated on a parse result",
      !/if\s*\([^)]*\)\s*onMessageRef\.current/.test(handler));
    /* An OR here accepted the phase alone and passed with the transcript
       emission deleted — which is the empty screen this whole change exists to
       fix. Both are required, by name. */
    check("a parsed transcript is handed to the caller — the empty screen fix",
      /onTranscriptRef\.current\?\.\(/.test(handler));
    check("and the phase is reported for the orb",
      /onPhaseRef\.current\?\.\(/.test(handler));
    check("parsing feeds display state only — no dispatch",
      !/fetch\(|execute|tool_call/i.test(handler));
    check("the component dispatches no tool of its own",
      !/tool_call/i.test(src) && !/executeTool/i.test(src));

    /* Client source ships to the browser verbatim. */
    check("no vendor, endpoint, model or key name in the client source",
      !/dashscope|aliyun|qwen|maas|api[_-]?key|ws-pl/i.test(src));

    /* The existing mic is a working tool and the standing rule keeps it. */
    const app = fs.readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
    check("MicButton is still mounted — the call button is an addition, not a replacement",
      /<MicButton/.test(app) && /<VoiceCallButton/.test(app));
    check("a live call stops the page's own speech synthesis",
      /onLiveChange=\{\(live\) => \{ if \(live\) stopTts\(\); \}\}/.test(app));
  }

  console.log("\n── 10. The audio meter releases what it opens ──");
  {
    /* AN AUDIOCONTEXT IS A HARDWARE HANDLE. Browsers cap how many may exist
       at once, so one leaked per call ends with calls that cannot open a meter
       at all — the same class of bug as leaving the microphone captured, and
       just as invisible until the fourth or fifth call. */
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/voice/useStreamLevel.ts", "utf8");

    check("the context is closed on cleanup", /ctx\.close\(\)/.test(src));
    check("the frame loop is cancelled", /cancelAnimationFrame/.test(src));
    check("the graph is disconnected", /source\.disconnect\(\)/.test(src));
    check("cleanup runs when the stream changes, not only on unmount",
      /\}, \[stream, active\]\)/.test(src));

    /* Routing the microphone to the speakers is feedback, in a room where the
       far side is already being played. */
    check("the meter never connects to the output",
      !/connect\(ctx\.destination\)/.test(src) && !/connect\(\s*ctx\.destination/.test(src));

    /* A browser that refuses an AudioContext, or a stream with no audio track,
       must mean a still orb — never a thrown error that takes the call down. */
    check("a missing AudioContext is handled, not assumed away",
      /webkitAudioContext/.test(src) && /if \(!Ctor\) return;/.test(src));
    check("a refused context leaves the call running", /\} catch \{[\s\S]{0,200}?return;/.test(src));

    /* An inactive meter must read as silence rather than the last value it
       saw, or a new call opens showing the previous call's amplitude. */
    check("an inactive meter reads as silence", /return stream && active \? level : 0;/.test(src));

    /* The button must drop both streams on hang-up or the meters never tear
       their contexts down, whatever the hook does. */
    const btn = fs.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    /* Sliced to the END OF THE FUNCTION rather than to the next declaration
       by name: `const startCallRef` was later added ABOVE this one, so the old
       boundary produced an empty slice and the assertion failed on correct
       code. `}, [` closes a useCallback and is the real end. */
    const hangUpAt = btn.indexOf("const releaseCall");
    const hangUp = btn.slice(hangUpAt, btn.indexOf("}, [", hangUpAt));
    check("hanging up drops the metered streams",
      /setMicStream\(null\)/.test(hangUp) && /setFarStream\(null\)/.test(hangUp));
    check("only the side that is making sound is metered",
      /useStreamLevel\(micStream, listening\)/.test(btn) &&
      /phase === "speaking"/.test(btn));
  }

  console.log("\n── 11. A connection that drops AFTER the call is live ──");
  {
    /* THE GAP THIS SECTION EXISTS FOR. Every assertion above stops at the
       handshake: they prove a call that never starts is reported honestly.
       Nothing proved anything about a call that starts and then loses its
       network — which is the failure a user on an unstable tunnel actually
       meets. The screen said "live" while the line was dead and they kept
       talking into it. WebRTC reports this; we were not listening. */

    /* 11a — a wobble is not a failure yet. */
    {
      const r = await run({});
      check("the call is live before anything drops", r.session.getState() === "live");
      r.ice("disconnected");
      check("a dropped connection is reported, not silently held as live",
        r.session.getState() === "reconnecting");
      /* AND IS NOT TORN DOWN. WebRTC recovers from a brief interruption on its
         own; releasing the microphone here would end a call that was about to
         come back. */
      check("  …the microphone stays open for the recovery", !r.mic.allStopped());
      check("  …and the connection is not closed", r.pcCalls.closed === 0);

      r.ice("connected");
      check("recovery puts the call back to live", r.session.getState() === "live");
      check("with no failure ever reported to the UI",
        r.states.every(([st]) => st !== "failed"));
    }

    /* 11b — THE RECOVERY MUST DISARM THE TIMER IT ARMED. Counted rather than
       inferred from state, for the reason given at pendingTimers(): nothing
       observable happens when this timer leaks, which is precisely why it
       would leak unnoticed. A browser tab that survives fifty wobbles over a
       long call would be holding fifty live callbacks over the session. */
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      /* Audit 2026-09-07: a call is watched from the moment it goes live —
         until its media connects, the never-connected watchdog is pending. */
      const beforeMedia = pendingTimers();
      r.ice("connected");
      check("the never-connected watchdog is pending until the media connects, then cleared", pendingTimers() === beforeMedia - 1);
      const base = pendingTimers();
      r.ice("disconnected");
      check("a drop arms a recovery timer", pendingTimers() === base + 1);
      r.ice("connected");
      check("recovery disarms it rather than leaving it pending",
        pendingTimers() === base);
      r.session.stop();
    }

    /* 11c — but not forever. */
    {
      const r = await run({});
      r.ice("disconnected");
      await sleep(160);               // grace is 80ms in the suite
      const last = r.states[r.states.length - 1];
      check("a drop that never recovers ends the call rather than pretending",
        last[0] === "failed" && last[1] === "connection-lost");
      /* THE MICROPHONE IS KEPT FOR THE RESUME (2026-09-08): a lost line on a
         call that was up hands its stream to the call that resumes it, so
         the phone is asked for nothing outside a tap. Taken once; the
         privacy obligation is met by whoever takes it — or by stop(). */
      /* Never up — so nothing to resume, and the microphone is released as
         on every other exit. (A call that WAS up keeps it: 11d, 17, 26.) */
      check("  …and the microphone is released — the call was never up, there is nothing to resume", r.mic.allStopped() && r.session.takeMicrophone() === null);
      check("  …and the connection is closed", r.pcCalls.closed === 1);
    }

    /* 11c-bis — THE REGRESSION THIS SECTION SHIPPED, and the one that made
       "could not start the call" the normal outcome on some networks.

       The session goes `live` the moment the SDP is exchanged; ICE is still
       working then. So this watcher runs with the state already "live" while
       the connection is being ESTABLISHED — and ICE legitimately reports
       "failed" mid-setup when the first candidate pairs lose and the ones
       trickled in with the answer have not been tried yet. Treating that as
       final killed calls that were about to connect. Before the watcher
       existed, nothing looked at ICE and those same calls worked. */
    {
      const r = await run({});
      check("the call is live once the SDP is exchanged, before ICE has connected",
        r.session.getState() === "live");
      r.ice("failed");
      check("an ICE failure BEFORE the connection was ever up is not final",
        r.session.getState() === "reconnecting");
      check("  …the microphone is not released on it", !r.mic.allStopped());
      check("  …and the connection is not closed", r.pcCalls.closed === 0);
      /* And it still connects when the later candidates win. */
      r.ice("connected");
      check("and the call comes up when a later candidate pair succeeds",
        r.session.getState() === "live");
      check("with no failure ever shown to the user",
        r.states.every(([st]) => st !== "failed"));
      r.session.stop();
    }

    /* 11c-ter — but a pre-connection failure that never resolves still ends,
       rather than leaving the user talking into a call that never came up. */
    {
      const r = await run({});
      r.ice("failed");
      await sleep(160);                 // grace is 80ms in the suite
      const last = r.states[r.states.length - 1];
      check("a connection that never comes up at all still ends honestly",
        last[0] === "failed" && last[1] === "connection-lost");
      check("  …and releases the microphone", r.mic.allStopped());
    }

    /* 11d — a connection that fails outright is over now. Waiting out a
       recovery window for a state WebRTC has already called final is eight
       seconds of silence sold to the user as a call. */
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      /* CONNECT FIRST. Without this the case tests the pre-connection path
         above instead, and would have passed on the broken behaviour. */
      r.ice("connected");
      r.ice("failed");
      const last = r.states[r.states.length - 1];
      check("an ICE failure AFTER the call was up ends it without waiting out the window",
        last[0] === "failed" && last[1] === "connection-lost");
      check("  …and the microphone is kept for the resume, and released by stop()", (() => { const kept = !r.mic.allStopped(); r.session.stop(); return kept && r.mic.allStopped(); })());
    }

    /* 11e — hanging up during a wobble must take the timer with it. The user
       ended the call; nothing about it should still be scheduled. Counted for
       the same reason as 11b. */
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      r.ice("connected");
      const base = pendingTimers();
      r.ice("disconnected");
      check("the recovery timer is pending mid-wobble", pendingTimers() === base + 1);
      r.session.stop();
      check("hanging up during a reconnect ends the call", r.session.getState() === "ended");
      check("  …and takes the recovery timer with it", pendingTimers() === base);

      /* And the call still works afterwards: the teardown that cancels a timer
         must not have broken anything the next call needs. */
      await r.session.start();
      check("a second call still starts", r.session.getState() === "live");
      r.session.stop();
    }

    /* 11f — a wobble DURING the handshake must not poison a call that then
       succeeds. `disconnected` before the connection was ever up is normal. */
    {
      const r = await run({ reconnectGraceMs: 200 });
      const last = r.states[r.states.length - 1];
      check("a call that completed its handshake is live", last[0] === "live");
    }

    /* 11g — THE VALUES THAT ACTUALLY SHIP. Every case above injects its own
       grace window so the suite does not spend eight seconds per assertion —
       which means every case above also passes with a production window of
       ZERO, where the first flicker of an unstable tunnel ends the call. That
       mutation survived the whole section. This one call runs on the real
       constant. */
    {
      const d = deps({});
      const shipped: VoiceDeps = { ...d.deps };
      delete shipped.reconnectGraceMs;
      const s2 = new VoiceSession(shipped, {});
      await s2.start();
      check("a call on the shipped defaults goes live", s2.getState() === "live");
      d.ice("disconnected");
      /* Longer than the window the rest of the suite injects, so a default
         that had quietly collapsed to it would be caught too. */
      await sleep(120);
      check("the SHIPPED recovery window is a real window — a brief wobble does not end the call",
        s2.getState() === "reconnecting");
      s2.stop();
    }

    /* 11i — THE TRANSPORT IS UP BY WHICHEVER SIGN ARRIVES FIRST (owner,
       2026-09-07: "when we talk suddenly it out of conversation"). The call
       was judged by iceConnectionState alone; Safari does not always report
       "connected" there for a connection that is plainly carrying audio and
       data, so the never-connected watchdog took a working call for one
       whose media had never come up, switched region onto the endpoint that
       refuses this account, and ended a conversation mid-sentence. An open
       DataChannel, a message on it, or connectionState "connected" is the
       media path connected — each disarms the watchdog and makes "failed"
       final. */
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      const before = pendingTimers();
      r.pcCalls.channel?.open();
      check("an open DataChannel disarms the never-connected watchdog — the media is up, whatever the ICE state says",
        pendingTimers() === before - 1 && r.session.diagnostics().ice_ever_connected === true);
      r.session.stop();
    }
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      const before = pendingTimers();
      r.conn("connected");
      check("connectionState \"connected\" counts too — the property Safari keeps current", pendingTimers() === before - 1 && r.session.diagnostics().ice_ever_connected === true);
      r.session.stop();
    }
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      const before = pendingTimers();
      r.pcCalls.channel?.open();
      r.pcCalls.channel?.onmessage?.({ data: JSON.stringify({ type: "session.created" }) });
      check("a message arriving on the channel counts — nothing arrives on a path that is down", pendingTimers() === before - 1);
      r.session.stop();
    }
    {
      /* THE CALL THAT WAS ENDED: two regions, ICE never says "connected",
         the channel is open and events flow. Before: after the window, a
         second handshake on the other region. Now: nothing — it is a call. */
      const recorded: Recorded[] = [];
      const r = await run({ recorded, envelope: { sdp: ANSWER, session: { type: "session.update", session: {} }, session_compact: { type: "session.update", session: {} }, region: "alt", alt_available: true } });
      r.pcCalls.channel?.open();
      await sleep(160);
      check("a live call with an open channel is never failed over to the other region while ICE sits on \"checking\"",
        recorded.length === 1 && r.session.getState() === "live" && r.states.every(([st]) => st !== "connecting" || r.states.indexOf([st, undefined]) === -1));
      check("  …and is not ended either", r.states.every(([st]) => st !== "failed"));
      r.session.stop();
    }
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      r.pcCalls.channel?.open();
      r.ice("failed");
      const last = r.states[r.states.length - 1];
      check("once the channel has been open, an ICE failure is final — a call that WAS up has gone down", last[0] === "failed" && last[1] === "connection-lost");
    }
    {
      const r = await run({ reconnectGraceMs: 5_000 });
      r.ice("connected");
      r.ice("disconnected");
      check("a wobble on a live call is reported as reconnecting", r.session.getState() === "reconnecting");
      r.pcCalls.channel?.open();
      r.pcCalls.channel?.onmessage?.({ data: JSON.stringify({ type: "response.audio_transcript.delta", delta: "hi" }) });
      check("  …and the far side talking to us again brings it back to live, without waiting for ICE to say so", r.session.getState() === "live");
      r.session.stop();
    }
    {
      /* THE WINDOW A CALL THAT WAS UP GETS is longer than the one a call
         that never came up gets: a handover between networks takes longer
         than eight seconds and comes back. */
      const r = await run({ reconnectGraceMs: 80, liveGraceMs: 300 });
      r.ice("connected");
      r.ice("disconnected");
      await sleep(160);
      check("a live call's wobble outlasts the never-connected window", r.session.getState() === "reconnecting");
      await sleep(260);
      const last = r.states[r.states.length - 1];
      check("  …and still ends honestly when the live window runs out", last[0] === "failed" && last[1] === "connection-lost");
    }
    {
      const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
      const live = Number((/const LIVE_GRACE_MS = ([\d_]+)/.exec(src)?.[1] ?? "0").replace(/_/g, ""));
      const never = Number((/const RECONNECT_GRACE_MS = ([\d_]+)/.exec(src)?.[1] ?? "0").replace(/_/g, ""));
      check("the shipped live window is twenty seconds, above the eight a call that never came up gets", live === 20_000 && never === 8_000 && live > never);
      check("  …and is the one armed for a call that was up", /this\.iceEverConnected\s*\?\s*\(this\.deps\.liveGraceMs \?\? this\.deps\.reconnectGraceMs \?\? LIVE_GRACE_MS\)\s*:[\s\S]{0,600}?\(this\.deps\.reconnectGraceMs \?\? RECONNECT_GRACE_MS\)/.test(src));
      check("  …every sign of a connected transport goes through one place",
        /local\.onopen = \(\) => \{\s*this\.markTransportUp\(\);/.test(src) && /remote\.onopen = \(\) => \{\s*this\.markTransportUp\(\);/.test(src) &&
        /private onChannelMessage\(raw: string, channel: VoiceChannel\): void \{[\s\S]{0,600}?this\.markTransportUp\(\);/.test(src) &&
        /pc\.onconnectionstatechange = \(\) => \{[\s\S]{0,200}?if \(st === "connected"\) \{\s*this\.markTransportUp\(\);/.test(src));
    }

    /* 11h — and the gathering budget, pinned the only way it can be: read.
       Waiting it out would make this suite the slowest thing in the gate, and
       every case above passes it an injected 60ms, so a regression to the
       original three seconds is invisible here. Three seconds is what an
       earlier version shipped, and it cuts a slow network off mid-gather —
       producing an offer with too few candidates, which negotiates and then
       connects to nothing. That is the failure on a tunnelled connection. */
    {
      const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
      const budget = Number(
        (/const ICE_GATHER_TIMEOUT_MS = ([\d_]+)/.exec(src)?.[1] ?? "0").replace(/_/g, ""),
      );
      check("the ICE gathering budget tolerates a slow or tunnelled network (source read)",
        budget >= 5_000);
    }
  }

  
console.log("\n── 12. Mute ──");
{
  /* WHAT MUTE MUST BE. Nothing the user says is transmitted, the call stays
     up, and the far side keeps talking. That means track.enabled — not
     track.stop(), which releases the microphone and needs a renegotiation to
     undo, and not closing the connection, which ends the call. */
  {
    const r = await run({});
    check("a call starts unmuted", r.session.isMuted() === false && r.mic.allEnabled());

    r.session.setMuted(true);
    check("muting reports muted", r.session.isMuted() === true);
    check("  …and disables the microphone tracks", r.mic.noneEnabled());
    /* THE THREE THINGS MUTE MUST NOT DO. */
    check("  …without stopping them — the call is not over", !r.mic.allStopped());
    check("  …without closing the connection", r.pcCalls.closed === 0);
    check("  …and the call is still live", r.session.getState() === "live");

    r.session.setMuted(false);
    check("unmuting re-enables the tracks", r.mic.allEnabled() && r.session.isMuted() === false);
    r.session.stop();
    check("hanging up still releases the microphone after a mute cycle", r.mic.allStopped());
  }

  /* MUTE MUST NOT SURVIVE INTO THE NEXT CALL. A session that opens muted is a
     user talking into a call that looks live, hearing nothing back, with no
     reason to connect it to something they did minutes ago in a different
     call. */
  {
    const r = await run({});
    r.session.setMuted(true);
    check("muted before hanging up", r.session.isMuted());
    r.session.stop();
    await r.session.start();
    check("a second call opens unmuted", r.session.isMuted() === false);
    check("  …with its tracks live", r.mic.allEnabled());
    r.session.stop();
  }

  /* Muting before anything is connected must not throw: the control exists
     from the moment the screen does. */
  {
    const d = deps({});
    const s2 = new VoiceSession(d.deps, {});
    check("muting before a call has started does not throw",
      (() => { s2.setMuted(true); return s2.isMuted() === true; })());
  }

  /* SOURCE READ — the button must ask the SESSION for the current value.
     Deriving the next state from a possibly-stale render is how a mute button
     and a microphone come to disagree, which is the one thing this control
     must never do. */
  {
    const fs = await import("node:fs");
    const btn = fs.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    check("the toggle reads the session's own flag, not React state",
      /const next = !session\.isMuted\(\);/.test(btn));
    check("and it tells the session before it tells the screen",
      /session\.setMuted\(next\);\s*\n\s*setMuted\(next\);/.test(btn));
    check("hanging up clears the UI's mute too", /setMuted\(false\);/.test(btn));
  }
}

  console.log("\n── 13. Typing into a live call ──");
  {
    const msgs = buildTextTurnMessages("  KX-180, quantity two  ");
    check("a typed turn becomes two protocol messages", msgs !== null && msgs.length === 2);
    const item = JSON.parse(msgs![0]) as { type: string; item: { type: string; role: string; content: Array<{ type: string; text: string }> } };
    const go = JSON.parse(msgs![1]) as { type: string };
    check("the first puts the text into the conversation as the USER's turn",
      item.type === EV_ITEM_CREATE && item.item.type === "message" && item.item.role === "user" &&
      item.item.content[0].type === "input_text" && item.item.content[0].text === "KX-180, quantity two");
    check("the second asks for an answer — turn detection fires on audio only",
      go.type === EV_RESPONSE_CREATE && Object.keys(go).length === 1);
    check("the names are the protocol's", EV_ITEM_CREATE === "conversation.item.create" && EV_RESPONSE_CREATE === "response.create");
    check("blank text sends nothing", buildTextTurnMessages("   ") === null && buildTextTurnMessages("") === null);
    const huge = JSON.parse(buildTextTurnMessages("z".repeat(MAX_TYPED_TURN_CHARS + 500))![0]) as { item: { content: Array<{ text: string }> } };
    check("a pasted document is cut to the cap", huge.item.content[0].text.length === MAX_TYPED_TURN_CHARS);

    /* ON A REAL SESSION: after the configuration, through the same channel. */
    const r = deps({ status: 200, channelOpen: true });
    const s = new VoiceSession(r.deps);
    await s.start();
    const before = r.pcCalls.sent.length;
    check("sendText goes when the channel is open", s.sendText("hello") === true);
    check("  …as exactly the two messages, after the configuration",
      before >= 1 && r.pcCalls.sent.length === before + 2 &&
      (JSON.parse(r.pcCalls.sent[before]) as { type: string }).type === EV_ITEM_CREATE &&
      (JSON.parse(r.pcCalls.sent[before + 1]) as { type: string }).type === EV_RESPONSE_CREATE);
    check("  …and blank text still sends nothing", s.sendText("  ") === false && r.pcCalls.sent.length === before + 2);

    const closed = deps({ status: 200, channelOpen: false });
    const s2 = new VoiceSession(closed.deps);
    await s2.start();
    check("sendText refuses while the channel is not open, rather than throwing or queueing",
      s2.sendText("hello") === false && closed.pcCalls.sent.length === 0);

    const fresh = new VoiceSession(deps({ status: 200 }).deps);
    check("sendText before start is a plain false", fresh.sendText("hello") === false);

    /* THE CONVERSATION TRAVELS WITH THE HANDSHAKE — as an id only. */
    const recorded: Recorded[] = [];
    const r3 = deps({ status: 200, recorded });
    const s3 = new VoiceSession(r3.deps, {}, "v1", "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab");
    await s3.start();
    check("the conversation id reaches the server beside the voice key",
      recorded[0]?.url === `${HANDSHAKE_PATH}?voice=v1&conversation=6f1d2c3b-4a5e-4f60-9b7c-1234567890ab`);
    const recorded4: Recorded[] = [];
    const s4 = new VoiceSession(deps({ status: 200, recorded: recorded4 }).deps, {}, null, null);
    await s4.start();
    check("no conversation, no parameter", recorded4[0]?.url === HANDSHAKE_PATH);
    const recorded5: Recorded[] = [];
    const s5 = new VoiceSession(deps({ status: 200, recorded: recorded5 }).deps, {}, "a b&c=d");
    await s5.start();
    check("values are encoded, so a key cannot smuggle a second parameter",
      recorded5[0]?.url === `${HANDSHAKE_PATH}?voice=a+b%26c%3Dd`);
    check("nothing of the thread itself leaves the browser — the body is still the offer alone",
      String(recorded[0]?.init?.body ?? "").startsWith("v=0"));
  }

  console.log("\n── 13b. A configuration refused for its CONTENT gets the compact one, once ──");
  {
    /* The size fallback catches a send() that throws. A field the far side
       does not know comes back as an `error` EVENT instead, with the call up
       and unconfigured. This is the second fallback: an error within the
       window after the full configuration, before any acknowledgement or
       progress, sends the compact one — once, and never later. */
    const authored = { type: "session.update", session: { modalities: ["text", "audio"], input_audio_transcription: { enabled: true, language: "ar" } } };
    const compact = { type: "session.update", session: { modalities: ["text", "audio"] } };
    const r = deps({ status: 200, session: authored, sessionCompact: compact, channelOpen: true });
    const s = new VoiceSession(r.deps);
    await s.start();
    check("the full configuration went first", r.pcCalls.sent.length === 1 && r.pcCalls.sent[0] === JSON.stringify(authored));
    r.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "error", error: { message: "unknown field: language" } }) } as MessageEvent);
    check("an error right after it sends the compact configuration",
      r.pcCalls.sent.length === 2 && r.pcCalls.sent[1] === JSON.stringify(compact));
    r.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "error", error: { message: "again" } }) } as MessageEvent);
    check("  …once — a second error sends nothing more", r.pcCalls.sent.length === 2);
    check("  …and the call is still up", s.getState() === "live");

    /* Acknowledged, then an error: the error is something else's. */
    const r2 = deps({ status: 200, session: authored, sessionCompact: compact, channelOpen: true });
    const s2 = new VoiceSession(r2.deps);
    await s2.start();
    r2.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) } as MessageEvent);
    r2.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "error", error: { message: "tool failed" } }) } as MessageEvent);
    check("after session.updated an error does NOT touch the configuration", r2.pcCalls.sent.length === 1);

    /* Progress without an explicit ack counts as accepted too. */
    const r3 = deps({ status: 200, session: authored, sessionCompact: compact, channelOpen: true });
    const s3 = new VoiceSession(r3.deps);
    await s3.start();
    r3.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "input_audio_buffer.speech_started" }) } as MessageEvent);
    r3.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "error" }) } as MessageEvent);
    check("after any progress an error does not touch it either", r3.pcCalls.sent.length === 1);

    /* session.created is not progress — it can arrive right after the send. */
    const r4 = deps({ status: 200, session: authored, sessionCompact: compact, channelOpen: true });
    const s4 = new VoiceSession(r4.deps);
    await s4.start();
    r4.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "session.created" }) } as MessageEvent);
    r4.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "error" }) } as MessageEvent);
    check("session.created between the send and the error does not mask the refusal", r4.pcCalls.sent.length === 2);

    /* The hint travels as a query value the server allow-lists. */
    const recorded: Recorded[] = [];
    const s5 = new VoiceSession(deps({ status: 200, recorded }).deps, {}, null, null, "ar");
    await s5.start();
    check("the caller's language reaches the server as a hint", recorded[0]?.url === `${HANDSHAKE_PATH}?stt=ar`);
    const recorded6: Recorded[] = [];
    const s6 = new VoiceSession(deps({ status: 200, recorded: recorded6 }).deps, {}, null, null, null);
    await s6.start();
    check("  …and without one, no parameter", recorded6[0]?.url === HANDSHAKE_PATH);
    void s; void s2; void s3; void s4; void s5; void s6;
  }

  console.log("\n── 14. Settled turns leave for the conversation; partial ones do not ──");
  {
    type Post = { body: { conversation_id: string; turns: Array<{ role: string; text: string; via: string }> }; keepalive: boolean | undefined };
    const CONV = "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab";
    const harness = (opts: { status?: number | ((n: number) => number); ensure?: () => Promise<string | null>; conv?: string | null } = {}) => {
      const posts: Post[] = [];
      const saved: SavedTurn[][] = [];
      const errors: string[] = [];
      let ensured = 0;
      const fetchFn = (async (url: string, init?: RequestInit) => {
        if (url !== TRANSCRIPT_PATH) throw new Error(`unexpected url ${url}`);
        const body = JSON.parse(String(init?.body)) as Post["body"];
        posts.push({ body, keepalive: (init as { keepalive?: boolean } | undefined)?.keepalive });
        const status = typeof opts.status === "function" ? opts.status(posts.length) : (opts.status ?? 200);
        return {
          ok: status < 400,
          status,
          json: async () => ({
            messages: body.turns.map((t, i) => ({ id: `row-${posts.length}-${i}`, role: t.role, content: t.text, created_at: "now", source: t.via })),
            conversation: { id: body.conversation_id, title: "T" },
          }),
        } as unknown as Response;
      }) as unknown as typeof fetch;
      const p = new TranscriptPersister(
        {
          fetchFn,
          ensureConversation: opts.ensure ?? (async () => { ensured++; return CONV; }),
          onSaved: (rows) => { saved.push(rows); },
          onError: (reason) => { errors.push(reason); },
        },
        opts.conv === undefined ? CONV : opts.conv,
      );
      return { p, posts, saved, errors, ensured: () => ensured };
    };
    const L = (role: "user" | "assistant", text: string, final: boolean, via?: "voice" | "text"): TranscriptLine =>
      ({ role, text, final, ...(via ? { via } : {}) });

    {
      const h = harness();
      h.p.observe([L("user", "how ma", false)]);
      await h.p.flush();
      check("a partial line is never posted", h.posts.length === 0 && h.p.pending() === 0);
      h.p.observe([L("user", "how many orders", true)]);
      await h.p.flush();
      check("a settled line is posted at once", h.posts.length === 1 && h.posts[0].body.turns[0].text === "how many orders");
      check("  …into the conversation it was given", h.posts[0].body.conversation_id === CONV);
      check("  …marked as spoken when the line carries no via", h.posts[0].body.turns[0].via === "voice");
      check("  …and the rows come back to the caller", h.saved.length === 1 && h.saved[0][0].id === "row-1-0");
      h.p.observe([L("user", "how many orders", true), L("assistant", "Fourt", false)]);
      await h.p.flush();
      check("the same settled line is not posted twice", h.posts.length === 1);
      h.p.observe([L("user", "how many orders", true), L("assistant", "Fourteen.", true)]);
      await h.p.flush();
      check("the assistant's settled turn follows", h.posts.length === 2 && h.posts[1].body.turns[0].role === "assistant");
      check("  …not with keepalive — the page is still here", h.posts[1].keepalive === false);
      h.p.observe([L("user", "how many orders", true), L("assistant", "Fourteen.", true), L("user", "KX-180", true, "text")]);
      await h.p.flush();
      check("a typed turn keeps its via", h.posts[2].body.turns[0].via === "text");
    }

    {
      /* A LINE LEFT OPEN BEHIND THE CONVERSATION. An answer whose `done`
         never came, then two more turns: "everything up to the first open
         line" stopped at it and nothing after it was ever saved (owner,
         2026-09-07: the thread after a call "not complete"). A line the
         fold can no longer reach is settled as it stands. */
      const h = harness();
      h.p.observe([L("user", "show me the pyramids", true), L("assistant", "One moment", false)]);
      await h.p.flush();
      check("an open answer is not posted while it can still grow", h.posts.length === 1);
      h.p.observe([L("user", "show me the pyramids", true), L("assistant", "One moment", false), L("user", "and the sphinx", true), L("assistant", "Here they are.", true)]);
      await h.p.flush();
      const turns = h.posts.flatMap((x) => x.body.turns.map((t) => t.text));
      check("  …but once two turns have followed it, it and everything after it are saved, in order",
        turns.join("|") === "show me the pyramids|One moment|and the sphinx|Here they are.");
    }

    {
      /* A CALL THAT BEGINS ON AN EMPTY SCREEN. The conversation is made when
         the first settled turn needs it — not at construction, so a call that
         never connects leaves no empty chat behind. */
      const h = harness({ conv: null });
      check("nothing is created for a call with no words yet", h.ensured() === 0);
      h.p.observe([L("user", "hello", false)]);
      await h.p.flush();
      check("  …nor for a partial", h.ensured() === 0 && h.posts.length === 0);
      h.p.observe([L("user", "hello there", true)]);
      await h.p.flush();
      check("the first settled turn creates the conversation once", h.ensured() === 1 && h.p.conversation() === CONV);
      h.p.observe([L("user", "hello there", true), L("assistant", "hi there", true)]);
      await h.p.flush();
      check("  …and later turns reuse it", h.ensured() === 1 && h.posts.length === 2);
    }

    {
      /* Audit 2026-09-07: settled means every line up to the FIRST open one.
         The far side opens its answer on top of the caller's still-open
         question; "everything but the last line" posted both as turns. */
      const h = harness({});
      h.p.observe([L("user", "how many ord", false), L("assistant", "Fourt", false)]);
      await h.p.flush();
      check("an open question under an open answer posts nothing", h.posts.length === 0 && h.p.pending() === 0);
      h.p.observe([L("user", "how many orders today", true), L("assistant", "Fourteen", false)]);
      await h.p.flush();
      check("the closed question posts alone, the open answer waits", h.posts.length === 1 && h.posts[0].body.turns.map((t) => t.text).join("|") === "how many orders today");
      h.p.observe([L("user", "how many orders today", true), L("assistant", "Fourteen orders.", true)]);
      await h.p.flush();
      check("  …and posts when it closes; a short real answer such as \"OK\" or \"نعم\" is a turn like any other",
        h.posts.length === 2 && h.posts[1].body.turns[0].text === "Fourteen orders.");
      h.p.observe([L("user", "how many orders today", true), L("assistant", "Fourteen orders.", true), L("user", "in stock?", true), L("assistant", "نعم", true)]);
      await h.p.flush();
      check("  …proved: نعم is saved", h.posts.flatMap((b) => b.body.turns.map((t) => t.text)).includes("نعم"));
    }

    {
      /* Audit 2026-09-07: a resumed call keeps its captions and gets a new
         persister; seeded with the settled count it does not re-post them. */
      const kept = [L("user", "hello there", true), L("assistant", "hi there", true), L("user", "and", false)];
      const h = harness({});
      const resumed = new TranscriptPersister(
        { fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({ messages: [], conversation: { id: CONV, title: "T" } }) })) as unknown as typeof fetch,
          ensureConversation: async () => CONV },
        CONV,
        kept.filter((l) => l.final).length,
      );
      resumed.observe(kept);
      await resumed.flush();
      check("a resumed persister seeded with the settled count re-posts nothing", resumed.pending() === 0 && h.posts.length === 0);
      resumed.observe([...kept.slice(0, 2), L("user", "and the price?", true)]);
      check("  …and queues only what settles after the resume", resumed.pending() === 0 || resumed.pending() === 1);
    }

    {
      const h = harness({ conv: null, ensure: async () => null });
      for (let i = 0; i < MAX_POST_FAILURES; i++) {
        h.p.observe([L("user", "turn", true)].concat(Array.from({ length: i }, (_, k) => L("assistant", `a${k}`, true))));
        await h.p.flush();
      }
      check("a conversation that cannot be made is given up on after the cap, with one word to the UI",
        h.posts.length === 0 && h.errors.length === 1 && h.errors[0] === "failed");
    }

    {
      const h = harness({ status: 401 });
      h.p.observe([L("user", "x", true)]);
      await h.p.flush();
      h.p.observe([L("user", "x", true), L("user", "y", true)]);
      await h.p.flush();
      check("a 401 stops the writer for the call and says so once",
        h.posts.length === 1 && h.errors.join(",") === "unauthorised" && h.p.pending() === 0);
      const h4 = harness({ status: 404 });
      h4.p.observe([L("user", "x", true)]);
      await h4.p.flush();
      check("a 404 — the conversation is gone — has its own word", h4.errors.join(",") === "not-found");
    }

    {
      /* A BAD MOMENT ON THE SERVER. The batch is kept, but the retry waits for
         the next settled turn rather than firing three times in a burst. */
      let n = 0;
      const h = harness({ status: () => (++n === 1 ? 500 : 200) });
      h.p.observe([L("user", "first", true)]);
      await h.p.flush();
      check("a 500 keeps the turn queued", h.posts.length === 1 && h.p.pending() === 1 && h.errors.length === 0);
      await h.p.flush();
      check("  …and retries on the next flush, first turn first",
        h.posts.length === 2 && h.posts[1].body.turns[0].text === "first" && h.p.pending() === 0);
    }

    {
      const h = harness({ status: 400 });
      h.p.observe([L("user", "x", true)]);
      await h.p.flush();
      check("a 400 — our own shape refused — is dropped, not retried and not fatal",
        h.posts.length === 1 && h.p.pending() === 0 && h.errors.length === 0);
    }

    {
      const h = harness();
      const many = Array.from({ length: MAX_TURNS_PER_POST + 5 }, (_, i) => L(i % 2 ? "assistant" : "user", `turn ${i}`, true));
      h.p.observe(many);
      await h.p.flush();
      await h.p.flush();
      check("a burst is split at the server's batch size",
        h.posts.length === 2 && h.posts[0].body.turns.length === MAX_TURNS_PER_POST && h.posts[1].body.turns.length === 5);
    }

    {
      const h = harness();
      h.p.observe([L("user", "   ", true), L("user", "real", true)]);
      await h.p.flush();
      check("an empty settled turn is skipped but counted, so it never blocks the ones after it",
        h.posts.length === 1 && h.posts[0].body.turns.length === 1 && h.posts[0].body.turns[0].text === "real");
    }

    {
      /* A turn still QUEUED at hang-up — here because its first post failed —
         goes out from finish() with keepalive, so it survives the screen
         closing. A turn already in flight when finish() is called simply
         completes; nothing is sent twice. */
      let n = 0;
      const h = harness({ status: () => (++n === 1 ? 500 : 200) });
      h.p.observe([L("user", "bye", true)]);
      await h.p.flush();
      check("a turn is waiting at hang-up", h.p.pending() === 1 && h.posts[0].keepalive === false);
      await h.p.finish();
      check("finish posts it with keepalive, so hang-up does not lose the last turn",
        h.posts.length === 2 && h.posts[1].keepalive === true && h.p.pending() === 0);
      await h.p.finish();
      check("  …and a second finish sends nothing more", h.posts.length === 2);
    }
  }

  console.log("\n── 15. What a lookup showed is read out of its result — https only, capped, and kept ──");
  {
    const search = {
      ok: true, status: "allowed",
      data: { products: [
        { id: "1", product_name: "KX-180 Spreader", primary_model: "KX-180", photo_url: "https://cdn.example/a.jpg" },
        { id: "2", product_name: "KX-220", photo_url: "http://cdn.example/b.jpg" },
        { id: "3", product_name: "No photo" },
        { id: "4", product_name: "KX-260", photo_url: "https://cdn.example/a.jpg" },
      ] },
    };
    const got = extractProductPhotos(search);
    check("a search result yields one photo per product that has one", got.length === 1);
    check("  …labelled with the product's name", got[0].label === "KX-180 Spreader");
    check("  …https only — a plain http URL is dropped", !got.some((p) => p.url.startsWith("http:")));
    check("  …and deduplicated by URL", extractProductPhotos({ data: [{ photo_url: "https://x/1.jpg" }, { photo_url: "https://x/1.jpg" }] }).length === 1);

    const details = { ok: true, data: { product: { product_name: "KX-180" }, main_photo_url: "https://cdn.example/main.jpg", photo_urls: ["https://cdn.example/g1.jpg", "https://cdn.example/g2.jpg"] } };
    const d = extractProductPhotos(details);
    check("a details result yields the main photo and the first of the gallery, not the whole gallery",
      d.map((p) => p.url).join(",") === "https://cdn.example/main.jpg,https://cdn.example/g1.jpg");

    const many = { data: Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, photo_url: `https://cdn.example/${i}.jpg` })) };
    check("a catalogue is capped", extractProductPhotos(many).length === MAX_PHOTOS_PER_RESULT);
    check("nothing photo-shaped means nothing", extractProductPhotos({ ok: false, message: "no" }).length === 0 && extractProductPhotos(null).length === 0 && extractProductPhotos("x").length === 0);
    check("a javascript: or data: URL never becomes a photo",
      extractProductPhotos({ photo_url: "javascript:alert(1)" }).length === 0 &&
      extractProductPhotos({ photo_url: "data:image/png;base64,AAAA" }).length === 0);
    check("a URL with a quote in it is dropped rather than rendered", extractProductPhotos({ photo_url: 'https://x/"onerror' }).length === 0);

    check("the saved markdown uses the URL exactly and the name as alt",
      photosMarkdown([{ url: "https://cdn.example/a.jpg", label: "KX-180" }]) === "![KX-180](https://cdn.example/a.jpg)");
    check("  …brackets in a name cannot break the markdown",
      photosMarkdown([{ url: "https://x/a.jpg", label: "K[X]" }]) === "![KX](https://x/a.jpg)");
    check("  …and no photos is no markdown at all", photosMarkdown([]) === "");

    /* Option 2 of the photos plan: a web search's pictures ride the same
       strip, captioned with what the picture is rather than a product. */
    const web = { ok: true, data: { results: [{ url: "https://en.example/port-said" }], images: [
      { url: "https://img.example/a.jpg", description: "Port Said harbour at dusk" },
      { url: "http://img.example/b.jpg", description: "not https" },
      { url: "https://img.example/a.jpg", description: "duplicate" },
      "https://img.example/bare.jpg",
      { url: "https://img.example/c.jpg", description: "c".repeat(200) },
    ] } };
    const w = extractProductPhotos(web);
    check("a web search's images[] become photos, https only and deduplicated", w.map((p) => p.url).join(",") === "https://img.example/a.jpg,https://img.example/c.jpg");
    check("  …captioned with the picture's description", w[0].label === "Port Said harbour at dusk");
    check("  …a long caption is cut for the strip", w[1].label.length === 80);
    check("  …and a bare string in images[] is not walked into a photo", !w.some((p) => p.url === "https://img.example/bare.jpg"));
    check("  …the page URLs in results[] are never mistaken for pictures", !w.some((p) => p.url.includes("en.example")));
    /* A GALLERY IS NOT AN ANSWER. Four web pictures of other makers' presses
       went on a call screen for "a heat press"; web pictures are capped at
       two, below the product cap. */
    const gallery = { data: { images: Array.from({ length: 6 }, (_, i) => ({ url: `https://img.example/${i}.jpg`, description: `p${i}` })) } };
    check("web pictures are capped at two, below the product cap", extractProductPhotos(gallery).length === MAX_WEB_PHOTOS_PER_RESULT && MAX_WEB_PHOTOS_PER_RESULT < MAX_PHOTOS_PER_RESULT);

    /* THE FILE NAME UNDER THE ORB. The model wrote its picture into its own
       words as markdown; the caption strip printed the URL and the persister
       appended the same picture again. */
    const spoken = "دي صورة الماكينة\n\n![Pneumatic press](https://cdn.example/1787301737295_CH_80100.png)\nمقاس كبير.";
    check("a markdown image is stripped from what a caption shows", stripImageMarkdown(spoken) === "دي صورة الماكينة\n\nمقاس كبير.");
    check("  …and a turn that is only a picture shows nothing", stripImageMarkdown("![x](https://cdn.example/a.png)") === "");
    check("  …ordinary text is untouched", stripImageMarkdown("hello [link](https://x.example)") === "hello [link](https://x.example)");
    check("the URLs a turn already shows are read out of it", [...imageUrlsIn(spoken)].join(",") === "https://cdn.example/1787301737295_CH_80100.png" && imageUrlsIn("no pictures").size === 0);
    const tr = (await import("node:fs")).readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
    check("the live captions render the stripped text", /\{stripImageMarkdown\(line\.text\)\}/.test(tr));

    /* THE SESSION HANDS THE RESULT TO THE SCREEN as the model hears it. */
    const seen: Array<[string, unknown]> = [];
    const r = deps({ status: 200, channelOpen: true });
    const toolFetch = r.deps.fetchFn;
    r.deps.fetchFn = (async (url: string, init?: RequestInit) => {
      if (String(url) === TOOL_PATH) {
        return { ok: true, status: 200, json: async () => ({ output: { ok: true, data: { photo_url: "https://cdn.example/a.jpg", name: "KX-180" } } }) } as unknown as Response;
      }
      return toolFetch(url, init);
    }) as unknown as typeof fetch;
    const s = new VoiceSession(r.deps, { onToolResult: (name, output) => seen.push([name, output]) });
    await s.start();
    r.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "response.output_item.added", item: { type: "function_call", call_id: "c1", name: "searchProducts" } }) } as MessageEvent);
    r.pcCalls.channel!.onmessage?.({ data: JSON.stringify({ type: "response.function_call_arguments.done", call_id: "c1", arguments: "{\"q\":\"KX\"}" }) } as MessageEvent);
    await new Promise((res) => setTimeout(res, 20));
    check("onToolResult fires with the tool's name and the server's output",
      seen.length === 1 && seen[0][0] === "searchProducts" && extractProductPhotos(seen[0][1]).length === 1);
    check("  …before the result is relayed to the model, so the screen and the model see the same thing",
      r.pcCalls.sent.some((m) => m.includes("function_call_output")));

    /* THE PERSISTER SAVES THE PICTURE WITH THE WORDS. */
    type Post = { body: { turns: Array<{ role: string; text: string }> } };
    const posts: Post[] = [];
    const persister = new TranscriptPersister({
      fetchFn: (async (_u: string, init?: RequestInit) => {
        posts.push({ body: JSON.parse(String(init?.body)) as Post["body"] });
        return { ok: true, status: 200, json: async () => ({ messages: [], conversation: { id: "c", title: null } }) } as unknown as Response;
      }) as unknown as typeof fetch,
      ensureConversation: async () => "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab",
    }, "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab");
    const pic = [{ url: "https://cdn.example/a.jpg", label: "KX-180" }];
    persister.observe([
      { role: "user", text: "show me the KX-180", final: true, photos: pic },
      { role: "assistant", text: "Here it is.", final: true, photos: pic },
      { role: "assistant", text: "", final: true, photos: pic },
    ]);
    await persister.flush();
    const turns = posts[0]?.body.turns ?? [];
    check("an assistant turn is saved with its photo as markdown after the words",
      turns[1]?.text === "Here it is.\n\n![KX-180](https://cdn.example/a.jpg)");
    check("a user turn never carries a picture, whatever the line says", turns[0]?.text === "show me the KX-180");
    check("an assistant turn with a photo and no words is still saved — the picture IS the answer",
      turns[2]?.text === "![KX-180](https://cdn.example/a.jpg)");

    /* NOT TWICE: a picture the words already carry is not appended again. */
    const posts2: Post[] = [];
    const p2 = new TranscriptPersister({
      fetchFn: (async (_url: string, init?: RequestInit) => {
        posts2.push({ body: JSON.parse(String(init?.body)) as Post["body"] });
        return { ok: true, status: 200, json: async () => ({ messages: [], conversation: { id: "c", title: null } }) } as unknown as Response;
      }) as unknown as typeof fetch,
      ensureConversation: async () => "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab",
    }, "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab");
    p2.observe([
      { role: "assistant", text: "Here it is.\n\n![KX-180](https://cdn.example/a.jpg)", final: true, photos: [{ url: "https://cdn.example/a.jpg", label: "KX-180" }, { url: "https://cdn.example/b.jpg", label: "KX-220" }] },
    ]);
    await p2.flush();
    check("a photo the spoken words already show is not appended a second time; a new one still is",
      posts2[0]?.body.turns[0]?.text === "Here it is.\n\n![KX-180](https://cdn.example/a.jpg)\n\n![KX-220](https://cdn.example/b.jpg)");
  }

{
  console.log("\n── 16. The call says it is ready — with a sound — and the orb moves like a voice ──");
  /* THE TONE, on a fake Web Audio graph that records what was scheduled. */
  type Ev = { kind: string; v?: number; t?: number; freq?: number };
  function fakeCtx(state = "running") {
    const events: Ev[] = [];
    const oscs: Array<ToneOscillatorLike & { dest?: unknown }> = [];
    let resumed = 0, closed = 0;
    const ctx: ToneContextLike = {
      currentTime: 10,
      destination: { dest: true },
      get state() { return state; },
      createOscillator: () => {
        let f = 0;
        const o: ToneOscillatorLike & { dest?: unknown } = {
          type: "",
          frequency: { setValueAtTime: (v, t) => { f = v; events.push({ kind: "freq", freq: v, t }); }, linearRampToValueAtTime: (v, t) => events.push({ kind: "glide", freq: v, t }) },
          connect: (d) => { o.dest = d; },
          start: (t) => events.push({ kind: "start", t, freq: f }),
          stop: (t) => events.push({ kind: "stop", t, freq: f }),
        };
        oscs.push(o);
        return o;
      },
      createGain: () => {
        const g: ToneGainLike & { dest?: unknown } = {
          gain: { setValueAtTime: (v, t) => events.push({ kind: "gain", v, t }), linearRampToValueAtTime: (v, t) => events.push({ kind: "ramp", v, t }) },
          connect: (d) => { g.dest = d; },
        };
        return g;
      },
      resume: async () => { resumed++; },
      close: async () => { closed++; },
    };
    return { ctx, events, oscs, counts: () => ({ resumed, closed }) };
  }

  const f = fakeCtx();
  const end = scheduleTone(f.ctx, READY_TONE);
  const starts = f.events.filter((e) => e.kind === "start");
  check("the ready tone is three short notes, each higher than the last — a device coming online, not a doorbell",
    starts.length === 3 && (starts[1].freq ?? 0) > (starts[0].freq ?? 0) && (starts[2].freq ?? 0) > (starts[1].freq ?? 0) && READY_TONE.every((n) => n.dur <= 0.25) && end - 10 < 0.5);
  const glides = f.events.filter((e) => e.kind === "glide");
  check("  …and the last note slides further up as it fades; the earlier notes hold",
    glides.length === 1 && (glides[0].freq ?? 0) > (starts[2].freq ?? 0) && READY_TONE[2].glideTo !== undefined && READY_TONE[0].glideTo === undefined);
  check("  …the recovered tone slides too, so it is unmistakably the same family", RECOVERED_TONE[0].glideTo !== undefined && (RECOVERED_TONE[0].glideTo ?? 0) > RECOVERED_TONE[0].freq);
  check("  …scheduled from the context's clock, in order", starts[0].t === 10 && (starts[1].t ?? 0) > 10 && end > (starts[1].t ?? 0));
  check("  …every oscillator is a sine, routed through its own gain to the output",
    f.oscs.every((o) => o.type === "sine") && f.oscs.every((o) => typeof o.dest === "object" && o.dest !== null && "gain" in o.dest));
  const peak = Math.max(...f.events.filter((e) => e.kind === "ramp" || e.kind === "gain").map((e) => e.v ?? 0));
  check("  …quiet: the peak gain is a cue, not an alarm", peak === TONE_GAIN && TONE_GAIN <= 0.2);
  check("  …and every note begins at zero gain and ends at zero (no click)",
    f.events.filter((e) => e.kind === "gain" && e.v === 0).length === READY_TONE.length && f.events.filter((e) => e.kind === "ramp" && e.v === 0).length === READY_TONE.length);
  check("the recovered tone is one note, so it is not mistaken for a new call", RECOVERED_TONE.length === 1);

  /* THE OWNER'S CHOICE FIRST: the cue is a library tone from Settings →
     Sounds, through the Hub's one engine; the synthesised notes are only
     the fallback for an engine that is not there. */
  {
    const fsT = await import("node:fs");
    const calls: string[] = [];
    const mk = (outcome: "played" | "silenced" | "unavailable") => {
      const g = fakeCtx();
      const t = new CallTones(() => g.ctx, { prime: () => calls.push("prime"), play: () => { calls.push("play:" + outcome); return outcome; } });
      return { g, t };
    };
    const played = mk("played"); played.t.prime(); played.t.ready();
    check("prime() warms the library tone inside the gesture, and ready() plays it — no synthesised note when the library played",
      calls.includes("prime") && calls.includes("play:played") && played.g.events.filter((e) => e.kind === "start").length === 0);
    calls.length = 0;
    const silenced = mk("silenced"); silenced.t.prime(); silenced.t.ready();
    check("  …a caller who silenced the cue in Settings gets silence — never the fallback", silenced.g.events.filter((e) => e.kind === "start").length === 0);
    const gone = mk("unavailable"); gone.t.prime(); gone.t.ready();
    check("  …only an engine that is not there gets the synthesised cue", gone.g.events.filter((e) => e.kind === "start").length === READY_TONE.length);
    const thrower = new CallTones(() => fakeCtx().ctx, { prime: () => { throw new Error("x"); }, play: () => { throw new Error("y"); } });
    thrower.prime(); thrower.ready();
    check("  …and a library that throws is a silent library, never an exception", true);
    const ns = await import("../src/lib/notificationSound");
    /* THE OWNER'S WORD (2026-09-07, night): "change the connected sound
       to be ping from our sounds". */
    check("the default call tone is one of the recorded library tones, enabled — 'ping', the owner's choice", ns.getSoundPrefs().call.tone === "ping" && ns.getSoundPrefs().call.enabled === true && (ns.SOUND_LIBRARY as readonly string[]).includes("ping") && ns.LEGACY_CALL_TONES.join() === "arrive,confirm");
    /* THE OLD DEFAULTS FOLLOW THE NEW ONE — unless somebody chose them. */
    check("a stored 'arrive' or 'confirm' nobody chose becomes the new default; a chosen one, or any other tone, stays",
      ns.migrateCallTone({ enabled: true, tone: "arrive" }).tone === "ping" && ns.migrateCallTone({ enabled: true, tone: "confirm" }).tone === "ping" &&
      ns.migrateCallTone({ enabled: true, tone: "arrive", chosen: true }).tone === "arrive" && ns.migrateCallTone({ enabled: true, tone: "confirm", chosen: true }).tone === "confirm" &&
      ns.migrateCallTone({ enabled: true, tone: "sparkle" }).tone === "sparkle" &&
      ns.migrateCallTone({ enabled: false, tone: "arrive" }).enabled === false);
    check("  …outside a browser the engine reports itself unavailable rather than pretending", ns.playCallSound() === "unavailable");
    const nsSrc = fsT.readFileSync("src/lib/notificationSound.ts", "utf8");
    check("  …do-not-disturb silences arrivals, not the cue for a call the caller just started",
      /if \(!prefs\.master \|\| \(prefs\.dnd && category !== "call"\)\) return;/.test(nsSrc));
    check("  …the call tone is warmed with the others on boot and merged from storage like the others",
      /p\.call\.tone,/.test(nsSrc) && /call: migrateCallTone\(\{ \.\.\.DEFAULT_PREFS\.call, \.\.\.\(stored\.call \?\? \{\}\) \}\)/.test(nsSrc) &&
      /call: \{ \.\.\.cur\.call, \.\.\.\(patch\.call \?\? \{\}\), \.\.\.\(patch\.call\?\.tone !== undefined \? \{ chosen: true \} : \{\}\) \}/.test(nsSrc));
    const tab = fsT.readFileSync("src/components/settings/tabs/SoundsTab.tsx", "utf8");
    check("Settings → Sounds offers the call cue as its own switch and tone, so the owner can change it",
      /checked=\{prefs\.call\.enabled\}/.test(tab) && /setPicker\(\{ kind: "category", category: "call" \}\)/.test(tab) && /call: "sounds\.cat\.call"/.test(tab));
    const i18n = fsT.readFileSync("src/lib/translations/settings.ts", "utf8");
    check("  …with copy in all three languages", ["sounds.callSounds", "sounds.callSounds.hint", "sounds.callTone", "sounds.cat.call"].every((k) => new RegExp('"' + k.replace(/\./g, "\\.") + '":\\s*\\{ en: "[^"]+", zh: "[^"]+", ar: "[^"]+" \\}').test(i18n)));
  }

  const g = fakeCtx("suspended");
  const tones = new CallTones(() => g.ctx);
  tones.ready();
  check("before prime() nothing plays and nothing throws", g.events.length === 0);
  tones.prime();
  check("prime() creates the context and resumes it inside the gesture", g.counts().resumed === 1);
  tones.prime();
  check("  …and a second prime() does not open a second context", g.counts().resumed === 1);
  tones.ready();
  check("ready() after prime schedules the tone, resuming a suspended context first", g.events.some((e) => e.kind === "start") && g.counts().resumed === 2);
  tones.close();
  check("close() releases the context", g.counts().closed === 1);
  tones.ready();
  check("  …after which nothing plays and nothing throws", g.events.filter((e) => e.kind === "start").length === READY_TONE.length);
  const none = new CallTones(() => null);
  none.prime(); none.ready(); none.recovered(); none.close();
  check("no AudioContext at all is a silent cue, never an error", true);
  const thrower = new CallTones(() => { throw new Error("blocked"); });
  thrower.prime(); thrower.ready();
  check("a factory that throws is a silent cue too", true);

  /* THE LEVEL, the shape of a voice: quick up, slow down. */
  const up = stepLevel(0, 1);
  const down = stepLevel(1, 0);
  check("a louder target is approached faster than a quieter one", up > 1 - down && LEVEL_ATTACK > LEVEL_RELEASE);
  check("  …neither step overshoots", up <= 1 && down >= 0);
  let v = 0;
  for (let i = 0; i < 6; i++) v = stepLevel(v, 1);
  check("  …six frames of a syllable reach most of the way", v > 0.85);
  let w = 1;
  for (let i = 0; i < 6; i++) w = stepLevel(w, 0);
  check("  …six frames of silence have not yet faded out", w > 0.5);
  for (let i = 0; i < 200; i++) w = stepLevel(w, 0);
  check("  …but silence settles to exactly zero rather than trembling for ever", w === 0);
  check("garbage in reads as silence, never NaN", stepLevel(NaN, NaN) === 0 && stepLevel(0.5, Infinity) <= 1 && stepLevel(-4, 2) <= 1);

  /* THE WIRING, read from the source (the render harness runs no effects). */
  const fs16 = await import("node:fs");
  const sess = fs16.readFileSync("src/lib/voice/session.ts", "utf8");
  check("the session reports READY once, when the configuration is acknowledged",
    /this\.configAckPending = false;\s*if \(!this\.readyFired\) \{\s*this\.readyFired = true;\s*this\.events\.onReady\?\.\(\);/.test(sess));
  check("  …and not on the compact resend path, which has no acknowledgement to wait on",
    !/compactRetried = true;[\s\S]{0,200}?onReady/.test(sess));
  const btn = fs16.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  const startAt = btn.indexOf("const startCall = useCallback");
  const startBody = btn.slice(startAt, btn.indexOf("await session.start();", startAt));
  check("the tones are made and primed INSIDE startCall — the tap that unlocks audio",
    /tonesRef\.current = new CallTones\(\);\s*tonesRef\.current\.prime\(\);/.test(startBody));
  check("  …before the session is created, so a slow handshake cannot outlive the gesture", startBody.indexOf("tonesRef.current.prime()") < startBody.indexOf("new VoiceSession("));
  check("ready is set by the session's onReady", /onReady: \(\) => \{\s*setReady\(true\);/.test(btn));
  /* Audit 2026-09-07: the fallback used to fire on a transport that never
     came up, telling a caller nobody could hear to "go ahead". */
  check("  …with a fallback so a silent vendor cannot leave the call on connecting — gated on a transport that exists",
    /if \(!live \|\| ready\) return;[\s\S]{0,700}?const transportUp = !!d && \(d\.dc === "open" \|\| d\.ice_ever_connected === true\);\s*if \(transportUp && Date\.now\(\) - startedAt >= READY_FALLBACK_MS\) setReady\(true\);/.test(btn) && /const READY_FALLBACK_MS = 2_500;/.test(btn));
  check("  …a new negotiation forgets ready and the chime, so the alt region does not say go-ahead early",
    /if \(next === "connecting"\) \{\s*setReady\(false\);\s*chimedRef\.current = false;\s*\}/.test(btn));
  check("  …and after eight seconds the caption says the service is slow",
    /const CONNECTING_SLOW_MS = 8_000;/.test(btn) && /setConnectingSlow\(true\), CONNECTING_SLOW_MS/.test(btn) && /connectingSlow=\{connectingSlow\}/.test(btn));
  const sessWatch = fs16.readFileSync("src/lib/voice/session.ts", "utf8");
  check("the session arms the never-connected watchdog when it goes live, and the timer honours that case",
    /this\.setState\("live"\);[\s\S]{0,1200}?if \(!this\.iceEverConnected\) this\.armReconnectTimer\(\);\s*\}/.test(sessWatch) &&
    /if \(this\.state !== "reconnecting" && !\(this\.state === "live" && !this\.iceEverConnected\)\) return;/.test(sessWatch));
  check("  …the configuration acknowledgement is awaited for either version, so a compact-first call fires ready",
    /this\.configAckPending = true;\s*this\.compactRetried = first !== this\.sessionUpdate;/.test(sessWatch));
  check("  …and the handshake POST carries our own deadline, read as the service not answering",
    /signal: AbortSignal\.timeout\(HANDSHAKE_TIMEOUT_MS\)/.test(sessWatch) && /this\.fail\(isTimeoutError\(e\) \? "service-unreachable" : "handshake-failed", e\);/.test(sessWatch));
  check("the tone plays once, when live AND ready, guarded by a ref so a re-render cannot repeat it",
    /if \(live && ready && !chimedRef\.current\) \{\s*chimedRef\.current = true;\s*tonesRef\.current\?\.ready\(\);/.test(btn));
  check("  …and a recovered connection plays its own single note", /prev === "reconnecting" && state === "live"\) tonesRef\.current\?\.recovered\(\)/.test(btn));
  const hangUpAt16 = btn.indexOf("const releaseCall");
  const hangUpBody = btn.slice(hangUpAt16, btn.indexOf("}, [", hangUpAt16));
  check("hanging up closes the tone context and resets ready", /tonesRef\.current\?\.close\(\)/.test(hangUpBody) && /setReady\(false\)/.test(hangUpBody) && /chimedRef\.current = false/.test(hangUpBody));
  check("  …and so does unmount", /persisterRef\.current = null;\s*tonesRef\.current\?\.close\(\);\s*tonesRef\.current = null;\s*\};\s*\}, \[\]\);/.test(btn));
  check("the screen is told ready separately from live", /ready=\{ready\}/.test(btn));
  const scr = fs16.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the screen says connecting until READY, not merely live — and says so differently when it is slow", /: !live \|\| !ready\s*\? \(connectingSlow \? copy\.connectingSlow : copy\.connecting\)/.test(scr) && /\{soundBlocked && onEnableSound && \(/.test(scr));
  check("  …and the orb stays awakening until then", /!live \|\| reconnecting \|\| !ready\s*\? "awakening"/.test(scr));
  check("  …ready defaults to true so other callers are unchanged", /ready = true,/.test(scr));
  check("the rings are driven by the smoothed level, not by a per-render transform", /useCallLevel\(orbWrapRef, audioLevel, live && ready && !reconnecting && !muted\)/.test(scr) && !/audioLevel \* 0\.35/.test(scr));
  check("  …three rings, colour by who is speaking", (scr.match(/kx-call-ring-\d/g) ?? []).length === 3 && /phase === "speaking" \? "is-far" : "is-near"/.test(scr));
  const css = fs16.readFileSync("src/app/globals.css", "utf8");
  check("the rings read --kx-call-level with transform and opacity only", /\.kx-call-orb\.is-live \.kx-call-ring-3 \{\s*opacity: calc\(var\(--kx-call-level\)[^}]*transform: scale\(calc\(1\.16 \+ var\(--kx-call-level\)/.test(css));
  check("  …Koleex AI's voice is the Hub's blue, the caller's is white", /\.kx-call-orb\.is-far \.kx-call-ring \{ border-color: rgba\(0, 102, 255/.test(css) && /\.kx-call-orb\.is-near \.kx-call-ring \{ border-color: rgba\(255, 255, 255/.test(css));
  const orbSrc16 = fs16.readFileSync("src/components/ai-orb/AIOrb.tsx", "utf8");
  const lively = orbSrc16.match(/\.kx-aiorb\.is-lively\.is-listening \.ind,\s*\.kx-aiorb\.is-lively\.is-speaking \.ind \{([^}]*)\}/);
  check("the call's orb overrides live in the orb's OWN sheet (is-lively), where they can win — a global rule lost the tie",
    lively !== null && !/\.kx-call-aiorb/.test(css));
  check("  …and touch no indicator geometry: blink, no per-frame filter, the lock's own transition",
    lively !== null && /animation: kxA-blink 6\.4s infinite;/.test(lively[1]) && /filter: none;/.test(lively[1]) && !/(width|height|border-radius|top|left|transform)/.test(lively[1]));
  check("  …the lively rules come AFTER the stilling rules they override", orbSrc16.indexOf(".kx-aiorb.is-lively.is-listening .ind") > orbSrc16.indexOf(".kx-aiorb.is-sleeping .ind { animation: none; }"));
  check("reduced motion stills the rings", /prefers-reduced-motion: reduce\) \{\s*\.kx-call-ring \{[^}]*transform: none !important/.test(css));
  const hook = fs16.readFileSync("src/components/ai/useCallLevel.ts", "utf8");
  check("the frame loop uses stepLevel, cancels on cleanup, and resets the variable", /stepLevel\(current, target\.current\)/.test(hook) && /cancelAnimationFrame\(raf\)/.test(hook) && /setProperty\(CALL_LEVEL_VAR, "0"\)/.test(hook));
}

{
  console.log("\n── 17. A call whose media never connects tries the other region — once ──");
  /* THE VPN CASE. The handshake succeeds (our server reached a vendor), the
     answer is applied, the call is "live" — and ICE never connects, because
     the browser's media path leaves the country and never reaches the
     mainland host. Before this, that ended as "connection-lost" after the
     grace window. Now, if the server said another region exists, the
     handshake is done once more asking for it. */
  const twoRegion = (region: "primary" | "alt", alt_available: boolean) =>
    ({ sdp: ANSWER, session: { type: "session.update", session: {} }, session_compact: { type: "session.update", session: {} }, region, alt_available });
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded, envelope: twoRegion("primary", true) });
    check("the call is live after the first handshake", r.session.getState() === "live" && recorded.length === 1);
    check("  …which carried no region hint", !/region=/.test(recorded[0].url));
    /* THE CHANNEL NEVER OPENS on this endpoint — that is what "media never
       connects" means; an open channel would be the media connected (see
       the transport-up cases below), and this section is about the other
       case. The first channel was created and nothing could go out on it. */
    const sentBefore = r.pcCalls.sent.length;
    check("  …a channel was created and, unopened, carried nothing", r.pcCalls.channels.length === 1 && sentBefore === 0);
    r.ice("failed");
    check("media that never connects is a recovery state first, not a failure", r.session.getState() === "reconnecting");
    await sleep(160);
    check("after the grace window the handshake is done AGAIN, asking for the other slot",
      recorded.length === 2 && /[?&]region=alt(&|$)/.test(recorded[1].url));
    check("  …through connecting back to live, with no failure shown", r.states.some(([st]) => st === "connecting") && r.session.getState() === "live" && r.states.every(([st]) => st !== "failed"));
    check("  …the first connection was closed and a new one negotiated", r.pcCalls.closed === 1 && r.pcCalls.remoteSdp.length > 0);
    check("  …and the microphone was KEPT across it — no second permission prompt", !r.mic.allStopped());
    r.pcCalls.channel?.open();
    check("  …and the session configuration is sent AFRESH on the new channel — a connected call is silent until it is",
      r.pcCalls.channels.length === 2 && r.pcCalls.sent.length === sentBefore + 1 && /session\.update/.test(r.pcCalls.sent[sentBefore]));
    r.ice("failed");
    await sleep(160);
    const last = r.states[r.states.length - 1];
    check("a second failure is final — the other region is tried once, never in a loop", recorded.length === 2 && last[0] === "failed" && last[1] === "connection-lost");
    check("  …and the microphone is kept for a resume then, released by stop()", (() => { const kept = !r.mic.allStopped(); r.session.stop(); return kept && r.mic.allStopped(); })());
  }
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded, envelope: twoRegion("alt", true) });
    r.ice("failed");
    await sleep(160);
    check("a call served by the alt asks for the primary", recorded.length === 2 && /[?&]region=primary(&|$)/.test(recorded[1].url));
    r.session.stop();
  }
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded, envelope: twoRegion("primary", false) });
    r.ice("failed");
    await sleep(160);
    const last = r.states[r.states.length - 1];
    check("with no other region there is no second handshake, and the failure is reported as before", recorded.length === 1 && last[0] === "failed" && last[1] === "connection-lost");
  }
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded });
    r.ice("failed");
    await sleep(160);
    check("an envelope without the fields reads as primary with no alternative", recorded.length === 1 && r.session.getState() === "failed");
  }
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded, envelope: twoRegion("primary", true) });
    r.ice("connected");
    r.ice("disconnected");
    await sleep(160);
    const last = r.states[r.states.length - 1];
    check("a call that was up and dropped does not switch region — the network went, not the endpoint", recorded.length === 1 && last[0] === "failed" && last[1] === "connection-lost");
  }
  {
    const recorded: Recorded[] = [];
    const r = await run({ recorded, envelope: twoRegion("primary", true) });
    r.ice("failed");
    r.session.stop();
    await sleep(160);
    check("hanging up during the grace window ends the call — no handshake is started afterwards", recorded.length === 1 && r.session.getState() === "ended" && r.mic.allStopped());
  }
}

{
  console.log("\n── 18. Steady playback, a screen in two parts, and a visible lookup ──");
  const fs18 = await import("node:fs");
  const sess = fs18.readFileSync("src/lib/voice/session.ts", "utf8");
  check("the remote track's receiver is asked to hold 400ms against jitter — the speed changes the owner heard",
    /const JITTER_BUFFER_TARGET_MS = 400;/.test(sess) && /if \("jitterBufferTarget" in r\) r\.jitterBufferTarget = JITTER_BUFFER_TARGET_MS;/.test(sess) && /else if \("playoutDelayHint" in r\) r\.playoutDelayHint = JITTER_BUFFER_TARGET_MS \/ 1000;/.test(sess));
  check("  …best-effort: inside a try, before the stream is handed out", /try \{\s*const r = ev\.receiver as unknown as Record<string, unknown>;[\s\S]{0,400}?\} catch \{[\s\S]{0,200}?const stream = ev\.streams\?\.\[0\];/.test(sess));
  const scr = fs18.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  const css18 = fs18.readFileSync("src/app/globals.css", "utf8");
  check("the call screen is TWO VIEWS, the way ChatGPT does it: the orb alone, or the conversation with the same orb small in the corner",
    /const view: "orb" \| "chat" = chosenView \?\? "orb";/.test(scr) && /\{wordsLayer\}\s*\{orbLayer\}/.test(scr) &&
    /<VoiceTranscript lines=\{lines\} lang=\{lang\} className="kx-transcript flex-1 min-h-0 pb-28" fill onOpenPhoto=\{setOpenPhoto\} photosVisible=\{view === "chat"\} \/>/.test(scr) && /h-\[72px\] w-\[72px\]/.test(scr));
  check("  …a tap on the orb toggles the views; the quiet button under it opens the words",
    /onClick=\{\(\) => switchView\(view === "orb" \? "chat" : "orb"\)\}/.test(scr) && (scr.match(/onClick=\{\(\) => switchView\("chat"\)\}/g) ?? []).length === 1);
  check("  …the view is the caller's choice alone, derived, no effect writes it — a picture no longer switches it (section 21)",
    /useState<"orb" \| "chat" \| null>\(null\)/.test(scr) && !/useEffect\(\(\) => \{[^}]*setView/.test(scr) && !/hasPhotos/.test(scr));
  check("  …and the last thing said is a caption under the orb, so the orb view still shows the words",
    /const lastLine = lines\.length > 0 \? lines\[lines\.length - 1\] : null;/.test(scr) && /\{stripImageMarkdown\(lastLine\.text\)\}/.test(scr) && /line-clamp-3/.test(scr));
  check("  …and the pinned photo strip is gone: no `photos` prop, pictures come with the lines", !/photos\?: readonly/.test(scr) && !/photos\.map\(/.test(scr));
  check("  …and a lookup is shown on the orb itself, as THINKING (not processing's rim arc) with the searching activity",
    /\(searching \|\| phase === "thinking"\) && !muted\s*\? "thinking"/.test(scr) && /activity=\{searching && live && !muted \? "searching" : "none"\}/.test(scr));
  check("  …and on the rings: slow blue waves while a lookup runs, transform and opacity only",
    /\(searching \|\| phase === "thinking"\) && live && !muted \? "is-thinking" : ""/.test(scr) &&
    /\.kx-call-orb\.is-thinking \.kx-call-ring \{\s*border-color: rgba\(0, 102, 255[^}]*animation: kx-call-think/.test(css18) &&
    /@keyframes kx-call-think \{\s*0% \{ transform: scale\([\d.]+\); opacity: [\d.]+; \}\s*100% \{ transform: scale\([\d.]+\); opacity: 0; \}/.test(css18) &&
    /\.kx-call-orb\.is-thinking \.kx-call-ring-3 \{ animation-delay: 1\.6s; \}/.test(css18));
  check("  …reduced motion stills the waves and leaves one quiet ring", /prefers-reduced-motion: reduce\) \{[^}]*animation: none !important/.test(css18) && /\.kx-call-orb\.is-thinking \.kx-call-ring-1 \{ opacity: 0\.35; \}/.test(css18));
  check("the wordmark stands above the orb in the top part, white, 24px on the grid",
    /import KoleexLogo from "@\/components\/layout\/KoleexLogo";/.test(scr) && /<KoleexLogo className="h-6 w-auto shrink-0 text-white" \/>/.test(scr) && scr.indexOf("<KoleexLogo") < scr.indexOf("{orb}"));
  const tr18 = fs18.readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
  check("a picture in the conversation goes through the image pipeline at 384px, eagerly, box reserved, and removes itself when it fails to load",
    /src=\{aiImage\(photo\.url, 384\)\}/.test(tr18) && !/cdnImage\(/.test(tr18) && /width=\{size\}\s*height=\{size\}/.test(tr18) && /size = 120/.test(tr18) && !/loading="lazy"/.test(tr18) &&
    /onError=\{\(\) => setBroken\(true\)\}/.test(tr18) && /if \(broken\) return null;/.test(tr18));
  check("  …the conversation view shows every line, the chat-side transcript the last four", /const shown = fill \? lines : lines\.slice\(-VISIBLE_LINES\);/.test(tr18));
  const prodTool = fs18.readFileSync("src/lib/server/ai-agent/tools/products.ts", "utf8");
  check("  …and the catalogue lookup no longer fetches the same photo row twice", !/\(await mainPhotoByProduct\(\[productId\]\)\)\[productId\]/.test(prodTool) && /main_photo_url: mainPhoto,/.test(prodTool));
  const tr = fs18.readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
  check("the transcript can fill the part it is given instead of a fixed share of the viewport",
    /fill \? "flex-1 min-h-0" : "max-h-\[34vh\]"/.test(tr));
  /* "NOT MOVING LIKE ON THE HOME PAGE": the same orb, kept alive at call
     size the way idle keeps it alive on the home page — by the orb's own
     opt-in class, because the first attempt (a global rule) lost the tie. */
  const orb18 = fs18.readFileSync("src/components/ai-orb/AIOrb.tsx", "utf8");
  check("on a call the eyes look around and blink in listening and speaking, as they do idle on the home page",
    /\.kx-aiorb\.is-lively\.is-listening \.gaze,\s*\.kx-aiorb\.is-lively\.is-speaking \.gaze \{ animation: kxA-look 7s ease-in-out infinite; \}/.test(orb18) &&
    /\.kx-aiorb\.is-lively\.is-listening \.ind,\s*\.kx-aiorb\.is-lively\.is-speaking \.ind \{[^}]*animation: kxA-blink 6\.4s infinite;/.test(orb18) &&
    /className="shrink-0 kx-call-aiorb is-lively"/.test(scr));
  check("  …and the aura breathes at its idle pace", /\.kx-aiorb\.is-lively\.is-listening \.aura,\s*\.kx-aiorb\.is-lively\.is-speaking \.aura \{ animation-duration: 7s, 2\.2s; \}/.test(orb18));

  /* WHICH LANGUAGE THE CALLER SPEAKS — not which language the app is in. */
  const stt = await import("../src/lib/voice/stt-lang");
  check("the speaking language is allow-listed to the three the transcriber and the server know",
    stt.parseSttLang("ar") === "ar" && stt.parseSttLang("EN ") === "en" && stt.parseSttLang("zh") === "zh" && stt.parseSttLang("ar-EG") === null && stt.parseSttLang("fr") === null && stt.parseSttLang(null) === null);
  check("the caller's saved choice wins over the device, which wins over the UI language",
    stt.pickSttLang("zh", "ar-EG", "en") === "zh" && stt.pickSttLang(null, "ar-EG", "en") === "ar" && stt.pickSttLang("junk", "fr-FR", "zh") === "zh" && stt.pickSttLang(null, null, null) === "en");
  /* LEARNED, NOT ASKED — from the script of Koleex AI's own replies. */
  const sl = await import("../src/lib/voice/script-lang");
  check("a script says the language: Arabic letters, CJK, Latin — and no letters is null",
    sl.detectScriptLang("إزيك يا أستاذ كمال") === "ar" && sl.detectScriptLang("我想一下") === "zh" && sl.detectScriptLang("Hello there") === "en" && sl.detectScriptLang("123 !!") === null && sl.detectScriptLang("") === null);
  check("  …mixed text goes to the majority script", sl.detectScriptLang("الموديل CH-4040S من Koleex بمقاس 40×40") === "ar" && sl.detectScriptLang("Model CH-4040S بس") === "en");
  check("a conversation's language: the assistant's turns always vote; a LATIN caller line never does — it was written under the hint being judged",
    sl.detectConversationLang([{ role: "user", content: "On the autism spectrum, they were" }, { role: "assistant", content: "أهلاً بك، إزاي أقدر أساعدك؟" }]) === "ar" &&
    sl.detectConversationLang([{ role: "user", content: "hello there" }]) === null && sl.detectConversationLang([]) === null);
  check("  …but a caller line in Arabic or Chinese script is the caller's own and votes (two saved calls, 2026-09-04: English replies to Arabic taught the device 'English')",
    sl.detectConversationLang([{ role: "user", content: "مرحبا" }]) === "ar" && sl.detectConversationLang([{ role: "user", content: "我想一下" }]) === "zh" &&
    sl.detectConversationLang([
      { role: "user", content: "هلا و." }, { role: "assistant", content: "Hello Kimo, how are you doing?" },
      { role: "user", content: "أريد أن أسألك، هل أنت أفضل أم شات جي بي تي أفضل؟" }, { role: "assistant", content: "I'm Koleex AI, made by Koleex International Group." },
      { role: "user", content: "الشط" }, { role: "assistant", content: "بالطبع، ممكن نتكلم مصري." },
      { role: "user", content: "أنا أستيقظ" }, { role: "assistant", content: "I hear you, Kimo." },
      { role: "user", content: "شashawa" },
    ]) === "ar" &&
    sl.detectConversationLang([{ role: "user", content: "Show me a photo of Tesla car." }, { role: "assistant", content: "I can only show pictures of Koleex machines." }]) === "en");
  check("  …the majority of recent replies wins, so a caller who switches is followed",
    sl.detectConversationLang([{ role: "assistant", content: "Hello" }, { role: "assistant", content: "你好" }, { role: "assistant", content: "很高兴" }]) === "zh");
  check("learnSttLang reads the same thing off the screen's transcript, settled lines only",
    stt.learnSttLang([{ role: "user", text: "Is that a cash at GPT?", final: true }, { role: "assistant", text: "أهلاً بك", final: true }, { role: "assistant", text: "Hel", final: false }]) === "ar" &&
    stt.learnSttLang([{ role: "user", text: "hi", final: true }]) === null);
  check("  …and there are no chips: nothing in the module names a label or asks", !("STT_LANG_LABELS" in stt));
  const btn18 = fs18.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the session is given the SPEAKING language, never the UI language, as the transcription hint",
    /\}, voiceKeyRef\.current, conversationIdRef\.current, sttLangRef\.current,\s*(\/\*[^*]*\*\/\s*)?regionHintRef\.current \?\? readSavedRegion\(\),\s*(\/\*[^*]*\*\/\s*)?transportRef\.current\);/.test(btn18) && !/conversationIdRef\.current, langRef\.current\)/.test(btn18));
  check("  …picked after mount (learned, device, UI) and never shown as a control",
    /sttLangRef\.current = pickSttLang\(readSavedSttLang\(\), typeof navigator !== "undefined" \? navigator\.language : null, lang\);/.test(btn18) && !/sttLanguage=\{/.test(btn18) && !/onSelectSttLanguage/.test(btn18) && !/onSelectSttLanguage|STT_LANGS/.test(scr));
  check("  …and each settled reply from Koleex AI teaches the device the caller's language for next time",
    /if \(update\.role === "assistant" && update\.final\) \{\s*const learned = learnSttLang\(linesRef\.current, sttLangRef\.current\);\s*if \(learned && learned !== sttLangRef\.current\) \{\s*sttLangRef\.current = learned;\s*saveSttLang\(learned\);/.test(btn18));
  const route18 = fs18.readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
  check("the server reads the conversation's language off its history FIRST, and takes the client's guess only for a new thread",
    /const clientHint = parseSttLanguage\(new URL\(req\.url\)\.searchParams\.get\("stt"\)\);[\s\S]{0,300}?const fromHistory = detectConversationLang\(recentTurns, \{ hint: clientHint \}\);\s*const sttLanguage = fromHistory \?\? clientHint;/.test(route18));
  /* Audit 2026-09-07: a transcriber told the wrong language writes nonsense
     IN THAT SCRIPT — English speech under an Arabic hint comes back as Arabic
     letters. A caller line in the hinted script may be its artefact. */
  check("under an Arabic hint, Arabic caller lines do not vote and the English replies decide",
    sl.detectConversationLang([{ role: "user", content: "أنا أريد" }, { role: "assistant", content: "Sure, which model?" }, { role: "user", content: "شashawa" }, { role: "assistant", content: "Go on, I'm listening." }], { hint: "ar" }) === "en");
  check("  …under an English hint, Arabic caller lines vote and outvote the English replies (the 2026-09-04 call)",
    sl.detectConversationLang([{ role: "user", content: "هلا و" }, { role: "assistant", content: "Hello Kimo, how are you?" }, { role: "user", content: "أريد أن أسألك" }, { role: "assistant", content: "I'm Koleex AI" }, { role: "user", content: "أنا أستيقظ" }], { hint: "en" }) === "ar");
  check("  …a tie goes to the most recent reply, never to a fixed language",
    sl.detectConversationLang([{ role: "assistant", content: "你好" }, { role: "assistant", content: "Hello" }], { hint: "zh" }) === "en" &&
    sl.detectConversationLang([{ role: "assistant", content: "Hello" }, { role: "assistant", content: "你好" }], { hint: "zh" }) === "zh");

  /* THINKING — the gap between turns, shown. */
  const ev18 = await import("../src/lib/voice/events");
  check("the caller stopping, and the far side opening a response, both read as THINKING",
    ev18.parseVoiceEvent(JSON.stringify({ type: "input_audio_buffer.speech_stopped" })).phase === "thinking" &&
    ev18.parseVoiceEvent(JSON.stringify({ type: "response.created" })).phase === "thinking");
  check("  …the first word back is speaking, the caller speaking is listening, and done hands the turn back (listening)",
    ev18.parseVoiceEvent(JSON.stringify({ type: "response.audio_transcript.delta", delta: "أ" })).phase === "speaking" &&
    ev18.parseVoiceEvent(JSON.stringify({ type: "input_audio_buffer.speech_started" })).phase === "listening" &&
    ev18.parseVoiceEvent(JSON.stringify({ type: "response.done" })).phase === "listening");
  check("  …the screen shows thinking on the orb and the rings and in the caption",
    /\(searching \|\| phase === "thinking"\) && !muted\s*\? "thinking"/.test(scr) && /\(searching \|\| phase === "thinking"\) && live && !muted \? "is-thinking" : ""/.test(scr) && /phase === "thinking"\s*\? copy\.thinking/.test(scr));

  /* THE LOOKUP CEILING — sixty, after twelve was spent in four minutes. */
  check("a call may make sixty lookups, not twelve, and the server's constant agrees",
    /const MAX_TOOL_CALLS_PER_SESSION = 60;/.test(sess) && /export const VOICE_TOOL_CALLS_PER_SESSION = 60;/.test(fs18.readFileSync("src/lib/server/ai/voice/tools.ts", "utf8")));
  check("  …and at the ceiling the model is told to say so, never to answer as if it had looked",
    /never answer from memory as if you had looked/.test(sess));

  /* THE CHANNEL CLOSING UNDER A LIVE CALL, and the call coming back. */
  check("the data channel's close is watched and treated as a dropped connection",
    /local\.onclose = \(\) => this\.onChannelClosed\(\);/.test(sess) && /private onChannelClosed\(\): void \{\s*if \(this\.state !== "live" && this\.state !== "reconnecting"\) return;\s*if \(this\.state === "live"\) this\.setState\("reconnecting"\);\s*this\.armReconnectTimer\(\);/.test(sess));
  check("a call that was up for five seconds and is lost is started again in place, twice at most, keeping the words",
    /export const RESUME_MIN_LIVE_MS = 5_000;/.test(btn18) && /export const MAX_RESUMES = 2;/.test(btn18) &&
    /const canResume = failure === "connection-lost" && wasUp && resumesRef\.current < MAX_RESUMES;/.test(btn18) &&
    /queueMicrotask\(\(\) => void startCallRef\.current\?\.\(\{ resume: true, mic: keptMic \}\)\);/.test(btn18) &&
    /if \(!opts\?\.resume\) \{\s*linesRef\.current = \[\];/.test(btn18));
  check("  …and only when it cannot come back does the caller hear the failure",
    /if \(canResume\) \{[\s\S]*?return;\s*\}\s*onErrorRef\.current\?\.\(FAILURE_COPY\[langRef\.current\]\[failure\]\);/.test(btn18));
  const tel = await import("../src/lib/voice/telemetry");
  const posted: Array<[string, string]> = [];
  tel.sendVoiceTelemetry({ reason: "connection-lost", elapsed_ms: 1234, ice: "failed", tool_calls: 3 }, (p, b) => posted.push([p, b]));
  check("the beacon carries states and counts to the telemetry route", posted.length === 1 && posted[0][0] === "/api/ai/voice/telemetry" && JSON.parse(posted[0][1]).ice === "failed" && JSON.parse(posted[0][1]).elapsed_ms === 1234);
  tel.sendVoiceTelemetry({ reason: "x" }, () => { throw new Error("offline"); });
  check("  …and never throws", true);
  check("  …the button sends it on every failure, with the session's diagnostics, before deciding to resume",
    /sendVoiceTelemetry\(\{ reason: canResume \? "resumed" : failure, resumes: resumesRef\.current, lane: transportRef\.current, fell_back: canFallBack, \.\.\.diag \}\);/.test(btn18) && /const diag = sessionRef\.current\?\.diagnostics\(\);/.test(btn18));
  const telRoute = fs18.readFileSync("src/app/api/ai/voice/telemetry/route.ts", "utf8");
  check("the telemetry route is authenticated, allow-lists the reason, bounds every field, logs one line and stores nothing",
    /const auth = await requireAuth\(req\);/.test(telRoute) && /const REASONS = new Set\(/.test(telRoute) && /if \(!REASONS\.has\(reason\)\) return NextResponse\.json/.test(telRoute) &&
    /console\.warn\(\s*`\[ai\.voice\.client\]/.test(telRoute) && !/supabase|insert\(/.test(telRoute) && /new NextResponse\(null, \{ status: 204 \}\)/.test(telRoute));
  const diagS = new VoiceSession(deps({ status: 200 }).deps);
  const dg = diagS.diagnostics();
  check("diagnostics are states and counts only", Object.keys(dg).sort().join(",") === "dc,elapsed_ms,err,events,ice,ice_ever_connected,last_event,region,tool_calls,ws_close,ws_reconnects" && dg.tool_calls === 0 && dg.ws_reconnects === 0 && dg.ws_close === "" && dg.elapsed_ms === 0 && dg.err === "" && dg.events === "");

  /* THE PICTURE EXPANDS IN PLACE. */
  check("a photo in the conversation is a button that opens the lightbox, not a link out of the app",
    /onClick=\{\(\) => onOpen\(photo\)\}/.test(fs18.readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8")) && !/<a href=\{p\.url\}/.test(scr) && /<PhotoLightbox photo=\{openPhoto\} onClose=\{closePhoto\} closeLabel=\{copy\.closePhoto\} \/>/.test(scr));
  /* THE CALL THAT ENDED BY ITSELF: the installed app reloading onto a new
     build mid-call. */
  const uw18 = fs18.readFileSync("src/components/pwa/UpdateWatcher.tsx", "utf8");
  check("the call screen marks itself as uninterruptible, and the update watcher never reloads over it — on heal or on hide",
    /data-kx-call-active="1"/.test(scr) &&
    /export function busyWithSomethingUninterruptible\(\): boolean \{\s*return Boolean\(document\.querySelector\("\[data-kx-unsaved='1'\], \[data-kx-call-active='1'\]"\)\);/.test(uw18) &&
    (uw18.match(/if \(busyWithSomethingUninterruptible\(\)\) return;/g) ?? []).length === 2 &&
    !/document\.querySelector\("\[data-kx-unsaved='1'\]"\)/.test(uw18));
  const md18 = fs18.readFileSync("src/components/ai/MessageMarkdown.tsx", "utf8");
  check("  …and in the written thread a picture that fails to load becomes its words, never a broken icon in a frame",
    /onError=\{\(\) => setBroken\(true\)\}/.test(md18) && /if \(broken\) return <span className="koleex-md-img-fallback">\{alt\}<\/span>;/.test(md18));
  const lb = fs18.readFileSync("src/components/ai/PhotoLightbox.tsx", "utf8");
  check("  …the lightbox sits above the call and below confirmations, fits the picture whole, and eats Escape before the call screen sees it",
    /z-\[260\]/.test(lb) && /object-contain/.test(lb) && /e\.stopPropagation\(\);\s*e\.preventDefault\(\);\s*onClose\(\);/.test(lb) && /window\.addEventListener\("keydown", onKey, true\)/.test(lb));
}

{
  console.log("\n── 19. The voice can be changed, and the choice is kept ──");
  const fs19 = await import("node:fs");
  const pref = await import("../src/lib/voice/voice-pref");
  const offered = [{ key: "v1", label: "Nour" }, { key: "v2", label: "Layla" }];
  check("the saved key is pre-selected when the catalogue still offers it",
    pref.pickVoiceKey("v2", offered) === "v2" && pref.pickVoiceKey(" v2 ", offered) === "v2");
  check("  …a key no longer offered, junk, or nothing saved falls back to the FIRST voice — the vendor's own default",
    pref.pickVoiceKey("v9", offered) === "v1" && pref.pickVoiceKey("Tina", offered) === "v1" && pref.pickVoiceKey(null, offered) === "v1" && pref.pickVoiceKey(undefined, offered) === "v1");
  check("  …and no catalogue means no selection, whatever was saved", pref.pickVoiceKey("v1", []) === null);
  /* Storage: present, absent, refusing. */
  const g = globalThis as unknown as { window?: unknown };
  const hadWindow = "window" in g;
  const prevWindow = g.window;
  const store = new Map<string, string>();
  g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } };
  check("nothing saved reads as null, and a saved choice reads back under the voice key",
    pref.readSavedVoiceKey() === null && (pref.saveVoiceKey("v2"), store.get(pref.VOICE_STORAGE_KEY) === "v2" && pref.readSavedVoiceKey() === "v2"));
  check("  …the key is the voice's own, not the speaking-language key", pref.VOICE_STORAGE_KEY === "koleex-voice-voice");
  store.set(pref.VOICE_STORAGE_KEY, "   ");
  check("  …a blank stored value is no value", pref.readSavedVoiceKey() === null);
  g.window = { localStorage: { getItem: () => { throw new Error("refused"); }, setItem: () => { throw new Error("refused"); } } };
  let threw = false;
  try { pref.saveVoiceKey("v1"); } catch { threw = true; }
  check("a refusing store never throws: reading is null, saving is silent", !threw && pref.readSavedVoiceKey() === null);
  delete g.window;
  let threw2 = false;
  try { pref.saveVoiceKey("v1"); } catch { threw2 = true; }
  check("  …and no window at all (server render) is the same", !threw2 && pref.readSavedVoiceKey() === null);
  if (hadWindow) g.window = prevWindow;
  const btn19 = fs19.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the button pre-selects the remembered voice from the server's list, and remembers every choice",
    /setVoices\(list\);\s*setVoiceKey\(\(cur\) => pickVoiceKey\(cur \?\? readSavedVoiceKey\(\), list\)\);/.test(btn19) &&
    !/body\.voices\?\.\[0\]\?\.key/.test(btn19) &&
    /const selectVoice = useCallback\(\(key: string\) => \{\s*setVoiceKey\(key\);\s*voiceKeyRef\.current = key;\s*saveVoiceKey\(key\);/.test(btn19));

  /* THE SWITCH THAT THREW THE CALLER OUT. Picking a voice hung up (idle → the
     portal unmounted the screen) and started again: the owner was back in the
     text chat for the whole handshake. The rebuild now keeps the screen up. */
  check("a voice switch rebuilds the call with the screen still mounted: swapping is set, the call is released (not hung up), and the new one RESUMES",
    /const current = sessionRef\.current;\s*if \(!current\) return;/.test(btn19) &&
    /setSwapping\(true\);\s*releaseCall\(\);/.test(btn19) &&
    /startCallRef\.current\?\.\(\{ resume: true \}\);\s*void \(started \?\? Promise\.resolve\(\)\)\.finally\(\(\) => setSwapping\(false\)\);/.test(btn19) &&
    !/hangUp\(\);\s*\/\*[^*]*\*\/\s*queueMicrotask/.test(btn19) &&
    /\{\(connected \|\| busy \|\| swapping\) && typeof document !== "undefined" && createPortal\(/.test(btn19));
  check("  …hangUp is the release plus idle — the same teardown, one more step",
    /const hangUp = useCallback\(\(\) => \{[\s\S]{0,900}?releaseCall\(\);\s*setState\("idle"\);/.test(btn19) &&
    /const releaseCall = useCallback\(\(\) => \{\s*sessionRef\.current\?\.stop\(\);/.test(btn19) &&
    (btn19.match(/setState\("idle"\)/g) ?? []).length === 1);
  check("  …and says so in the log: a voice-switched beacon with the old call's diagnostics, before the release",
    (() => { const b = btn19.indexOf('sendVoiceTelemetry({ reason: "voice-switched", resumes: resumesRef.current, lane: transportRef.current, ...diag });'); const r = btn19.indexOf("setSwapping(true);\n    releaseCall();"); return b > 0 && r > b; })());
  /* WHERE TO START THE NEXT CALL: the region that served this one. */
  check("a continued call (resume or switch) asks first for the region that served the last one; a fresh call leaves it to the server",
    /regionHintRef\.current = diag\.region === "alt" \? "alt" : "primary";/.test(btn19) &&
    /if \(diag\) regionHintRef\.current = diag\.region === "alt" \? "alt" : "primary";/.test(btn19) &&
    /sttLangRef\.current,\s*(\/\*[^*]*\*\/\s*)?regionHintRef\.current \?\? readSavedRegion\(\),\s*(\/\*[^*]*\*\/\s*)?transportRef\.current\);/.test(btn19));
  /* THE DEVICE REMEMBERS THE REGION TOO — the server's memory dies with its warm instance. */
  const regionPref = await import("../src/lib/voice/voice-pref");
  check("the region memory is two allow-listed words, read and written without ever throwing",
    regionPref.parseRegionSlot("alt") === "alt" && regionPref.parseRegionSlot("primary") === "primary" && regionPref.parseRegionSlot("cn-north") === null && regionPref.parseRegionSlot(null) === null &&
    regionPref.REGION_STORAGE_KEY === "koleex-voice-region");
  {
    const g = globalThis as unknown as { window?: unknown };
    const had = "window" in g; const prev = g.window;
    const store = new Map<string, string>();
    g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } };
    const before = regionPref.readSavedRegion();
    regionPref.saveRegion("alt");
    const after = regionPref.readSavedRegion();
    store.set(regionPref.REGION_STORAGE_KEY, "junk");
    const junk = regionPref.readSavedRegion();
    g.window = { localStorage: { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } } };
    let threw = false; try { regionPref.saveRegion("primary"); } catch { threw = true; }
    const refused = regionPref.readSavedRegion();
    if (had) g.window = prev; else delete g.window;
    check("  …nothing → null, saved → read back, junk → null, a refusing store → null and silent",
      before === null && after === "alt" && junk === null && !threw && refused === null);
  }
  check("  …the button remembers the served slot the moment a call is live, and asks for it first on EVERY call",
    /if \(next === "live"\) \{\s*const region = sessionRef\.current\?\.diagnostics\(\)\.region;\s*if \(region === "alt" \|\| region === "primary"\) \{\s*regionHintRef\.current = region;\s*saveRegion\(region\);/.test(btn19) &&
    !/opts\?\.resume \? regionHintRef\.current : null/.test(btn19));
  const recordedR: Recorded[] = [];
  const sR = new VoiceSession(deps({ status: 200, recorded: recordedR }).deps, {}, "v1", null, null, "alt");
  await sR.start();
  check("  …the session sends it as the two-word hint the server allow-lists", recordedR[0]?.url === `${HANDSHAKE_PATH}?voice=v1&region=alt`);
  const recordedR2: Recorded[] = [];
  const sR2 = new VoiceSession(deps({ status: 200, recorded: recordedR2 }).deps, {}, "v1", null, null, null);
  await sR2.start();
  check("  …and nothing when there is none", recordedR2[0]?.url === `${HANDSHAKE_PATH}?voice=v1`);
  /* THE EXITS NOTHING REPORTED. */
  check("a live call that ends by unmount or by the page going away sends one beacon each, before the teardown",
    /const onPageHide = \(\) => beacon\("page-hidden"\);\s*window\.addEventListener\("pagehide", onPageHide\);/.test(btn19) &&
    /window\.removeEventListener\("pagehide", onPageHide\);\s*beacon\("unmounted"\);\s*sessionRef\.current\?\.stop\(\);/.test(btn19) &&
    /if \(st !== "live" && st !== "reconnecting"\) return;\s*sendVoiceTelemetry\(\{ reason, resumes: resumesRef\.current, \.\.\.s\.diagnostics\(\) \}\);/.test(btn19));
  const cfg19 = fs19.readFileSync("src/lib/server/ai/voice/config.ts", "utf8");
  check("the server offers a default catalogue, so the picker exists without anyone setting a variable",
    /voices: voiceCatalogue\(env\.AI_VOICE_VOICES\),/.test(cfg19) && !/voices: parseVoiceOptions\(env\.AI_VOICE_VOICES\)/.test(cfg19));
}

{
  console.log("\n── 20. The Speak pill, the activity line, the voice sheet ──");
  const fs20 = await import("node:fs");
  const btn20 = fs20.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  const app20 = fs20.readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  /* GROK'S SHAPE, THE OWNER'S ASK: on an empty composer the call is a named,
     inverted pill and Send stands down; with a draft, Send is back and the
     call shrinks to its icon. */
  check("the call button has a pill variant: inverted, named Speak in three languages, only while idle",
    /variant\?: "icon" \| "pill";/.test(btn20) && /\{variant === "pill" && !connected && !busy \? \(/.test(btn20) &&
    /bg-\[var\(--bg-inverted\)\] text-\[var\(--text-inverted\)\] text-\[13px\] font-semibold/.test(btn20) && /\{labels\.speak\}/.test(btn20) &&
    /speak: "Speak"/.test(btn20) && /speak: "语音"/.test(btn20) && /speak: "اتكلم"/.test(btn20));
  check("  …the composer uses it when there is nothing to send, and shows Send only when there is",
    /const hasDraft = input\.trim\(\)\.length > 0 \|\| attachments\.length > 0;/.test(app20) &&
    /variant=\{hasDraft \|\| sending \? "icon" : "pill"\}/.test(app20) && /\) : hasDraft && \(\s*<button\s*type="submit"/.test(app20));
  /* WHAT IT IS DOING, IN WORDS. */
  const bubble20 = fs20.readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const line20 = fs20.readFileSync("src/components/ai/ActivityLine.tsx", "utf8");
  check("the empty assistant bubble shows the activity line (Thinking / Searching the web / …) instead of anonymous dots, and again above a reply while a lookup runs",
    /orbState === "loading" \|\| orbState === "typing" \? \(\s*<ActivityLine activity=\{orbActivity\} lang=\{lang\}/.test(bubble20) &&
    /msg\.content && orbState === "typing" && orbActivity !== "none" && \(\s*<ActivityLine/.test(bubble20));
  check("  …the line is a status region with the shared sweep-and-dots classes, and no tool name ever reaches it",
    /role="status"/.test(line20) && /kx-activity-text/.test(line20) && /kx-activity-dots/.test(line20) && /activityLabel\(activity, lang\)/.test(line20));
  const ac = await import("../src/components/ai/activity-copy");
  check("  …every activity has words in all three languages, and the web says where the lookup goes",
    (["en", "zh", "ar"] as const).every((l) => Object.values(ac.ACTIVITY_COPY[l]).every((v) => typeof v === "string" && v.length > 0)) &&
    ac.activityLabel("browsing", "en") === "Searching the web" && ac.activityLabel("none", "ar") === "بفكّر" && ac.activityLabel(undefined, "zh") === "思考中" &&
    !Object.values(ac.ACTIVITY_COPY.en).some((v) => /_|[a-z][A-Z]/.test(v)));
  const map20 = fs20.readFileSync("src/components/ai-orb/ai-orb-tool-map.ts", "utf8");
  check("  …and the web search tool is mapped to browsing so the caption can say so", /search_web: "browsing",/.test(map20));
  /* THE VOICE SHEET. */
  const scr20 = fs20.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the chips are gone; a Voice control beside Mute opens a sheet of orb tiles, Escape closes the sheet before the screen can end the call",
    !/voices\.map\(\(v\) => \{\s*const on = v\.key === selectedVoice;\s*return \(\s*<button\s*key=\{v\.key\}\s*type="button"\s*onClick=\{\(\) => onSelectVoice\?\.\(v\.key\)\}/.test(scr20) &&
    /onClick=\{\(\) => setVoiceSheet\(true\)\}/.test(scr20) && /aria-haspopup="dialog"/.test(scr20) &&
    /<VoiceGlyph index=\{i\} on=\{on \|\| sampling === v\.key\} \/>/.test(scr20) && !/<AIOrb size=\{64\}/.test(scr20) &&
    /onClick=\{\(\) => tapVoice\(v\.key\)\}/.test(scr20) && /if \(!onPreviewVoice\) \{\s*onSelectVoice\?\.\(key\);\s*closeVoiceSheet\(\);\s*return;\s*\}/.test(scr20) &&
    /window\.addEventListener\("keydown", onKey, true\);/.test(scr20) && /e\.stopPropagation\(\);\s*e\.preventDefault\(\);\s*setVoiceSheet\(false\);/.test(scr20));
  /* A VOICE IS A SHAPE. Six distinct five-bar signatures; the chosen one is
     Hub Blue and breathes; off is monochrome. */
  check("each voice has its own waveform signature — six fixed patterns, all different, none derived from the label",
    (() => { const m = /const GLYPH_PATTERNS[^=]*= \[([\s\S]*?)\n\];/.exec(scr20); if (!m) return false; const rows = m[1].trim().split("\n").map((r) => r.trim().replace(/,$/, "")); return rows.length === 6 && new Set(rows).size === 6 && rows.every((r) => /^\[\d+(, \d+){4}\]$/.test(r)); })() &&
    /GLYPH_PATTERNS\[index % GLYPH_PATTERNS\.length\]/.test(scr20) &&
    /fill=\{on \? "#0066FF" : "rgba\(255,255,255,0\.72\)"\}/.test(scr20) && /\.kx-voice-glyph\.is-on rect \{ animation: kx-voice-bar/.test(fs20.readFileSync("src/app/globals.css", "utf8")));
  check("  …the caption moves only while something is pending",
    /const working = !live \|\| !ready \|\| reconnecting \|\| \(searching && !muted\) \|\| \(phase === "thinking" && !muted\);/.test(scr20) &&
    /\{working \? \(\s*<>\s*<span className="kx-activity-text">\{status\.replace\(\/…\$\/, ""\)\}<\/span>/.test(scr20));
}

{
  console.log("\n── 21. The switch between the orb and the words: one orb travels, nothing remounts, nothing switches by itself ──");
  /* Owner, 2026-09-07: "the motion when I press show conversation or press
     the orb is not smooth and ease enough, it has a glitch" and "suddenly
     it out of conversation and show me the text conversation". The first
     was two views remounted on every tap with a third, inert copy of the
     leaving one on top; the second was a picture opening the conversation
     by itself. Both layers now stay mounted, the orb is one element whose
     flight is measured (FLIP), and only a tap changes the view. */
  const fs21 = await import("node:fs");
  const scr21 = fs21.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  const css21 = fs21.readFileSync("src/app/globals.css", "utf8");
  check("only a tap changes the view — a picture no longer opens the conversation by itself",
    /const view: "orb" \| "chat" = chosenView \?\? "orb";/.test(scr21) &&
    /const switchView = useCallback\(\(next: "orb" \| "chat"\) => setView\(next\), \[\]\);/.test(scr21) &&
    !/hasPhotos/.test(scr21));
  check("  …and the latest pictures show under the orb instead, where the caller is looking",
    /const latestPhotos: readonly TranscriptPhoto\[\]/.test(scr21) &&
    /\{latestPhotos\.length > 0 && \(\s*<div className="flex flex-wrap justify-center gap-3" role="group" aria-label=\{copy\.photos\}>/.test(scr21) &&
    /<PhotoTile key=\{p\.url\} photo=\{p\} onOpen=\{setOpenPhoto\} label=\{copy\.photos\} size=\{88\} visible=\{view === "orb"\} \/>/.test(scr21));
  check("both layers stay mounted: the words layer and the orb layer are always rendered, hidden by class, never keyed",
    /<div ref=\{stageRef\} className="relative flex-1 min-h-0" data-view=\{view\}>\s*\{wordsLayer\}\s*\{orbLayer\}\s*<\/div>/.test(scr21) &&
    !/key=\{view\}/.test(scr21) && !/leaving/.test(scr21.replace(/\/\*[\s\S]*?\*\//g, "")) &&
    /className=\{`kx-call-words absolute inset-0 flex flex-col pt-4 \$\{view === "chat" \? "is-in" : ""\}`\}/.test(scr21));
  check("  …the hidden layer is out of the accessibility tree and takes no taps; the orb alone stays tappable over the words",
    /aria-hidden=\{view !== "chat"\}/.test(scr21) && /aria-hidden=\{view !== "orb"\}/.test(scr21) &&
    /\$\{view === "orb" \? "" : "pointer-events-none"\}/.test(scr21) &&
    /className="kx-orb-stage block rounded-full pointer-events-auto/.test(scr21));
  check("one orb, drawn once: a single AIOrb at call size, no small second orb",
    (scr21.match(/<AIOrb\b/g) ?? []).length === 1 && !/kx-mini-orb/.test(scr21) && /size=\{200\}/.test(scr21));
  check("  …its flight is measured from its home to the corner slot (FLIP), so it lands exactly, in RTL too, and follows a resize",
    /const home = orbHomeRef\.current\?\.getBoundingClientRect\(\);\s*const corner = cornerRef\.current\?\.getBoundingClientRect\(\);/.test(scr21) &&
    /setTravel\(`translate\(\$\{dx\.toFixed\(1\)\}px, \$\{dy\.toFixed\(1\)\}px\) scale\(\$\{\(corner\.width \/ home\.width\)\.toFixed\(3\)\}\)`\);/.test(scr21) &&
    /const ro = new ResizeObserver\(measure\);/.test(scr21) && /useLayoutEffect\(/.test(scr21) &&
    /<div className="kx-orb-travel" style=\{\{ transform: travel \}\} data-travel=\{view\}>/.test(scr21) &&
    /<div ref=\{cornerRef\} aria-hidden className="kx-orb-corner absolute bottom-4 end-6 h-\[72px\] w-\[72px\] pointer-events-none" \/>/.test(scr21));
  check("  …the orb's home does not move with every caption: the block under it reserves a floor",
    /ref=\{belowRef\}[\s\S]{0,120}min-h-\[176px\]/.test(scr21));
  check("  …and the rings' level hook binds once — the ref never changes element now",
    /useCallLevel\(orbWrapRef, audioLevel, live && ready && !reconnecting && !muted\);/.test(scr21));
  check("the motion is transitions on transform and opacity, eased, and nothing animates under reduced motion",
    /\.kx-orb-travel \{ transform-origin: 50% 50%; will-change: transform; \}/.test(css21) &&
    /@media \(prefers-reduced-motion: no-preference\) \{\s*\.kx-orb-travel \{ transition: transform 0\.6s cubic-bezier\(0\.32, 0\.72, 0, 1\); \}/.test(css21) &&
    /\.kx-call-words \{ transition: opacity 0\.35s ease-out, transform 0\.6s cubic-bezier\(0\.32, 0\.72, 0, 1\), visibility 0s linear 0\.35s; \}/.test(css21) &&
    !/kx-view-in|kx-view-out|kx-orb-fly/.test(css21));
  check("  …a layer that fades out becomes visibility:hidden after its fade, so it cannot take a tap once gone; the arriving one shows at once",
    /\.kx-call-words \{ opacity: 0; visibility: hidden; transform: translateY\(24px\); \}/.test(css21) &&
    /\.kx-call-words\.is-in \{ opacity: 1; visibility: visible; transform: none; \}/.test(css21) &&
    /\.kx-call-fade \{ transition: opacity 0\.25s ease-out, visibility 0s linear 0\.25s; \}/.test(css21) &&
    /\.kx-call-fade\.is-in \{ transition-delay: 0\.22s, 0s; \}/.test(css21) &&
    /\.kx-call-words\.is-in \{ transition-delay: 0\.08s, 0s, 0s; \}/.test(css21));
}

{
  console.log("\n── 22. What the call came to — asked for at hang-up ──");
  const fs22 = await import("node:fs");
  const sum = await import("../src/lib/voice/summary");
  check("a call is worth a summary after two settled caller turns and one reply — never before, never on drafts",
    sum.shouldSummarise([{ role: "user", text: "a", final: true }, { role: "assistant", text: "b", final: true }, { role: "user", text: "c", final: true }]) &&
    !sum.shouldSummarise([{ role: "user", text: "a", final: true }, { role: "assistant", text: "b", final: true }]) &&
    !sum.shouldSummarise([{ role: "user", text: "a", final: true }, { role: "user", text: "c", final: true }]) &&
    !sum.shouldSummarise([{ role: "user", text: "a", final: false }, { role: "assistant", text: "b", final: true }, { role: "user", text: "c", final: false }]) &&
    !sum.shouldSummarise([{ role: "user", text: "  ", final: true }, { role: "assistant", text: "b", final: true }, { role: "user", text: "c", final: true }]) &&
    sum.SUMMARY_MIN_USER_LINES === 2 && sum.SUMMARY_PATH === "/api/ai/voice/summary");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (status: number, body: unknown) => (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(body), { status }); }) as typeof fetch;
  const ok = await sum.requestCallSummary("6f1d2c3b-4a5e-4f60-9b7c-1234567890ab", "ar", fakeFetch(200, { message: { id: "m1", role: "assistant", content: "**ملخص**", created_at: "t" }, conversation: { id: "c", title: "T" } }));
  check("the request posts the conversation id and the UI language with the session cookie, and returns the row",
    ok?.message.id === "m1" && ok.conversation.id === "c" && calls[0].url === sum.SUMMARY_PATH && calls[0].init?.method === "POST" && calls[0].init?.credentials === "include" &&
    calls[0].init?.body === JSON.stringify({ conversation_id: "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab", lang: "ar" }));
  check("  …too little to summarise (message null), a refusal, and a network failure are all null — nothing on screen",
    (await sum.requestCallSummary("c", "en", fakeFetch(200, { message: null, conversation: { id: "c", title: null } }))) === null &&
    (await sum.requestCallSummary("c", "en", fakeFetch(429, { message: { id: "m9", role: "assistant", content: "x", created_at: "t" }, conversation: { id: "c", title: null } }))) === null &&
    (await sum.requestCallSummary("c", "en", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)) === null);
  const btn22 = fs22.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("hang-up takes the writer, the thread and the words BEFORE the release, then asks after the last turns landed, and the row joins the thread; a voice switch never asks",
    /const persister = persisterRef\.current;\s*const conversation = conversationIdRef\.current;\s*const lines = linesRef\.current;\s*releaseCall\(\);\s*setState\("idle"\);\s*if \(conversation && shouldSummarise\(lines\)\) \{/.test(btn22) &&
    /Promise\.resolve\(persister\?\.finish\(\)\)\s*\.then\(\(\) => requestCallSummary\(conversation, langRef\.current\)\)\s*\.then\(\(res\) => \{ if \(res\) onTurnsSavedRef\.current\?\.\(\[res\.message\], res\.conversation\); \}\)/.test(btn22) &&
    (btn22.match(/requestCallSummary\(/g) ?? []).length === 1 && !/selectVoice[\s\S]{0,1200}?requestCallSummary/.test(btn22.slice(btn22.indexOf("const selectVoice"), btn22.indexOf("const selectVoice") + 1500)));

  /* ── ROADMAP B2: HOLD TO TALK ──────────────────────────────────────────
     A loud room gets turns of its own under server-side detection. The
     answer is a device-side choice about the microphone — the tracks open
     only while a button is held — so no handshake, no vendor field, and
     the mute path is reused rather than a second owner of the tracks. */
  const talkPref = await import("../src/lib/voice/voice-pref");
  check("the talk mode is two allow-listed words, hands-free by default, under its own storage key",
    talkPref.parseTalkMode("hold") === "hold" && talkPref.parseTalkMode("hands-free") === "hands-free" &&
    talkPref.parseTalkMode("push") === null && talkPref.parseTalkMode(null) === null && talkPref.parseTalkMode(undefined) === null &&
    talkPref.DEFAULT_TALK_MODE === "hands-free" && talkPref.TALK_MODE_STORAGE_KEY === "koleex-voice-talk" &&
    new Set<string>([talkPref.TALK_MODE_STORAGE_KEY, talkPref.VOICE_STORAGE_KEY, talkPref.REGION_STORAGE_KEY]).size === 3);
  {
    const g = globalThis as unknown as { window?: unknown };
    const had = "window" in g; const prev = g.window;
    const store = new Map<string, string>();
    g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } };
    const before = talkPref.readSavedTalkMode();
    talkPref.saveTalkMode("hold");
    const after = talkPref.readSavedTalkMode();
    const written = store.get(talkPref.TALK_MODE_STORAGE_KEY);
    store.set(talkPref.TALK_MODE_STORAGE_KEY, "junk");
    const junk = talkPref.readSavedTalkMode();
    g.window = { localStorage: { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } } };
    let threw = false; try { talkPref.saveTalkMode("hold"); } catch { threw = true; }
    const refused = talkPref.readSavedTalkMode();
    if (had) g.window = prev; else delete g.window;
    const noWindow = talkPref.readSavedTalkMode();
    check("  …nothing → hands-free, saved → read back, junk → hands-free, a refusing store and no window → hands-free and silent",
      before === "hands-free" && after === "hold" && written === "hold" && junk === "hands-free" && !threw && refused === "hands-free" && noWindow === "hands-free");
  }
  const btn23 = fs22.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the button reads the saved mode lazily (no effect, no hydration frame that differs) and keeps a ref beside the state for the session's handlers",
    /const \[talkMode, setTalkMode\] = useState<TalkMode>\(readSavedTalkMode\);\s*const talkModeRef = useRef<TalkMode>\(talkMode\);/.test(btn23) &&
    !/useEffect\(\(\) => \{\s*const saved = readSavedTalkMode\(\)/.test(btn23));
  check("hold mode CLOSES the tracks the moment the microphone exists — per session, so a rebuilt line keeps the mode — through the session's own mute",
    /onLocalStream: \(stream\) => \{\s*setMicStream\(stream\);[\s\S]{0,900}?if \(talkModeRef\.current === "hold"\) \{\s*session\.setMuted\(true\);\s*setMuted\(true\);\s*\}\s*\},/.test(btn23));
  check("the hold opens the tracks while held and closes them on release, and is IGNORED outside hold mode (a stray event must not close a hands-free microphone)",
    /const setHolding = useCallback\(\(held: boolean\) => \{\s*const session = sessionRef\.current;\s*if \(!session \|\| talkModeRef\.current !== "hold"\) return;\s*session\.setMuted\(!held\);\s*setMuted\(!held\);\s*\}, \[\]\);/.test(btn23));
  check("choosing a mode is remembered on the device and applied to the live call at once — closed for hold, open for hands-free — without a new session",
    /const selectTalkMode = useCallback\(\(mode: TalkMode\) => \{\s*talkModeRef\.current = mode;\s*setTalkMode\(mode\);\s*saveTalkMode\(mode\);\s*const session = sessionRef\.current;\s*if \(!session\) return;\s*const closed = mode === "hold";\s*session\.setMuted\(closed\);\s*setMuted\(closed\);\s*\}, \[\]\);/.test(btn23) &&
    !/selectTalkMode[\s\S]{0,600}?releaseCall\(\)/.test(btn23.slice(btn23.indexOf("const selectTalkMode"), btn23.indexOf("const selectTalkMode") + 700)));
  check("the screen is handed the mode, the chooser and the hold",
    /talkMode=\{talkMode\}\s*onSelectTalkMode=\{selectTalkMode\}\s*onHold=\{setHolding\}/.test(btn23));


  /* ── ROADMAP B3: BARGE-IN WIRING ──────────────────────────────────────── */
  const btn24 = fs22.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("every data-channel event runs the playback gate against the phase the channel last reported, BEFORE the caption parse, and mutes or unmutes the far side's element",
    /onMessageRef\.current\?\.\(data\);[\s\S]{0,700}?const gate = playbackGate\(voiceEventType\(data\), phaseRef\.current\);\s*if \(gate && audioRef\.current\) audioRef\.current\.muted = gate === "cut";[\s\S]{0,600}?const parsed = parseVoiceEvent\(data\);/.test(btn24) &&
    /phaseRef\.current = parsed\.phase;\s*setPhase\(parsed\.phase\);/.test(btn24));
  check("the element starts every line audible and is left audible on release, so a start with no end can never silence the next call",
    /audioRef\.current\.srcObject = stream;[\s\S]{0,300}?audioRef\.current\.muted = false;/.test(btn24) &&
    /audioRef\.current\.srcObject = null;\s*audioRef\.current\.muted = false;\s*\}\s*phaseRef\.current = null;/.test(btn24) &&
    (btn24.match(/phaseRef\.current = null;/g) ?? []).length >= 2);


  /* ── ROADMAP B5: THE SCREEN STAYS AWAKE ON A CALL ─────────────────────── */
  const btn25 = fs22.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the screen wake lock is feature-detected, asked for when the call goes live, released with the call, and asked for again when the page returns",
    /if \(!wl \|\| wakeLockRef\.current\) return;\s*wl\.request\("screen"\)\.then\(\(lock\) => \{ wakeLockRef\.current = lock; \}\)\.catch\(/.test(btn25) &&
    /if \(next === "live"\) acquireWakeLock\(\);/.test(btn25) &&
    /phaseRef\.current = null;\s*releaseWakeLock\(\);/.test(btn25) &&
    /if \(document\.visibilityState === "visible"\) \{ wakeLockRef\.current = null; acquireWakeLock\(\); \}/.test(btn25) &&
    /\}, \[live, acquireWakeLock\]\);/.test(btn25));


  /* ── ROADMAP D1: A TASK BY VOICE, SAVED BY A TAP ────────────────────────── */
  const tt = await import("../src/lib/voice/text-turn");
  {
    const note = tt.buildNoteMessage("  the caller tapped Confirm ");
    const parsed = note ? JSON.parse(note) as { type: string; item: { role: string; content: Array<{ type: string; text: string }> } } : null;
    check("a note is ONE message — the text as the user's turn, no response asked for — trimmed and capped, null when empty",
      parsed !== null && parsed.type === tt.EV_ITEM_CREATE && parsed.item.role === "user" && parsed.item.content[0].text === "the caller tapped Confirm" &&
      tt.buildNoteMessage("   ") === null && (JSON.parse(tt.buildNoteMessage("x".repeat(5000))!) as { item: { content: Array<{ text: string }> } }).item.content[0].text.length === tt.MAX_TYPED_TURN_CHARS &&
      !note!.includes(tt.EV_RESPONSE_CREATE));
  }
  const sess24 = fs22.readFileSync("src/lib/voice/session.ts", "utf8");
  check("the session hands a write's preview to the screen only when the server put one beside the envelope, shaped as tool + object args, and can send a note without a response",
    /const p = body\.pending;\s*if \(p && typeof p\.tool === "string" && p\.args && typeof p\.args === "object" && !Array\.isArray\(p\.args\)\) \{[\s\S]{0,400}?this\.events\.onPendingWrite\?\.\(call\.name, \{ tool: p\.tool, args: p\.args as Record<string, unknown> \},/.test(sess24) &&
    /sendNote\(text: string\): boolean \{[\s\S]{0,300}?const message = buildNoteMessage\(text\);[\s\S]{0,200}?channel\.send\(message\);/.test(sess24));
  const btn26 = fs22.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the tap posts the previewed arguments with confirm:true marked via tap to the fixed tool path, then tells the model in a note; a cancel tells it too; hang-up clears the card",
    /fetch\(TOOL_PATH, \{\s*method: "POST",\s*credentials: "include",[\s\S]{0,300}?name: pending\.tool,[\s\S]{0,120}?arguments: JSON\.stringify\(\{ \.\.\.pending\.args, confirm: true \}\),\s*via: "tap",/.test(btn26) &&
    /if \(!body\?\.output\?\.ok\) \{\s*setWriteError\(true\);\s*return;\s*\}/.test(btn26) &&
    /session\?\.sendNote\(`\(Screen: the caller tapped Confirm/.test(btn26) &&
    /sessionRef\.current\?\.sendNote\("\(Screen: the caller cancelled the task card/.test(btn26) &&
    /releaseWakeLock\(\);\s*setPendingWrite\(null\);/.test(btn26) &&
    (btn26.match(/via: "tap"/g) ?? []).length === 1);
  check("the model's own path never carries via: the relay body has name, call_id, arguments and the call's conversation id only",
    /body: JSON\.stringify\(\{\s*name: call\.name,\s*call_id: call\.callId,\s*arguments: call\.argumentsJson,[\s\S]{0,300}?\.\.\.\(this\.conversationId \? \{ conversation_id: this\.conversationId \} : \{\}\),\s*\}\)/.test(sess24) && !/via:/.test(sess24.slice(sess24.indexOf("TOOL_PATH, {"), sess24.indexOf("TOOL_PATH, {") + 600)));

}

{
  console.log("\n── 25. A handshake on a link that drops it, and a hang-up while it is in flight ──");
  /* Production, 2026-09-07 15:00–15:08, after the owner's "AI can't be
     connected": two calls, both `handshake-failed` on a network whose other
     sockets were flapping every second. One beacon carried no session at
     all — the caller had hung up while "connecting" and was then told the
     call could not start. Neither had a cause in it. */
  {
    /* THE LINK DROPS THE FIRST POST. A bare TypeError is what fetch reports
       for a connection cut underneath it; the offer is still good, so the
       same POST goes once more. */
    const recorded: Recorded[] = [];
    const d = deps({ recorded });
    const real = d.deps.fetchFn;
    let n = 0;
    d.deps.fetchFn = (async (url: string, init?: RequestInit) => {
      if (n++ === 0) throw new TypeError("Load failed");
      return real(url, init);
    }) as unknown as typeof fetch;
    const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
    const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
    await within(4000, s.start());
    check("a handshake the link dropped is posted once more, and the call is live", s.getState() === "live" && n === 2 && recorded.length === 1);
    check("  …with no failure shown in between", states.every(([st]) => st !== "failed"));
    s.stop();
  }
  {
    const d = deps({});
    d.deps.fetchFn = (async () => { throw new TypeError("Load failed"); }) as unknown as typeof fetch;
    const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
    const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
    await within(4000, s.start());
    const last = states[states.length - 1];
    check("a second drop is the failure it always was — one retry, never a loop", last[0] === "failed" && last[1] === "handshake-failed");
    check("  …and the beacon now carries the cause", s.diagnostics().err === "TypeError: Load failed");
  }
  {
    const d = deps({});
    const err = Object.assign(new Error("signal timed out"), { name: "TimeoutError" });
    let calls = 0;
    d.deps.fetchFn = (async () => { calls++; throw err; }) as unknown as typeof fetch;
    const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
    const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
    await within(4000, s.start());
    const last = states[states.length - 1];
    check("our own deadline is not retried — the service did not answer, and is said to have not", calls === 1 && last[1] === "service-unreachable");
  }
  {
    /* HUNG UP WHILE CONNECTING. The fetch resolves after stop(); the answer
       must not be applied, and nothing may be reported as a failure. */
    const d = deps({});
    const real = d.deps.fetchFn;
    const gate: { release: (() => void) | null } = { release: null };
    d.deps.fetchFn = (async (url: string, init?: RequestInit) => {
      await new Promise<void>((r) => { gate.release = r; });
      return real(url, init);
    }) as unknown as typeof fetch;
    const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
    const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
    const started = s.start();
    await sleep(30);
    s.stop();
    gate.release?.();
    await within(4000, started);
    check("a call ended while its handshake was in flight stays ended — no late \"live\", no late failure",
      s.getState() === "ended" && states.every(([st]) => st !== "failed" && st !== "live") && d.mic.allStopped());
  }
  {
    const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
    const tele = (await import("node:fs")).readFileSync("src/app/api/ai/voice/telemetry/route.ts", "utf8");
    check("fail() is a no-op on an ended call, and records the cause the beacon reads",
      /private fail\(reason: VoiceFailure, cause\?: unknown\): void \{[\s\S]{0,700}?if \(this\.state === "ended"\) return;\s*this\.lastError = describeError\(cause\);/.test(src) &&
      /err: this\.lastError,/.test(src) && /err="\$\{cause\(body\.err\)\}"/.test(tele));
    check("  …the cause is words only, bounded", describeErrorCheck());
  }
}
function describeErrorCheck(): boolean {
  const d = describeError(new TypeError("Load <failed> \"x\""));
  return d === "TypeError: Load failed x" && describeError(null) === "" && describeError("a".repeat(300)).length === 100;
}

{
  console.log("\n── 26. The WebSocket lane: a socket the browser opens with a secret our server minted ──");
  /* THE SECOND LANE (ai/voice/grok.ts). One POST to our route, no offer in;
     out come the socket url, a subprotocol carrying a short-lived secret,
     the audio rate and the same server-authored session. Everything above
     the transport — configuration, acknowledgement, transcripts, tool relay
     — is the same code the WebRTC lane runs, so what is proved here is the
     transport: the handshake, the socket, the frames, the teardown. */
  type FakeSocket = VoiceSocket & { sent: string[]; url: string; protocols: string[]; closed: number; open(): void; message(raw: string): void; drop(): void };
  const makeSocket = (url: string, protocols: string[]): FakeSocket => {
    const sock: FakeSocket = {
      url, protocols, sent: [], closed: 0, readyState: 0,
      onopen: null, onmessage: null, onclose: null, onerror: null,
      send(d) { if (sock.readyState !== 1) throw new Error("not open"); sock.sent.push(d); },
      close() { sock.closed++; (sock as { readyState: number }).readyState = 3; },
      open() { (sock as { readyState: number }).readyState = 1; sock.onopen?.({}); },
      message(raw) { sock.onmessage?.({ data: raw }); },
      drop() { (sock as { readyState: number }).readyState = 3; sock.onclose?.({}); },
    };
    return sock;
  };
  type FakeAudio = { stream: MediaStream; played: string[]; flushes: number; closed: number; captureStarted: boolean; frame: ((b64: string) => void) | null; rate: number; samples: number[] };
  const wsEnvelope = (over: Record<string, unknown> = {}) => ({
    transport: "ws", url: "wss://voice.example/v1/realtime", protocols: ["xai-client-secret.SECRET-1"], expires_at: 1,
    audio: { format: "pcm16", sample_rate: 24_000 },
    session: { type: "session.update", session: { modalities: ["text", "audio"], input_audio_format: "pcm16" } },
    session_compact: { type: "session.update", session: { modalities: ["text", "audio"] } },
    ...over,
  });
  const laneRun = async (opts: { envelope?: unknown; status?: number; noSocket?: boolean; noAudio?: boolean; reconnectGraceMs?: number; failFetch?: number } = {}) => {
    const recorded: Recorded[] = [];
    const d = deps({ recorded, reconnectGraceMs: opts.reconnectGraceMs });
    const base = d.deps.fetchFn;
    const sockets: FakeSocket[] = [];
    const audios: FakeAudio[] = [];
    let fetches = 0;
    d.deps.fetchFn = (async (url: string, init?: RequestInit) => {
      if (String(url).startsWith(WS_SESSION_PATH)) {
        recorded.push({ url: String(url), init });
        fetches++;
        if (opts.failFetch && fetches <= opts.failFetch) throw new TypeError("Load failed");
        const status = opts.status ?? 200;
        return { ok: status < 400, status, json: async () => opts.envelope ?? wsEnvelope() } as unknown as Response;
      }
      if (String(url) === TOOL_PATH) {
        recorded.push({ url: String(url), init });
        return { ok: true, status: 200, json: async () => ({ call_id: "c1", output: { ok: true, data: { hits: 1 } } }) } as unknown as Response;
      }
      return base(url, init);
    }) as unknown as typeof fetch;
    if (!opts.noSocket) d.deps.createWebSocket = (url, protocols) => { const sock = makeSocket(url, protocols); sockets.push(sock); return sock; };
    if (!opts.noAudio) d.deps.createWsAudio = (rate) => {
      const a: FakeAudio = { stream: { id: "far" } as unknown as MediaStream, played: [], flushes: 0, closed: 0, captureStarted: false, frame: null, rate, samples: [] };
      audios.push(a);
      return {
        stream: a.stream,
        startCapture: (_mic, onFrame) => { a.captureStarted = true; a.frame = onFrame; },
        play: (b64) => { a.played.push(b64); },
        flush: () => { a.flushes++; },
        close: () => { a.closed++; },
        playSample: async (bytes) => { a.samples.push(bytes.byteLength); return true; },
      };
    };
    const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
    const remote: unknown[] = [];
    let ready = 0;
    const tools: string[] = [];
    const s = new VoiceSession(d.deps, {
      onState: (st, f) => states.push([st, f]),
      onRemoteStream: (st) => remote.push(st),
      onReady: () => { ready++; },
      onToolCall: (name) => tools.push(name),
    }, "v2", "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab", "ar", null, "ws");
    const outcome = await within(4000, s.start());
    return { s, states, recorded, sockets, audios, remote, ready: () => ready, tools, hung: outcome === HUNG, mic: d.mic };
  };

  {
    const r = await laneRun();
    check("a ws call posts to OUR ws-session route, with the voice key, the conversation and the language hint — and no region, no offer",
      r.recorded.length === 1 && r.recorded[0].url.startsWith(`${WS_SESSION_PATH}?`) && /voice=v2/.test(r.recorded[0].url) && /conversation=6f1d/.test(r.recorded[0].url) && /stt=ar/.test(r.recorded[0].url) && !/region=/.test(r.recorded[0].url) &&
      r.recorded[0].init?.method === "POST" && r.recorded[0].init?.credentials === "include" && !r.recorded[0].init?.body);
    check("  …and never the SDP route", !r.recorded.some((x) => x.url.startsWith(HANDSHAKE_PATH)));
    check("the socket is opened to the url the server named, with the subprotocol the server composed — the secret travels there and nowhere else",
      r.sockets.length === 1 && r.sockets[0].url === "wss://voice.example/v1/realtime" && r.sockets[0].protocols.join() === "xai-client-secret.SECRET-1");
    check("the call is live once the socket is opening, with the microphone announced first", r.s.getState() === "live" && r.states.map(([st]) => st).join(">") === "requesting-mic>connecting>live");
    check("  …nothing is sent on a socket that has not opened", r.sockets[0].sent.length === 0);
    check("  …and the audio is built at the wire rate the server named", r.audios.length === 1 && r.audios[0].rate === 24_000);
    const before = pendingTimers();
    r.sockets[0].open();
    check("an OPEN socket is the transport up: the watchdog is disarmed and the diagnostics say so", pendingTimers() === before - 1 && r.s.diagnostics().ice_ever_connected === true && r.s.diagnostics().ice === "ws1" && r.s.diagnostics().dc === "open");
    check("  …the server's session goes out first, unchanged", r.sockets[0].sent.length === 1 && r.sockets[0].sent[0] === JSON.stringify(wsEnvelope().session));
    check("  …the far side's stream is handed to the screen and the microphone reader starts", r.remote.length === 1 && r.remote[0] === r.audios[0].stream && r.audios[0].captureStarted);
    r.audios[0].frame?.("AAAA");
    check("a microphone frame goes up as input_audio_buffer.append", r.sockets[0].sent.length === 2 && r.sockets[0].sent[1] === JSON.stringify({ type: "input_audio_buffer.append", audio: "AAAA" }));
    r.sockets[0].message(JSON.stringify({ type: "session.updated" }));
    check("the acknowledgement fires ready, exactly as on the other lane", r.ready() === 1);
    r.sockets[0].message(JSON.stringify({ type: "response.audio.delta", delta: "QUJD" }));
    check("a voice frame from the far side is played", r.audios[0].played.join() === "QUJD");
    r.sockets[0].message(JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    check("  …and the caller starting to speak flushes what was queued (barge-in)", r.audios[0].flushes === 1);
    r.sockets[0].message(JSON.stringify({ type: "response.output_item.added", item: { type: "function_call", call_id: "c1", name: "search_knowledge" } }));
    r.sockets[0].message(JSON.stringify({ type: "response.function_call_arguments.done", call_id: "c1", arguments: "{\"query\":\"x\"}" }));
    await sleep(20);
    check("a tool call on the socket is relayed to the same server route and its answer goes back on the socket",
      r.tools.join() === "search_knowledge" && r.recorded.some((x) => x.url === TOOL_PATH) &&
      r.sockets[0].sent.some((m) => /conversation\.item\.create/.test(m) && /function_call_output/.test(m)) && r.sockets[0].sent[r.sockets[0].sent.length - 1] === JSON.stringify({ type: "response.create" }));
    r.s.stop();
    check("hanging up closes the socket and the audio, and releases the microphone — with no failure reported", r.sockets[0].closed === 1 && r.audios[0].closed === 1 && r.mic.allStopped() && r.s.getState() === "ended" && r.states.every(([st]) => st !== "failed"));
    r.sockets[0].drop();
    check("  …and a close that follows the hang-up changes nothing", r.s.getState() === "ended");
  }
  {
    const r = await laneRun({ reconnectGraceMs: 80 });
    r.sockets[0].open();
    r.sockets[0].drop();
    check("a socket that closes under a live call is a recovery state first", r.s.getState() === "reconnecting");
    await sleep(160);
    const last = r.states[r.states.length - 1];
    check("  …and after the window the call is over, honestly — a dropped connection the button may resume", last[0] === "failed" && last[1] === "connection-lost" && r.sockets[0].closed === 1 && r.audios[0].closed === 1);
  }
  {
    const r = await laneRun({ reconnectGraceMs: 80 });
    await sleep(160);
    const last = r.states[r.states.length - 1];
    check("a socket that never opens is the service not answering — not a dropped call to resume", last[0] === "failed" && last[1] === "service-unreachable" && r.mic.allStopped());
  }
  {
    const r = await laneRun({ status: 502 });
    check("the route's statuses are read the same way as on the other lane: 502 is the service refusing", r.states[r.states.length - 1][1] === "service-refused" && r.sockets.length === 0);
    check("  …by one shared table", failureForStatus(403) === "not-allowed" && failureForStatus(401) === "signed-out" && failureForStatus(429) === "too-many-calls" && failureForStatus(503) === "unavailable" && failureForStatus(504) === "service-unreachable" && failureForStatus(500) === "handshake-failed");
  }
  {
    const r = await laneRun({ envelope: wsEnvelope({ url: "ws://voice.example/v1/realtime" }) });
    check("an insecure socket url is refused before any socket is opened", r.states[r.states.length - 1][1] === "handshake-failed" && r.sockets.length === 0);
    const r2 = await laneRun({ envelope: wsEnvelope({ protocols: [] }) });
    check("  …so is an envelope with no secret to present", r2.states[r2.states.length - 1][1] === "handshake-failed" && r2.sockets.length === 0);
    const r3 = await laneRun({ envelope: wsEnvelope({ session: undefined }) });
    check("  …and one with no session to send", r3.states[r3.states.length - 1][1] === "handshake-failed");
  }
  {
    const r = await laneRun({ noSocket: true });
    check("a runtime with no WebSocket fails the lane as unavailable, never by throwing", r.states[r.states.length - 1][1] === "unavailable" && !r.hung);
  }
  {
    /* THE NEWER NAME FOR THE SAME FRAME. */
    const r = await laneRun();
    r.sockets[0].open();
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", delta: "R0E=" }));
    check("a voice frame under the protocol's GA name is played too", r.audios[0].played.join() === "R0E=");
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio_transcript.delta", delta: "hi" }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", delta: "R0E=" }));
    const dg = r.s.diagnostics();
    check("every event name the far side sent is counted, names only, for the end-of-call beacon",
      dg.events.split(",").sort().join("|") === "response.output_audio.delta:2|response.output_audio_transcript.delta:1" && !/R0E=|hi/.test(dg.events.replace(/response\.output_audio_transcript\.delta|response\.output_audio\.delta/g, "")));
    r.s.stop();
  }
  {
    const r = await laneRun({ noAudio: true });
    r.sockets[0].open();
    r.sockets[0].message(JSON.stringify({ type: "response.audio.delta", delta: "QUJD" }));
    check("without an audio implementation the socket still carries the protocol — no crash on a voice frame", r.s.getState() === "live" && r.sockets[0].sent.length === 1);
    r.s.stop();
  }
  {
    const r = await laneRun({ failFetch: 1 });
    check("the handshake POST dropped by the link is posted once more, as on the other lane", r.recorded.filter((x) => x.url.startsWith(WS_SESSION_PATH)).length === 2 && r.s.getState() === "live");
    r.s.stop();
  }
  {
    const fs26 = await import("node:fs");
    const btn = fs26.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    const sess = fs26.readFileSync("src/lib/voice/session.ts", "utf8");
    check("the button takes the lane from the voices GET — the server's word — and hands it to the session; it never picks one",
      /const server: "rtc" \| "ws" = body\.transport === "ws" \? "ws" : "rtc";/.test(btn) && /transportRef\.current\);/.test(btn) && !/transportRef\.current = "ws";/.test(btn));
    check("  …a ws lane that never came up falls back to the mainland lane ONCE, silently, and never the other way",
      /const canFallBack = transportRef\.current === "ws" && !wasUp && laneFailed && !laneFellBackRef\.current;/.test(btn) &&
      /if \(canFallBack\) \{\s*laneFellBackRef\.current = true;\s*transportRef\.current = "rtc";/.test(btn) && !/transportRef\.current = "ws";/.test(btn));
    check("  …the first `error` the far side sends is beaconed once with its bounded message, so a refused field on a new vendor names itself",
      /if \(voiceEventType\(data\) === "error"\) reportFirstError\(data\);/.test(btn) && /reason: "config-rejected", lane: transportRef\.current, err: errorMessageOf\(data\)/.test(btn));
    check("hanging up a live call beacons `hung-up` with the lane and the diagnostics, before the release drops the session",
      /if \(s && \(s\.getState\(\) === "live" \|\| s\.getState\(\) === "reconnecting"\)\) \{\s*sendVoiceTelemetry\(\{ reason: "hung-up", resumes: resumesRef\.current, lane: transportRef\.current, \.\.\.s\.diagnostics\(\) \}\);/.test(btn) &&
      /const hangUp = useCallback\(\(\) => \{\s*(\/\*[\s\S]*?\*\/\s*)?beaconHangUp\(\);/.test(btn));
    check("the browser's socket and audio are the deps' defaults; the session itself names no vendor and no host",
      /createWebSocket: \(url, protocols\) => new WebSocket\(url, protocols\)/.test(sess) && /createWsAudio: \(sampleRate\) => createBrowserWsAudio\(sampleRate\)/.test(sess) &&
      !/api\.x\.ai|wss:\/\/[a-z]/i.test(sess));
  }
  {
    /* THE CUT ANSWER STAYS CUT. Frames of the answer being interrupted are
       still on the wire after the flush; played, they are the "strange
       voices" over the caller's words. */
    const r = await laneRun();
    r.sockets[0].open();
    r.sockets[0].message(JSON.stringify({ type: "response.created", response: { id: "r1" } }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", response_id: "r1", delta: "QQ==" }));
    r.sockets[0].message(JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", response_id: "r1", delta: "Qg==" }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", delta: "Qw==" }));
    check("after a barge-in, late frames of the cut answer — named or unnamed — are dropped, not played", r.audios[0].flushes === 1 && r.audios[0].played.join() === "QQ==");
    r.sockets[0].message(JSON.stringify({ type: "response.created", response: { id: "r2" } }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", response_id: "r2", delta: "RA==" }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", response_id: "r1", delta: "RQ==" }));
    check("  …the NEXT answer plays from its first frame, and a straggler of the cut one is still dropped", r.audios[0].played.join() === "QQ==,RA==");
    r.sockets[0].message(JSON.stringify({ type: "response.cancelled" }));
    r.sockets[0].message(JSON.stringify({ type: "response.output_audio.delta", response_id: "r2", delta: "Rg==" }));
    check("  …a cancelled response is silenced the same way", r.audios[0].flushes === 2 && r.audios[0].played.join() === "QQ==,RA==");
    const sentBefore = r.sockets[0].sent.length;
    check("a voice sample on the socket lane plays through the call's OWN audio (no second context under a live microphone)",
      (() => { const pr = r.s.previewAudio(new ArrayBuffer(7)); return pr !== null && r.audios[0].samples.join() === "7"; })());
    check("a response request goes out on the open socket as one response.create with instructions",
      r.s.requestResponse("say hi") === true && r.sockets[0].sent.length === sentBefore + 1 && r.sockets[0].sent[sentBefore] === JSON.stringify({ type: "response.create", response: { instructions: "say hi" } }) && r.s.requestResponse("  ") === false);
    r.s.stop();
    check("  …and not on a closed one", r.s.requestResponse("say hi") === false);
  }
  {
    /* THE SOCKET IS DIALLED AGAIN WHEN IT DROPS (2026-09-08 02:40: the
       phone's network went offline for five seconds mid-call; the socket
       died with it, nothing redialled, the deadline ended the call). */
    const { WS_RECONNECT_DELAYS_MS, closeCodeOf } = await import("../src/lib/voice/session");
    check("the redial ladder starts at once and backs off; a close event's code is read as text", WS_RECONNECT_DELAYS_MS.join() === "0,1500,3000,6000" && closeCodeOf({ code: 1006 }) === "1006" && closeCodeOf({}) === "" && closeCodeOf(null) === "");
    const r = await laneRun({ reconnectGraceMs: 400 });
    r.sockets[0].open();
    r.sockets[0].message(JSON.stringify({ type: "session.updated" }));
    const postsBefore = r.recorded.filter((x) => x.url.startsWith(WS_SESSION_PATH)).length;
    r.sockets[0].drop();
    check("a dropped socket on a call that was up is 'reconnecting', not failed — and the deadline is armed once", r.s.getState() === "reconnecting" && r.s.diagnostics().ws_close === "");
    await sleep(30);
    check("  …a new secret is asked for and a NEW socket dialled at once, on the same microphone and audio",
      r.recorded.filter((x) => x.url.startsWith(WS_SESSION_PATH)).length === postsBefore + 1 && r.sockets.length === 2 && r.audios.length === 1 && !r.mic.allStopped() && r.s.diagnostics().ws_reconnects === 1);
    r.sockets[1].open();
    check("  …and the open socket is the call back: live, the session configured afresh on the new socket, no failure shown",
      r.s.getState() === "live" && r.sockets[1].sent.length === 1 && /session\.update/.test(r.sockets[1].sent[0]) && r.states.every(([st]) => st !== "failed"));
    r.sockets[1].message(JSON.stringify({ type: "response.output_audio.delta", delta: "QQ==" }));
    r.audios[0].frame?.("BBBB");
    check("  …voice frames flow on the new socket both ways — the reader was kept, not restarted", r.audios[0].played.join() === "QQ==" && r.sockets[1].sent[r.sockets[1].sent.length - 1] === JSON.stringify({ type: "input_audio_buffer.append", audio: "BBBB" }) && r.audios[0].captureStarted);
    /* A second outage whose redials all die: the deadline ends the call. */
    r.sockets[1].drop();
    await sleep(30);
    check("a redial that dies before opening schedules the next — the deadline is not pushed out by it", r.s.getState() === "reconnecting" && r.sockets.length === 3);
    r.sockets[2].drop();
    await sleep(520);
    const last = r.states[r.states.length - 1];
    check("  …and when the deadline passes with no socket open, the call fails as connection-lost, keeping the microphone for a resume",
      last[0] === "failed" && last[1] === "connection-lost" && !r.mic.allStopped() && r.s.takeMicrophone() !== null);
    r.s.stop();
  }
}

{
  console.log("\n── 27. The device finds out which lane works from its own network ──");
  /* 2026-09-07 17:27: VPN on, mainland voice. A phone's VPN tunnels only
     the blocked hosts; our host is not blocked, so our server saw a
     mainland address and chose the mainland lane while the browser could
     reach the vendor all along. The server's answer is a default; the
     browser probes, once, ahead of the call, and remembers. */
  const { decideLane, parseSavedLane, LANE_TTL_MS } = await import("../src/lib/voice/voice-pref");
  const { probeWsLane, LANE_PROBE_TIMEOUT_MS } = await import("../src/lib/voice/lane-probe");
  const now = 1_700_000_000_000;
  check("the server saying the socket lane is final — no probe", JSON.stringify(decideLane("ws", { lane: "rtc", at: now }, now)) === JSON.stringify({ lane: "ws", probe: false }));
  check("the server saying mainland with no device verdict: mainland now, and a probe", JSON.stringify(decideLane("rtc", null, now)) === JSON.stringify({ lane: "rtc", probe: true }));
  check("  …a fresh device verdict overrides it, either way, with no probe",
    JSON.stringify(decideLane("rtc", { lane: "ws", at: now - 60_000 }, now)) === JSON.stringify({ lane: "ws", probe: false }) &&
    JSON.stringify(decideLane("rtc", { lane: "rtc", at: now - 60_000 }, now)) === JSON.stringify({ lane: "rtc", probe: false }));
  check("  …a stale verdict is re-checked", decideLane("rtc", { lane: "ws", at: now - LANE_TTL_MS - 1 }, now).probe === true && LANE_TTL_MS === 6 * 60 * 60 * 1000);
  check("  …a verdict from the future is not trusted", decideLane("rtc", { lane: "ws", at: now + 5_000 }, now).probe === true);
  check("the saved verdict is read strictly", parseSavedLane('{"lane":"ws","at":5}')?.lane === "ws" && parseSavedLane('{"lane":"x","at":5}') === null && parseSavedLane("nonsense") === null && parseSavedLane(null) === null);

  const probeDeps = (opts: { open?: boolean; error?: boolean; status?: number; bad?: boolean }) => {
    const sockets: Array<{ url: string; protocols: string[]; closed: number }> = [];
    return {
      sockets,
      deps: {
        timeoutMs: 80,
        fetchFn: (async () => ({
          ok: (opts.status ?? 200) < 400, status: opts.status ?? 200,
          json: async () => (opts.bad ? { url: "ws://plain", protocols: [] } : { url: "wss://voice.example/v1/realtime", protocols: ["xai-client-secret.S"] }),
        }) as unknown as Response) as unknown as typeof fetch,
        createWebSocket: (url: string, protocols: string[]) => {
          const rec = { url, protocols, closed: 0 };
          sockets.push(rec);
          const sock: VoiceSocket = {
            readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null,
            send() {}, close() { rec.closed++; },
          };
          setTimeout(() => { if (opts.open) sock.onopen?.({}); else if (opts.error) { sock.onerror?.({}); sock.onclose?.({}); } }, 10);
          return sock;
        },
      },
    };
  };
  {
    const h = probeDeps({ open: true });
    const ok = await probeWsLane(h.deps);
    check("a socket that opens is a lane that works — and is closed at once, no audio, no session", ok === true && h.sockets.length === 1 && h.sockets[0].closed === 1 && h.sockets[0].protocols.join() === "xai-client-secret.S");
  }
  {
    const h = probeDeps({ error: true });
    check("a socket that errors is a lane that does not", (await probeWsLane(h.deps)) === false && h.sockets[0].closed === 1);
  }
  {
    const h = probeDeps({});
    const t0 = Date.now();
    check("a socket that never answers is a lane that does not, within the deadline", (await probeWsLane(h.deps)) === false && Date.now() - t0 < 1_000 && h.sockets[0].closed === 1);
  }
  check("a route refusal or a bad envelope opens no socket", (await probeWsLane(probeDeps({ status: 503 }).deps)) === false && (await probeWsLane(probeDeps({ bad: true }).deps)) === false);
  check("the shipped deadline is three seconds", LANE_PROBE_TIMEOUT_MS === 3_000);
  {
    const fs27 = await import("node:fs");
    const btn = fs27.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    const route = fs27.readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
    const sess = fs27.readFileSync("src/lib/voice/session.ts", "utf8");
    check("the picker shows the lane's OWN voices, and follows the lane the device settles on — now, and again after the probe",
      /const offerFor = \(lane: "rtc" \| "ws"\) => \{\s*const list = byLane\[lane\]\.length > 0 \? byLane\[lane\] : byLane\.rtc;\s*setVoices\(list\);\s*setVoiceKey\(\(cur\) => pickVoiceKey\(cur \?\? readSavedVoiceKey\(\), list\)\);/.test(btn) &&
      /transportRef\.current = decided\.lane;\s*offerFor\(decided\.lane\);/.test(btn) && /transportRef\.current = ok \? "ws" : "rtc";\s*offerFor\(transportRef\.current\);/.test(btn));
    check("the button decides from the server's default and the device's verdict, probes in the background only when told the socket lane exists, and never moves a call already placed",
      /const decided = decideLane\(server, readSavedLane\(\), Date\.now\(\)\);\s*transportRef\.current = decided\.lane;\s*offerFor\(decided\.lane\);\s*if \(decided\.probe && body\.ws_available === true\) \{/.test(btn) &&
      /saveLane\(ok \? "ws" : "rtc"\);\s*(\/\*[^*]*\*\/\s*)?if \(!sessionRef\.current\) \{\s*transportRef\.current = ok \? "ws" : "rtc";/.test(btn));
    check("  …a real call teaches the device too: live on the socket lane saves ws, a fall-back saves rtc",
      /if \(next === "live" && transportRef\.current === "ws"\) saveLane\("ws"\);/.test(btn) && /transportRef\.current = "rtc";\s*(\/\*[^*]*\*\/\s*)?saveLane\("rtc"\);/.test(btn));
    check("the voices GET says whether a socket lane exists and logs its decision with the country — nothing else", /ws_available: grok !== null/.test(route) && /\[ai\.voice\] lane=\$\{lane \?\? "none"\} country=/.test(route));
    check("a socket lane waits four seconds for its socket, not eight — the fall-back is behind it", /const WS_OPEN_GRACE_MS = 4_000;/.test(sess) && /this\.transport === "ws" && this\.deps\.reconnectGraceMs === undefined[\s\S]{0,400}?\? WS_OPEN_GRACE_MS/.test(sess));
  }
}

{
  console.log("\n── 28. The page that hosts the call must not die under it ──");
  /* 2026-09-07 17:33: a call four minutes in, a lookup answered, and two
     seconds later a cold load of /ai with a fresh perf session and NO
     page-hidden beacon — the document was not reloaded, it was killed and
     restored. The same page had reported a realtime channel closing and
     rejoining every 0.8 s since 15:00: the backoff reset on every
     SUBSCRIBED, and a channel that flaps subscribes fine before it closes.
     And a stale build made the next app launch a FULL navigation, guarded
     against nothing. Read pins, because both modules pull the browser and
     the database client in. */
  const fs28 = await import("node:fs");
  const discuss = fs28.readFileSync("src/lib/discuss.ts", "utf8");
  const launch = fs28.readFileSync("src/components/layout/AppLaunchLink.tsx", "utf8");
  check("a rejoin's backoff climbs to a minute and only resets once a subscription has HELD for thirty seconds — a flap keeps climbing",
    /export const REJOIN_STABLE_MS = 30_000;/.test(discuss) &&
    /return Math\.min\(60_000, 1_000 \* 2 \*\* Math\.min\(retry, 6\)\) \* \(0\.8 \+ random\(\) \* 0\.4\);/.test(discuss) &&
    /if \(created\.subscribedAt > 0 && performance\.now\(\) - created\.subscribedAt >= REJOIN_STABLE_MS\) created\.retry = 0;/.test(discuss) &&
    /if \(created\.retry > 0 && created\.joins > 1\) \{[\s\S]{0,120}?\} else \{\s*created\.retry = 0;\s*\}/.test(discuss) &&
    !/const delay = Math\.min\(15_000/.test(discuss));
  check("  …and a hidden page schedules no rejoin at all; the visible/online nudge retries when it is back",
    /if \(typeof document !== "undefined" && document\.visibilityState === "hidden"\) return;[\s\S]{0,700}?const delay = rejoinDelayMs\(created\.retry\);/.test(discuss) && /const kickAll = \(\) => \{/.test(discuss));
  check("  …nor under a live call: the channel's storm waits for the call to end, and the end nudges it",
    /if \(typeof document !== "undefined" && document\.querySelector\("\[data-kx-call-active='1'\]"\)\) return;\s*const delay = rejoinDelayMs\(created\.retry\);/.test(discuss) &&
    /window\.addEventListener\("kx-call-ended", kickAll\);/.test(discuss));
  check("a stale build's full-page app launch is skipped mid-call — the same guard the update watcher uses",
    /import \{ busyWithSomethingUninterruptible \} from "@\/components\/pwa\/UpdateWatcher";/.test(launch) &&
    /if \(g\.__kxStaleBuild && !busyWithSomethingUninterruptible\(\)\) \{/.test(launch));
}

{
  console.log("\n── 29. The page must not die under a call, and the voice must not chop ──");
  /* 2026-09-07, 17:33 and 18:03: two calls ended with the page killed under
     them, both right after pictures were shown — web photos into <img> at
     their original URLs, camera-sized files decoded for 88px tiles in the
     page that holds the audio graph. And 18:10, the owner: "the voice of
     Grok not so stable" — frames butted 50 ms behind now, so every wire gap
     longer than that was a gap in the voice. */
  const { JitterQueue, PREBUFFER_S, PREBUFFER_STEP_S, PREBUFFER_MAX_S, PREBUFFER_WAIT_MS, RUN_GAP_S, CAPTURE_WORKLET_SOURCE, CAPTURE_WORKLET_NAME, FRAME_SAMPLES } = await import("../src/lib/voice/ws-audio");
  const { aiImage, AI_IMAGE_PROXY_PATH } = await import("../src/lib/ai/image-url");
  {
    /* A fake clock and a fake scheduler: frames are letters, starts are
       recorded as "letter@time". */
    let now = 10;
    const starts: string[] = [];
    let timers: Array<{ fn: () => void; ms: number; id: number }> = [];
    let nextId = 1;
    const q = new JitterQueue<string>({
      now: () => now,
      start: (node, at) => starts.push(`${node}@${at.toFixed(2)}`),
      setTimer: (fn, ms) => { const id = nextId++; timers.push({ fn, ms, id }); return id; },
      clearTimer: (h) => { timers = timers.filter((t) => t.id !== h); },
    });
    q.push({ node: "a", duration: 0.1 });
    check("the first small frame of an answer is GATHERED, not played: nothing starts, a timer is armed for the short-answer case",
      PREBUFFER_S === 0.3 && starts.length === 0 && q.buffered === 0.1 && timers.length === 1 && timers[0].ms === PREBUFFER_WAIT_MS && PREBUFFER_WAIT_MS === 350);
    now = 10.2;
    q.push({ node: "b", duration: 0.25 });
    check("  …once a third of a second is held, everything plays back to back from now, and the timer is dropped",
      starts.join() === "a@10.25,b@10.35" && timers.length === 0 && q.buffered === 0);
    now = 10.4;
    q.push({ node: "c", duration: 0.3 });
    check("  …a frame arriving while the run is still ahead butts against it", starts[2] === "c@10.60");
    /* The run ends at 10.90. A frame at 11.1 is 0.2 s late: an UNDERRUN. */
    now = 11.1;
    q.push({ node: "d", duration: 0.1 });
    check("a frame that arrives shortly after the run drained is an underrun: it is gathered again and the target grows a step",
      starts.length === 3 && q.underruns === 1 && Math.abs(q.target - (PREBUFFER_S + PREBUFFER_STEP_S)) < 1e-9 && timers.length === 1);
    const fire = timers[0];
    timers = [];
    fire.fn();
    check("  …and the short-answer timer releases what is held when the buffer never fills", starts[3] === "d@11.15");
    /* The run ends at 11.25. The next answer comes 3 s later: not an underrun. */
    now = 14.5;
    q.push({ node: "e", duration: 0.5 });
    check("a frame that arrives long after the run drained is the NEXT answer: gathered at the settled target, no growth",
      RUN_GAP_S === 1.0 && q.underruns === 1 && Math.abs(q.target - 0.4) < 1e-9 && starts[4] === "e@14.55" /* 0.5 ≥ 0.4 releases at once */);
    for (let i = 0; i < 20; i++) { now += 10; q.push({ node: "x", duration: 0.05 }); q.release(); now += 0.5; q.push({ node: "y", duration: 0.05 }); }
    check("  …the target stops growing at the ceiling", PREBUFFER_MAX_S === 0.8 && Math.abs(q.target - PREBUFFER_MAX_S) < 1e-9 && q.underruns > 1);
    const before = q.target;
    q.push({ node: "held", duration: 0.01 });
    const dropped = q.flush();
    check("flush() hands back what was gathered and never started, forgets the run, and keeps the target", dropped.includes("held") && q.buffered === 0 && q.target === before);
    const fs29 = await import("node:fs");
    const wa = fs29.readFileSync("src/lib/voice/ws-audio.ts", "utf8");
    check("the browser player feeds every decoded frame to the queue, starts nodes only when the queue says so, and a flush stops the started and disconnects the gathered",
      /jitter\.push\(\{ node, duration: buffer\.duration \}\);/.test(wa) && /start: \(node, at\) => \{\s*node\.start\(at\);\s*playing\.add\(node\);/.test(wa) &&
      /for \(const node of jitter\.flush\(\)\) \{[\s\S]{0,120}?node\.disconnect\(\);/.test(wa) && !/nextFrameStart|LEAD_S \/ 2/.test(wa));
    check("the microphone is read on the audio thread by a worklet loaded from a blob — no second file — and the processor is the fallback, never both",
      CAPTURE_WORKLET_NAME === "koleex-capture" && CAPTURE_WORKLET_SOURCE.includes(`registerProcessor("${CAPTURE_WORKLET_NAME}"`) && CAPTURE_WORKLET_SOURCE.includes(`new Float32Array(${FRAME_SAMPLES})`) &&
      CAPTURE_WORKLET_SOURCE.includes("this.port.postMessage(out, [out.buffer])") &&
      /URL\.createObjectURL\(new Blob\(\[CAPTURE_WORKLET_SOURCE\], \{ type: "application\/javascript" \}\)\)/.test(wa) && /URL\.revokeObjectURL\(url\);/.test(wa) &&
      /void startWorklet\(mic, onFrame\)\.then\(\(ok\) => \{\s*if \(ok \|\| closed\) return;\s*startProcessor\(mic, onFrame\);/.test(wa) &&
      /if \(!ctx\.audioWorklet \|\| typeof AudioWorkletNode === "undefined"\) return false;/.test(wa));
    check("  …both readers keep the graph alive through a silent gain, and never play the microphone back", /silence\.gain\.value = 0;/.test(wa) && /keepAlive\(processor\)/.test(wa) && /keepAlive\(worklet\)/.test(wa));
  }
  {
    check("a web picture's src is the AI picture proxy at the slot's width; a storage picture is the optimizer; a blob is itself",
      AI_IMAGE_PROXY_PATH === "/api/ai/image" &&
      aiImage("https://img.example/a.jpg?x=1&y=2", 384) === "/api/ai/image?u=https%3A%2F%2Fimg.example%2Fa.jpg%3Fx%3D1%26y%3D2&w=384" &&
      aiImage("https://xyz.supabase.co/storage/v1/object/public/products/a.png", 768).startsWith("/_next/image?url=") &&
      aiImage("blob:https://hub.koleexgroup.com/abc", 1200) === "blob:https://hub.koleexgroup.com/abc" && aiImage("", 384) === "" && aiImage(null, 384) === "");
    check("  …and never http: an http URL is returned as-is, and the screens already refuse to draw it", aiImage("http://img.example/a.jpg", 384) === "http://img.example/a.jpg");
    const fs29 = await import("node:fs");
    const tr = fs29.readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
    const scr = fs29.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
    const md = fs29.readFileSync("src/components/ai/MessageMarkdown.tsx", "utf8");
    const lb = fs29.readFileSync("src/components/ai/PhotoLightbox.tsx", "utf8");
    const lib = fs29.readFileSync("src/components/ai/LibraryPanel.tsx", "utf8");
    check("every AI screen draws a picture through aiImage: tile 384, bubble 768, full view 1200, library 384 — no original URL reaches an <img>",
      /src=\{aiImage\(photo\.url, 384\)\}/.test(tr) && /src=\{aiImage\(url, 768\)\}/.test(md) && /src=\{aiImage\(photo\.url, 1200\)\}/.test(lb) && /src=\{aiImage\(it\.url, 384\)\}/.test(lib) &&
      !/src=\{photo\.url\}/.test(tr) && !/src=\{url\}/.test(md) && !/src=\{photo\.url\}/.test(lb) && !/src=\{it\.url\}/.test(lib));
    check("a tile in a layer that is not showing holds no picture: the words layer's tiles are visible only on the chat view, the strip's only on the orb view",
      /visible = true \}/.test(tr) && /const img = visible \? \(/.test(tr) && /<span aria-hidden className=\{`block \$\{frame\}`\} style=\{\{ width: size, height: size \}\} \/>/.test(tr) &&
      /visible=\{photosVisible\}/.test(tr) && /photosVisible=\{view === "chat"\}/.test(scr) && /size=\{88\} visible=\{view === "orb"\}/.test(scr));
  }
}

{
  console.log("\n── 30. Hear a voice before choosing it, and a cut answer stays cut ──");
  /* The owner, 2026-09-07: "when I press a voice it should say some sample
     words so I can listen before I select it", and "when I speak I hear
     strange voices from Koleex AI, it seems to glitch". */
  const { createPreviewPlayer, VOICE_PREVIEW_PATH, PREVIEW_FETCH_TIMEOUT_MS } = await import("../src/lib/voice/preview-player");
  {
    type Src = { buffer: unknown; connect(d: unknown): void; start(): void; stop(): void; onended: (() => void) | null };
    const log: string[] = [];
    const sources: Src[] = [];
    let state = "suspended";
    let decodeFail = false;
    const ctx = {
      get state() { return state; },
      destination: { id: "speaker" },
      resume: async () => { state = "running"; log.push("resume"); },
      decodeAudioData: async (b: ArrayBuffer) => { if (decodeFail) throw new Error("bad"); log.push(`decode:${b.byteLength}`); return { samples: b.byteLength }; },
      createBufferSource: () => {
        const src: Src = { buffer: null, connect: (d) => log.push(`connect:${(d as { id: string }).id}`), start: () => log.push("start"), stop: () => log.push("stop"), onended: null };
        sources.push(src);
        return src;
      },
      close: async () => { log.push("close"); },
    };
    let made = 0;
    const player = createPreviewPlayer(() => { made++; return ctx; });
    player.prime();
    check("prime() creates the context and resumes it inside the tap — a context a gesture woke stays awake for the bytes that arrive later", made === 1 && state === "running" && log.join() === "resume");
    const p1 = player.play(new ArrayBuffer(8));
    await sleep(0);
    check("play() decodes into that same context and starts one source into the speaker", made === 1 && log.slice(1).join() === "decode:8,connect:speaker,start" && sources.length === 1 && sources[0].buffer !== null);
    sources[0].onended?.();
    check("  …and resolves true when the sound ended on its own", (await p1) === true);
    const p2 = player.play(new ArrayBuffer(4));
    await sleep(0);
    const p3 = player.play(new ArrayBuffer(2));
    await sleep(0);
    check("a second tap stops the sample still playing — one voice at a time — and the first resolves false", log.includes("stop") && (await p2) === false && sources.length === 3);
    player.stop();
    check("  …stop() ends the current one the same way", (await p3) === false);
    decodeFail = true;
    check("bytes that do not decode resolve false, never throw", (await player.play(new ArrayBuffer(1))) === false);
    player.close();
    check("close() releases the context", log[log.length - 1] === "close");
    const none = createPreviewPlayer(() => null);
    none.prime();
    check("a runtime with no audio context plays nothing and throws nothing", (await none.play(new ArrayBuffer(1))) === false);
    check("the route and the ceiling", VOICE_PREVIEW_PATH === "/api/ai/voice/preview" && PREVIEW_FETCH_TIMEOUT_MS === 15_000);
  }
  {
    const fs30 = await import("node:fs");
    const btn = fs30.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    const scr = fs30.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
    check("the button primes the player INSIDE the tap, fetches the sample from our route with the lane and the UI language, and hands the bytes to the player",
      /player\?\.prime\(\);/.test(btn) &&
      /new URLSearchParams\(\{ voice: key, lane: transportRef\.current, lang \}\)/.test(btn) && /fetch\(`\$\{VOICE_PREVIEW_PATH\}\?\$\{q\.toString\(\)\}`/.test(btn) &&
      /return await p\.play\(bytes\);/.test(btn));
    check("  …while the sample plays the microphone is closed, and restored exactly as it was; the far side is silenced only when the sample does not travel its own stream",
      /const micWasOpen = !!session && !session\.isMuted\(\);\s*if \(micWasOpen\) session\.setMuted\(true\);/.test(btn) &&
      /const farWasMuted = far\?\.muted \?\? false;\s*if \(far && !viaCall\) far\.muted = true;/.test(btn) &&
      /finally \{\s*if \(far && !viaCall\) far\.muted = farWasMuted;\s*if \(micWasOpen && sessionRef\.current === session\) session\.setMuted\(false\);\s*\}/.test(btn) &&
      /onPreviewVoice=\{previewVoice\}\s*onStopPreview=\{stopPreview\}/.test(btn));
    check("  …and NO second audio context is opened under a live call: the socket lane's own audio plays the sample, the other lane borrows the tones' context; the standalone player only when there is no call",
      /const inCall = !!sessionRef\.current;\s*const player = inCall \? null : \(previewRef\.current \?\?= createPreviewPlayer\(browserPreviewContext\)\);/.test(btn) &&
      /const viaCall = session\?\.previewAudio\(bytes\) \?\? null;/.test(btn) && /if \(viaCall\) return await viaCall;/.test(btn) &&
      /const tones = tonesRef\.current\?\.context\(\) \?\? null;/.test(btn));
    const tt = fs30.readFileSync("src/lib/voice/text-turn.ts", "utf8");
    const { buildResponseRequest, VOICE_SWITCH_GREETING } = await import("../src/lib/voice/text-turn");
    check("a switched voice speaks first: the switch arms a greeting, the rebuilt call's ready sends ONE response request with instructions and no user turn, and the beacon names the lane",
      /greetOnReadyRef\.current = true;\s*setSwapping\(true\);/.test(btn) && /if \(greetOnReadyRef\.current\) \{\s*greetOnReadyRef\.current = false;\s*sessionRef\.current\?\.requestResponse\(VOICE_SWITCH_GREETING\);/.test(btn) &&
      /reason: "voice-switched", resumes: resumesRef\.current, lane: transportRef\.current/.test(btn) &&
      JSON.parse(buildResponseRequest(VOICE_SWITCH_GREETING)!).type === "response.create" && JSON.parse(buildResponseRequest(VOICE_SWITCH_GREETING)!).response.instructions === VOICE_SWITCH_GREETING &&
      buildResponseRequest("  ") === null && /language of the conversation so far/.test(VOICE_SWITCH_GREETING) && !/grok|xai|qwen/i.test(tt));
    check("on the sheet a tap is 'let me hear it' and a separate button is 'this one' — off until a voice other than the current has been heard; closing the sheet stops the sample",
      /const tapVoice = useCallback\(\(key: string\) => \{/.test(scr) && /void onPreviewVoice\(key\)\.then\(\(ok\) => \{/.test(scr) &&
      /disabled=\{!candidate \|\| candidate === selectedVoice\}/.test(scr) && /if \(!candidate \|\| candidate === selectedVoice\) return;\s*onSelectVoice\?\.\(candidate\);\s*closeVoiceSheet\(\);/.test(scr) &&
      /const closeVoiceSheet = useCallback\(\(\) => \{[\s\S]{0,200}?onStopPreview\?\.\(\);/.test(scr) &&
      /aria-pressed=\{chosen\}/.test(scr) && /const on = candidate \? v\.key === candidate : chosen;/.test(scr));
  }
}

{
  console.log("\n── 31. A call the page died under is found, reported and offered back; a beacon the network cannot carry waits ──");
  /* 2026-09-08: four "it closed by itself" exits with no line in the log.
     Two kinds: the page killed under the call (nothing can beacon from a
     dead page), and a beacon sent while the phone's network was down. */
  const cm = await import("../src/lib/voice/call-memory");
  const tm = await import("../src/lib/voice/telemetry");
  const { readFileSync } = await import("node:fs");
  {
    const store = new Map<string, string>();
    const like = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    const pulse = { at: 1_000_000, startedAt: 990_000, lane: "ws", voice: "v2", conversation: "c1", elapsed_ms: 10_000, events: "ping:3", last_event: "ping", ws_reconnects: 1, ws_close: "1006" };
    cm.writeCallPulse(like, pulse);
    check("a live call writes its pulse every five seconds, and a hang-up clears it", cm.CALL_PULSE_EVERY_MS === 5_000 && store.has(cm.CALL_PULSE_KEY) && (cm.clearCallPulse(like), !store.has(cm.CALL_PULSE_KEY)));
    cm.writeCallPulse(like, pulse);
    const found = cm.takeInterruptedCall(like, 1_000_000 + 20_000);
    check("the next load finds a recent pulse nobody cleared — the call the page died under — with its diagnostics, once",
      found?.lane === "ws" && found?.voice === "v2" && found?.ws_close === "1006" && found?.events === "ping:3" && cm.takeInterruptedCall(like, 1_000_000 + 20_000) === null);
    cm.writeCallPulse(like, pulse);
    check("  …a pulse older than forty-five seconds is a call long over, not reported; garbage is not reported", cm.INTERRUPTED_WITHIN_MS === 45_000 && cm.takeInterruptedCall(like, 1_000_000 + 60_000) === null && (like.setItem(cm.CALL_PULSE_KEY, "{not json"), cm.takeInterruptedCall(like, 0) === null));
  }
  {
    const store = new Map<string, string>();
    const like = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    const posted: string[] = [];
    for (let i = 0; i < 12; i++) tm.queueVoiceTelemetry({ reason: `r${i}` }, like);
    const queued = JSON.parse(store.get(tm.TELEMETRY_QUEUE_KEY) ?? "[]") as Array<{ reason: string; queued_at: number }>;
    check("a beacon queued offline is kept on the device with when it was made, ten at most, oldest dropped", queued.length === 10 && queued[0].reason === "r2" && typeof queued[0].queued_at === "number" && tm.TELEMETRY_QUEUE_MAX === 10);
    const sent = tm.flushVoiceTelemetry((_p, body) => posted.push(body), like);
    check("  …and flushed in order when the network is back, once", sent === 10 && posted.length === 10 && /"reason":"r2"/.test(posted[0]) && !store.has(tm.TELEMETRY_QUEUE_KEY) && tm.flushVoiceTelemetry((_p, body) => posted.push(body), like) === 0);
    const src = readFileSync("src/lib/voice/telemetry.ts", "utf8");
    check("  …sendVoiceTelemetry queues instead of posting while the browser says it is offline", /if \(typeof navigator !== "undefined" && navigator\.onLine === false\) \{\s*queueVoiceTelemetry\(t\);\s*return;\s*\}/.test(src));
  }
  {
    const btn = readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
    check("the button writes the pulse while live or reconnecting, clears it on release, and nudges the page's other sockets",
      /if \(state !== "live" && state !== "reconnecting"\) return;[\s\S]{0,900}?writeCallPulse\(store, \{/.test(btn) && /const t = window\.setInterval\(beat, CALL_PULSE_EVERY_MS\);/.test(btn) &&
      /clearCallPulse\(browserStorage\(\)/.test(btn) && /window\.dispatchEvent\(new Event\("kx-call-ended"\)\);/.test(btn));
    check("  …on load it flushes queued beacons, and a found pulse is beaconed as page-killed and told to the caller",
      /const flush = \(\) => flushVoiceTelemetry\(\);\s*flush\(\);\s*window\.addEventListener\("online", flush\);/.test(btn) &&
      /const dead = store \? takeInterruptedCall\(store\) : null;/.test(btn) && /reason: "page-killed",\s*lane: dead\.lane,/.test(btn) && /onErrorRef\.current\?\.\(INTERRUPTED_COPY\[langRef\.current\]\);/.test(btn) &&
      (["en", "zh", "ar"] as const).every((l) => new RegExp(`${l}: "[^"]{20,}"`).test(btn.slice(btn.indexOf("const INTERRUPTED_COPY"), btn.indexOf("const INTERRUPTED_COPY") + 600))));
    check("  …a resumed call is handed the microphone the lost one kept — and a microphone nobody resumes is released",
      /const keptMic = sessionRef\.current\?\.takeMicrophone\(\) \?\? null;\s*sessionRef\.current = null;\s*if \(keptMic && !canResume\) keptMic\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\);/.test(btn) &&
      /if \(kept && kept\.getAudioTracks\(\)\.some\(\(t\) => t\.readyState === "live"\)\) \{\s*deps\.getMicrophone = async \(\) => kept;/.test(btn));
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("NOT proved here: a real WebRTC negotiation. Node has no WebRTC — see the header.");
}

main().catch((e) => {
  /* An unexpected rejection must NAME the break. A mutation that removed the
     configuration send crashed this suite with a Node stack trace, which fails
     CI without telling anyone what regressed. */
  console.log(`  \u2717 the suite threw instead of asserting: ${e instanceof Error ? e.message : String(e)}`);
  console.log("\nFAILED:\n  \u00b7 an async section rejected — see above");
  process.exit(1);
});
