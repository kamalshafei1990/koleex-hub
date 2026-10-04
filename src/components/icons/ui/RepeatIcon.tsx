import { forwardRef } from "react";

/* RepeatIcon — two arrows chasing round a loop: a recurring item / series.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const RepeatIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
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
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        <path d="m17 2 4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3" />
      </svg>
    );
  },
);
RepeatIcon.displayName = "RepeatIcon";
export default RepeatIcon;
