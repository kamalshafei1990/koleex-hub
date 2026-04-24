import { forwardRef } from "react";

/* Automatic / robotic sewing cell — machine silhouette with a
   "gear + spark" overlay signalling automation. Used for
   automatic sleeve setters, waistband attachers, robotic cells. */
const AutomaticMachineIcon = forwardRef<
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
      <path d="M3 15 V9 a2 2 0 0 1 2-2 h9 a2 2 0 0 1 2 2 V12 a2 2 0 0 1-2 2 H7" />
      {/* needle */}
      <path d="M7 14 V16" />
      {/* work bed */}
      <path d="M2 18 H16" />
      {/* automation gear top-right */}
      <circle cx="19" cy="7" r="3" />
      <path d="M19 4 V5" />
      <path d="M19 9 V10" />
      <path d="M16 7 H17" />
      <path d="M21 7 H22" />
      <path d="M16.9 4.9 L17.6 5.6" />
      <path d="M20.4 8.4 L21.1 9.1" />
      <path d="M21.1 4.9 L20.4 5.6" />
      <path d="M17.6 8.4 L16.9 9.1" />
    </svg>
  );
});
AutomaticMachineIcon.displayName = "AutomaticMachineIcon";
export default AutomaticMachineIcon;
