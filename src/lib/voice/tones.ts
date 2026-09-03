/* ---------------------------------------------------------------------------
   voice/tones — the sounds a call makes about itself.

   THE OWNER'S ASK, in his words: "when it shows connecting then says go
   ahead, I want a sound that lets me know it connected and I can talk". A
   caption is for the eyes, and a caller's eyes are often elsewhere — on the
   road, on a machine, on the customer in front of them. A tone reaches them
   where the caption does not.

   SYNTHESISED, NOT A FILE. Two short sine notes from an oscillator: nothing
   to download, nothing that can 404, nothing a slow network in mainland
   China can delay past the moment it is for. The notification library in
   lib/notificationSound.ts fetches recordings on demand; a call's own cue
   must never wait on a fetch.

   THE AUDIOCONTEXT IS CREATED INSIDE THE USER'S GESTURE — the tap that
   starts the call — because browsers refuse audio that no gesture unlocked.
   `prime()` is that: called from the click handler, it creates the context
   and resumes it while the gesture is still current, so `ready()` can play
   seconds later when the vendor finally answers.

   QUIET. A cue, not an alarm: the peak gain is well under what a voice
   comes through at, and each note fades in and out so nothing clicks.

   NEVER THROWS. No AudioContext, a refused resume, a closed context — every
   path here is a silent tone, never an exception in a call that is otherwise
   working. The call is the product; the tone is a courtesy.
   --------------------------------------------------------------------------- */

export interface ToneNote {
  /** Hz. */
  freq: number;
  /** Seconds after the tone starts. */
  at: number;
  /** Seconds the note sounds for, fades included. */
  dur: number;
  /** Hz at the end of the note, when it should slide there rather than hold.
   *  A glide is what makes a plain sine sound like a signal rather than a
   *  doorbell. Omitted, the note holds `freq`. */
  glideTo?: number;
}

/* THE OWNER, after the first version: "the sound when it connects is not good
   enough — choose one little futuristic one". The first was two plain notes,
   a doorbell. This is three short notes stepping up a major triad (G6, C7,
   E7), the last of them sliding up a further third as it fades — the shape
   of a device coming online rather than a bell. Still rising (a falling
   figure reads as "ended"), still sine, still quiet, still under half a
   second. */
export const READY_TONE: readonly ToneNote[] = [
  { freq: 783.99, at: 0, dur: 0.07 },
  { freq: 1046.5, at: 0.075, dur: 0.07 },
  { freq: 1318.51, at: 0.15, dur: 0.24, glideTo: 1567.98 },
];

/* One sliding note, when a dropped connection comes back: the call is yours
   again. Single so it is not confused with the start of a call; the same
   upward slide so it is unmistakably the same family. */
export const RECOVERED_TONE: readonly ToneNote[] = [{ freq: 1046.5, at: 0, dur: 0.18, glideTo: 1318.51 }];

/** Peak gain. A voice on the call sits far above this. */
export const TONE_GAIN = 0.12;
/** Fade in and out, so a sine that starts mid-cycle does not click. */
const RAMP_S = 0.012;

/* The slice of Web Audio this file uses, so a test can hand in a fake and
   the browser can hand in the real thing. */
export interface ToneParamLike {
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
}
export interface ToneOscillatorLike {
  type: string;
  frequency: ToneParamLike;
  connect(dest: unknown): unknown;
  start(t: number): void;
  stop(t: number): void;
}
export interface ToneGainLike {
  gain: ToneParamLike;
  connect(dest: unknown): unknown;
}
export interface ToneContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state?: string;
  createOscillator(): ToneOscillatorLike;
  createGain(): ToneGainLike;
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Schedule `notes` on `ctx` starting now. Pure scheduling — nothing here
 * waits, and the return value is when the last note ends, for a caller
 * that wants to know.
 */
export function scheduleTone(ctx: ToneContextLike, notes: readonly ToneNote[], gain = TONE_GAIN): number {
  const t0 = ctx.currentTime;
  let end = t0;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    const start = t0 + n.at;
    const stop = start + n.dur;
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.glideTo !== undefined) osc.frequency.linearRampToValueAtTime(n.glideTo, stop);
    /* Envelope: silent → gain → silent, ramps at both ends. */
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + RAMP_S);
    g.gain.setValueAtTime(gain, Math.max(start + RAMP_S, stop - RAMP_S));
    g.gain.linearRampToValueAtTime(0, stop);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(stop);
    if (stop > end) end = stop;
  }
  return end;
}

/** The browser's factory, feature-detected. Null where there is none. */
export function browserToneContext(): ToneContextLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor() as unknown as ToneContextLike;
  } catch {
    return null;
  }
}

/**
 * One call's tones. Made in the tap that starts the call, closed when the
 * call ends. Every method is safe to call at any time and never throws.
 */
export class CallTones {
  private ctx: ToneContextLike | null = null;

  constructor(private readonly create: () => ToneContextLike | null = browserToneContext) {}

  /** Call INSIDE the user gesture that starts the call. */
  prime(): void {
    if (this.ctx) return;
    try {
      this.ctx = this.create();
      /* Resumed now, while the gesture is current; a context created in a
         gesture but resumed later is refused on some browsers. */
      void this.ctx?.resume?.().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  /** The call is ready to hear you. */
  ready(): void {
    this.play(READY_TONE);
  }

  /** A dropped connection is back. */
  recovered(): void {
    this.play(RECOVERED_TONE);
  }

  private play(notes: readonly ToneNote[]): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;
    try {
      if (ctx.state === "suspended") void ctx.resume?.().catch(() => {});
      scheduleTone(ctx, notes);
    } catch {
      /* A refused context is a silent cue, not a broken call. */
    }
  }

  /** Release the hardware handle. An AudioContext is capped per page. */
  close(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (!ctx) return;
    try {
      void ctx.close?.().catch(() => {});
    } catch {
      /* Already closed. */
    }
  }
}
