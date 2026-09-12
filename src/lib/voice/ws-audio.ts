/* ---------------------------------------------------------------------------
   voice/ws-audio — the microphone in, the voice out, over a socket.

   On the WebRTC lane the browser carries audio itself: an Opus track each
   way, decoded and played by the engine. On the WebSocket lane the audio is
   PCM16 frames inside JSON messages, so this module does what the engine
   did: read the microphone and cut it into frames, and turn the frames
   that come back into sound.

   THE SOUND COMES OUT AS A MediaStream, on purpose. The call button plays
   the far side through an <audio> element and meters it with a stream
   analyser; a MediaStreamAudioDestinationNode gives this lane the same
   object, so the button, the meter, the "turn on sound" recovery and the
   barge-in gate on the element all work unchanged.

   A JITTER BUFFER, BECAUSE THE VOICE ARRIVED CHOPPED (owner, 2026-09-07
   18:10: "the voice of Grok not so stable"; 19:05: still "a strange voice").
   Frames come down a socket across a VPN and a border, in bursts and with
   gaps, and the first frame of an answer is small and early. Playing each
   frame as it landed made every wire gap a gap in the voice and every
   answer start as a blip, a silence, then the sentence. Now an answer is
   GATHERED before it plays — a third of a second of sound, or whatever has
   arrived after a third of a second — and then plays back to back; a run
   that still drains mid-answer grows the gathering for the rest of the call,
   up to a ceiling. The logic is JitterQueue, pure given a clock, and tested.

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

/* ── The jitter buffer ──────────────────────────────────────────────────── */

/** How much of an answer is gathered before its first frame plays.
 *  (Owner, 2026-09-12 evening: "crackling and cuts while it talks, VPN or
 *  not" — a China path jitters by hundreds of ms; a third of a second of
 *  lead drained mid-sentence again and again. Half a second is the price
 *  of a sentence that plays whole.) */
export const PREBUFFER_S = 0.45;
/** How much the gathering grows each time a run still drains mid-answer. */
export const PREBUFFER_STEP_S = 0.15;
/** The most delay a rough network can buy itself. */
export const PREBUFFER_MAX_S = 1.2;
/** A frame that arrives this soon after the run drained CONTINUES the run
 *  from now — a gap too short to hear — instead of stopping the sentence
 *  to gather again (which was a third-of-a-second hole in every word the
 *  network delivered a few ms late: the "cuts"). It still counts as an
 *  underrun, so the next run starts with more lead. */
export const LATE_GRACE_S = 0.12;
/** Where a late frame restarts the run: just ahead of now. */
const LATE_RESTART_S = 0.02;
/** A short answer ("Yes.") never fills the buffer: whatever has arrived
 *  plays after this long regardless. */
export const PREBUFFER_WAIT_MS = 350;
/** A run that drained this long ago ended on its own — the answer was over,
 *  not late. Shorter than this is an UNDERRUN and grows the buffer. */
export const RUN_GAP_S = 1.0;
/** Scheduling margin so a start time is never already in the past. */
const START_MARGIN_S = 0.05;

export type JitterFrame<T> = { node: T; duration: number };
export type JitterDeps<T> = {
  now(): number;
  /** Start this frame at this context time. */
  start(node: T, at: number): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** The context's sample rate. With it, a run's start times are counted
   *  in whole samples from the run's first frame, so a thousand frames of
   *  float `duration` cannot drift a fraction of a sample apart — a gap or
   *  an overlap at a frame boundary is a click, twenty times a second. */
  rate?: number;
};

/**
 * Frames in, start times out.
 *
 * The first version butted each frame 50 ms behind "now": every gap on the
 * wire longer than that was a gap in the voice, and the FIRST frame of an
 * answer — the vendor sends a small one fast, then streams — was a blip, a
 * silence, then the sentence. Now an answer is GATHERED first: frames queue
 * until PREBUFFER_S of sound is held (or PREBUFFER_WAIT_MS has passed), then
 * play back to back from a single start. A frame that arrives after the run
 * drained is an underrun: the run stops, the target grows a step, and the
 * frame begins a new gathering. A frame that arrives long after the run
 * drained is simply the next answer, gathered at the target the call has
 * settled on. Pure given its deps; the suite drives it with a fake clock.
 */
export class JitterQueue<T> {
  target = PREBUFFER_S;
  underruns = 0;
  private nextStart = 0;
  /* The run's origin and its length in whole samples (see JitterDeps.rate). */
  private runStart = 0;
  private runSamples = 0;
  private running = false;
  private pending: JitterFrame<T>[] = [];
  private pendingDur = 0;
  private timer: unknown = null;

  constructor(private readonly deps: JitterDeps<T>) {}

  /** Advance the run by one frame, sample-exact when the rate is known. */
  private advance(duration: number): void {
    const rate = this.deps.rate;
    if (rate && rate > 0) {
      this.runSamples += Math.round(duration * rate);
      this.nextStart = this.runStart + this.runSamples / rate;
    } else {
      this.nextStart += duration;
    }
  }

  private beginRun(at: number): void {
    this.runStart = at;
    this.runSamples = 0;
    this.nextStart = at;
    this.running = true;
  }

  push(frame: JitterFrame<T>): void {
    if (this.running) {
      const now = this.deps.now();
      if (this.nextStart >= now) {
        this.deps.start(frame.node, this.nextStart);
        this.advance(frame.duration);
        return;
      }
      const late = now - this.nextStart;
      if (late < LATE_GRACE_S) {
        /* Barely late: the sentence goes on from now, the lead grows. */
        this.underruns++;
        this.target = Math.min(PREBUFFER_MAX_S, this.target + PREBUFFER_STEP_S);
        this.beginRun(now + LATE_RESTART_S);
        this.deps.start(frame.node, this.nextStart);
        this.advance(frame.duration);
        return;
      }
      /* The run drained before this frame arrived. */
      this.running = false;
      if (late < RUN_GAP_S) {
        this.underruns++;
        this.target = Math.min(PREBUFFER_MAX_S, this.target + PREBUFFER_STEP_S);
      }
    }
    this.pending.push(frame);
    this.pendingDur += frame.duration;
    if (this.pendingDur >= this.target) this.release();
    else if (this.timer === null) {
      this.timer = this.deps.setTimer(() => {
        this.timer = null;
        this.release();
      }, PREBUFFER_WAIT_MS);
    }
  }

  /** Play everything gathered, back to back, from now. */
  release(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.pending.length === 0) return;
    this.beginRun(this.deps.now() + START_MARGIN_S);
    for (const f of this.pending) {
      this.deps.start(f.node, this.nextStart);
      this.advance(f.duration);
    }
    this.pending = [];
    this.pendingDur = 0;
  }

  /** Drop what is gathered and forget the run (barge-in). The target the
   *  call has settled on is kept. */
  flush(): T[] {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
    const dropped = this.pending.map((f) => f.node);
    this.pending = [];
    this.pendingDur = 0;
    this.running = false;
    this.nextStart = 0;
    return dropped;
  }

  /** How much sound is gathered and not yet playing, in seconds. */
  get buffered(): number {
    return this.pendingDur;
  }
}

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
  /* THE CONTEXT RUNS AT THE WIRE'S RATE (owner, 2026-09-12: "when Koleex
     AI talks I hear pulses… the voice is not clean"). Each frame of the far
     side's voice used to become its own 24 kHz buffer inside a 48 kHz
     context, and the engine resampled every buffer ON ITS OWN — with no
     memory of the previous one, so every frame boundary, twenty or so times
     a second, was a small discontinuity: the pulses. At the wire's rate the
     frames play back to back as one continuous signal and only the device's
     output resamples, once, continuously. The microphone is then read at the
     same rate and needs no resampling either. An engine that refuses the
     option (the argument is ignored or throws) gets the default context, as
     before; stats() carries the rate the beacon reads. */
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ sampleRate: wireRate });
  } catch {
    ctx = new Ctx();
  }
  const out = ctx.createMediaStreamDestination();
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
  const playing = new Set<AudioBufferSourceNode>();
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
  farBus.connect(out);
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
  const jitter = new JitterQueue<AudioBufferSourceNode>({
    now: () => ctx.currentTime,
    start: (node, at) => {
      node.start(at);
      playing.add(node);
      node.onended = () => playing.delete(node);
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    rate: ctx.sampleRate,
  });

  const emit = (onFrame: (b64: string) => void, input: Float32Array) => {
    const frame = resample(input, ctx.sampleRate, wireRate);
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
      const samples = pcm16ToFloat(base64ToBytes(b64));
      if (samples.length === 0) return;
      const buffer = ctx.createBuffer(1, samples.length, wireRate);
      buffer.getChannelData(0).set(samples);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(farBus);
      jitter.push({ node, duration: buffer.duration });
      void ctx.resume().catch(() => {});
    },
    endOfResponse() {
      jitter.release();
    },
    flush() {
      /* Gathered frames were never started; started ones are stopped. */
      for (const node of jitter.flush()) {
        try {
          node.disconnect();
        } catch {
          /* never connected */
        }
      }
      for (const node of playing) {
        try {
          node.stop();
        } catch {
          /* already ended */
        }
      }
      playing.clear();
    },
    levels() {
      return { mic: read(micMeter), far: read(farMeter) };
    },
    stats() {
      return { path: capturePath, frames, peak: Math.round(peak * 100) / 100, ctx: String(ctx.state ?? ""), rate: ctx.sampleRate, start: startState, stalled, underruns: jitter.underruns, bufferMs: Math.round(jitter.target * 1000) };
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
