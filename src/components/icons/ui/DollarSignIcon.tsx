import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* DollarSignIcon — SEMANTIC icon: "money / financial". Registry-first since 2026-08-07
   (entity.money in the Semantic Icon Registry): every call site follows what the
   Visual Library binds. The inline SVG is ONLY the offline fallback.
   Sizing contract: a Tailwind className wins when provided; otherwise the
   size prop applies (same as the old svg attribute behavior). */

const fallbackFor = (s: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} style={{ maxWidth: "100%", maxHeight: "100%" }} fill="currentColor">
        <path d="M13.932,4A3.071,3.071,0,0,1,17,7.068a1,1,0,0,0,2,0V7c0-.019,0-.036,0-.055A5.073,5.073,0,0,0,13.932,2H13V1a1,1,0,0,0-2,0V2h-.932a5.068,5.068,0,0,0-1.6,9.875L11,12.72V20h-.932A3.071,3.071,0,0,1,7,16.932a1,1,0,0,0-2,0V17c0,.019,0,.036,0,.055A5.073,5.073,0,0,0,10.068,22H11v1a1,1,0,0,0,2,0V22h.932a5.068,5.068,0,0,0,1.6-9.875L13,11.28V4Zm.97,10.021A3.068,3.068,0,0,1,13.932,20H13V13.387ZM11,10.613,9.1,9.979A3.068,3.068,0,0,1,10.068,4H11Z"/>
      </svg>
);

const DollarSignIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.money" className="h-full w-full" fallback={fallbackFor(s)} />
      </span>
    );
  },
);
DollarSignIcon.displayName = "DollarSignIcon";
export default DollarSignIcon;
