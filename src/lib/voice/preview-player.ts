/* ---------------------------------------------------------------------------
   voice/preview-player — play a few seconds of a voice, once, on a tap.

   THE OWNER (2026-09-07): "when I press a voice it should say some sample
   words so I can listen before I select it". The sample arrives as audio
   bytes from our own route a second or so after the tap. That second is the
   whole problem on a phone: a sound that is not started INSIDE the tap is a
   sound the engine may refuse. So the player is PRIMED in the tap — the
   audio context is created and resumed while the gesture is still live —
   and the bytes, when they land, are decoded into that already-running
   context and played from it. A context a gesture has woken stays awake.

   One sample at a time: a new tap stops the one still playing. `play`
   resolves when the sound has ended (or was replaced), so the caller can
   hold the microphone closed for exactly as long as the sample is heard
   and no longer.

   Injectable: the suite hands in a context double and never hears a thing.
   --------------------------------------------------------------------------- */

export type PreviewSourceLike = {
  buffer: unknown;
  connect(dest: unknown): void;
  start(): void;
  stop(): void;
  onended: (() => void) | null;
};

export type PreviewContextLike = {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  createBufferSource(): PreviewSourceLike;
  close(): Promise<void>;
};

export type PreviewPlayer = {
  /** Call INSIDE the tap: wakes the context while the gesture allows it. */
  prime(): void;
  /** Decode and play; resolves true when the sound ended on its own, false
   *  when it was stopped, replaced, or could not be decoded. */
  play(bytes: ArrayBuffer): Promise<boolean>;
  /** Stop whatever is playing. */
  stop(): void;
  /** Stop and release the context. */
  close(): void;
};

export function createPreviewPlayer(makeContext: () => PreviewContextLike | null): PreviewPlayer {
  let ctx: PreviewContextLike | null = null;
  let current: { source: PreviewSourceLike; settle: (ended: boolean) => void } | null = null;
  let generation = 0;

  const ensure = (): PreviewContextLike | null => {
    if (ctx) return ctx;
    try {
      ctx = makeContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };
  const stopCurrent = () => {
    const c = current;
    current = null;
    if (!c) return;
    c.source.onended = null;
    try {
      c.source.stop();
    } catch {
      /* already ended */
    }
    c.settle(false);
  };

  return {
    prime() {
      const c = ensure();
      if (c && c.state !== "running") void c.resume().catch(() => {});
    },
    async play(bytes) {
      const c = ensure();
      if (!c) return false;
      const mine = ++generation;
      stopCurrent();
      let buffer: unknown;
      try {
        if (c.state !== "running") await c.resume().catch(() => {});
        buffer = await c.decodeAudioData(bytes);
      } catch {
        return false;
      }
      /* A newer tap won while this one was decoding. */
      if (mine !== generation) return false;
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (ended: boolean) => {
          if (settled) return;
          settled = true;
          if (current?.source === source) current = null;
          resolve(ended);
        };
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.connect(c.destination);
        source.onended = () => settle(true);
        current = { source, settle };
        try {
          source.start();
        } catch {
          settle(false);
        }
      });
    },
    stop() {
      stopCurrent();
    },
    close() {
      stopCurrent();
      const c = ctx;
      ctx = null;
      if (c) void c.close().catch(() => {});
    },
  };
}

/** The browser's context, or null where there is none. */
export function browserPreviewContext(): PreviewContextLike | null {
  if (typeof window === "undefined") return null;
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) return null;
  return new Ctx() as unknown as PreviewContextLike;
}

export const VOICE_PREVIEW_PATH = "/api/ai/voice/preview";
/** The sample fetch has its own ceiling: a synthesis that takes longer than
 *  this is one the caller has stopped waiting for. */
export const PREVIEW_FETCH_TIMEOUT_MS = 15_000;
