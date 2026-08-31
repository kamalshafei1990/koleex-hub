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

/* The only import this module has, and it is a pure one: no DOM, no network,
   no browser globals. Everything else arrives through VoiceDeps, which is
   what makes this file testable in Node at all. */
import {
  parseToolCallEvent,
  buildToolResultMessages,
  ToolCallNames,
  type VoiceToolCall,
} from "./tool-calls";

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
  /** A tool call was made and answered — for a UI that wants to say
   *  "checking…" rather than leaving a silence the caller cannot read. */
  onToolCall?: (name: string) => void;
  /** SOMETHING NAMED ITSELF A FUNCTION CALL AND COULD NOT BE READ.
   *
   *  This exists because the alternative is silence: if the vendor's event
   *  names differ from the protocol ones, the model asks to search, nothing
   *  happens, and it answers from memory sounding just as certain. A caller
   *  that logs this turns a wrong guess into something findable in a minute
   *  instead of a bug report about "the AI is out of date". */
  onToolProtocolMismatch?: (eventType: string) => void;
};

export type VoiceDeps = {
  createPeerConnection: () => RTCPeerConnection;
  getMicrophone: () => Promise<MediaStream>;
  fetchFn: typeof fetch;
  /** Test seam. Production uses the constant below. */
  iceTimeoutMs?: number;
  /** Test seam. Eight real seconds per assertion would make the recovery
   *  window the slowest thing in the suite, and a suite slow enough to skip
   *  proves nothing. */
  reconnectGraceMs?: number;
  /** Test seam for the per-call cap, so the loop guard can be proved without
   *  making a dozen round trips. */
  maxToolCallsPerSession?: number;
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
const MAX_TOOL_CALLS_PER_SESSION = 12;

/* HOW LONG A DROPPED CONNECTION MAY TRY TO COME BACK. `disconnected` is
   routinely transient — a handover between networks, a VPN re-establishing a
   tunnel — and WebRTC reconnects on its own without any help from us. Failing
   instantly would end calls that were about to recover; waiting forever leaves
   a user talking into a call that is never coming back. */
const RECONNECT_GRACE_MS = 8_000;

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
export const TOOL_PATH = "/api/ai/voice/tool";

export const HANDSHAKE_PATH = "/api/ai/voice/session";

export class VoiceSession {
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  /** The channel we opened. Step 3 sends session.update and tool results
   *  through it; nothing writes to it yet. */
  private channel: RTCDataChannel | null = null;
  /* The configuration is sent exactly once. Two triggers race to send it — the
     channel opening and `session.created` arriving — because the order of
     those two is the vendor's business and not something to depend on. */
  private configSent = false;
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
  private state: VoiceState = "idle";

  constructor(
    private readonly deps: VoiceDeps,
    private readonly events: VoiceEvents = {},
    /** Which voice to ask for. Opaque — this module never learns the vendor's
     *  own identifier, and cannot ask for one that was not offered. */
    private readonly voiceKey: string | null = null,
  ) {}

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
    /* TRACKS FIRST, and the order matters. Closing the peer connection does
       not stop a capture track; the recording light stays on and the browser
       keeps the device held. */
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    try {
      this.pc?.close();
    } catch {
      /* already closed — teardown must not throw over a cleanup detail */
    }
    this.pc = null;
    this.channel = null;
    if (this.state !== "failed") this.setState("ended");
  }

  /** Send the session configuration, at most once, and only on an open
   *  channel. A send on a connecting channel throws and would take the call
   *  down over a race that resolves itself a moment later. */
  private sendSessionConfig(channel: RTCDataChannel): void {
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
  private onChannelMessage(raw: string, channel: RTCDataChannel): void {
    if (!this.configSent && raw.includes("session.created")) {
      this.sendSessionConfig(channel);
    }
    this.events.onMessage?.(raw);

    /* UNTRUSTED. This came off a network socket and describes something the
       model wants done. Nothing is executed here: the name is relayed to the
       server, which decides against its own allow-list whether it may run. */
    const parsed = parseToolCallEvent(raw, this.toolNames);
    if (parsed.unreadable) {
      this.events.onToolProtocolMismatch?.(parsed.unreadable);
      return;
    }
    if (parsed.call) void this.runToolCall(parsed.call, channel);
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
  private async runToolCall(call: VoiceToolCall, channel: RTCDataChannel): Promise<void> {
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
        message: "That is as many lookups as one call can make. Ask again in a new call.",
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
        }),
      });
      if (!res.ok) {
        /* The route's own body is not forwarded: it is written for a screen,
           and on a refusal it may name a limit. The model gets something it
           can say. */
        output = { ok: false, message: "That lookup could not be completed just now." };
      } else {
        const body = (await res.json()) as { output?: unknown };
        output = body.output ?? { ok: false, message: "That lookup returned nothing." };
      }
    } catch {
      output = { ok: false, message: "That lookup could not be completed just now." };
    }

    this.sendToolResult(channel, call.callId, output);
  }

  /** Both protocol messages, in order, with the channel checked once. */
  private sendToolResult(channel: RTCDataChannel, callId: string, output: unknown): void {
    if (channel.readyState !== "open") return;
    for (const message of buildToolResultMessages(callId, output)) {
      try {
        channel.send(message);
      } catch {
        /* The call may have ended while the lookup was in flight. Nothing to
           recover: there is no longer anyone waiting for this answer. */
        return;
      }
    }
  }

  private armReconnectTimer(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      /* Still not back. A call that has been silent this long is over, and
         saying so beats leaving a live-looking screen in front of someone. */
      if (this.state === "reconnecting") this.fail("connection-lost");
    }, this.deps.reconnectGraceMs ?? RECONNECT_GRACE_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private fail(reason: VoiceFailure): void {
    this.clearReconnectTimer();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    try {
      this.pc?.close();
    } catch { /* see stop() */ }
    this.pc = null;
    this.channel = null;
    this.setState("failed", reason);
  }

  /** Open a call. Resolves when the handshake is applied, or after failing —
   *  the outcome is the STATE, not a thrown error, because every caller of
   *  this needs to render a reason rather than catch one. */
  async start(): Promise<void> {
    if (this.state === "connecting" || this.state === "live") return;

    this.setState("requesting-mic");
    try {
      this.mic = await this.deps.getMicrophone();
    } catch {
      /* A refused permission and a machine with no microphone are the same
         thing to the user: they cannot talk. */
      this.fail("no-microphone");
      return;
    }

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
          this.iceEverConnected = true;
          this.clearReconnectTimer();
          if (this.state === "reconnecting") this.setState("live");
        }
      };

      /* The assistant's voice. Handed out as a stream rather than played here,
         so this module stays testable and the UI owns the audio element. */
      pc.ontrack = (ev: RTCTrackEvent) => {
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
        /* A CONNECTED CALL IS A SILENT CALL UNTIL THIS IS SENT. */
        local.onopen = () => this.sendSessionConfig(local);
        local.onmessage = (m: MessageEvent) => {
          if (typeof m.data === "string") this.onChannelMessage(m.data, local);
        };
        /* Already open is possible in a test double and cheap to cover. */
        this.sendSessionConfig(local);
        this.channel = local;
      }
      /* The server may also open its own. Both are wired to the same handler
         rather than assuming which one carries the events. */
      pc.ondatachannel = (ev: RTCDataChannelEvent) => {
        const remote = ev.channel;
        remote.onopen = () => this.sendSessionConfig(remote);
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
      const path = this.voiceKey
        ? `${HANDSHAKE_PATH}?voice=${encodeURIComponent(this.voiceKey)}`
        : HANDSHAKE_PATH;
      const res = await this.deps.fetchFn(path, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        /* Read back from the connection, not from the offer object: the
           candidates were added to the local description, not to the value
           createOffer returned. */
        body: pc.localDescription?.sdp ?? offer.sdp ?? "",
        credentials: "include",
      });

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
        const env = body as { sdp?: unknown; session?: unknown; session_compact?: unknown };
        answer = typeof env.sdp === "string" ? env.sdp : "";
        /* Serialised here, once, so what goes on the wire is exactly what the
           server sent and this module never reshapes it. */
        if (env.session && typeof env.session === "object") {
          this.sessionUpdate = JSON.stringify(env.session);
        }
        if (env.session_compact && typeof env.session_compact === "object") {
          this.sessionUpdateCompact = JSON.stringify(env.session_compact);
        }
      } catch {
        this.fail("handshake-failed");
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

      /* The channel can have opened while the handshake was in flight, in
         which case its `onopen` already fired and found nothing to relay. */
      if (this.channel) this.sendSessionConfig(this.channel);
    } catch {
      this.fail("handshake-failed");
      return;
    }

    this.setState("live");
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
  };
}
