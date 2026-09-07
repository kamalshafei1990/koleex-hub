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

   BARGE-IN FLUSHES. When the caller speaks over an answer, the far side
   stops sending — but the seconds already queued would keep playing over
   the caller's first words. `flush()` stops every scheduled buffer at once;
   the session calls it on the same event the WebRTC lane cuts the element.

   PLAIN WEB AUDIO, ON PURPOSE. A ScriptProcessorNode is deprecated and an
   AudioWorklet is the modern answer, but the worklet needs a module URL
   and a second file in the bundle, and the processor works on every engine
   this product meets, iOS Safari included. The frame is 4096 samples at
   the context's own rate, resampled to the wire rate here — an engine's
   context rate is the engine's business (48 k on most phones), and the
   wire's is the vendor's.

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

const FRAME_SAMPLES = 4096;

/** The browser implementation. Created on a user gesture — the call
 *  button's tap — so the context is allowed to run. */
export function createBrowserWsAudio(wireRate: number): WsAudio {
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const out = ctx.createMediaStreamDestination();
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let silence: GainNode | null = null;
  /* Where the next far-side frame starts, in context time. Kept a little
     ahead of "now" so consecutive frames butt against each other without a
     gap, and reset after a flush or a long pause. */
  let nextStart = 0;
  const playing = new Set<AudioBufferSourceNode>();
  const LEAD_S = 0.05;

  return {
    stream: out.stream,
    startCapture(mic, onFrame) {
      if (processor) return;
      source = ctx.createMediaStreamSource(mic);
      processor = ctx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        const input = ev.inputBuffer.getChannelData(0);
        const frame = resample(input, ctx.sampleRate, wireRate);
        onFrame(bytesToBase64(floatToPcm16(frame)));
      };
      /* A processor with no destination is not driven by the graph; a
         silent gain keeps it running without playing the microphone back. */
      silence = ctx.createGain();
      silence.gain.value = 0;
      source.connect(processor);
      processor.connect(silence);
      silence.connect(ctx.destination);
      void ctx.resume().catch(() => {});
    },
    play(b64) {
      const samples = pcm16ToFloat(base64ToBytes(b64));
      if (samples.length === 0) return;
      const buffer = ctx.createBuffer(1, samples.length, wireRate);
      buffer.getChannelData(0).set(samples);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(out);
      const now = ctx.currentTime;
      if (nextStart < now + LEAD_S / 2) nextStart = now + LEAD_S;
      node.start(nextStart);
      nextStart += buffer.duration;
      playing.add(node);
      node.onended = () => playing.delete(node);
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
      nextStart = 0;
    },
    close() {
      this.flush();
      try {
        processor?.disconnect();
        source?.disconnect();
        silence?.disconnect();
      } catch {
        /* teardown must not throw */
      }
      processor = null;
      source = null;
      silence = null;
      void ctx.close().catch(() => {});
    },
  };
}
