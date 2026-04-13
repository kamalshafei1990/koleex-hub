import { forwardRef } from "react";

const StethoscopeIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m24 9a3 3 0 1 0 -4 2.816v4.184a6 6 0 0 1 -12 0v-.08a7.006 7.006 0 0 0 6-6.92v-4a5.006 5.006 0 0 0 -5-5 1 1 0 0 0 0 2 3 3 0 0 1 3 3v4a5 5 0 0 1 -10 0v-4a3 3 0 0 1 3-3 1 1 0 0 0 0-2 5.006 5.006 0 0 0 -5 5v4a7.006 7.006 0 0 0 6 6.92v.08a8 8 0 0 0 16 0v-4.184a3 3 0 0 0 2-2.816zm-3 1a1 1 0 1 1 1-1 1 1 0 0 1 -1 1z"/>
      </svg>
    );
  },
);
StethoscopeIcon.displayName = "StethoscopeIcon";
export default StethoscopeIcon;
