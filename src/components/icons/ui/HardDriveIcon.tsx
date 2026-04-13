import { forwardRef } from "react";

const HardDriveIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m16 19.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5Zm2.5-1.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5Zm4.5-1.8v2.8c0 2.757-2.243 5-5 5h-12c-2.757 0-5-2.243-5-5v-2.8c.005-.168.013-.329.025-.498l1.12-11.2c.256-2.566 2.396-4.502 4.975-4.502h9.76c2.58 0 4.719 1.936 4.976 4.502l1.12 11.199c.001.113.025.445.025.498Zm-19.895-1.2h17.79l-1.03-10.298c-.154-1.54-1.438-2.702-2.985-2.702h-9.76c-1.548 0-2.832 1.162-2.985 2.702Zm17.895 4v-2h-18v2c0 1.654 1.346 3 3 3h12c1.654 0 3-1.346 3-3Z"/>
      </svg>
    );
  },
);
HardDriveIcon.displayName = "HardDriveIcon";
export default HardDriveIcon;
