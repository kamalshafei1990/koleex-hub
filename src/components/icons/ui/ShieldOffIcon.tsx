import { forwardRef } from "react";

const ShieldOffIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m16.268,20.713c.301.463.171,1.082-.292,1.384-1.265.824-2.429,1.359-3.182,1.663,0,0-.43.24-.792.24s-.85-.307-.85-.307c-2.147-1.074-9.153-5.088-9.153-11.65v-3.55c0-.553.448-1,1-1s1,.447,1,1v3.55c0,5.416,6.159,8.917,8.047,9.861.549-.221,1.648-.708,2.837-1.483.462-.301,1.082-.17,1.384.292Zm7.439,2.994c-.195.195-.451.293-.707.293s-.512-.098-.707-.293L.293,1.707C-.098,1.316-.098.684.293.293S1.316-.098,1.707.293l2.46,2.46c.388-.266.813-.478,1.259-.627L11.685.051c.205-.068.425-.068.63,0l6.259,2.075c2.049.68,3.426,2.587,3.426,4.746v5.171c0,2.349-.71,4.509-2.111,6.432l3.818,3.818c.391.391.391,1.023,0,1.414ZM5.622,4.207l12.832,12.832c1.027-1.511,1.547-3.187,1.547-4.996v-5.171c0-1.295-.826-2.439-2.056-2.848l-5.944-1.971-5.944,1.971c-.151.05-.296.111-.435.183Z"/>
      </svg>
    );
  },
);
ShieldOffIcon.displayName = "ShieldOffIcon";
export default ShieldOffIcon;
