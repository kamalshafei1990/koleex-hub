import { forwardRef } from "react";

/* ArrowUpLineIcon — send, go up. The outline twin of ArrowUpIcon, for surfaces drawn only
   in outline (the call screen: "icons are outline, never filled"), where the
   older filled glyph sits beside stroke icons at a visibly different weight.
   House grammar — 24-grid, 2px round-capped, minimal (owner, 2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const ArrowUpLineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="6 11 12 5 18 11" />
      </svg>
    );
  },
);
ArrowUpLineIcon.displayName = "ArrowUpLineIcon";
export default ArrowUpLineIcon;
