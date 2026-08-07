import { forwardRef } from "react";
import BoundIcon from "@/components/common/BoundIcon";

/* FactoryIcon — SEMANTIC icon: "factory / manufacturing". Registry-first since 2026-08-07
   (entity.factory in the Semantic Icon Registry): every call site follows what the
   Visual Library binds. The inline SVG is ONLY the offline fallback.
   Sizing contract: a Tailwind className wins when provided; otherwise the
   size prop applies (same as the old svg attribute behavior). */

const fallbackFor = (s: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} style={{ maxWidth: "100%", maxHeight: "100%" }} fill="currentColor">
        <path d="m22.97,6.251c-.637-.354-1.415-.331-2.1.101l-4.87,3.649v-2.001c0-.727-.395-1.397-1.03-1.749-.637-.354-1.416-.331-2.1.101l-4.87,3.649V2c.553,0,1-.448,1-1s-.447-1-1-1H1C.447,0,0,.448,0,1s.447,1,1,1v17c0,2.757,2.243,5,5,5h13c2.757,0,5-2.243,5-5v-11c0-.727-.395-1.397-1.03-1.749Zm-.97,12.749c0,1.654-1.346,3-3,3H6c-1.654,0-3-1.346-3-3V2h3v9.991c0,.007,0,.014,0,.02v5.989c0,.552.447,1,1,1s1-.448,1-1v-5.5l6-4.5v4c0,.379.214.725.553.895s.743.134,1.047-.094l6.4-4.8v11Zm-8-2v1c0,.552-.448,1-1,1h-1c-.552,0-1-.448-1-1v-1c0-.552.448-1,1-1h1c.552,0,1,.448,1,1Zm2,1v-1c0-.552.448-1,1-1h1c.552,0,1,.448,1,1v1c0,.552-.448,1-1,1h-1c-.552,0-1-.448-1-1Z"/>
      </svg>
);

const FactoryIcon = forwardRef<HTMLSpanElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    const sized = className ? style : { width: s, height: s, ...style };
    return (
      <span ref={ref} aria-hidden className={`inline-flex shrink-0 ${className ?? ""}`} style={sized}>
        <BoundIcon semanticKey="entity.factory" className="h-full w-full" fallback={fallbackFor(s)} />
      </span>
    );
  },
);
FactoryIcon.displayName = "FactoryIcon";
export default FactoryIcon;
