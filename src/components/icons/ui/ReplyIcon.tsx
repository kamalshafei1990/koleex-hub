import { forwardRef } from "react";

const ReplyIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M23,2c-.55,0-1,.45-1,1V11c0,1.65-1.35,3-3,3H2.58l5.14-5.3c.38-.4,.37-1.03-.02-1.41-.4-.38-1.03-.38-1.41,.02L.88,12.88c-1.17,1.17-1.17,3.07-.01,4.23l5.41,5.59c.2,.2,.46,.3,.72,.3s.5-.09,.7-.28c.4-.38,.41-1.02,.02-1.41l-5.14-5.3H19c2.76,0,5-2.24,5-5V3c0-.55-.45-1-1-1Z"/>
      </svg>
    );
  },
);
ReplyIcon.displayName = "ReplyIcon";
export default ReplyIcon;
