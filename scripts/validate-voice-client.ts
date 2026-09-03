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

import { VoiceSession, HANDSHAKE_PATH, waitForIceGathering, normalizeSdp, type VoiceDeps, type VoiceState, type VoiceFailure,
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
    ontrack: null,
    ondatachannel: null,
    oniceconnectionstatechange: null,
  } as unknown as RTCPeerConnection;
  /** Drive the connection the way a browser does: set the state, then notify. */
  const ice = (state: string) => {
    (pc as unknown as { iceConnectionState: string }).iceConnectionState = state;
    (pc as unknown as { oniceconnectionstatechange: (() => void) | null }).oniceconnectionstatechange?.();
  };
  return { pc, calls, ice };
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
}): { deps: VoiceDeps; mic: ReturnType<typeof fakeMic>; ice: (state: string) => void; pcCalls: { closed: number; added: number; remoteSdp: string; channels: string[]; sent: string[]; channel: FakeChannel | null; gathered: boolean; postedAfterGathering: boolean | null } } {
  const bodyReads: number[] = [];
  void bodyReads;
  const mic = fakeMic();
  const { pc, calls, ice } = fakePc({ iceState: opts.iceState, gatherLater: opts.gatherLater, channelOpen: opts.channelOpen, sendThrows: opts.sendThrows, maxMessageSize: opts.maxMessageSize, enforceLimit: opts.enforceLimit });
  return {
    mic,
    ice,
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
    check("unmount stops the session",
      /return \(\) => \{\s*sessionRef\.current\?\.stop\(\);/.test(src));
    check("that cleanup belongs to a mount-only effect, so it cannot re-run early",
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*sessionRef\.current\?\.stop\(\);[\s\S]{0,400}?\}, \[\]\);/.test(src));
    /* THE LAST TURN IS OFTEN STILL QUEUED WHEN THE SCREEN GOES. */
    check("  …and that same cleanup flushes the transcript writer",
      /return \(\) => \{\s*sessionRef\.current\?\.stop\(\);[\s\S]{0,300}?persisterRef\.current\?\.finish\(\);[\s\S]{0,120}?\}, \[\]\);/.test(src));

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
      /\{\(connected \|\| busy\) && typeof document !== "undefined" && createPortal\(/.test(src));
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
      /next === "failed"[\s\S]{0,400}?sessionRef\.current = null/.test(src));
    check("hanging up clears the handle too",
      /const hangUp[\s\S]{0,300}?sessionRef\.current = null/.test(src));
    check("starting twice is refused rather than leaking the first session",
      /if \(sessionRef\.current\) return;/.test(src));
    check("hanging up detaches the stream from the audio element",
      /audioRef\.current\.srcObject = null/.test(src));

    /* Autoplay can be refused even after a gesture. A rejected play() nobody
       reports is indistinguishable from a dead call. */
    check("a refused autoplay is reported rather than swallowed",
      /\.play\(\)\.catch\(\(\) => \{[\s\S]{0,200}?onErrorRef\.current/.test(src));

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
    const hangUpAt = btn.indexOf("const hangUp");
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
      /* The privacy obligation applies to this exit path like every other. */
      check("  …and the microphone is released", r.mic.allStopped());
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
      check("  …and the microphone is released", r.mic.allStopped());
    }

    /* 11e — hanging up during a wobble must take the timer with it. The user
       ended the call; nothing about it should still be scheduled. Counted for
       the same reason as 11b. */
    {
      const r = await run({ reconnectGraceMs: 5_000 });
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
      h.p.observe([L("user", "hello there", true), L("assistant", "hi", true)]);
      await h.p.flush();
      check("  …and later turns reuse it", h.ensured() === 1 && h.posts.length === 2);
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
      const many = Array.from({ length: MAX_TURNS_PER_POST + 5 }, (_, i) => L(i % 2 ? "assistant" : "user", `t${i}`, true));
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
  check("ready is set by the session's onReady", /onReady: \(\) => setReady\(true\)/.test(btn));
  check("  …with a fallback timer so a silent vendor cannot leave the call on connecting",
    /if \(!live \|\| ready\) return;\s*const t = window\.setTimeout\(\(\) => setReady\(true\), READY_FALLBACK_MS\);/.test(btn) && /const READY_FALLBACK_MS = 2_500;/.test(btn));
  check("the tone plays once, when live AND ready, guarded by a ref so a re-render cannot repeat it",
    /if \(live && ready && !chimedRef\.current\) \{\s*chimedRef\.current = true;\s*tonesRef\.current\?\.ready\(\);/.test(btn));
  check("  …and a recovered connection plays its own single note", /prev === "reconnecting" && state === "live"\) tonesRef\.current\?\.recovered\(\)/.test(btn));
  const hangUpAt16 = btn.indexOf("const hangUp");
  const hangUpBody = btn.slice(hangUpAt16, btn.indexOf("}, [", hangUpAt16));
  check("hanging up closes the tone context and resets ready", /tonesRef\.current\?\.close\(\)/.test(hangUpBody) && /setReady\(false\)/.test(hangUpBody) && /chimedRef\.current = false/.test(hangUpBody));
  check("  …and so does unmount", /persisterRef\.current = null;\s*tonesRef\.current\?\.close\(\);\s*tonesRef\.current = null;\s*\};\s*\}, \[\]\);/.test(btn));
  check("the screen is told ready separately from live", /ready=\{ready\}/.test(btn));
  const scr = fs16.readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the screen says connecting until READY, not merely live", /: !live \|\| !ready\s*\? copy\.connecting/.test(scr));
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
    r.pcCalls.channel?.open();
    const sentBefore = r.pcCalls.sent.length;
    check("  …and the configuration went out on the first channel", sentBefore === 1 && /session\.update/.test(r.pcCalls.sent[0]));
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
    check("  …and the microphone is released then", r.mic.allStopped());
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
  check("the call screen is two parts: a fixed-height top for the orb, a scrolling bottom for the words",
    /h-\[42dvh\] min-h-\[300px\][^"]*border-b border-white\/10/.test(scr) && /<VoiceTranscript lines=\{lines\} lang=\{lang\} className="flex-1 min-h-0 pb-4" fill \/>/.test(scr));
  check("  …and a lookup is shown on the orb itself, as THINKING (not processing's rim arc) with the searching activity",
    /: searching && !muted\s*\? "thinking"/.test(scr) && /activity=\{searching && live && !muted \? "searching" : "none"\}/.test(scr));
  check("  …and on the rings: slow blue waves while a lookup runs, transform and opacity only",
    /searching && live && !muted \? "is-thinking" : ""/.test(scr) &&
    /\.kx-call-orb\.is-thinking \.kx-call-ring \{\s*border-color: rgba\(0, 102, 255[^}]*animation: kx-call-think/.test(css18) &&
    /@keyframes kx-call-think \{\s*0% \{ transform: scale\([\d.]+\); opacity: [\d.]+; \}\s*100% \{ transform: scale\([\d.]+\); opacity: 0; \}/.test(css18) &&
    /\.kx-call-orb\.is-thinking \.kx-call-ring-3 \{ animation-delay: 1\.6s; \}/.test(css18));
  check("  …reduced motion stills the waves and leaves one quiet ring", /prefers-reduced-motion: reduce\) \{[^}]*animation: none !important/.test(css18) && /\.kx-call-orb\.is-thinking \.kx-call-ring-1 \{ opacity: 0\.35; \}/.test(css18));
  check("the wordmark stands above the orb in the top part, white, 24px on the grid",
    /import KoleexLogo from "@\/components\/layout\/KoleexLogo";/.test(scr) && /<KoleexLogo className="h-6 w-auto shrink-0 text-white" \/>/.test(scr) && scr.indexOf("<KoleexLogo") < scr.indexOf("ref={orbWrapRef}"));
  check("a lookup's photo goes through the image pipeline at 384px, eagerly, with its box reserved",
    (() => { const m = scr.match(/<img\s[^>]*src=\{cdnImage\(p\.url, \{ width: 384, quality: 75, resize: "contain" \}\)\}[^>]*\/>/); return m !== null && !/loading=/.test(m[0]) && /width=\{160\}\s*height=\{160\}/.test(m[0]) && /fetchPriority="high"/.test(m[0]); })());
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
  check("  …the labels read in their own script", stt.STT_LANG_LABELS.ar === "عربي" && stt.STT_LANG_LABELS.zh === "中文" && stt.STT_LANG_LABELS.en === "English");
  const btn18 = fs18.readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the session is given the SPEAKING language, never the UI language, as the transcription hint",
    /\}, voiceKeyRef\.current, conversationIdRef\.current, sttLangRef\.current\);/.test(btn18) && !/conversationIdRef\.current, langRef\.current\)/.test(btn18));
  check("  …read from the device after mount (saved choice, device language, UI language), so first render matches the server",
    /pickSttLang\(readSavedSttLang\(\), typeof navigator !== "undefined" \? navigator\.language : null, lang\)/.test(btn18));
  check("  …changing it saves the choice and restarts the call, exactly as a voice change does",
    /const selectSttLang = useCallback\(\(next: SttLang\) => \{\s*saveSttLang\(next\);\s*setSttLang\(next\);\s*sttLangRef\.current = next;\s*if \(sessionRef\.current\) \{\s*hangUp\(\);\s*queueMicrotask\(\(\) => void startCallRef\.current\?\.\(\)\);/.test(btn18) &&
    /sttLanguage=\{sttLang\}\s*onSelectSttLanguage=\{selectSttLang\}/.test(btn18));
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
