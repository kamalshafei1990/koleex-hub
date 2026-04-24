import { forwardRef } from "react";

/* Walking foot / compound feed — two feet alternate to pull the
   top and bottom of the fabric together (stops layers shifting on
   heavy/slippery material). Render as a machine arm with two
   stacked presser feet descending. */
const WalkingFootMachineIcon = forwardRef<
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
      {/* machine arm */}
      <path d="M5 12 V6 a2 2 0 0 1 2-2 h11 a2 2 0 0 1 2 2 V10 a2 2 0 0 1-2 2 H10" />
      {/* two vertical presser bars (walking pair) */}
      <path d="M8.5 12 V16" />
      <path d="M11 12 V16" />
      {/* feet at bottom of bars */}
      <path d="M7.3 16 h2.4" strokeWidth={2.2} />
      <path d="M9.8 16 h2.4" strokeWidth={2.2} />
      {/* work bed */}
      <path d="M3 19 H21" />
    </svg>
  );
});
WalkingFootMachineIcon.displayName = "WalkingFootMachineIcon";
export default WalkingFootMachineIcon;
