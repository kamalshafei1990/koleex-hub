import { forwardRef } from "react";

/* Coverstitch / Interlock / Flatlock — parallel top stitches with
   looper thread underneath. Rendered as two (or three) parallel
   stitch lines with the looper zigzag on the back. */
const CoverstitchIcon = forwardRef<
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
      {/* top parallel cover stitches (two rows of dashes) */}
      <path d="M3 8 l2 0 m2 0 l2 0 m2 0 l2 0 m2 0 l2 0 m2 0 l2 0" />
      <path d="M3 12 l2 0 m2 0 l2 0 m2 0 l2 0 m2 0 l2 0 m2 0 l2 0" />
      {/* looper zigzag underneath linking the two rows */}
      <path d="M4 8 L6 12 L8 8 L10 12 L12 8 L14 12 L16 8 L18 12 L20 8" />
      {/* fabric edge */}
      <path d="M3 16 H21" />
    </svg>
  );
});
CoverstitchIcon.displayName = "CoverstitchIcon";
export default CoverstitchIcon;
