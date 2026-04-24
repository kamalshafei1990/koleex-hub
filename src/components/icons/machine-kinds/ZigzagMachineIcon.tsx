import { forwardRef } from "react";

/* Zigzag machine — stitch swings side-to-side. Render with a
   bold zigzag line plus a needle above and fabric edge below. */
const ZigzagMachineIcon = forwardRef<
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
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* zigzag stitch */}
      <path d="M3 10 L6 14 L9 10 L12 14 L15 10 L18 14 L21 10" />
      {/* fabric edge line */}
      <path d="M3 18 H21" />
      {/* needle icon top-left dropping to stitch start */}
      <path d="M4 4 V9" />
    </svg>
  );
});
ZigzagMachineIcon.displayName = "ZigzagMachineIcon";
export default ZigzagMachineIcon;
