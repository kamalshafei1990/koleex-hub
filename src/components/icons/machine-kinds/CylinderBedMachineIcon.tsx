import { forwardRef } from "react";

/* Cylinder-bed machine — narrow horizontal arm cantilevered from
   the right column so tubular work (sleeves, cuffs, shoes, gloves)
   can wrap around it. */
const CylinderBedMachineIcon = forwardRef<
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
      {/* upper arm */}
      <path d="M5 11 V7 a2 2 0 0 1 2-2 h11 a2 2 0 0 1 2 2 V9 a2 2 0 0 1-2 2 H9" />
      {/* needle */}
      <path d="M9 11 V13" />
      {/* cylinder bed — rounded capsule extending left */}
      <rect x="3" y="13" width="14" height="5" rx="2.5" />
      {/* hand wheel */}
      <circle cx="18" cy="7.5" r="1" />
    </svg>
  );
});
CylinderBedMachineIcon.displayName = "CylinderBedMachineIcon";
export default CylinderBedMachineIcon;
