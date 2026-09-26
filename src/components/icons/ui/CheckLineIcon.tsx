import { forwardRef } from "react";

/* CheckLineIcon — done, chosen, saved. The outline twin of CheckIcon, for surfaces drawn only
   in outline (the call screen: "icons are outline, never filled"), where the
   older filled glyph sits beside stroke icons at a visibly different weight.
   House grammar — 24-grid, 2px round-capped, minimal (owner, 2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const CheckLineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  },
);
CheckLineIcon.displayName = "CheckLineIcon";
export default CheckLineIcon;
