import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* ---------------------------------------------------------------------------
   Building2Icon — SEMANTIC icon: "company / organization".

   Registry-first since 2026-08-07 (entity.company in the Semantic Icon
   Registry): all ~65 call sites follow whatever the Visual Library binds —
   change the icon there and every supplier card, tenant picker and company
   field updates instantly. The inline SVG below is ONLY the offline
   fallback.

   Sizing contract preserved from the old SVG component: a Tailwind
   className (h-4 w-4 …) wins when provided; otherwise the `size` prop
   (default 24) applies — matching how CSS classes used to override the
   svg width/height attributes.
   --------------------------------------------------------------------------- */

const fallbackFor = (s: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} style={{ maxWidth: "100%", maxHeight: "100%" }} fill="currentColor" aria-hidden="true">
    <path d="m7 14a1 1 0 0 1 -1 1h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 1 1zm4-1h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5 4h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5-12h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-5 4h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm5 0h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm13 1v9a5.006 5.006 0 0 1 -5 5h-14a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h6a5.006 5.006 0 0 1 5 5h3a5.006 5.006 0 0 1 5 5zm-19 12h9v-17a3 3 0 0 0 -3-3h-6a3 3 0 0 0 -3 3v14a3 3 0 0 0 3 3zm17-12a3 3 0 0 0 -3-3h-3v15h3a3 3 0 0 0 3-3zm-3 3a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm0 4a1 1 0 1 0 1 1 1 1 0 0 0 -1-1zm0-8a1 1 0 1 0 1 1 1 1 0 0 0 -1-1z"/>
  </svg>
);

const Building2Icon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.company" className="h-full w-full" fallback={fallbackFor(s)} />
      </span>
    );
  },
);
Building2Icon.displayName = "Building2Icon";
export default Building2Icon;
