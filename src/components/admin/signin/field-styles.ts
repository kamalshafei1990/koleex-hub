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
