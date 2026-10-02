"use client";

/* ---------------------------------------------------------------------------
   voice-transcode — transcode a browser-recorded voice blob to MP3.

   WHY: Chrome/Firefox record `audio/webm` (Opus), which iOS Safari cannot
   decode in an <audio> element, so a voice note recorded on desktop plays
   silently on an iPhone. iOS itself records `audio/mp4` (AAC), which IS
   portable, so only the webm/ogg path needs transcoding.

   HOW: Web Audio decodes the blob to PCM (native — the same decode the
   waveform already runs), then lamejs re-encodes to 64kbps mono MP3. lamejs is
   lazy-loaded only when a webm note is actually sent, so it never lands in the
   first-paint bundle.
   --------------------------------------------------------------------------- */

/** Decode `blob` to PCM, then encode as 64kbps mono MP3. */
export async function transcodeVoiceToMp3(blob: Blob): Promise<Blob> {
  const { Mp3Encoder } = await import("lamejs");

  const arrayBuf = await blob.arrayBuffer();
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("AudioContext is not available");

  const ctx = new Ctor();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const pcm = audioBuf.getChannelData(0); // voice is mono; channel 0 is it
    const sampleRate = audioBuf.sampleRate;
    const encoder = new Mp3Encoder(1, sampleRate, 64); // 64kbps mono — voice-clear

    // Float32 (-1..1) -> Int16, the input shape lamejs expects.
    const int16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const chunks: BlobPart[] = [];
    /* lamejs returns Int8Array holding the raw 0-255 bytes as SIGNED values;
       copy through Uint8Array.set() so ToUint8 wraps them back to unsigned —
       a naive `new Uint8Array(i8)` would clamp negatives to 0 and corrupt MP3. */
    const toBytes = (i8: Int8Array): ArrayBuffer => {
      const u8 = new Uint8Array(i8.byteLength);
      u8.set(i8);
      return u8.buffer as ArrayBuffer; // fresh ArrayBuffer from the length ctor
    };
    const STEP = 1152 * 64; // encode in ~64-frame batches so huge notes stay bounded
    for (let i = 0; i < int16.length; i += STEP) {
      const slice = int16.subarray(i, Math.min(i + STEP, int16.length));
      const buf = encoder.encodeBuffer(slice);
      if (buf.length > 0) chunks.push(toBytes(buf));
    }
    const tail = encoder.flush();
    if (tail.length > 0) chunks.push(toBytes(tail));

    return new Blob(chunks, { type: "audio/mpeg" });
  } finally {
    void ctx.close();
  }
}
