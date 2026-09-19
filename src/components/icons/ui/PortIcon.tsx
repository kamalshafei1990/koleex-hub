import { forwardRef } from "react";

/* PortIcon — a quay under a gantry crane with a box on the hook. A seaport, as opposed to a map pin.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const PortIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M2 21h20 M5 21V8h14v13 M5 8h14 M12 8v4 M10 12h4v3.5h-4z" />
      </svg>
    );
  },
);
PortIcon.displayName = "PortIcon";
export default PortIcon;
