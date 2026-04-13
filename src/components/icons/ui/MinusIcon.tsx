import { forwardRef } from "react";

const MinusIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <rect y="11" width="24" height="2" rx="1"/>
      </svg>
    );
  },
);
MinusIcon.displayName = "MinusIcon";
export default MinusIcon;
