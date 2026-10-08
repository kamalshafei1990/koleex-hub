import { forwardRef } from "react";

/* Landed Cost icon — an anchor: the moment the goods ARRIVE at the port and
   the full landed cost (product + freight + duty + handling) is fixed.

   ⚠️ NOT a ship. ShippingIcon already carries the vessel mark (container
   ship), and one meaning gets one mark in this Hub — two apps drawn with the
   same metaphor are indistinguishable in the launcher. The anchor reads as
   "arrival at destination port", which is exactly when landed cost is known.

   Filled grammar like the rest of the set: 24-grid, currentColor, solid
   silhouette (artwork shared with ui/AnchorIcon). */
const LandedCostIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m23.392,13.001c-.518-.636-1.284-1.001-2.103-1.001h-1.289c-.553,0-1,.448-1,1s.447,1,1,1h1.289c.214,0,.415.096.552.264.076.093.196.29.141.557-.883,4.291-5.101,6.758-8.981,7.125v-7.946h2c.553,0,1-.448,1-1s-.447-1-1-1h-2v-4.142c1.721-.447,3-2,3-3.858,0-2.206-1.794-4-4-4s-4,1.794-4,4c0,1.858,1.28,3.411,3,3.858v4.142h-2c-.552,0-1,.448-1,1s.448,1,1,1h2v7.946c-3.88-.367-8.099-2.834-8.982-7.125-.055-.268.065-.464.141-.558.137-.167.338-.264.552-.264h1.289c.552,0,1-.448,1-1s-.448-1-1-1h-1.289c-.817,0-1.583.364-2.102,1C.098,13.627-.103,14.438.059,15.225c1.186,5.761,6.904,8.775,11.941,8.775s10.755-3.014,11.94-8.775c.162-.786-.038-1.597-.549-2.224ZM10,4c0-1.103.897-2,2-2s2,.897,2,2-.897,2-2,2-2-.897-2-2Z"/>
      </svg>
    );
  },
);
LandedCostIcon.displayName = "LandedCostIcon";
export default LandedCostIcon;
