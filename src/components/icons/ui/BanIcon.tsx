import { forwardRef } from "react";

const BanIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm0,2a9.949,9.949,0,0,1,6.324,2.262L4.262,18.324A9.992,9.992,0,0,1,12,2Zm0,20a9.949,9.949,0,0,1-6.324-2.262L19.738,5.676A9.992,9.992,0,0,1,12,22Z"/>
      </svg>
    );
  },
);
BanIcon.displayName = "BanIcon";
export default BanIcon;
