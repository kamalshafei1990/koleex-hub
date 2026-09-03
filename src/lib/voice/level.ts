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
