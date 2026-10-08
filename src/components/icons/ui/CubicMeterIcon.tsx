import { forwardRef } from "react";

/* CubicMeterIcon — a cube divided into units: volume, the thing LCL is sold by. Distinct from the plain carton cube in PackingTypeIcon, which means a box.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const CubicMeterIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9Z M3.5 7.5 12 12.5l8.5-5 M12 12.5v9 M7.75 10v4.75 M16.25 10v4.75" />
      </svg>
    );
  },
);
CubicMeterIcon.displayName = "CubicMeterIcon";
export default CubicMeterIcon;
