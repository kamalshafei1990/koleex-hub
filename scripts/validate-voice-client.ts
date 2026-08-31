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

import { VoiceSession, HANDSHAKE_PATH, type VoiceDeps, type VoiceState, type VoiceFailure } from "../src/lib/voice/session";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}

const ANSWER = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n";

/** A microphone whose tracks record whether they were stopped. */
function fakeMic() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; }, kind: "audio" }];
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    allStopped: () => tracks.every((t) => t.stopped),
  };
}

function fakePc() {
  const calls = { closed: 0, added: 0 };
  const pc = {
    addTrack: () => { calls.added++; },
    createOffer: async () => ({ type: "offer", sdp: "v=0\r\nOFFER\r\n" }),
    setLocalDescription: async () => {},
    setRemoteDescription: async () => {},
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
}): { deps: VoiceDeps; mic: ReturnType<typeof fakeMic>; pcCalls: { closed: number; added: number } } {
  const mic = fakeMic();
  const { pc, calls } = fakePc();
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
      fetchFn: (async (url: string, init?: RequestInit) => {
        opts.recorded?.push({ url: String(url), init });
        return {
          ok: (opts.status ?? 200) < 400,
          status: opts.status ?? 200,
          text: async () => opts.body ?? ANSWER,
        } as Response;
      }) as unknown as typeof fetch,
    },
  };
}

async function run(opts: Parameters<typeof deps>[0]) {
  const d = deps(opts);
  const states: Array<[VoiceState, VoiceFailure | undefined]> = [];
  const s = new VoiceSession(d.deps, { onState: (st, f) => states.push([st, f]) });
  await s.start();
  return { session: s, states, ...d };
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
    check("the body is the generated offer, unmodified", recorded[0].init?.body === "v=0\r\nOFFER\r\n");
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

  console.log("\n── 4. The module cannot be pointed anywhere else ──");
  {
    const src = (await import("node:fs")).readFileSync("src/lib/voice/session.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    check("the handshake path is a constant, not an argument",
      /export const HANDSHAKE_PATH = "\/api\/ai\/voice\/session"/.test(code) &&
      /fetchFn\(HANDSHAKE_PATH,/.test(code));
    /* Vendor identity has no field to arrive in, and the absence is the check. */
    check("no vendor concept appears anywhere in the client",
      !/dashscope|aliyun|qwen|api[_-]?key|Bearer/i.test(code));
    check("it asks for audio only — no second permission prompt for a camera",
      /video: false/.test(code) && /audio: \{/.test(code));
    check("teardown stops tracks before closing the connection, not after",
      code.indexOf("getTracks().forEach((t) => t.stop())") < code.indexOf("this.pc?.close()"));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("NOT proved here: a real WebRTC negotiation. Node has no WebRTC — see the header.");
}

main();
