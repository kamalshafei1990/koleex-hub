import { forwardRef } from "react";

const InventoryIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M21,24c-1.654,0-3-1.346-3-3V13c0-.551-.448-1-1-1H7c-.552,0-1,.449-1,1v8c0,1.654-1.346,3-3,3s-3-1.346-3-3V9.724c0-1.665,.824-3.214,2.203-4.145L9.203,.855c1.699-1.146,3.895-1.146,5.594,0l7,4.724c1.379,.931,2.203,2.48,2.203,4.145v11.276c0,1.654-1.346,3-3,3ZM7,10h10c1.654,0,3,1.346,3,3v8c0,.551,.448,1,1,1s1-.449,1-1V9.724c0-.999-.494-1.929-1.322-2.487L13.678,2.513c-1.02-.688-2.336-.688-3.355,0L3.322,7.237c-.828,.558-1.322,1.488-1.322,2.487v11.276c0,.551,.448,1,1,1s1-.449,1-1V13c0-1.654,1.346-3,3-3Zm4,13v-2c0-.552-.447-1-1-1h-1c-.553,0-1,.448-1,1v2c0,.552,.447,1,1,1h1c.553,0,1-.448,1-1Zm0-6v-2c0-.552-.447-1-1-1h-1c-.553,0-1,.448-1,1v2c0,.552,.447,1,1,1h1c.553,0,1-.448,1-1Zm5,6v-2c0-.552-.447-1-1-1h-1c-.553,0-1,.448-1,1v2c0,.552,.447,1,1,1h1c.553,0,1-.448,1-1Z" />
      </svg>
    );
  },
);
InventoryIcon.displayName = "InventoryIcon";
export default InventoryIcon;
