import { forwardRef } from "react";

/* Blindstitch / blind hem — the top thread barely catches the
   face of the fabric. Render as a fabric fold with a dashed (so
   "barely there") stitch tracking along the fold. */
const BlindstitchIcon = forwardRef<
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
      {/* folded hem outline — main body then a folded flap */}
      <path d="M3 8 H21" />
      <path d="M3 8 V17" />
      <path d="M21 8 V17" />
      <path d="M3 17 H21" />
      {/* inner fold line (where the blindstitch runs) */}
      <path d="M3 14 H21" />
      {/* dashed blindstitch barely visible along the fold */}
      <path d="M5 11 l1.5 0 m2 0 l1.5 0 m2 0 l1.5 0 m2 0 l1.5 0 m2 0 l1.5 0" />
    </svg>
  );
});
BlindstitchIcon.displayName = "BlindstitchIcon";
export default BlindstitchIcon;
