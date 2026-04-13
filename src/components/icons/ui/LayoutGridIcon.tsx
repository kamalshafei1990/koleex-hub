import { forwardRef } from "react";

const LayoutGridIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M4.5,17.5H2a2,2,0,0,0-2,2V22a2,2,0,0,0,2,2H4.5a2,2,0,0,0,2-2V19.5A2,2,0,0,0,4.5,17.5Zm0,4.5H2V19.5H4.5Z"/><path d="M22,17.5H19.5a2,2,0,0,0-2,2V22a2,2,0,0,0,2,2H22a2,2,0,0,0,2-2V19.5A2,2,0,0,0,22,17.5ZM22,22H19.5V19.5H22Z"/><path d="M4.5,8.75H2a2,2,0,0,0-2,2v2.5a2,2,0,0,0,2,2H4.5a2,2,0,0,0,2-2v-2.5A2,2,0,0,0,4.5,8.75Zm0,4.5H2v-2.5H4.5Z"/><path d="M22,8.75H19.5a2,2,0,0,0-2,2v2.5a2,2,0,0,0,2,2H22a2,2,0,0,0,2-2v-2.5A2,2,0,0,0,22,8.75Zm0,4.5H19.5v-2.5H22Z"/><path d="M4.5,0H2A2,2,0,0,0,0,2V4.5a2,2,0,0,0,2,2H4.5a2,2,0,0,0,2-2V2A2,2,0,0,0,4.5,0Zm0,4.5H2V2H4.5Z"/><path d="M13.25,17.5h-2.5a2,2,0,0,0-2,2V22a2,2,0,0,0,2,2h2.5a2,2,0,0,0,2-2V19.5A2,2,0,0,0,13.25,17.5Zm0,4.5h-2.5V19.5h2.5Z"/><path d="M13.25,8.75h-2.5a2,2,0,0,0-2,2v2.5a2,2,0,0,0,2,2h2.5a2,2,0,0,0,2-2v-2.5A2,2,0,0,0,13.25,8.75Zm0,4.5h-2.5v-2.5h2.5Z"/><path d="M13.25,0h-2.5a2,2,0,0,0-2,2V4.5a2,2,0,0,0,2,2h2.5a2,2,0,0,0,2-2V2A2,2,0,0,0,13.25,0Zm0,4.5h-2.5V2h2.5Z"/><path d="M22,0H19.5a2,2,0,0,0-2,2V4.5a2,2,0,0,0,2,2H22a2,2,0,0,0,2-2V2A2,2,0,0,0,22,0Zm0,4.5H19.5V2H22Z"/>
      </svg>
    );
  },
);
LayoutGridIcon.displayName = "LayoutGridIcon";
export default LayoutGridIcon;
