import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* HashtagIcon — SEMANTIC icon: "code / registration number". Registry-first since 2026-08-08
   (field.code). All 9 call sites are tax / registration / customs identifiers. Inline SVG = offline fallback only. Sizing contract:
   className wins over the size prop. */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M20,5H17.5l.5-4a1,1,0,0,0-2-.1L15.5,5h-5l.5-4a1,1,0,0,0-2-.1L8.5,5H4A1,1,0,0,0,4,7H8.25l-.5,4H4a1,1,0,0,0,0,2H7.5l-.5,4a1,1,0,0,0,.9,1.1h.1a1,1,0,0,0,1-.9l.5-4.2h5l-.5,4a1,1,0,0,0,.9,1.1h.1a1,1,0,0,0,1-.9l.5-4.2H20a1,1,0,0,0,0-2H16.75l.5-4H20A1,1,0,0,0,20,5ZM14.75,11h-5l.5-4h5Z"/>
      </svg>
);

const HashtagIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="field.code" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
HashtagIcon.displayName = "HashtagIcon";
export default HashtagIcon;
