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
  /** One decoded DataChannel message. Tool calls arrive here; step 3 handles
   *  them. Passed through untouched — this module does not interpret them. */
  onMessage?: (data: string) => void;
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
  private state: VoiceState = "idle";

  constructor(
    private readonly deps: VoiceDeps,
    private readonly events: VoiceEvents = {},
    /** Which voice to ask for. Opaque — this module never learns the vendor's
     *  own identifier, and cannot ask for one that was not offered. */
    private readonly voiceKey: string | null = null,
  ) {}

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
          this.clearReconnectTimer();
          this.fail("connection-lost");
          return;
        }
        if (st === "connected" || st === "completed") {
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
