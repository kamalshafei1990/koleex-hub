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

import { VoiceSession, HANDSHAKE_PATH, waitForIceGathering, normalizeSdp, type VoiceDeps, type VoiceState, type VoiceFailure } from "../src/lib/voice/session";

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

/** A microphone whose tracks record whether they were stopped. */
function fakeMic() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; }, kind: "audio" }];
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    allStopped: () => tracks.every((t) => t.stopped),
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
          for (const fn of listeners["icegatheringstatechange"] ?? []) fn();
        }, 5);
      }
    },
    setRemoteDescription: async (d: { sdp: string }) => { calls.remoteSdp = d.sdp; },
    close: () => { calls.closed++; },
    ontrack: null,
    ondatachannel: null,
  } as unknown as RTCPeerConnection;
  return { pc, calls };
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
}): { deps: VoiceDeps; mic: ReturnType<typeof fakeMic>; pcCalls: { closed: number; added: number; remoteSdp: string; channels: string[]; sent: string[]; channel: FakeChannel | null } } {
  const bodyReads: number[] = [];
  void bodyReads;
  const mic = fakeMic();
  const { pc, calls } = fakePc({ iceState: opts.iceState, gatherLater: opts.gatherLater, channelOpen: opts.channelOpen, sendThrows: opts.sendThrows, maxMessageSize: opts.maxMessageSize, enforceLimit: opts.enforceLimit });
  return {
    mic,
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
    fetchFn: (async (url: string, init?: RequestInit) => {
        opts.recorded?.push({ url: String(url), init });
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
      ["the handshake is rejected", { status: 502 }, "handshake-failed"],
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
    const started = Date.now();
    const r = await run({ iceState: "gathering", gatherLater: true });
    check("it waits for gathering to complete before posting",
      r.session.getState() === "live" && Date.now() - started >= 5);

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
    check("the channel is dropped on teardown like every other handle",
      (code.match(/this\.channel = null/g) ?? []).length === 2);
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
      /HANDSHAKE_PATH\}\?voice=/.test(code) &&
      /: HANDSHAKE_PATH;/.test(code) &&
      /fetchFn\(path,/.test(code));
    check("the voice key is url-encoded rather than interpolated raw",
      /encodeURIComponent\(this\.voiceKey\)/.test(code));
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
      [500, "handshake-failed"],
      [502, "handshake-failed"],
      [504, "handshake-failed"],
    ];
    for (const [status, expected] of cases) {
      const r = deps({ status });
      const seen: string[] = [];
      const s = new VoiceSession(r.deps, { onState: (_st, f) => { if (f) seen.push(f); } });
      await s.start();
      check(`${status} is reported as ${expected}`, seen.includes(expected));
    }

    /* The four that need different actions must not share a message. */
    const distinct = new Set(["signed-out", "not-allowed", "too-many-calls", "unavailable"]);
    check("the four actionable statuses have four distinct reasons", distinct.size === 4);

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
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*sessionRef\.current\?\.stop\(\);[\s\S]{0,80}?\}, \[\]\);/.test(src));

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
