import { forwardRef } from "react";

/* ShippingIcon — the Shipping app's mark: a container ship, a solid wall of
   stacked containers on a hull with portholes.

   The vessel metaphor belongs to Shipping ALONE: LandedCostIcon is an anchor
   (arrival at the destination port, when landed cost is fixed), so no two
   apps in Operations share a metaphor any more.

   Filled grammar — 24-grid, currentColor, solid silhouette with even-odd
   knock-outs for the container dividers and portholes. The container block
   spans nearly the full width and the hull is a heavy slab, so the icon's
   ink coverage matches its filled neighbours (the first stroked version AND
   the first sparse filled version both read too small on the launcher — the
   owner measures weight, not the viewBox). */
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
        fill="currentColor"
        className={className}
        style={style}
        {...rest}
      >
        <path
          fillRule="evenodd"
          d="M9.75 2.8h4.5v4h-4.5v-4ZM4.8 6.8h14.5v10H4.8v-10Zm4.5 0h.75v10H9.3v-10Zm4.65 0h.75v10h-.75v-10ZM4.8 11.4h14.5v.8H4.8v-.8ZM2 16.8h20l-2.45 4.35a2 2 0 0 1-1.65.95H6.1a2 2 0 0 1-1.65-.95L2 16.8Zm4.05 2.8a.95.95 0 1 1 1.9 0a.95.95 0 1 1-1.9 0Zm5 0a.95.95 0 1 1 1.9 0a.95.95 0 1 1-1.9 0Zm5 0a.95.95 0 1 1 1.9 0a.95.95 0 1 1-1.9 0Z"
        />
      </svg>
    );
  },
);
ShippingIcon.displayName = "ShippingIcon";
export default ShippingIcon;
