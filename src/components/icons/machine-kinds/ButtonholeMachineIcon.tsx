import { forwardRef } from "react";

/* Buttonhole machine — a straight buttonhole shape (rectangle with
   short end bars). The eyelet / keyhole variant uses the same
   archetype since it's recognizable at a glance. */
const ButtonholeMachineIcon = forwardRef<
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
      {/* fabric rectangle */}
      <rect x="3" y="5" width="18" height="14" rx="2" />
      {/* buttonhole slit in the center */}
      <path d="M10 12 H14" strokeWidth="2.6" />
      {/* bar tacks at the ends of the slit */}
      <path d="M9.5 11 V13" strokeWidth="2.2" />
      <path d="M14.5 11 V13" strokeWidth="2.2" />
    </svg>
  );
});
ButtonholeMachineIcon.displayName = "ButtonholeMachineIcon";
export default ButtonholeMachineIcon;
