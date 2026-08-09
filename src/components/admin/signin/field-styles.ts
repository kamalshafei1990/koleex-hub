/* The sign-in screen's field styling, shared by the sign-in panel (which
   ships in the boot chunk) and the join panel (which no longer does).

   Hard-coded colours, not CSS variables, so the gate renders correctly even
   before the app's theme CSS has loaded — this is the first paint a visitor
   ever gets. */

export const inputBase =
  "w-full h-11 px-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors";

/* `appearance-none` removes the browser's own chevron — and nothing was drawn
   in its place, so every dropdown looked like a plain text box with no hint
   you could open it. Room is reserved at the inline end (logical, so Arabic
   flips) and SelectChevron paints the arrow. pe-10, not pe-9: the arrow sits
   16px in, so 36px left the longest option ending under it. */
export const selectBase =
  "w-full h-11 ps-3 pe-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer truncate";

export const textareaBase =
  "w-full min-h-[86px] px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-none";

export const labelBase =
  "block text-[10px] font-semibold text-white/55 mb-1.5 uppercase tracking-[0.08em]";

/* The primary action — Sign In, and Request Access on the join form.

   Owner's pick: underglow plus the smallest motion that still registers.

   The colour shift is toward Hub Blue, not toward grey. `hover:bg-white/90`
   is gone: a white button that DIMS on hover signals "unavailable" in every
   interface there is, so the strongest control on the screen was saying the
   opposite of what it is. #EDF3FA is white with about three percent of the
   accent in it — enough to register as the glow catching the face, not enough
   to read as a different button. Black type on it stays well past AA.

   Two traps here, both found by measuring rather than by reading the class
   list. Tailwind v4 emits the standalone `translate` property, NOT `transform`
   — so the transition has to name `translate` or the lift snaps instead of
   easing, and `getComputedStyle(...).transform` reports "none" while the
   button is very much lifted. And `translate-y-[-1px]` is written the long way
   because the negative-prefix form behind two stacked variants generated no
   rule at all.

   One pixel, not two: one pixel is felt rather than seen,
   which is what "very simple motion" asks for. active: puts it back down, so
   pressing has somewhere to go.

   motion-safe on the transform only — under reduced motion the glow still
   appears, so the hover is never silent.

   disabled: kills all three. A control you cannot press must not answer being
   pointed at, and the old class had nothing to say about that. */
export const primaryButton =
  "w-full h-11 rounded-xl bg-white text-black text-[13px] font-semibold " +
  "flex items-center justify-center gap-2 " +
  "transition-[box-shadow,translate,opacity,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "hover:bg-[#EDF3FA] hover:shadow-[0_10px_26px_-6px_rgba(86,127,178,0.75)] " +
  "motion-safe:hover:translate-y-[-1px] motion-safe:active:translate-y-[0px] active:shadow-[0_4px_14px_-6px_rgba(86,127,178,0.6)] " +
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(188,216,240,0.45)] " +
  "disabled:opacity-60 disabled:shadow-none disabled:translate-y-[0px] disabled:bg-white disabled:cursor-not-allowed";
