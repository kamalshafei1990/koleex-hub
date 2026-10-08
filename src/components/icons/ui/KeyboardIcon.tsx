import { forwardRef } from "react";

/* KeyboardIcon — "type instead of speaking". Drawn in the library's stroke
   grammar — 24-grid, 2px round-capped, minimal — the one the owner set for
   new marks on 2026-09-14: "same style, same stroke size, rounded and
   minimal." Props match every other icon in ui/. */
const KeyboardIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M8 16h8" />
      </svg>
    );
  },
);
KeyboardIcon.displayName = "KeyboardIcon";
export default KeyboardIcon;
