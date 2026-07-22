/* ---------------------------------------------------------------------------
   The ONE range-slider look for the whole Hub.

   Standing rule from the owner: every BAR-type control — sliders, level and
   progress bars — has an accent-BLUE filled portion and a WHITE circle knob.
   (Toggles are the other rule: emerald track, white knob. Bars are a value,
   toggles are a state.)

   Why not `accent-color`: it paints the track AND the thumb the same colour,
   which is exactly the green-on-green / blue-on-blue thumb we had to undo.
   So the track is a linear-gradient and the thumb is styled explicitly.

   Usage:
     <input type="range" className={KX_RANGE_CLASS} style={kxRangeStyle(pct)} … />
   where `pct` is 0–100.
   --------------------------------------------------------------------------- */

export const KX_RANGE_CLASS =
  "h-1.5 w-full cursor-pointer appearance-none rounded-full " +
  "[--kx-slider-fill:var(--accent-blue,#0066FF)] [--kx-slider-rest:var(--border-color,#6b7280)] " +
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 " +
  "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 " +
  "[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow";

/** Track fill for a 0–100 percentage. Clamped so a bad value can't paint
 *  outside the bar. */
export function kxRangeStyle(pct: number): React.CSSProperties {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return {
    background: `linear-gradient(to right, var(--kx-slider-fill) 0 ${p}%, var(--kx-slider-rest) ${p}% 100%)`,
  };
}
