import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* PackageIcon — SEMANTIC icon: "product / goods". Registry-first since 2026-08-07
   (entity.product): every call site follows what the Visual Library binds. Inline
   SVG = offline fallback only. Sizing contract: className wins over the
   size prop (matches the old svg attribute behavior). */

const fallbackFor = (s: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} style={{ maxWidth: "100%", maxHeight: "100%" }} fill="currentColor">
        <path d="m19 0h-14a5.006 5.006 0 0 0 -5 5v14a5.006 5.006 0 0 0 5 5h14a5.006 5.006 0 0 0 5-5v-14a5.006 5.006 0 0 0 -5-5zm3 5h-7v-3h4a3 3 0 0 1 3 3zm-11-3h2v5a1 1 0 0 1 -2 0zm-6 0h4v3h-7a3 3 0 0 1 3-3zm14 20h-14a3 3 0 0 1 -3-3v-12h7a3 3 0 0 0 6 0h7v12a3 3 0 0 1 -3 3zm1-3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 0-2h3a1 1 0 0 1 1 1z"/>
      </svg>
);

const PackageIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.product" className="h-full w-full" fallback={fallbackFor(s)} />
      </span>
    );
  },
);
PackageIcon.displayName = "PackageIcon";
export default PackageIcon;
