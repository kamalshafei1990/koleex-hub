import { forwardRef } from "react";

/* Overlock / serger — edge trim + overedge stitch. Represented as
   a fabric edge being trimmed (blade) with looping stitches
   wrapping over the edge. */
const OverlockMachineIcon = forwardRef<
  SVGSVGElement,
  { size?: number | string; className?: string; style?: React.CSSProperties }
>(({ size = 24, className, style, ...rest }, ref) => {
  const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* fabric edge (horizontal line) */}
      <path d="M3 14 H21" />
      {/* overlock wrap-stitch loops on top of the edge */}
      <path d="M5 14 C 6.5 9, 8.5 9, 10 14 S 13.5 9, 15 14 S 18.5 9, 20 14" />
      {/* trim blade on the right, cutting into the edge */}
      <path d="M19 7 L22 10 L20 12 L17 9 Z" fill="currentColor" stroke="none" />
      {/* chevron chip on the blade to signal cutting */}
      <path d="M18 10 L20 10" stroke="var(--bg-primary, #0A0A0A)" />
    </svg>
  );
});
OverlockMachineIcon.displayName = "OverlockMachineIcon";
export default OverlockMachineIcon;
