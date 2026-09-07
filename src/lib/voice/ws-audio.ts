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
   18:10: "the voice of Grok not so stable"). Frames come down a socket
   across a VPN and a border, in bursts and with gaps; the first version
   started each frame 50 ms after "now" and butted the next against it, so
   every gap on the wire longer than 50 ms became a gap in the voice. Now a
   fresh run of frames starts a fifth of a second behind, and every time the
   queue still runs dry the lead grows a tenth, up to a ceiling: a lane with
   a rough network buys itself a little more delay instead of stuttering
   for the whole call. The lead is per run — a barge-in flush or a pause
   starts a new run — so an answer never begins a second late. The
   arithmetic is in nextFrameStart, pure, and tested.

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

/** How far behind "now" a fresh run of frames starts playing. */
export const JITTER_LEAD_S = 0.2;
/** How much the lead grows each time the queue runs dry mid-run. */
export const JITTER_LEAD_STEP_S = 0.1;
/** The most delay a rough network can buy itself. */
export const JITTER_LEAD_MAX_S = 0.6;

export type JitterState = {
  /** Context time the next frame should start at; 0 = no run in progress. */
  nextStart: number;
  /** The lead this session has settled on, grown by underruns. */
  lead: number;
};

/**
 * Where the frame that just arrived should start, and the state after it.
 *
 *   · no run in progress (after a flush, or the first frame): now + lead
 *   · the run is still ahead of now: butt against the previous frame
 *   · the run fell behind now (an UNDERRUN — the gap on the wire outlasted
 *     the queue): start now + lead, and grow the lead for the next time
 *
 * Pure. `duration` is the frame's length in seconds.
 */
export function nextFrameStart(state: JitterState, now: number, duration: number): { start: number; next: JitterState; underrun: boolean } {
  if (state.nextStart === 0) {
    const start = now + state.lead;
    return { start, next: { nextStart: start + duration, lead: state.lead }, underrun: false };
  }
  if (state.nextStart >= now) {
    return { start: state.nextStart, next: { nextStart: state.nextStart + duration, lead: state.lead }, underrun: false };
  }
  const lead = Math.min(JITTER_LEAD_MAX_S, state.lead + JITTER_LEAD_STEP_S);
  const start = now + lead;
  return { start, next: { nextStart: start + duration, lead }, underrun: true };
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
  let jitter: JitterState = { nextStart: 0, lead: JITTER_LEAD_S };
  const playing = new Set<AudioBufferSourceNode>();

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
      const placed = nextFrameStart(jitter, ctx.currentTime, buffer.duration);
      jitter = placed.next;
      node.start(placed.start);
      playing.add(node);
      node.onended = () => {
        playing.delete(node);
        /* The queue drained on its own (the answer ended): the next answer
           is a fresh run, at the lead this call has settled on. */
        if (playing.size === 0) jitter = { nextStart: 0, lead: jitter.lead };
      };
      void ctx.resume().catch(() => {});
    },
    flush() {
      for (const node of playing) {
        try {
          node.stop();
        } catch {
          /* already ended */
        }
      }
      playing.clear();
      jitter = { nextStart: 0, lead: jitter.lead };
    },
    close() {
      closed = true;
      this.flush();
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
