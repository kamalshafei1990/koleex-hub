/* ---------------------------------------------------------------------------
   Business card — the small contact icons some of the owner's references
   carry beside each line (phone, e-mail, website, address). Our own
   drawings, on a 24-unit grid, scaled to mm; one colour each.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

export type IconKind = "phone" | "mail" | "globe" | "pin" | "cursor" | "whatsapp" | "wechat" | "linkedin" | "fax" | "dot";

/** The icon a contact line gets (its kind in the card's rows). */
export function iconOf(kind: string | undefined, web: "globe" | "cursor" = "globe"): IconKind {
  switch (kind) {
    case "mobile": case "tel": return "phone";
    case "fax": return "fax";
    case "email": return "mail";
    case "web": return web;
    case "address": return "pin";
    case "whatsapp": return "whatsapp";
    case "wechat": return "wechat";
    case "linkedin": return "linkedin";
    default: return "dot";
  }
}

const HANDSET = "M7.3 2.9c.8-.5 1.8-.3 2.3.4l2 2.9c.4.7.4 1.5-.2 2.1l-1.5 1.4c.9 2 2.5 3.6 4.5 4.5l1.4-1.5c.6-.6 1.4-.7 2.1-.2l2.9 2c.7.5.9 1.5.4 2.3l-1.1 1.7c-.7 1-1.9 1.5-3.1 1.2C11.3 19.4 4.6 12.7 3.3 6.9c-.3-1.2.2-2.4 1.2-3.1z";

function glyph(kind: IconKind, color: string): ReactNode {
  const line = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "phone": return <path d={HANDSET} fill={color} />;
    case "mail": return <g {...line}><rect x={3.2} y={5.5} width={17.6} height={13} rx={1.6} /><path d="M3.8 6.6l8.2 6.4 8.2-6.4" /></g>;
    case "globe": return (
      <g {...line}>
        <circle cx={12} cy={12} r={8.8} />
        <ellipse cx={12} cy={12} rx={3.8} ry={8.8} />
        <path d="M3.4 12h17.2M4.9 7.4h14.2M4.9 16.6h14.2" />
      </g>
    );
    case "pin": return <path fillRule="evenodd" fill={color} d="M12 2.4c-4 0-7.1 3.1-7.1 7 0 5.3 7.1 12.2 7.1 12.2s7.1-6.9 7.1-12.2c0-3.9-3.1-7-7.1-7zm0 4.1a2.9 2.9 0 1 0 0 5.8a2.9 2.9 0 1 0 0-5.8z" />;
    case "cursor": return <path fill={color} d="M6.2 3.2l12.6 9.3-5.5 1 3.2 6.1-2.6 1.3-3.1-6.1-4.6 3.8z" />;
    case "whatsapp": return (
      <g>
        <path {...line} d="M12 3.1a8.9 8.9 0 0 0-7.7 13.4L3.1 20.9l4.5-1.2A8.9 8.9 0 1 0 12 3.1z" />
        <g transform="translate(6.3 6.3) scale(0.48)"><path d={HANDSET} fill={color} /></g>
      </g>
    );
    case "wechat": return (
      <g {...line}>
        <path d="M9.6 4.6c-3.8 0-6.8 2.5-6.8 5.6 0 1.8 1 3.3 2.5 4.3l-.6 2 2.4-1.2c.8.3 1.6.4 2.5.4" />
        <path d="M15.1 9.6c3.3 0 6 2.2 6 4.9 0 1.5-.8 2.8-2.1 3.7l.5 1.8-2.1-1.1c-.7.2-1.5.4-2.3.4-3.3 0-6-2.2-6-4.8s2.7-4.9 6-4.9z" />
      </g>
    );
    case "linkedin": return (
      <g>
        <rect x={3} y={3} width={18} height={18} rx={3} {...line} />
        <circle cx={8.2} cy={8} r={1.3} fill={color} />
        <rect x={7.1} y={10.4} width={2.2} height={6.8} fill={color} />
        <path fill={color} d="M11.2 10.4h2.1v1c.5-.8 1.4-1.2 2.4-1.2 1.9 0 2.8 1.2 2.8 3.2v3.8h-2.2v-3.5c0-1-.4-1.6-1.3-1.6-.9 0-1.5.7-1.5 1.7v3.4h-2.3z" />
      </g>
    );
    case "fax": return <g {...line}><path d="M7 9V3.5h10V9" /><path d="M4.8 9h14.4c.9 0 1.6.7 1.6 1.6V16h-3.6v4.5H6.8V16H3.2v-5.4C3.2 9.7 3.9 9 4.8 9z" /></g>;
    default: return <circle cx={12} cy={12} r={3.2} fill={color} />;
  }
}

/** One icon, `size` mm square, centred on (cx, cy). */
export function ContactIcon({ kind, cx, cy, size, color }: { kind: IconKind; cx: number; cy: number; size: number; color: string }) {
  const k = size / 24;
  return <g transform={`translate(${(cx - size / 2).toFixed(3)} ${(cy - size / 2).toFixed(3)}) scale(${k.toFixed(4)})`}>{glyph(kind, color)}</g>;
}
