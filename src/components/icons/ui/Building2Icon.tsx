import { forwardRef } from "react";

const Building2Icon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m7 14a1 1 0 0 1 -1 1h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 1 1zm4-1h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5 4h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5-12h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5 4h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm13 1v9a5.006 5.006 0 0 1 -5 5h-14a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h6a5.006 5.006 0 0 1 5 5h3a5.006 5.006 0 0 1 5 5zm-19 12h9v-17a3 3 0 0 0 -3-3h-6a3 3 0 0 0 -3 3v14a3 3 0 0 0 3 3zm17-12a3 3 0 0 0 -3-3h-3v15h3a3 3 0 0 0 3-3zm-3 3a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm0 4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm0-8a1 1 0 1 0 1 1 1 1 0 0 0 -1-1z"/>
      </svg>
    );
  },
);
Building2Icon.displayName = "Building2Icon";
export default Building2Icon;
