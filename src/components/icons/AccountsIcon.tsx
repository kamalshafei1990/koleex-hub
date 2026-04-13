import { forwardRef } from "react";

const AccountsIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M19,0H5A5.006,5.006,0,0,0,0,5V19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V5A5.006,5.006,0,0,0,19,0ZM7,22V21a5,5,0,0,1,10,0v1Zm15-3a3,3,0,0,1-3,3V21A7,7,0,0,0,5,21v1a3,3,0,0,1-3-3V5A3,3,0,0,1,5,2H19a3,3,0,0,1,3,3Z" />
        <path d="M12,4a4,4,0,1,0,4,4A4,4,0,0,0,12,4Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,10Z" />
      </svg>
    );
  },
);
AccountsIcon.displayName = "AccountsIcon";
export default AccountsIcon;
