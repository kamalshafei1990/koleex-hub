import { forwardRef } from "react";

/* RouteIcon — origin node, a turn, destination node. The lane itself, not a map.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const RouteIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M6 20.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z M18 8a2.25 2.25 0 1 0 0-4.5A2.25 2.25 0 0 0 18 8Z M8.5 18.25h4a3.5 3.5 0 0 0 3.5-3.5v-4.5" />
      </svg>
    );
  },
);
RouteIcon.displayName = "RouteIcon";
export default RouteIcon;
