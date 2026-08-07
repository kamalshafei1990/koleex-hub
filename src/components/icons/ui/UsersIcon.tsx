import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* UsersIcon — SEMANTIC icon: "people / group" (the GENERIC meaning).
   Registry-first since 2026-08-07 (entity.people). Sites that mean
   something more precise (employees, customers) bind their own key at the
   call site — see entity.employee / entity.customer. Inline SVG = offline
   fallback only. Sizing contract: className wins over the size prop. */

const fallbackFor = (s: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} style={{ maxWidth: "100%", maxHeight: "100%" }} fill="currentColor">
        <path d="m7.5 13a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm0-7a2.5 2.5 0 1 0 2.5 2.5 2.5 2.5 0 0 0 -2.5-2.5zm7.5 17v-.5a7.5 7.5 0 0 0 -15 0v.5a1 1 0 0 0 2 0v-.5a5.5 5.5 0 0 1 11 0v.5a1 1 0 0 0 2 0zm9-5a7 7 0 0 0 -11.667-5.217 1 1 0 1 0 1.334 1.49 5 5 0 0 1 8.333 3.727 1 1 0 0 0 2 0zm-6.5-9a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm0-7a2.5 2.5 0 1 0 2.5 2.5 2.5 2.5 0 0 0 -2.5-2.5z"/>
      </svg>
);

const UsersIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.people" className="h-full w-full" fallback={fallbackFor(s)} />
      </span>
    );
  },
);
UsersIcon.displayName = "UsersIcon";
export default UsersIcon;
