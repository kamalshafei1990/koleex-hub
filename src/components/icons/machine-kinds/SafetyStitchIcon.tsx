import { forwardRef } from "react";

/* Safety stitch (5-thread) — overlock edge-wrap combined with a
   separate chainstitch row for extra seam strength. Render as
   overlock loops on the edge plus a chainstitch line parallel. */
const SafetyStitchIcon = forwardRef<
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
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* fabric edge (upper) */}
      <path d="M3 9 H21" />
      {/* overlock loops wrapping the upper edge */}
      <path d="M4 9 C 5.5 5, 7.5 5, 9 9 S 12.5 5, 14 9 S 17.5 5, 19 9" />
      {/* parallel chainstitch seam (lower) */}
      <ellipse cx="5" cy="15" rx="1.8" ry="1" />
      <ellipse cx="9" cy="15" rx="1.8" ry="1" />
      <ellipse cx="13" cy="15" rx="1.8" ry="1" />
      <ellipse cx="17" cy="15" rx="1.8" ry="1" />
      {/* fabric base */}
      <path d="M3 19 H21" />
    </svg>
  );
});
SafetyStitchIcon.displayName = "SafetyStitchIcon";
export default SafetyStitchIcon;
