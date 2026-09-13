/* ---------------------------------------------------------------------------
   voice/ws-audio — the microphone in, the voice out, over a socket.

   On the WebRTC lane the browser carries audio itself: an Opus track each
   way, decoded and played by the engine. On the WebSocket lane the audio is
   PCM16 frames inside JSON messages, so this module does what the engine
   did: read the microphone and cut it into frames, and turn the frames
   that come back into sound.

   THE SOUND GOES STRAIGHT TO THE SPEAKER (2026-09-12 evening, the owner
   after two rounds of fixes: "crackling while it talks — nothing changed",
   with the beacon reading ZERO buffer underruns at a 450 ms lead, so the
   buffer was not the crackle). Until then the far side was rendered into a
   MediaStreamAudioDestinationNode and that stream was played by the call
   button's <audio> element: a second clock domain, a second buffer, and
   on Apple's engine a known source of clicks — the more so with a context
   running at the wire's 24 kHz against 48 kHz hardware. Now the far bus
   connects to the context's own destination; the element is handed a
   stream that carries nothing, so the button's wiring stands, and the
   barge-in gate reaches this lane through `mute()` instead of the element.

   AND THE CONTEXT RUNS AT THE ENGINE'S OWN RATE AGAIN. The wire is 24 kHz;
   the frames are resampled here, CONTINUOUSLY — one resampler carries its
   position and its last sample from frame to frame, so the joints are
   seamless (the per-buffer resampling of the first version, which forgot
   the previous frame at every joint, was the "pulses" of the morning). The
   microphone goes the other way through the same kind of resampler.

   A JITTER BUFFER, BECAUSE THE VOICE ARRIVED CHOPPED (owner, 2026-09-07
   18:10: "the voice of Grok not so stable"; 19:05: still "a strange voice").
   Frames come down a socket across a VPN and a border, in bursts and with
   gaps, and the first frame of an answer is small and early. Playing each
   frame as it landed made every wire gap a gap in the voice and every
   answer start as a blip, a silence, then the sentence. Now an answer is
   GATHERED before it plays — a third of a second of sound, or whatever has
   arrived after a third of a second — and then plays back to back; a run
   that still drains mid-answer grows the gathering for the rest of the call,
   up to a ceiling. And since 2026-09-12 night the far side is ONE stream —
   a ring on the audio thread the engine pulls from, never a node per frame
   (the crackle that survived four attempts was the seam between frames).
   The gate is PlayoutGate, the ring PcmRing, both pure and tested.

   THE MICROPHONE IS READ OFF THE MAIN THREAD when the engine allows it.
   A ScriptProcessorNode runs on the main thread, and the main thread of
   this page is busy — transcript renders, pictures decoding — so its
   callbacks were skipped under load and the far side heard holes in the
   caller's words. An AudioWorklet runs on the audio thread and posts the
   frames across; the module is loaded from a blob URL so it needs no
   second file in the bundle. Engines without a worklet (or a page whose
   policy refuses the blob) fall back to the processor, which is what this
   lane shipped with. Both paths cut frames of 4096 samples at the
   context's own rate, resampled to the wire rate here — an engine's rate is
   the engine's business (48 k on most phones), the wire's is the vendor's.

   No network, no session state: sound in, frames out, frames in, sound out.
   Injectable, so the suite drives the session with a double.
   --------------------------------------------------------------------------- */

import { rmsLevel } from "./level";

export type WsAudio = {
  /** The far side, as a stream the UI can attach and meter. */
  readonly stream: MediaStream;
  /** Start reading the microphone; each frame is PCM16 at the wire rate,
   *  base64, ready for `input_audio_buffer.append`. */
  startCapture(mic: MediaStream, onFrame: (b64: string) => void): void;
  /** One frame from the far side: PCM16 at the wire rate, base64. */
  play(b64: string): void;
  /** Drop everything queued (barge-in). */
  flush(): void;
  /** The barge-in gate: silence the far side's output (the answer being
   *  cancelled still has frames in flight) or let it through again. */
  mute?(on: boolean): void;
  /** Release the microphone reader and the output. */
  close(): void;
  /** A VOICE SAMPLE THROUGH THIS SAME CONTEXT (owner, 2026-09-07 night:
   *  "when I talk it has a noise"). The sample player used to open its own
   *  AudioContext beside this one; on a phone a second context started
   *  mid-call re-negotiates the audio hardware, and the first context's
   *  microphone reader went on at a rate that was no longer the hardware's
   *  — the far side transcribed "[noise]". So a sample decodes and plays
   *  here, through the same output the voice uses. Resolves when it ended;
   *  false when it could not be decoded or was stopped. */
  playSample(bytes: ArrayBuffer): Promise<boolean>;
  /** HOW LOUD, BOTH WAYS, FROM THIS CONTEXT (2026-09-08). The orb's meters
   *  used to open their own AudioContext over the microphone; on a phone
   *  that garbled this context's reader. Two analysers here, one on the
   *  microphone, one on everything played, read on demand. 0..1 each. */
  levels(): { mic: number; far: number };
  /** WHAT THE MICROPHONE READER DID (2026-09-09 03:09: two calls from a
   *  phone opened their socket, were configured, and sent NOT ONE frame of
   *  audio in fourteen seconds — the relay's log read `up=1`, and the beacon
   *  could not say whether the reader never started, ran on a suspended
   *  context, or read a track that was silent). Which reader took the
   *  microphone, how many frames it handed out, the loudest sample it saw,
   *  and the context's state and rate — for the beacon, at hang-up. */
  stats(): WsAudioStats;
  /** The far side finished an answer: whatever is still gathered plays now.
   *  Without this the last frames of a short tail waited out the gathering
   *  timer and came out glued to the NEXT answer — "it swallows the last
   *  letter and says it when the result comes" (owner, 2026-09-12). */
  endOfResponse?(): void;
};

export type WsAudioStats = {
  /** "worklet" | "processor" | "processor-after-stall" | "none" | "failed"
   *  — none until startCapture, failed when both readers refused,
   *  processor-after-stall when the worklet read nothing and the processor
   *  took the microphone (CAPTURE_STALL_MS). */
  path: string;
  frames: number;
  /** 0..1, the loudest absolute sample across every frame handed out. */
  peak: number;
  ctx: string;
  rate: number;
  /** The context's state right after the reader started and resume() came
   *  back ("running", "suspended", "resume-failed"); "" before then. The
   *  state at hang-up is ctx — the hang-up tap itself may have resumed a
   *  context that sat suspended for the whole call. */
  start: string;
  /** Both readers were given the microphone and neither read a frame. */
  stalled: boolean;
  /** The far side's jitter buffer: how many times it ran dry (each one an
   *  audible gap) and the depth it settled at, in ms. Absent on a runtime
   *  without a buffer. */
  underruns?: number;
  bufferMs?: number;
  /** "worklet" | "processor" | "pending" | "failed": what plays the far
   *  side — pending until the worklet module loaded, failed when neither
   *  path could be built (the beacon carries it). */
  playout?: string;
};

/** A reader that has read NOTHING this long after it started is judged
 *  stalled (2026-09-10 17:22, a phone in mainland China, no VPN: worklet
 *  reader started, context "running", track live and unmuted, and zero
 *  frames in twelve seconds — twice; the same phone through a VPN read 1512
 *  frames a minute earlier). The context is resumed again and the other
 *  reader takes the microphone; a second silence is reported as stalled. */
export const CAPTURE_STALL_MS = 2_500;

/* Linear resampling — a phone microphone into a speech model does not need
   better, and better would cost a filter on every frame. Pure. */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

/**
 * A resampler that remembers where it was. Frames of a stream go through
 * ONE instance: it keeps the fractional read position and the last input
 * sample across calls, so the output is the same continuous signal it
 * would be for the whole stream at once — no discontinuity at frame
 * joints. Linear interpolation, like `resample`. Pure per instance.
 */
export class StreamResampler {
  private pos = 0;
  private last = 0;
  private primed = false;
  constructor(private readonly fromRate: number, private readonly toRate: number) {}
  get ratio(): number {
    return this.fromRate / this.toRate;
  }
  process(input: Float32Array): Float32Array {
    if (this.fromRate === this.toRate) return input;
    if (input.length === 0) return input;
    const ratio = this.ratio;
    /* Positions are counted in INPUT samples, relative to an input made of
       the last sample of the previous frame followed by this frame. */
    const ext = new Float32Array(input.length + 1);
    ext[0] = this.primed ? this.last : input[0];
    ext.set(input, 1);
    const out: number[] = [];
    /* `pos` is where the next output sample falls in `ext`; while it is
       inside this frame (strictly before the last input sample's slot) both
       neighbours exist. What is left over — always in [0, ratio) — is where
       the next frame starts. (A frame of ONE sample used to leave a negative
       position behind and the next frame read before the array: a NaN, a
       click.) */
    let pos = this.pos;
    while (pos < input.length) {
      const i0 = Math.floor(pos);
      const t = pos - i0;
      out.push(ext[i0] * (1 - t) + ext[i0 + 1] * t);
      pos += ratio;
    }
    this.pos = pos - input.length;
    this.last = input[input.length - 1];
    this.primed = true;
    return Float32Array.from(out);
  }
}

/** Float samples (-1..1) to little-endian PCM16 bytes. Pure. */
export function floatToPcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

/** Little-endian PCM16 bytes to float samples. Pure. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength - (bytes.byteLength % 2));
  const n = view.byteLength / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

/* base64 without atob/btoa string tricks on large buffers: chunked, so a
   long answer cannot blow the argument list. */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── The playout ────────────────────────────────────────────────────────── */

/** How much of an answer is gathered before its first sample plays.
 *  (Owner, 2026-09-12 evening: "crackling and cuts while it talks, VPN or
 *  not" — a China path jitters by hundreds of ms; a third of a second of
 *  lead drained mid-sentence again and again. Half a second is the price
 *  of a sentence that plays whole.) */
export const PREBUFFER_S = 0.45;
/** How much the gathering grows each time the ring still runs dry mid-answer. */
export const PREBUFFER_STEP_S = 0.15;
/** The most delay a rough network can buy itself. */
export const PREBUFFER_MAX_S = 1.2;
/** A short answer ("Yes.") never fills the gathering: whatever has arrived
 *  plays after this long regardless — the guard for a vendor whose
 *  end-of-answer event never comes. */
export const PREBUFFER_WAIT_MS = 350;
/** After the ring ran dry mid-answer, the gathering waits for its (grown)
 *  target plus this much before playing what it has. A wait as short as
 *  PREBUFFER_WAIT_MS let the frames out before the lead was rebuilt, and
 *  the target's growth bought nothing. */
export const REGATHER_EXTRA_MS = 250;
/** The script processor's block, when there is no worklet: ~43 ms at 48 kHz. */
export const PLAYOUT_PROCESSOR_SAMPLES = 2048;

/**
 * ONE CONTINUOUS STREAM (owner, 2026-09-12 night, the fourth "nothing fixed,
 * everything is the same" — on a build the beacon proved live: rate 48000,
 * two dry runs in 78 s, the lead at 750 ms). Every attempt before this one
 * played each frame of the far side as its own AudioBufferSourceNode started
 * at a computed time — at the wire's rate, at the engine's rate, through a
 * stream, straight to the destination — and the crackle survived them all:
 * the one thing they shared. A start time is honoured by the engine's
 * scheduler, on some engines to the render quantum and not the sample; two
 * hundred starts a minute are two hundred seams. Now the far side is ONE
 * stream: its samples go into a ring on the audio thread (a worklet, or the
 * script processor where there is none) and the engine pulls from the ring
 * every quantum, so there is nothing to seam. The ring reports the moment it
 * runs dry and holds until told to go on. This gate, on the main thread,
 * decides when the ring may play: gather PREBUFFER_S of an answer first (or
 * PREBUFFER_WAIT_MS, or the answer's end), then open; a dry ring inside an
 * answer is an UNDERRUN — the target grows a step and the ring gathers
 * again; a dry ring after the answer's end is the answer over. Pure given
 * its deps; the suite drives it with a fake ring and a fake clock.
 */
export type PlayoutDeps = {
  /** Let the ring play (true) or hold what it has (false). */
  gate(open: boolean): void;
  /** Empty the ring and begin generation `gen`: a report carrying an older
   *  generation is from before the flush and is ignored. */
  flush(gen: number): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
};
export type PlayoutPhase = "idle" | "gathering" | "playing";

export class PlayoutGate {
  target = PREBUFFER_S;
  underruns = 0;
  /* Samples pushed and consumed since the last flush: exact while the ring
     holds (it consumes nothing then), which is the only time they decide. */
  private pushed = 0;
  private consumed = 0;
  private gen = 0;
  private state: PlayoutPhase = "idle";
  private answerOpen = false;
  private timer: unknown = null;

  constructor(private readonly deps: PlayoutDeps, private readonly rate: number) {}

  get phase(): PlayoutPhase {
    return this.state;
  }
  get generation(): number {
    return this.gen;
  }
  /** Seconds held and not yet played (exact while gathering). */
  get buffered(): number {
    return Math.max(0, this.pushed - this.consumed) / this.rate;
  }

  /** `samples` more are in the ring. */
  push(samples: number): void {
    this.pushed += samples;
    this.answerOpen = true;
    if (this.state === "playing") return;
    if (this.state === "idle") this.state = "gathering";
    if (this.buffered >= this.target) this.open();
    else this.arm(PREBUFFER_WAIT_MS);
  }

  /** The ring ran dry — and holds until opened again. */
  onDry(gen: number, consumed: number): void {
    if (gen !== this.gen) return;
    this.consumed = consumed;
    if (this.state !== "playing") return;
    if (!this.answerOpen) {
      this.state = "idle";
      return;
    }
    this.underruns++;
    this.target = Math.min(PREBUFFER_MAX_S, this.target + PREBUFFER_STEP_S);
    this.state = "gathering";
    if (this.buffered >= this.target) this.open();
    else this.arm(Math.round(this.target * 1000) + REGATHER_EXTRA_MS);
  }

  /** The far side finished the answer: what is gathered plays now. */
  endOfResponse(): void {
    this.answerOpen = false;
    if (this.state === "gathering") this.open();
  }

  /** Drop everything (barge-in); the target the call settled on is kept. */
  flush(): void {
    this.disarm();
    this.gen++;
    this.state = "idle";
    this.answerOpen = false;
    this.pushed = 0;
    this.consumed = 0;
    this.deps.flush(this.gen);
  }

  private open(): void {
    this.disarm();
    if (this.state !== "gathering") return;
    this.state = "playing";
    this.deps.gate(true);
  }
  private arm(ms: number): void {
    if (this.timer !== null) return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      this.open();
    }, ms);
  }
  private disarm(): void {
    if (this.timer === null) return;
    this.deps.clearTimer(this.timer);
    this.timer = null;
  }
}

/** What the ring tells the gate. */
export type RingReport = { type: "dry"; gen: number; consumed: number };

/** The ring itself, as the script-processor path runs it on this thread —
 *  the worklet below is the same logic on the audio thread. Frames queue
 *  whole; `pull` fills a block from them while open and silence where it
 *  has nothing; running out while open is reported ONCE and the ring holds
 *  (open again is the gate's decision). Pure. */
export class PcmRing {
  private chunks: Float32Array[] = [];
  private head = 0;
  private open = false;
  private gen = 0;
  private consumed = 0;
  held = 0;

  constructor(private readonly report: (r: RingReport) => void) {}

  push(frame: Float32Array): void {
    this.chunks.push(frame);
    this.held += frame.length;
  }
  gate(open: boolean): void {
    this.open = open;
  }
  flush(gen: number): void {
    this.chunks = [];
    this.head = 0;
    this.held = 0;
    this.open = false;
    this.gen = gen;
    this.consumed = 0;
  }
  pull(out: Float32Array): void {
    let i = 0;
    if (this.open) {
      while (i < out.length && this.chunks.length > 0) {
        const c = this.chunks[0];
        const take = Math.min(out.length - i, c.length - this.head);
        out.set(c.subarray(this.head, this.head + take), i);
        i += take;
        this.head += take;
        this.consumed += take;
        this.held -= take;
        if (this.head === c.length) {
          this.chunks.shift();
          this.head = 0;
        }
      }
      if (i < out.length) {
        this.open = false;
        this.report({ type: "dry", gen: this.gen, consumed: this.consumed });
      }
    }
    out.fill(0, i);
  }
}

/** The ring, as a worklet: PcmRing above, in the engine's own thread. The
 *  main thread posts frames (transferred), `{cmd:"gate",open}` and
 *  `{cmd:"flush",gen}`; the ring posts `{type:"dry",gen,consumed}`. */
export const PLAYOUT_WORKLET_NAME = "koleex-playout";
export const PLAYOUT_WORKLET_SOURCE = `
class KoleexPlayout extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.head = 0;
    this.open = false;
    this.gen = 0;
    this.consumed = 0;
    this.port.onmessage = (ev) => {
      const m = ev.data;
      if (m instanceof Float32Array) { this.chunks.push(m); return; }
      if (!m || typeof m !== "object") return;
      if (m.cmd === "gate") { this.open = !!m.open; return; }
      if (m.cmd === "flush") { this.chunks = []; this.head = 0; this.open = false; this.gen = m.gen | 0; this.consumed = 0; }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let i = 0;
    if (this.open) {
      while (i < out.length && this.chunks.length > 0) {
        const c = this.chunks[0];
        const take = Math.min(out.length - i, c.length - this.head);
        out.set(c.subarray(this.head, this.head + take), i);
        i += take;
        this.head += take;
        this.consumed += take;
        if (this.head === c.length) { this.chunks.shift(); this.head = 0; }
      }
      if (i < out.length) {
        this.open = false;
        this.port.postMessage({ type: "dry", gen: this.gen, consumed: this.consumed });
      }
    }
    out.fill(0, i);
    return true;
  }
}
registerProcessor("${PLAYOUT_WORKLET_NAME}", KoleexPlayout);
`;

/* ── Capture ────────────────────────────────────────────────────────────── */

export const FRAME_SAMPLES = 4096;
/** The meters' window: ~11 ms at 48 kHz. */
export const METER_FFT_SIZE = 512;

/** The worklet, as source. It collects the input into frames of
 *  FRAME_SAMPLES and posts each as a Float32Array (transferred, not
 *  copied). Nothing else happens on the audio thread. */
export const CAPTURE_WORKLET_SOURCE = `
class KoleexCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(${FRAME_SAMPLES});
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const take = Math.min(ch.length - i, this.buf.length - this.n);
      this.buf.set(ch.subarray(i, i + take), this.n);
      this.n += take;
      i += take;
      if (this.n === this.buf.length) {
        const out = this.buf;
        this.port.postMessage(out, [out.buffer]);
        this.buf = new Float32Array(${FRAME_SAMPLES});
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("koleex-capture", KoleexCapture);
`;
export const CAPTURE_WORKLET_NAME = "koleex-capture";

/** The browser implementation. Created on a user gesture — the call
 *  button's tap — so the context is allowed to run. */
export function createBrowserWsAudio(wireRate: number, opts: { stallMs?: number } = {}): WsAudio {
  const stallMs = opts.stallMs ?? CAPTURE_STALL_MS;
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  /* THE CONTEXT RUNS AT THE ENGINE'S OWN RATE (2026-09-12 evening). The
     morning's context at the wire's 24 kHz put 24 against 48 kHz hardware
     on Apple's engine; the frames are bridged here instead, by one
     continuous resampler each way (StreamResampler), and the engine never
     resamples its output. stats() carries the rate the beacon reads. */
  const ctx: AudioContext = new Ctx();
  /* The element still gets a stream (the button's wiring stands); it
     carries nothing — the voice goes to the destination below. */
  const out = ctx.createMediaStreamDestination();
  const down = new StreamResampler(wireRate, ctx.sampleRate);
  const up = new StreamResampler(ctx.sampleRate, wireRate);
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let silence: GainNode | null = null;
  let capturing = false;
  let closed = false;
  let capturePath = "none";
  let frames = 0;
  let peak = 0;
  let startState = "";
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let sample: { node: AudioBufferSourceNode; stop: () => void } | null = null;
  /* THE FAR SIDE GOES THROUGH A BUS, and the meter hangs off the bus — NOT
     off the destination. A MediaStreamAudioDestinationNode has NO outputs,
     and `out.connect(analyser)` throws IndexSizeError in every browser. That
     one line (2026-09-08 03:25, the meters change) threw out of this
     factory, which threw out of the socket lane's dial after its socket
     was created and BEFORE its handlers were attached: the socket opened,
     the far side spoke, nothing was heard and nothing was sent, and the
     screen said "Still connecting" for as long as anyone waited — from a
     phone and a Mac, through a VPN and without one (the relay's log:
     `upstream open … down=3 up=0`). The Node fakes had a `connect` on the
     destination, so no suite caught it. Everything that plays connects to
     the bus; the bus feeds the destination and the meter. */
  const farBus = ctx.createGain();
  farBus.connect(ctx.destination);
  const farMeter = ctx.createAnalyser();
  farMeter.fftSize = METER_FFT_SIZE;
  farBus.connect(farMeter);
  let micMeter: AnalyserNode | null = null;
  const meterBuf = new Uint8Array(METER_FFT_SIZE);
  const read = (a: AnalyserNode | null): number => {
    if (!a) return 0;
    a.getByteTimeDomainData(meterBuf);
    return rmsLevel(meterBuf);
  };
  /* THE FAR SIDE'S RING (see PlayoutGate). The worklet is loaded from a
     blob at build time; frames that arrive before it is up wait in `early`
     and the gate's decision waits with them; the script processor takes
     the ring on an engine without worklets. */
  type Sink = { push(f: Float32Array): void; gate(open: boolean): void; flush(gen: number): void; close(): void };
  let sink: Sink | null = null;
  let playoutPath = "pending";
  const early: Float32Array[] = [];
  let wantOpen = false;
  let wantGen = 0;
  const gate = new PlayoutGate({
    gate: (open) => {
      wantOpen = open;
      sink?.gate(open);
    },
    flush: (gen) => {
      early.length = 0;
      wantGen = gen;
      wantOpen = false;
      sink?.flush(gen);
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  }, ctx.sampleRate);
  const attachSink = (s: Sink) => {
    sink = s;
    s.flush(wantGen);
    for (const f of early) s.push(f);
    early.length = 0;
    s.gate(wantOpen);
  };
  const workletSink = (node: AudioWorkletNode): Sink => ({
    push: (f) => node.port.postMessage(f, [f.buffer]),
    gate: (open) => node.port.postMessage({ cmd: "gate", open }),
    flush: (gen) => node.port.postMessage({ cmd: "flush", gen }),
    close: () => {
      try {
        node.disconnect();
        node.port.close();
      } catch {
        /* gone */
      }
    },
  });
  const processorSink = (): Sink => {
    const ring = new PcmRing((r) => gate.onDry(r.gen, r.consumed));
    const node = ctx.createScriptProcessor(PLAYOUT_PROCESSOR_SAMPLES, 1, 1);
    node.onaudioprocess = (ev: AudioProcessingEvent) => ring.pull(ev.outputBuffer.getChannelData(0));
    node.connect(farBus);
    return {
      push: (f) => ring.push(f),
      gate: (open) => ring.gate(open),
      flush: (gen) => ring.flush(gen),
      close: () => {
        try {
          node.disconnect();
        } catch {
          /* gone */
        }
      },
    };
  };
  const startPlayout = async (): Promise<void> => {
    if (ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      const url = URL.createObjectURL(new Blob([PLAYOUT_WORKLET_SOURCE], { type: "application/javascript" }));
      try {
        await ctx.audioWorklet.addModule(url);
        if (closed) return;
        const node = new AudioWorkletNode(ctx, PLAYOUT_WORKLET_NAME, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        node.port.onmessage = (ev: MessageEvent) => {
          const m = ev.data as Partial<RingReport> | null;
          if (m && m.type === "dry") gate.onDry(Number(m.gen), Number(m.consumed));
        };
        node.connect(farBus);
        attachSink(workletSink(node));
        playoutPath = "worklet";
        return;
      } catch {
        /* the processor below */
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (closed) return;
    try {
      attachSink(processorSink());
      playoutPath = "processor";
    } catch {
      playoutPath = "failed";
    }
  };
  void startPlayout();
  /* Silence-in-the-graph: the destination node needs an input to stay in
     the graph on some engines; the far bus at zero into it costs nothing. */
  const outKeep = ctx.createGain();
  outKeep.gain.value = 0;
  farBus.connect(outKeep);
  outKeep.connect(out);

  const emit = (onFrame: (b64: string) => void, input: Float32Array) => {
    const frame = up.process(input);
    frames += 1;
    for (let i = 0; i < frame.length; i++) {
      const a = frame[i] < 0 ? -frame[i] : frame[i];
      if (a > peak) peak = a;
    }
    onFrame(bytesToBase64(floatToPcm16(frame)));
  };
  /* A processor with no destination is not driven by the graph; a silent
     gain keeps either reader running without playing the microphone back. */
  const keepAlive = (node: AudioNode) => {
    silence = ctx.createGain();
    silence.gain.value = 0;
    node.connect(silence);
    silence.connect(ctx.destination);
  };
  const meterMic = () => {
    if (!source) return;
    if (!micMeter) {
      micMeter = ctx.createAnalyser();
      micMeter.fftSize = METER_FFT_SIZE;
    }
    /* A reader that replaced another brings a new source; the meter follows. */
    source.connect(micMeter);
  };
  const startProcessor = (mic: MediaStream, onFrame: (b64: string) => void) => {
    source = ctx.createMediaStreamSource(mic);
    meterMic();
    processor = ctx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
    processor.onaudioprocess = (ev: AudioProcessingEvent) => emit(onFrame, ev.inputBuffer.getChannelData(0));
    source.connect(processor);
    keepAlive(processor);
    capturePath = "processor";
  };
  const startWorklet = async (mic: MediaStream, onFrame: (b64: string) => void): Promise<boolean> => {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return false;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
      if (closed) return true;
      source = ctx.createMediaStreamSource(mic);
      meterMic();
      worklet = new AudioWorkletNode(ctx, CAPTURE_WORKLET_NAME, { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      worklet.port.onmessage = (ev: MessageEvent) => {
        if (ev.data instanceof Float32Array) emit(onFrame, ev.data);
      };
      source.connect(worklet);
      keepAlive(worklet);
      capturePath = "worklet";
      return true;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  /* THE READER THAT READ NOTHING (CAPTURE_STALL_MS after it started): the
     context is resumed once more, and a silent worklet hands the microphone
     to the script processor — a different code path in the engine, on the
     same context and the same track. A processor that is silent too, or a
     silent processor from the start, is `stalled`: nothing here can fix a
     microphone the engine delivers nothing from, and the beacon says so. */
  const onStall = (mic: MediaStream, onFrame: (b64: string) => void) => {
    stallTimer = null;
    if (closed || frames > 0) return;
    void ctx.resume().catch(() => {});
    if (capturePath !== "worklet") {
      stalled = true;
      return;
    }
    try {
      worklet?.disconnect();
      worklet?.port.close();
      source?.disconnect();
    } catch {
      /* a node that was never connected */
    }
    worklet = null;
    source = null;
    try {
      startProcessor(mic, onFrame);
      capturePath = "processor-after-stall";
    } catch {
      capturePath = "failed";
      stalled = true;
      return;
    }
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (!closed && frames === 0) stalled = true;
    }, stallMs);
  };

  return {
    stream: out.stream,
    startCapture(mic, onFrame) {
      if (capturing) return;
      capturing = true;
      void ctx.resume().then(
        () => { startState = String(ctx.state ?? ""); },
        () => { startState = "resume-failed"; },
      );
      void startWorklet(mic, onFrame).then((ok) => {
        if (closed) return;
        if (!ok) {
          try {
            startProcessor(mic, onFrame);
          } catch {
            /* Neither reader: said in stats(), carried by the beacon. */
            capturePath = "failed";
            return;
          }
        }
        stallTimer = setTimeout(() => onStall(mic, onFrame), stallMs);
      });
    },
    play(b64) {
      if (closed) return;
      const samples = down.process(pcm16ToFloat(base64ToBytes(b64)));
      if (samples.length === 0) return;
      if (sink) sink.push(samples);
      else early.push(samples);
      gate.push(samples.length);
      void ctx.resume().catch(() => {});
    },
    mute(on) {
      farBus.gain.value = on ? 0 : 1;
    },
    endOfResponse() {
      gate.endOfResponse();
    },
    flush() {
      /* The ring is emptied and held; nothing was ever "started". */
      gate.flush();
    },
    levels() {
      return { mic: read(micMeter), far: read(farMeter) };
    },
    stats() {
      return { path: capturePath, frames, peak: Math.round(peak * 100) / 100, ctx: String(ctx.state ?? ""), rate: ctx.sampleRate, start: startState, stalled, underruns: gate.underruns, bufferMs: Math.round(gate.target * 1000), playout: playoutPath };
    },
    playSample(bytes) {
      /* Whatever the far side was saying yields to the sample. */
      this.flush();
      sample?.stop();
      sample = null;
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        void ctx.decodeAudioData(bytes.slice(0)).then(
          (buffer) => {
            if (closed) return done(false);
            const node = ctx.createBufferSource();
            node.buffer = buffer;
            node.connect(farBus);
            node.onended = () => {
              if (sample?.node === node) sample = null;
              done(true);
            };
            sample = { node, stop: () => { try { node.stop(); } catch { /* ended */ } done(false); } };
            try {
              node.start();
            } catch {
              done(false);
            }
            void ctx.resume().catch(() => {});
          },
          () => done(false),
        );
      });
    },
    close() {
      closed = true;
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = null;
      this.flush();
      sink?.close();
      sink = null;
      sample?.stop();
      sample = null;
      try {
        processor?.disconnect();
        worklet?.disconnect();
        worklet?.port.close();
        source?.disconnect();
        silence?.disconnect();
      } catch {
        /* teardown must not throw */
      }
      processor = null;
      worklet = null;
      source = null;
      silence = null;
      void ctx.close().catch(() => {});
    },
  };
}
