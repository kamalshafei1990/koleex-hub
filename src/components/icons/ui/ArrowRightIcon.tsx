import { forwardRef } from "react";

const ArrowRightIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    /* Platform-wide design decision (2026-10-03, Kamal): the right/next
       glyph is the slim chevron — mirrors ArrowLeftIcon so prev/next
       pairs stay symmetric. Same shape as AngleRightIcon. */
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M7,24a1,1,0,0,1-.71-.29,1,1,0,0,1,0-1.42l8.17-8.17a3,3,0,0,0,0-4.24L6.29,1.71A1,1,0,0,1,7.71.29l8.17,8.17a5,5,0,0,1,0,7.08L7.71,23.71A1,1,0,0,1,7,24Z"/>
      </svg>
    );
  },
);
ArrowRightIcon.displayName = "ArrowRightIcon";
export default ArrowRightIcon;
