import { forwardRef } from "react";

const MoreHorizontalIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <circle cx="2" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="22" cy="12" r="2"/>
      </svg>
    );
  },
);
MoreHorizontalIcon.displayName = "MoreHorizontalIcon";
export default MoreHorizontalIcon;
