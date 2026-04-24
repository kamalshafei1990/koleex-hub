import { forwardRef } from "react";

/* Long-arm machine — extended horizontal reach from the column to
   the needle so oversized work (quilts, sails, tarps, upholstery)
   can pass through the throat. */
const LongArmMachineIcon = forwardRef<
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
      {/* long top arm */}
      <path d="M3 9 H18 a2 2 0 0 1 2 2 v2 a2 2 0 0 1-2 2 h-1" />
      {/* needle dropping from far left end */}
      <path d="M3.5 9 V16" />
      {/* work bed */}
      <path d="M2 19 H22" />
      {/* reach indicator arrows */}
      <path d="M6 12 H14" />
      <path d="M6 12 l1.2 1.2" />
      <path d="M14 12 l-1.2 1.2" />
    </svg>
  );
});
LongArmMachineIcon.displayName = "LongArmMachineIcon";
export default LongArmMachineIcon;
