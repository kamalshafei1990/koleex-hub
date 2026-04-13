import { forwardRef } from "react";

const LayoutListIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M21,15H10.26c-.8,0-1.55-.31-2.12-.88l-1.42-1.41c-.19-.19-.29-.44-.29-.71s.11-.52,.29-.71l1.42-1.41c.57-.57,1.32-.88,2.12-.88h10.74c1.65,0,3,1.35,3,3s-1.35,3-3,3Zm-12.15-3l.71,.71c.19,.19,.44,.29,.71,.29h10.74c.55,0,1-.45,1-1s-.45-1-1-1H10.26c-.26,0-.52,.11-.71,.29h0l-.71,.71Zm9.15-6h-7.74c-.8,0-1.55-.31-2.12-.88l-1.42-1.41c-.19-.19-.29-.44-.29-.71s.11-.52,.29-.71l1.42-1.41c.57-.57,1.32-.88,2.12-.88h7.74c1.65,0,3,1.35,3,3s-1.35,3-3,3ZM8.85,3l.71,.71c.19,.19,.44,.29,.71,.29h7.74c.55,0,1-.45,1-1s-.45-1-1-1h-7.74c-.26,0-.52,.11-.71,.29h0l-.71,.71Zm7.15,21h-5.74c-.8,0-1.55-.31-2.12-.88l-1.42-1.41c-.19-.19-.29-.44-.29-.71s.11-.52,.29-.71l1.42-1.41c.57-.57,1.32-.88,2.12-.88h5.74c1.65,0,3,1.35,3,3s-1.35,3-3,3Zm-7.15-3l.71,.71c.19,.19,.44,.29,.71,.29h5.74c.55,0,1-.45,1-1s-.45-1-1-1h-5.74c-.26,0-.52,.11-.71,.29h0l-.71,.71Zm-6.85-2c-1.1,0-2,.9-2,2s.9,2,2,2,2-.9,2-2-.9-2-2-2Zm0-9c-1.1,0-2,.9-2,2s.9,2,2,2,2-.9,2-2-.9-2-2-2ZM2,1C.9,1,0,1.9,0,3s.9,2,2,2,2-.9,2-2S3.1,1,2,1Z"/>
      </svg>
    );
  },
);
LayoutListIcon.displayName = "LayoutListIcon";
export default LayoutListIcon;
