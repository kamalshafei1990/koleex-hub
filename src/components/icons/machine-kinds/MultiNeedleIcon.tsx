import { forwardRef } from "react";

/* Multi-needle machine — 3+ needles for waistbands, elastics,
   smocking, quilting, and decorative parallel-row stitching. */
const MultiNeedleIcon = forwardRef<
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
      {/* needle bar housing (wider) */}
      <rect x="4" y="3" width="16" height="5" rx="1.5" />
      {/* four needles */}
      <path d="M7 8 V17" />
      <path d="M11 8 V17" />
      <path d="M15 8 V17" />
      <path d="M19 8 V17" />
      {/* tips */}
      <path d="M6.3 17 h1.4 L7 18.3 z" fill="currentColor" stroke="none" />
      <path d="M10.3 17 h1.4 L11 18.3 z" fill="currentColor" stroke="none" />
      <path d="M14.3 17 h1.4 L15 18.3 z" fill="currentColor" stroke="none" />
      <path d="M18.3 17 h1.4 L19 18.3 z" fill="currentColor" stroke="none" />
      {/* work surface */}
      <path d="M3 21 H21" />
    </svg>
  );
});
MultiNeedleIcon.displayName = "MultiNeedleIcon";
export default MultiNeedleIcon;
