import { forwardRef } from "react";

/* SpinnerIcon — the inline size of the Koleex orb.

   THIS FILE IS THE SWEEP. 148 of the Hub's 173 `animate-spin` call sites are
   `<SpinnerIcon />`, so replacing what this renders
   replaces the loading language almost everywhere in one move, without
   touching 148 files and without 148 chances to get one wrong.

   It used to be an SVG arc tinted by `currentColor`. It is now the orb at its
   smallest — same shadows, same 2s clock, just without the lockup, which is
   illegible below about 72px. See .kx-orb in globals.css.

   TWO THINGS THE OLD CONTRACT DID THAT THIS HAS TO KEEP DOING:

   · Both sizing conventions. 119 call sites pass `size={14}`, 141 size it
     with `h-4 w-4`, and the old SVG served both because an HTML width
     attribute is a fallback that any CSS class overrides. A span has no such
     attribute, so the size classes live in @layer components — which every
     Tailwind utility outranks — and an explicit width is written inline only
     when the caller actually asked for one, or when it sized the icon
     neither way and would otherwise get a zero-wide box.

   · `animate-spin` is stripped. The orb turns itself; leaving the caller's
     class on would turn the wrapper too and run it at double speed. Every one
     of those 148 call sites passes it.

   Safe to change the element type: nothing in the repo passes a ref here. */

const SIZED = /\b[wh]-|\bsize-/;

const SpinnerIcon = forwardRef<
  HTMLSpanElement,
  { size?: number | string; className?: string; style?: React.CSSProperties }
>(({ size, className = "", style, ...rest }, ref) => {
  const cls = className.replace(/\banimate-spin\b/g, "").trim();
  const n = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  const px = n ?? (SIZED.test(className) ? undefined : 24);
  return (
    <span
      ref={ref}
      aria-hidden
      className={`kx-orb kx-orb--inline${cls ? ` ${cls}` : ""}`}
      style={px === undefined ? style : { width: px, height: px, ...style }}
      {...rest}
    >
      <span className="kx-orb-ball" />
    </span>
  );
});
SpinnerIcon.displayName = "SpinnerIcon";
export default SpinnerIcon;
