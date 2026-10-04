import { forwardRef } from "react";

/* Orders — a stack of documents held together as one deal. Distinct from
   InvoicesIcon (a single document with money) and DocumentsIcon: what this
   app shows is the BUNDLE, not any one paper in it. */
const OrdersIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        {/* Two sheets behind, offset — the other documents of the deal. */}
        <path d="M9 0h6a5 5 0 0 1 5 5v1a1 1 0 0 1-2 0V5a3 3 0 0 0-3-3H9a1 1 0 0 1 0-2z" opacity=".45"/>
        <path d="M7 3.5h9A4.5 4.5 0 0 1 20.5 8v1.5a1 1 0 0 1-2 0V8A2.5 2.5 0 0 0 16 5.5H7a1 1 0 0 1 0-2z" opacity=".7"/>
        {/* The front sheet, carrying the deal's own lines. */}
        <path d="M6.5 7h9A4.5 4.5 0 0 1 20 11.5v8A4.5 4.5 0 0 1 15.5 24h-9A4.5 4.5 0 0 1 2 19.5v-8A4.5 4.5 0 0 1 6.5 7zm0 2A2.5 2.5 0 0 0 4 11.5v8A2.5 2.5 0 0 0 6.5 22h9a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 15.5 9z"/>
        <path d="M7 12h8a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2zM7 16h8a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2z"/>
      </svg>
    );
  },
);
OrdersIcon.displayName = "OrdersIcon";
export default OrdersIcon;
