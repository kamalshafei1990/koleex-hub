import { forwardRef } from "react";

/* Dropdown / disclosure caret. House grammar: 24-grid, stroke, round caps,
   minimal geometry — the "▾" text glyph it replaces rendered in whatever
   font the platform picked and never matched the icon set beside it. */
const ChevronDownIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  },
);
ChevronDownIcon.displayName = "ChevronDownIcon";
export default ChevronDownIcon;
