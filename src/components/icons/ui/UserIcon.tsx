import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* UserIcon — SEMANTIC icon: "person / individual". Registry-first since 2026-08-07
   (entity.person): every call site follows what the Visual Library binds. Inline
   SVG = offline fallback only. Sizing contract: className wins over the
   size prop (matches the old svg attribute behavior). */

const FALLBACK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
        <path d="M12,12A6,6,0,1,0,6,6,6.006,6.006,0,0,0,12,12ZM12,2A4,4,0,1,1,8,6,4,4,0,0,1,12,2Z"/><path d="M12,14a9.01,9.01,0,0,0-9,9,1,1,0,0,0,2,0,7,7,0,0,1,14,0,1,1,0,0,0,2,0A9.01,9.01,0,0,0,12,14Z"/>
      </svg>
);

const UserIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.person" className="h-full w-full" fallback={FALLBACK} />
      </span>
    );
  },
);
UserIcon.displayName = "UserIcon";
export default UserIcon;
