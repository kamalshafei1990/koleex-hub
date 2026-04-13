import { forwardRef } from "react";

const ItalicIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M20,0H7A1,1,0,0,0,7,2h5.354L9.627,22H4a1,1,0,0,0,0,2H17a1,1,0,0,0,0-2H11.646L14.373,2H20a1,1,0,0,0,0-2Z"/>
      </svg>
    );
  },
);
ItalicIcon.displayName = "ItalicIcon";
export default ItalicIcon;
