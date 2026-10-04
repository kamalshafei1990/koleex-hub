import { forwardRef } from "react";

/* SunLineIcon — today, daytime. The outline twin of SunIcon, for surfaces drawn only
   in outline (the call screen: "icons are outline, never filled"), where the
   older filled glyph sits beside stroke icons at a visibly different weight.
   House grammar — 24-grid, 2px round-capped, minimal (owner, 2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const SunLineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  },
);
SunLineIcon.displayName = "SunLineIcon";
export default SunLineIcon;
