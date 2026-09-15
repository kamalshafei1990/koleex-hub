import { forwardRef } from "react";

/* WeightIcon — the classic scale weight. Gross, volumetric and chargeable weight all hang off this one mark.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const WeightIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M12 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z M8.75 7.5h6.5l2.7 11.1a2 2 0 0 1-1.95 2.4H8a2 2 0 0 1-1.95-2.4L8.75 7.5Z" />
      </svg>
    );
  },
);
WeightIcon.displayName = "WeightIcon";
export default WeightIcon;
