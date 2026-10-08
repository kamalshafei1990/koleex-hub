import { forwardRef } from "react";

/* Timeline / Gantt view — a time axis with three staggered bars. House
   grammar: 24-grid, stroke 2, round caps and joins, minimal geometry. */
const GanttChartIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M3 3v18h18" />
        <path d="M7 7h8" />
        <path d="M10 12h9" />
        <path d="M7 17h6" />
      </svg>
    );
  },
);
GanttChartIcon.displayName = "GanttChartIcon";
export default GanttChartIcon;
