import { forwardRef } from "react";

const PlugIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m22,7h-5V1c0-.552-.447-1-1-1s-1,.448-1,1v6h-6V1c0-.552-.447-1-1-1s-1,.448-1,1v6H2c-.553,0-1,.448-1,1s.447,1,1,1h1v3c0,4.624,3.506,8.445,8,8.944v2.056c0,.552.447,1,1,1s1-.448,1-1v-2.056c4.494-.499,8-4.32,8-8.944v-3h1c.553,0,1-.448,1-1s-.447-1-1-1Zm-3,5c0,3.86-3.141,7-7,7s-7-3.14-7-7v-3h14v3Z"/>
      </svg>
    );
  },
);
PlugIcon.displayName = "PlugIcon";
export default PlugIcon;
