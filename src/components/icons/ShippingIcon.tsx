import { forwardRef } from "react";

/* ShippingIcon — the Shipping app's mark: a container ship, hull plus stacked
   boxes.

   ⚠️ NOT a plain ship. LandedCostIcon already carries the ship glyph (it is
   byte-for-byte ui/ShipIcon), and one meaning gets one mark in this Hub — two
   apps drawn with the same silhouette are indistinguishable in the launcher.
   The stacked containers are what make this one freight rather than vessels.

   ⚠️ IT HAS TO FILL THE 24-GRID, OR IT READS AS A SMALLER ICON.
   The first version drew the ship between y 9.3 and 20.7 — a bounding box
   11.4 tall in a 24 box. Measured on the launcher, every neighbour fills the
   full 24 (Catalogs, Landed Cost, Sales, Travel, Markets, Purchases, Orders
   all box at 24), so at the same `size` prop this one rendered visibly
   smaller and the owner spotted it immediately. Same box, same prop, half the
   ink is still the wrong size.

   Now y 1.8 → 22.4, a box 20.6 tall — and because a 2px stroke is centred on
   the path, the INK runs 0.8 → 23.4, which is 22.6 of the 24 and optically
   level with the filled neighbours. That centring is also the ceiling: draw
   the geometry any closer to the edge and half the stroke is clipped off, so
   roughly one unit of clearance is what a stroked glyph has to leave. Notes,
   the other stroked app mark, inks 20.

   Stroke grammar: 24-grid, 2px round-capped, minimal. The extra height went
   into the centre stack, split by two dividers so it reads as three
   containers stacked rather than one chimney. */
const ShippingIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        <path d="M2 17.4h20l-2.45 4.1a2 2 0 0 1-1.65.9H6.1a2 2 0 0 1-1.65-.9L2 17.4Z M5.5 17.4v-5.8h4.2v5.8 M14.3 17.4v-5.8h4.2v5.8 M9.9 17.4V1.8h4.2v15.6 M9.9 11.6h4.2 M9.9 6.7h4.2" />
      </svg>
    );
  },
);
ShippingIcon.displayName = "ShippingIcon";
export default ShippingIcon;
