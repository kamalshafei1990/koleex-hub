import { forwardRef } from "react";

const LineChartIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M24,23c0,.552-.448,1-1,1H3c-1.654,0-3-1.346-3-3V1C0,.448,.448,0,1,0s1,.448,1,1V21c0,.551,.449,1,1,1H23c.552,0,1,.448,1,1Zm-3-18h-4c-.552,0-1,.448-1,1s.448,1,1,1h3.563l-4.857,4.707c-.377,.378-1.036,.378-1.413,0-.041-.04-1.239-.893-1.239-.893-1.138-1.073-3.077-1.033-4.162,.051l-4.586,4.414c-.398,.383-.41,1.016-.027,1.414,.197,.204,.458,.307,.721,.307,.25,0,.5-.093,.693-.279l4.6-4.428c.377-.378,1.036-.378,1.413,0,.041,.04,1.239,.893,1.239,.893,1.139,1.074,3.076,1.036,4.164-.054l4.89-4.74v3.607c0,.552,.448,1,1,1s1-.448,1-1v-4c0-1.654-1.346-3-3-3Z"/>
      </svg>
    );
  },
);
LineChartIcon.displayName = "LineChartIcon";
export default LineChartIcon;
