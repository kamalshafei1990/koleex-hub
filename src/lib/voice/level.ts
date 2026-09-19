/* ---------------------------------------------------------------------------
   voice/level — how a displayed audio level follows a measured one.

   THE GLITCH THE OWNER SAW. The call screen's ring was scaled straight from
   the meter on every React render: a value that moves in 2% steps up to
   sixty times a second, with no easing between steps, and that drops to
   zero the instant the speaking side changes. On a phone that is a ring
   that twitches and snaps rather than breathes.

   A voice does not move like that. It rises fast — a syllable begins in a
   few milliseconds — and it decays slowly. So the display follows the
   meter with two different speeds: a quick ATTACK toward a louder value and
   a slow RELEASE toward a quieter one. The eye reads the result as the
   voice itself, not as a meter.

   Pure, so the suite can prove the shape without a browser. The hook that
   drives it each frame lives beside the screen that uses it.
   --------------------------------------------------------------------------- */

/** Per-frame factors at ~60fps: reach a louder target in ~5 frames, fall
 *  back to silence over ~25. */
export const LEVEL_ATTACK = 0.35;
export const LEVEL_RELEASE = 0.08;

/** One frame of smoothing. Clamped to 0..1; NaN reads as silence. */
export function stepLevel(current: number, target: number, attack = LEVEL_ATTACK, release = LEVEL_RELEASE): number {
  const t = Number.isFinite(target) ? Math.min(1, Math.max(0, target)) : 0;
  const c = Number.isFinite(current) ? Math.min(1, Math.max(0, current)) : 0;
  const k = t > c ? attack : release;
  const next = c + (t - c) * k;
  /* Settle exactly, so a silent call reads 0 rather than 0.0004 for ever
     and the rings stop moving instead of trembling. */
  return Math.abs(next - t) < 0.002 ? t : next;
}

/* ── The meter itself ─────────────────────────────────────────────────── */

/** Speech RMS sits well below 1.0 even when someone is speaking clearly, so
 *  the raw value would leave the orb barely moving. A display gain, not a
 *  measurement. */
export const DISPLAY_GAIN = 2.8;
/** How much the level must move before a render is worth it. */
export const LEVEL_EPSILON = 0.02;

/** 0..1 from an analyser's byte time-domain window: samples 0..255 centred
 *  on 128, root-mean-square over the window, display gain, clamped. Pure. */
export function rmsLevel(buf: Uint8Array, gain = DISPLAY_GAIN): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * gain);
}
