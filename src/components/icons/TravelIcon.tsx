import { forwardRef } from "react";

/* Travel — a passport booklet: cover, an emblem, and the two machine-readable
   lines at the foot of the data page. Documents, not a plane, because the app
   is about the paperwork.

   Drawn from primitives rather than one long traced path. navigation.ts is
   imported by EVERY route, so this file's bytes land in the shared baseline of
   all 40 of them — the first draft traced a detailed globe and pushed
   commercial-policy past its budget by 1 KB. */
const TravelIcon = forwardRef<
  SVGSVGElement,
  { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }
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
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <circle cx="12" cy="9" r="3.2" />
      <path d="M12 5.8v6.4M8.8 9h6.4" />
      <path d="M8 16.4h8M8 19h5" />
    </svg>
  );
});
TravelIcon.displayName = "TravelIcon";
export default TravelIcon;
