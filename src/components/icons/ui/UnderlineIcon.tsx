import { forwardRef } from "react";

const UnderlineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M12,20a8.009,8.009,0,0,0,8-8V1a1,1,0,0,0-2,0V12A6,6,0,0,1,6,12V1A1,1,0,0,0,4,1V12A8.009,8.009,0,0,0,12,20Z"/><path d="M23,22H1a1,1,0,0,0,0,2H23a1,1,0,0,0,0-2Z"/>
      </svg>
    );
  },
);
UnderlineIcon.displayName = "UnderlineIcon";
export default UnderlineIcon;
