import { forwardRef } from "react";

const SalesIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M19,4H17.9A5.009,5.009,0,0,0,13,0H11A5.009,5.009,0,0,0,6.1,4H5A5.006,5.006,0,0,0,0,9V19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V9A5.006,5.006,0,0,0,19,4ZM11,2h2a3,3,0,0,1,2.816,2H8.184A3,3,0,0,1,11,2ZM5,6H19a3,3,0,0,1,3,3v3H2V9A3,3,0,0,1,5,6ZM19,22H5a3,3,0,0,1-3-3V14h9v1a1,1,0,0,0,2,0V14h9v5A3,3,0,0,1,19,22Z" />
      </svg>
    );
  },
);
SalesIcon.displayName = "SalesIcon";
export default SalesIcon;
