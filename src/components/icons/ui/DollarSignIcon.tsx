import { forwardRef } from "react";

const DollarSignIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M13.932,4A3.071,3.071,0,0,1,17,7.068a1,1,0,0,0,2,0V7c0-.019,0-.036,0-.055A5.073,5.073,0,0,0,13.932,2H13V1a1,1,0,0,0-2,0V2h-.932a5.068,5.068,0,0,0-1.6,9.875L11,12.72V20h-.932A3.071,3.071,0,0,1,7,16.932a1,1,0,0,0-2,0V17c0,.019,0,.036,0,.055A5.073,5.073,0,0,0,10.068,22H11v1a1,1,0,0,0,2,0V22h.932a5.068,5.068,0,0,0,1.6-9.875L13,11.28V4Zm.97,10.021A3.068,3.068,0,0,1,13.932,20H13V13.387ZM11,10.613,9.1,9.979A3.068,3.068,0,0,1,10.068,4H11Z"/>
      </svg>
    );
  },
);
DollarSignIcon.displayName = "DollarSignIcon";
export default DollarSignIcon;
