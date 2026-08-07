import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* BriefcaseIcon — SEMANTIC icon: "job position / role". Registry-first since 2026-08-07
   (entity.position): every call site follows what the Visual Library binds. Inline
   SVG = offline fallback only. Sizing contract: className wins over the
   size prop (matches the old svg attribute behavior). */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M19,4H17.9A5.009,5.009,0,0,0,13,0H11A5.009,5.009,0,0,0,6.1,4H5A5.006,5.006,0,0,0,0,9V19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V9A5.006,5.006,0,0,0,19,4ZM11,2h2a3,3,0,0,1,2.816,2H8.184A3,3,0,0,1,11,2ZM5,6H19a3,3,0,0,1,3,3v3H2V9A3,3,0,0,1,5,6ZM19,22H5a3,3,0,0,1-3-3V14h9v1a1,1,0,0,0,2,0V14h9v5A3,3,0,0,1,19,22Z"/>
      </svg>
);

const BriefcaseIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.position" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
BriefcaseIcon.displayName = "BriefcaseIcon";
export default BriefcaseIcon;
