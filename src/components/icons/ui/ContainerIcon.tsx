import { forwardRef } from "react";

/* ContainerIcon — a shipping container, corrugated sides and end frame. The unit FCL is priced in.
   Drawn in the library's stroke grammar — 24-grid, 2px round-capped, minimal —
   the one the owner set for new marks on 2026-09-14: "same style, same stroke
   size, rounded and minimal." Props match every other icon in ui/. */
const ContainerIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M3 7.5h18a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z M6.5 7.5v9 M10 7.5v9 M14 7.5v9 M17.5 7.5v9" />
      </svg>
    );
  },
);
ContainerIcon.displayName = "ContainerIcon";
export default ContainerIcon;
