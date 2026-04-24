import { forwardRef } from "react";

/* Flat-bed sewing machine — the default industrial silhouette.
   Arched arm from right-hand column, horizontal work bed below,
   needle dropping to the throat plate. Used for any kind whose
   archetype is the standard flat-bed lockstitch / chainstitch /
   zigzag etc. */
const FlatBedMachineIcon = forwardRef<
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
      {/* machine arm */}
      <path d="M5 18 V9 a2 2 0 0 1 2-2 h11 a2 2 0 0 1 2 2 V12 a2 2 0 0 1-2 2 H9" />
      {/* needle */}
      <path d="M9 14 V17" />
      {/* work bed */}
      <path d="M3 18 H21" />
      {/* hand wheel */}
      <circle cx="18" cy="10.5" r="1" />
    </svg>
  );
});
FlatBedMachineIcon.displayName = "FlatBedMachineIcon";
export default FlatBedMachineIcon;
