import { forwardRef } from "react";

/* CrossLineIcon — close, leave, end. The outline twin of CrossIcon, for surfaces drawn only
   in outline (the call screen: "icons are outline, never filled"), where the
   older filled glyph sits beside stroke icons at a visibly different weight.
   House grammar — 24-grid, 2px round-capped, minimal (owner, 2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const CrossLineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    );
  },
);
CrossLineIcon.displayName = "CrossLineIcon";
export default CrossLineIcon;
