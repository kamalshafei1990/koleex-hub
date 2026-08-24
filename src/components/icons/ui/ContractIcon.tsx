import { forwardRef } from "react";

/* Sales contract — a document carrying a signature rule and a seal.
   Deliberately NOT FileCheckIcon (certifications) or HandshakeIcon
   (supplier negotiation): the semantic registry keeps one icon to one
   meaning, and an executed agreement is its own meaning. */
const ContractIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        {/* Page with a folded corner. */}
        <path d="m19.535 3.122-1.656-1.658a4.968 4.968 0 0 0 -3.536-1.464h-6.343a5.006 5.006 0 0 0 -5 5v14a5.006 5.006 0 0 0 5 5h8a5.006 5.006 0 0 0 5-5v-12.343a4.968 4.968 0 0 0 -1.465-3.535zm-1.414 1.414a2.932 2.932 0 0 1 .379.464h-2.5v-2.5a3.1 3.1 0 0 1 .465.38zm.879 14.464a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3-3v-14a3 3 0 0 1 3-3h6v3a2 2 0 0 0 2 2h3z"/>
        {/* Two lines of terms. */}
        <path d="M8 9.5h8a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2z"/>
        <path d="M8 13h4.5a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2z"/>
        {/* Signature rule, and the seal beside it. */}
        <path d="M7.4 18.4h4.2a1 1 0 0 1 0 2H7.4a1 1 0 0 1 0-2z"/>
        <circle cx="15.6" cy="18" r="2.6"/>
      </svg>
    );
  },
);
ContractIcon.displayName = "ContractIcon";
export default ContractIcon;
