import { forwardRef } from "react";

/* Special / miscellaneous — a generic sewing machine silhouette
   with a small star accent to signal "speciality". Used as a
   fallback for one-off machines that don't map to a standard
   archetype. */
const SpecialMachineIcon = forwardRef<
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
      <path d="M3 16 V10 a2 2 0 0 1 2-2 h10 a2 2 0 0 1 2 2 V13 a2 2 0 0 1-2 2 H7" />
      {/* needle */}
      <path d="M7 15 V17" />
      {/* work bed */}
      <path d="M2 19 H18" />
      {/* sparkle accent top-right */}
      <path
        d="M20 4 L21 6.5 L23.5 7.5 L21 8.5 L20 11 L19 8.5 L16.5 7.5 L19 6.5 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
});
SpecialMachineIcon.displayName = "SpecialMachineIcon";
export default SpecialMachineIcon;
