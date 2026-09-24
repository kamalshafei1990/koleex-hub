import { forwardRef } from "react";

/* ThumbsDownIcon — a vote that this reply was not good. Drawn in the library's stroke grammar —
   24-grid, 2px round-capped, minimal — the one the owner set for new marks
   on 2026-09-14: "same style, same stroke size, rounded and minimal." A
   chosen vote passes fill="currentColor"; props otherwise match ui/. */
const ThumbsDownIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; fill?: string }>(
  ({ size = 24, className, style, fill = "none", ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={s}
        height={s}
        fill={fill}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </svg>
    );
  },
);
ThumbsDownIcon.displayName = "ThumbsDownIcon";
export default ThumbsDownIcon;
