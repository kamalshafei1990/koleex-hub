import { forwardRef } from "react";

/* Chainstitch — a single thread forms a chain of loops on the
   underside. Render as a string of connected oval loops. */
const ChainstitchIcon = forwardRef<
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
      {/* chain of 4 overlapping ovals */}
      <ellipse cx="5.5" cy="12" rx="2.8" ry="1.6" />
      <ellipse cx="11" cy="12" rx="2.8" ry="1.6" />
      <ellipse cx="16.5" cy="12" rx="2.8" ry="1.6" />
      <ellipse cx="22" cy="12" rx="1.5" ry="1.2" />
      {/* feed thread entering from the left */}
      <path d="M0.5 12 H2.5" />
    </svg>
  );
});
ChainstitchIcon.displayName = "ChainstitchIcon";
export default ChainstitchIcon;
