import { forwardRef } from "react";

const ArrowUpRightIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M20,0H11c-.553,0-1,.448-1,1s.447,1,1,1h9c.179,0,.352,.024,.518,.068L.293,22.293c-.391,.391-.391,1.023,0,1.414,.195,.195,.451,.293,.707,.293s.512-.098,.707-.293L21.932,3.482c.044,.165,.068,.339,.068,.518V13c0,.552,.447,1,1,1s1-.448,1-1V4c0-2.206-1.794-4-4-4Z"/>
      </svg>
    );
  },
);
ArrowUpRightIcon.displayName = "ArrowUpRightIcon";
export default ArrowUpRightIcon;
