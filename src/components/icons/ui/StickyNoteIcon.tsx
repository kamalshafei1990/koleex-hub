import { forwardRef } from "react";

const StickyNoteIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M19,0H5C2.24,0,0,2.24,0,5v14c0,2.76,2.24,5,5,5h11.34c1.34,0,2.59-.52,3.54-1.46l2.66-2.66c.94-.94,1.46-2.2,1.46-3.54V5c0-2.76-2.24-5-5-5ZM5,22c-1.65,0-3-1.35-3-3V5c0-1.65,1.35-3,3-3h14c1.65,0,3,1.35,3,3V15h-4c-1.65,0-3,1.35-3,3v4H5Zm13.46-.88c-.4,.4-.91,.68-1.46,.8v-3.93c0-.55,.45-1,1-1h3.93c-.12,.55-.4,1.06-.8,1.46l-2.66,2.66Z"/>
      </svg>
    );
  },
);
StickyNoteIcon.displayName = "StickyNoteIcon";
export default StickyNoteIcon;
