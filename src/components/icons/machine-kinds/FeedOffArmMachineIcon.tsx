import { forwardRef } from "react";

/* Feed-off-the-arm — the narrow arm extends to the operator with
   the feed dog pulling fabric off the end. Used for jeans inseams,
   shirt side seams, tubular bottom hems. */
const FeedOffArmMachineIcon = forwardRef<
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
      {/* machine head on right */}
      <path d="M11 10 V6 a2 2 0 0 1 2-2 h6 a2 2 0 0 1 2 2 v4 a2 2 0 0 1-2 2 h-4" />
      {/* needle drop */}
      <path d="M15 12 V14" />
      {/* narrow arm extending left, terminating in rounded cap */}
      <rect x="2" y="14" width="13" height="3.5" rx="1.7" />
      {/* feed direction chevrons moving leftward off the arm */}
      <path d="M6 19 l-2 1" />
      <path d="M9 19 l-2 1" />
    </svg>
  );
});
FeedOffArmMachineIcon.displayName = "FeedOffArmMachineIcon";
export default FeedOffArmMachineIcon;
