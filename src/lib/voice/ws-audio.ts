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
};

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

/** How much of an answer is gathered before its first frame plays. */
export const PREBUFFER_S = 0.3;
/** How much the gathering grows each time a run still drains mid-answer. */
export const PREBUFFER_STEP_S = 0.1;
/** The most delay a rough network can buy itself. */
export const PREBUFFER_MAX_S = 0.8;
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
  private running = false;
  private pending: JitterFrame<T>[] = [];
  private pendingDur = 0;
  private timer: unknown = null;

  constructor(private readonly deps: JitterDeps<T>) {}

  push(frame: JitterFrame<T>): void {
    if (this.running) {
      const now = this.deps.now();
      if (this.nextStart >= now) {
        this.deps.start(frame.node, this.nextStart);
        this.nextStart += frame.duration;
        return;
      }
      /* The run drained before this frame arrived. */
      this.running = false;
      if (now - this.nextStart < RUN_GAP_S) {
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
    let at = this.deps.now() + START_MARGIN_S;
    for (const f of this.pending) {
      this.deps.start(f.node, at);
      at += f.duration;
    }
    this.pending = [];
    this.pendingDur = 0;
    this.nextStart = at;
    this.running = true;
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
export function createBrowserWsAudio(wireRate: number): WsAudio {
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const out = ctx.createMediaStreamDestination();
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let silence: GainNode | null = null;
  let capturing = false;
  let closed = false;
  let sample: { node: AudioBufferSourceNode; stop: () => void } | null = null;
  const playing = new Set<AudioBufferSourceNode>();
  const jitter = new JitterQueue<AudioBufferSourceNode>({
    now: () => ctx.currentTime,
    start: (node, at) => {
      node.start(at);
      playing.add(node);
      node.onended = () => playing.delete(node);
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });

  const emit = (onFrame: (b64: string) => void, input: Float32Array) => {
    const frame = resample(input, ctx.sampleRate, wireRate);
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
  const startProcessor = (mic: MediaStream, onFrame: (b64: string) => void) => {
    source = ctx.createMediaStreamSource(mic);
    processor = ctx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
    processor.onaudioprocess = (ev: AudioProcessingEvent) => emit(onFrame, ev.inputBuffer.getChannelData(0));
    source.connect(processor);
    keepAlive(processor);
  };
  const startWorklet = async (mic: MediaStream, onFrame: (b64: string) => void): Promise<boolean> => {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return false;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
      if (closed) return true;
      source = ctx.createMediaStreamSource(mic);
      worklet = new AudioWorkletNode(ctx, CAPTURE_WORKLET_NAME, { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      worklet.port.onmessage = (ev: MessageEvent) => {
        if (ev.data instanceof Float32Array) emit(onFrame, ev.data);
      };
      source.connect(worklet);
      keepAlive(worklet);
      return true;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return {
    stream: out.stream,
    startCapture(mic, onFrame) {
      if (capturing) return;
      capturing = true;
      void ctx.resume().catch(() => {});
      void startWorklet(mic, onFrame).then((ok) => {
        if (ok || closed) return;
        startProcessor(mic, onFrame);
      });
    },
    play(b64) {
      const samples = pcm16ToFloat(base64ToBytes(b64));
      if (samples.length === 0) return;
      const buffer = ctx.createBuffer(1, samples.length, wireRate);
      buffer.getChannelData(0).set(samples);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(out);
      jitter.push({ node, duration: buffer.duration });
      void ctx.resume().catch(() => {});
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
            node.connect(out);
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
