import { forwardRef } from "react";

const PercentIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M1,24c-.256,0-.512-.098-.707-.293-.391-.391-.391-1.023,0-1.414L22.293,.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414L1.707,23.707c-.195,.195-.451,.293-.707,.293ZM9,5c0-2.206-1.794-4-4-4S1,2.794,1,5s1.794,4,4,4,4-1.794,4-4Zm-2,0c0,1.103-.897,2-2,2s-2-.897-2-2,.897-2,2-2,2,.897,2,2Zm16,14c0-2.206-1.794-4-4-4s-4,1.794-4,4,1.794,4,4,4,4-1.794,4-4Zm-2,0c0,1.103-.897,2-2,2s-2-.897-2-2,.897-2,2-2,2,.897,2,2Z"/>
      </svg>
    );
  },
);
PercentIcon.displayName = "PercentIcon";
export default PercentIcon;
