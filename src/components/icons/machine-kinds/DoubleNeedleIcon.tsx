import { forwardRef } from "react";

/* Two parallel needles — archetype for all double-needle machines
   (fixed bar, split bar, long arm, walking foot variants etc.). */
const DoubleNeedleIcon = forwardRef<
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
      {/* needle bar housing */}
      <rect x="7" y="3" width="10" height="5" rx="1.5" />
      {/* two needles */}
      <path d="M10 8 V17" />
      <path d="M14 8 V17" />
      {/* needle tips (small triangles) */}
      <path d="M9.3 17 h1.4 L10 18.5 z" fill="currentColor" stroke="none" />
      <path d="M13.3 17 h1.4 L14 18.5 z" fill="currentColor" stroke="none" />
      {/* work surface */}
      <path d="M3 21 H21" />
    </svg>
  );
});
DoubleNeedleIcon.displayName = "DoubleNeedleIcon";
export default DoubleNeedleIcon;
