import { forwardRef } from "react";

/* Pattern sewer / CNC template machine — programmed head traces a
   pattern. Render as a tracked shape with a dotted path and a
   programmable crosshair / needle head tracking it. */
const PatternSewerIcon = forwardRef<
  SVGSVGElement,
  { size?: number | string; className?: string; style?: React.CSSProperties }
>(({ size = 24, className, style, ...rest }, ref) => {
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
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* programmed pattern — dashed rounded rectangle */}
      <path
        d="M5 6 H16 a3 3 0 0 1 3 3 V15 a3 3 0 0 1-3 3 H8 a3 3 0 0 1-3-3 Z"
        strokeDasharray="1.5 1.8"
      />
      {/* needle head crosshair on the pattern */}
      <circle cx="14" cy="9" r="1.6" />
      <path d="M14 6.5 V7.5" />
      <path d="M14 10.5 V11.5" />
      <path d="M11.5 9 H12.5" />
      <path d="M15.5 9 H16.5" />
    </svg>
  );
});
PatternSewerIcon.displayName = "PatternSewerIcon";
export default PatternSewerIcon;
