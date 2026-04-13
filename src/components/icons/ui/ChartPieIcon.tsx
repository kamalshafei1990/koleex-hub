import { forwardRef } from "react";

const ChartPieIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm9.573,9.12-8.908,1.732a4.941,4.941,0,0,1-.368-.679l-3.34-7.7A9.987,9.987,0,0,1,21.573,9.12ZM12,22A9.995,9.995,0,0,1,7.124,3.278l3.338,7.691a7.011,7.011,0,0,0,2.167,2.772l6.653,5.092A9.966,9.966,0,0,1,12,22Zm8.5-4.755-6.125-4.688,7.581-1.473c.027.3.046.607.046.916A9.925,9.925,0,0,1,20.5,17.245Z"/>
      </svg>
    );
  },
);
ChartPieIcon.displayName = "ChartPieIcon";
export default ChartPieIcon;
