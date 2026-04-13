import { forwardRef } from "react";

const CalculatorIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m18 24h-12a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h12a5.006 5.006 0 0 1 5 5v14a5.006 5.006 0 0 1 -5 5zm-12-22a3 3 0 0 0 -3 3v14a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-14a3 3 0 0 0 -3-3zm10 8h-8a3 3 0 0 1 0-6h8a3 3 0 0 1 0 6zm-8-4a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2zm-2 7a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm-8 4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm4 0a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm8-4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm1 5a1 1 0 0 0 -1-1h-4a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1z"/>
      </svg>
    );
  },
);
CalculatorIcon.displayName = "CalculatorIcon";
export default CalculatorIcon;
