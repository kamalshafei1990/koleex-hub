import { forwardRef } from "react";

const HrIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm0,4a3,3,0,1,1-3,3A3,3,0,0,1,12,4Zm5,14.5a.5.5,0,0,1-.5.5h-9a.5.5,0,0,1-.5-.5v-1A3.5,3.5,0,0,1,10.5,14h3A3.5,3.5,0,0,1,17,17.5ZM19.91,17A5.508,5.508,0,0,0,15,13H14a4.977,4.977,0,0,0,2-4A5,5,0,0,0,8,7.05,4.977,4.977,0,0,0,10,13H9a5.508,5.508,0,0,0-4.91,4,9.97,9.97,0,1,1,15.82,0Z" />
      </svg>
    );
  },
);
HrIcon.displayName = "HrIcon";
export default HrIcon;
