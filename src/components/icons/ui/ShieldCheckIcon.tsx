import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* ShieldCheckIcon — SEMANTIC icon: "compliance / verified trust". Registry-first since 2026-08-08
   (entity.compliance). Sites that mean something narrower (product certifications) bind their own key at the call site. Inline SVG = offline fallback only. Sizing contract:
   className wins over the size prop. */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M18.581,2.14,12.316.051a1,1,0,0,0-.632,0L5.419,2.14A4.993,4.993,0,0,0,2,6.883V12c0,7.563,9.2,11.74,9.594,11.914a1,1,0,0,0,.812,0C12.8,23.74,22,19.563,22,12V6.883A4.993,4.993,0,0,0,18.581,2.14ZM20,12c0,5.455-6.319,9.033-8,9.889-1.683-.853-8-4.42-8-9.889V6.883A3,3,0,0,1,6.052,4.037L12,2.054l5.948,1.983A3,3,0,0,1,20,6.883Z"/><path d="M15.3,8.3,11.112,12.5,8.868,10.16a1,1,0,1,0-1.441,1.386l2.306,2.4a1.872,1.872,0,0,0,1.345.6h.033a1.873,1.873,0,0,0,1.335-.553l4.272-4.272A1,1,0,0,0,15.3,8.3Z"/>
      </svg>
);

const ShieldCheckIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.compliance" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
ShieldCheckIcon.displayName = "ShieldCheckIcon";
export default ShieldCheckIcon;
