import { forwardRef } from "react";

/* Bartack — short, dense reinforcing stitch at stress points
   (belt loops, pocket corners). Render as a compact bundle of
   parallel stitches bracketed by two end bars. */
const BartackIcon = forwardRef<
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
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* fabric field */}
      <rect x="3" y="5" width="18" height="14" rx="2" />
      {/* end bars */}
      <path d="M8 9 V15" strokeWidth="2.4" />
      <path d="M16 9 V15" strokeWidth="2.4" />
      {/* densely packed zigzag tacks */}
      <path d="M9 10 L15 11 L9 12 L15 13 L9 14 L15 14.8" />
    </svg>
  );
});
BartackIcon.displayName = "BartackIcon";
export default BartackIcon;
