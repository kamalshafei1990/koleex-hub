import { forwardRef } from "react";

/* Heavy-duty — thicker machine silhouette with a reinforcement
   mark. Used for jeans, leather, canvas, sail-making, harness. */
const HeavyDutyMachineIcon = forwardRef<
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
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* thick machine arm */}
      <path d="M5 17 V8 a2 2 0 0 1 2-2 h11 a2 2 0 0 1 2 2 V12 a2 2 0 0 1-2 2 H9" />
      {/* thick needle */}
      <path d="M9 14 V17" strokeWidth={2.6} />
      {/* reinforced work bed — double line */}
      <path d="M3 19 H21" />
      <path d="M3 21 H21" />
      {/* shield / HD mark on the arm */}
      <path d="M13 9 L13 11 L14.5 11.8 L16 11 V9 Z" fill="currentColor" stroke="none" />
    </svg>
  );
});
HeavyDutyMachineIcon.displayName = "HeavyDutyMachineIcon";
export default HeavyDutyMachineIcon;
