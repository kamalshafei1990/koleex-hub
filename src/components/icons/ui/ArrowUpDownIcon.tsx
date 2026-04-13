import { forwardRef } from "react";

const ArrowUpDownIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M11.293,17.707l-3.293,3.293V1c0-.553-.447-1-1-1s-1,.447-1,1V21l-3.293-3.293c-.391-.391-1.023-.391-1.414,0s-.391,1.023,0,1.414l4.293,4.293c.39,.39,.902,.585,1.414,.585s1.024-.195,1.414-.585l4.293-4.293c.391-.391,.391-1.023,0-1.414s-1.023-.391-1.414,0ZM22.707,6.293c.391-.391,.391-1.023,0-1.414L18.414,.586C18.024,.196,17.512,0,17,0s-1.024,.195-1.414,.585l-4.293,4.293c-.391,.391-.391,1.023,0,1.414s1.023,.391,1.414,0l3.293-3.293V23c0,.553,.447,1,1,1s1-.447,1-1V3l3.293,3.293c.391,.391,1.023,.391,1.414,0Z"/>
      </svg>
    );
  },
);
ArrowUpDownIcon.displayName = "ArrowUpDownIcon";
export default ArrowUpDownIcon;
