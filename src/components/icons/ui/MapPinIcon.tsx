import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* MapPinIcon — SEMANTIC icon: "address / location". Registry-first since 2026-08-07
   (field.address): every call site follows what the Visual Library binds. Inline
   SVG = offline fallback only. Sizing contract: className wins over the
   size prop (matches the old svg attribute behavior). */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M12,6a4,4,0,1,0,4,4A4,4,0,0,0,12,6Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,12Z"/><path d="M12,24a5.271,5.271,0,0,1-4.311-2.2c-3.811-5.257-5.744-9.209-5.744-11.747a10.055,10.055,0,0,1,20.11,0c0,2.538-1.933,6.49-5.744,11.747A5.271,5.271,0,0,1,12,24ZM12,2.181a7.883,7.883,0,0,0-7.874,7.874c0,2.01,1.893,5.727,5.329,10.466a3.145,3.145,0,0,0,5.09,0c3.436-4.739,5.329-8.456,5.329-10.466A7.883,7.883,0,0,0,12,2.181Z"/>
      </svg>
);

const MapPinIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="field.address" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
MapPinIcon.displayName = "MapPinIcon";
export default MapPinIcon;
