import { forwardRef } from "react";

const ArrowLeftIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    /* Platform-wide design decision (2026-10-03, Kamal): the left/back
       glyph is the slim chevron everywhere in Koleex Hub — same shape as
       AngleLeftIcon. Kept under this component name so every existing
       back chip / pager picks it up with zero call-site edits. */
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M17.17,24a1,1,0,0,1-.71-.29L8.29,15.54a5,5,0,0,1,0-7.08L16.46.29a1,1,0,1,1,1.42,1.42L9.71,9.88a3,3,0,0,0,0,4.24l8.17,8.17a1,1,0,0,1,0,1.42A1,1,0,0,1,17.17,24Z"/>
      </svg>
    );
  },
);
ArrowLeftIcon.displayName = "ArrowLeftIcon";
export default ArrowLeftIcon;
