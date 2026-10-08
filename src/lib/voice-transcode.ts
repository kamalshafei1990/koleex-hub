"use client";

/* ---------------------------------------------------------------------------
   voice-transcode — transcode a browser-recorded voice blob to 16kHz WAV.

   WHY: Chrome/Firefox record `audio/webm` (Opus), which iOS Safari cannot
   decode in an <audio> element, so a voice note recorded on desktop played
   silently on an iPhone. iOS itself records `audio/mp4` (AAC), which IS
   portable, so only the webm/ogg path needs transcoding.

   HOW: Web Audio decodes the blob to PCM (native — the same decode the
   waveform already runs), then we downsample to 16kHz mono and write a plain
   RIFF/WAV header + PCM16. WAV is uncompressed (larger than MP3) but
   universally playable and needs ZERO third-party encoder — deliberately no
   lamejs/ffmpeg dependency, so the transcode cannot break on module loading.
   --------------------------------------------------------------------------- */

/** Decode `blob`, downsample to 16kHz mono, and return a PCM16 WAV. */
export async function transcodeVoiceToWav(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("AudioContext is not available");

  const ctx = new Ctor();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const src = audioBuf.getChannelData(0); // voice is mono; channel 0 is it
    const srcRate = audioBuf.sampleRate;

    // Downsample to 16kHz mono (voice-wideband; keeps the WAV small).
    const targetRate = 16_000;
    const ratio = Math.max(1, srcRate / targetRate);
    const outLen = Math.max(1, Math.floor(src.length / ratio));
    const pcm16 = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
      let sum = 0;
      let n = 0;
      for (let j = start; j < end && j < src.length; j++) { sum += src[j]; n++; }
      const s = Math.max(-1, Math.min(1, sum / Math.max(1, n)));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // RIFF/WAV header (PCM16 mono) + samples. All fields little-endian.
    const dataSize = pcm16.length * 2;
    const header = new ArrayBuffer(44);
    const dv = new DataView(header);
    const write = (s: string, o: number) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    write("RIFF", 0);
    dv.setUint32(4, 36 + dataSize, true);
    write("WAVE", 8);
    write("fmt ", 12);
    dv.setUint32(16, 16, true);              // fmt chunk size
    dv.setUint16(20, 1, true);               // PCM
    dv.setUint16(22, 1, true);               // mono
    dv.setUint32(24, targetRate, true);      // sample rate
    dv.setUint32(28, targetRate * 2, true);  // byte rate
    dv.setUint16(32, 2, true);               // block align
    dv.setUint16(34, 16, true);              // bits per sample
    write("data", 36);
    dv.setUint32(40, dataSize, true);

    const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, dataSize);
    const full = new Uint8Array(44 + dataSize);
    full.set(new Uint8Array(header), 0);
    full.set(pcmBytes, 44);
    return new Blob([full], { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}
