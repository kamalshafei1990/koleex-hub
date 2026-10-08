import { forwardRef } from "react";

/* Settings2LineIcon — settings, as three sliders. The outline twin of Settings2Icon, for surfaces drawn only
   in outline (the call screen: "icons are outline, never filled"), where the
   older filled glyph sits beside stroke icons at a visibly different weight.
   House grammar — 24-grid, 2px round-capped, minimal (owner, 2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const Settings2LineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <path d="M4 7h3M11 7h9M4 12h9M17 12h3M4 17h1M9 17h11" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="7" cy="17" r="2" />
      </svg>
    );
  },
);
Settings2LineIcon.displayName = "Settings2LineIcon";
export default Settings2LineIcon;
