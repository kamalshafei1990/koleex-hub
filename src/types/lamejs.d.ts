/* Minimal type declaration for `lamejs` (MP3 encoder, no bundled types). */
declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    /** Encode a buffer of interleaved Int16 samples. Returns MP3 bytes. */
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    /** Flush remaining encoder state. Returns trailing MP3 bytes. */
    flush(): Int8Array;
  }
}
