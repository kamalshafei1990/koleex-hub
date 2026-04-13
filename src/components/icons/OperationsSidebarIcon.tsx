import { forwardRef } from "react";

const OperationsSidebarIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m10,23c0,.553-.447,1-1,1h-4c-2.757,0-5-2.243-5-5V5C0,2.243,2.243,0,5,0h6c2.757,0,5,2.243,5,5v4c0,.553-.447,1-1,1s-1-.447-1-1v-4c0-1.654-1.346-3-3-3h-6c-1.654,0-3,1.346-3,3v14c0,1.654,1.346,3,3,3h4c.553,0,1,.447,1,1Zm-4-10h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm5,0h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm-5,4h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm0-12h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm5,0h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm-5,4h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm5,0h-1c-.553,0-1,.447-1,1s.447,1,1,1h1c.553,0,1-.447,1-1s-.447-1-1-1Zm13,8.5v3c0,1.93-1.57,3.5-3.5,3.5h-5c-1.93,0-3.5-1.57-3.5-3.5v-3c0-1.758,1.308-3.204,3-3.449v-.051c0-1.103.897-2,2-2h2c1.103,0,2,.897,2,2v.051c1.692.245,3,1.691,3,3.449Zm-10,0v.5h8v-.5c0-.827-.673-1.5-1.5-1.5h-5c-.827,0-1.5.673-1.5,1.5Zm8,3v-.5h-3c0,.553-.447,1-1,1s-1-.447-1-1h-3v.5c0,.827.673,1.5,1.5,1.5h5c.827,0,1.5-.673,1.5-1.5Z" />
      </svg>
    );
  },
);
OperationsSidebarIcon.displayName = "OperationsSidebarIcon";
export default OperationsSidebarIcon;
