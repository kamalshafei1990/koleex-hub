import { forwardRef } from "react";

const TableIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M19,2H5C2.243,2,0,4.243,0,7v10c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5V7c0-2.757-2.243-5-5-5ZM5,4h14c1.654,0,3,1.346,3,3H2c0-1.654,1.346-3,3-3Zm-3,13V9H7v11h-2c-1.654,0-3-1.346-3-3Zm17,3H9V9h13v8c0,1.654-1.346,3-3,3Z"/>
      </svg>
    );
  },
);
TableIcon.displayName = "TableIcon";
export default TableIcon;
