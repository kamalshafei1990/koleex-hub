import { forwardRef } from "react";

const GarmentMachineryIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m20.815,1.195c-1.477-.793-3.032-1.195-4.625-1.195H7.81c-1.592,0-3.148.402-4.625,1.195C1.221,2.25,0,4.335,0,6.636v2.388c0,1.654,1.346,3,3,3h1v6.976c0,2.757,2.243,5,5,5h6c2.757,0,5-2.243,5-5v-7h1c1.654,0,3-1.346,3-3v-2.364c0-2.301-1.221-4.386-3.185-5.44Zm-5.921.805c-.455,1.194-1.587,2-2.893,2s-2.438-.806-2.893-2h5.787Zm7.107,7c0,.551-.449,1-1,1h-1v-3c0-.552-.448-1-1-1s-1,.448-1,1v12c0,1.654-1.346,3-3,3h-6c-1.654,0-3-1.346-3-3V7c0-.552-.448-1-1-1s-1,.448-1,1v3.024h-1c-.551,0-1-.449-1-1v-2.388c0-1.563.817-2.973,2.131-3.679.937-.503,1.908-.801,2.897-.907.544,2.326,2.588,3.95,4.972,3.95s4.428-1.624,4.972-3.95c.988.106,1.96.404,2.897.907,1.314.706,2.131,2.116,2.131,3.679v2.364Z"/>
      </svg>
    );
  },
);
GarmentMachineryIcon.displayName = "GarmentMachineryIcon";
export default GarmentMachineryIcon;
