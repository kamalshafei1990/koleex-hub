import { forwardRef } from "react";

const BackspaceIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path fillRule="evenodd" d="M8.5 5a2 2 0 0 0-1.6.8L2.3 12l4.6 6.2a2 2 0 0 0 1.6.8H21a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8.5Zm4.2 4.3a1 1 0 0 1 1.4 0l1.4 1.4 1.4-1.4a1 1 0 1 1 1.4 1.4l-1.4 1.4 1.4 1.4a1 1 0 1 1-1.4 1.4l-1.4-1.4-1.4 1.4a1 1 0 1 1-1.4-1.4l1.4-1.4-1.4-1.4a1 1 0 0 1 0-1.4Z" clipRule="evenodd"/>
      </svg>
    );
  },
);
BackspaceIcon.displayName = "BackspaceIcon";
export default BackspaceIcon;
