import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* EnvelopeIcon — SEMANTIC icon: "email". Registry-first since 2026-08-07
   (field.email): every call site follows what the Visual Library binds. Inline
   SVG = offline fallback only. Sizing contract: className wins over the
   size prop (matches the old svg attribute behavior). */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M19,1H5A5.006,5.006,0,0,0,0,6V18a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V6A5.006,5.006,0,0,0,19,1ZM5,3H19a3,3,0,0,1,2.78,1.887l-7.658,7.659a3.007,3.007,0,0,1-4.244,0L2.22,4.887A3,3,0,0,1,5,3ZM19,21H5a3,3,0,0,1-3-3V7.5L8.464,13.96a5.007,5.007,0,0,0,7.072,0L22,7.5V18A3,3,0,0,1,19,21Z"/>
      </svg>
);

const EnvelopeIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="field.email" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
EnvelopeIcon.displayName = "EnvelopeIcon";
export default EnvelopeIcon;
