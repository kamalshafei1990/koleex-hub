import { forwardRef } from "react";

const ScanLineIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M4,15v7c0,.552-.448,1-1,1s-1-.448-1-1v-7c0-.552,.448-1,1-1s1,.448,1,1Zm14-1c-.552,0-1,.448-1,1v7c0,.552,.448,1,1,1s1-.448,1-1v-7c0-.552-.448-1-1-1Zm-8,0c-.552,0-1,.448-1,1v7c0,.552,.448,1,1,1s1-.448,1-1v-7c0-.552-.448-1-1-1Zm-3.5,0c-.829,0-1.5,.671-1.5,1.5v6c0,.829,.671,1.5,1.5,1.5s1.5-.671,1.5-1.5v-6c0-.829-.671-1.5-1.5-1.5Zm8,0c-.829,0-1.5,.671-1.5,1.5v6c0,.829,.671,1.5,1.5,1.5s1.5-.671,1.5-1.5v-6c0-.829-.671-1.5-1.5-1.5Zm6.5,0c-.552,0-1,.448-1,1v7c0,.552,.448,1,1,1s1-.448,1-1v-7c0-.552-.448-1-1-1Zm2-4h-1V2c0-.552-.448-1-1-1s-1,.448-1,1V10h-1V2c0-.552-.448-1-1-1s-1,.448-1,1V10h-1V2.5c0-.829-.671-1.5-1.5-1.5s-1.5,.671-1.5,1.5v7.5h-2V2c0-.552-.448-1-1-1s-1,.448-1,1V10h-1V2.5c0-.829-.671-1.5-1.5-1.5s-1.5,.671-1.5,1.5v7.5h-1V2c0-.552-.448-1-1-1s-1,.448-1,1V10H1c-.552,0-1,.448-1,1s.448,1,1,1H23c.552,0,1-.448,1-1s-.448-1-1-1Z"/>
      </svg>
    );
  },
);
ScanLineIcon.displayName = "ScanLineIcon";
export default ScanLineIcon;
