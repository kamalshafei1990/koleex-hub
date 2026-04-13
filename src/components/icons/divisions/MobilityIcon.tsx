import { forwardRef } from "react";

const MobilityIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M20.9,4.291A5.011,5.011,0,0,0,16.2,1H7.8A5.011,5.011,0,0,0,3.1,4.291L.4,11.718A6.664,6.664,0,0,0,0,14v1a4.979,4.979,0,0,0,2,3.978c0,.008,0,.014,0,.022v2a3,3,0,0,0,6,0V20h8v1a3,3,0,0,0,6,0V19c0-.008,0-.014,0-.022A4.979,4.979,0,0,0,24,15V14a6.654,6.654,0,0,0-.4-2.281ZM4.982,4.975A3.009,3.009,0,0,1,7.8,3h8.4a3.009,3.009,0,0,1,2.82,1.975L21.208,11H2.791ZM6,21a1,1,0,0,1-2,0V19.9A5,5,0,0,0,5,20H6Zm14,0a1,1,0,0,1-2,0V20h1a5,5,0,0,0,1-.1Zm2-6a3,3,0,0,1-3,3H5a3,3,0,0,1-3-3V14a4.659,4.659,0,0,1,.121-1H4v1a1,1,0,0,0,2,0V13H18v1a1,1,0,0,0,2,0V13h1.879A4.652,4.652,0,0,1,22,14Z"/>
      </svg>
    );
  },
);
MobilityIcon.displayName = "MobilityIcon";
export default MobilityIcon;
