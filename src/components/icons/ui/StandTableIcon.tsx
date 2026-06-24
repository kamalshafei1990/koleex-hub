import { forwardRef } from "react";

/* A garment-machine stand / table: tabletop + two legs + a lower stretcher.
   Outline style (matches the brand's line-icon language). */
const StandTableIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        {/* tabletop */}
        <path d="M2.5 7.5h19" />
        {/* legs */}
        <path d="M5 7.5v13" />
        <path d="M19 7.5v13" />
        {/* lower stretcher */}
        <path d="M5 16.5h14" />
      </svg>
    );
  },
);
StandTableIcon.displayName = "StandTableIcon";
export default StandTableIcon;
