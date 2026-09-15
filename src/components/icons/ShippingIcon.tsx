import { forwardRef } from "react";

/* ShippingIcon — the Shipping app's mark: a container ship, hull plus stacked
   boxes.

   ⚠️ NOT a plain ship. LandedCostIcon already carries the ship glyph (it is
   byte-for-byte ui/ShipIcon), and one meaning gets one mark in this Hub — two
   apps drawn with the same silhouette are indistinguishable in the launcher.
   The stacked containers are what make this one freight rather than vessels.

   Stroke grammar: 24-grid, 2px round-capped, minimal. */
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
        <path d="M2.5 16.5h19l-2.3 3.3a2 2 0 0 1-1.64.85H6.44a2 2 0 0 1-1.64-.85L2.5 16.5Z M6.25 16.5v-3.75h3.5v3.75 M14.25 16.5v-3.75h3.5v3.75 M10 16.5V9.25h4v7.25" />
      </svg>
    );
  },
);
ShippingIcon.displayName = "ShippingIcon";
export default ShippingIcon;
