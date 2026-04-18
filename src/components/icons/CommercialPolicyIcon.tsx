import { forwardRef } from "react";

const CommercialPolicyIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-9h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h5v1.5H8V17z" />
      </svg>
    );
  },
);
CommercialPolicyIcon.displayName = "CommercialPolicyIcon";
export default CommercialPolicyIcon;
