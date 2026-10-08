/* ---------------------------------------------------------------------------
   The occasion objects (plan step C15). The book (ch. 57): one object per
   occasion, white and greys only, up to half the layout, never behind the
   logo — the crescent for Ramadan, the tree for Christmas. The owner: KOLEEX
   is always 2D (no 3D renders), so each object is a flat, precise geometric
   drawing with at most a soft glow; no clip art, no flags, no landmarks.

   Every object is drawn in a unit box (−1 … 1) and scaled.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

export const OBJECTS = ["crescent", "fanous", "lantern", "moon", "tree", "burst", "gear", "leaf", "flame", "flower", "wave", "none"] as const;
export type OccasionObject = (typeof OBJECTS)[number];

const f = (n: number) => n.toFixed(3);
const star = (cx: number, cy: number, R: number, points = 5, inner = 0.45) => {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? R * inner : R;
    d += `${i ? "L" : "M"}${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  }
  return `${d}Z`;
};

/** One object, `size` wide and high, centred on (cx, cy). `fill` is the
 *  object, `ground` the colour behind it (windows and holes show it), `dim`
 *  the grey of its details. */
export function OccasionObject({ kind, cx, cy, size, fill, ground, dim, uid, glow = true }: {
  kind: OccasionObject; cx: number; cy: number; size: number; fill: string; ground: string; dim: string; uid: string; glow?: boolean;
}) {
  if (kind === "none") return null;
  const k = size / 2;
  const body = shapes(kind, fill, ground, dim, uid);
  const id = `${uid}-glow`;
  return (
    <g>
      {glow ? (
        <>
          <defs>
            <filter id={id} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={0.16} /></filter>
          </defs>
          <g transform={`translate(${f(cx)} ${f(cy)}) scale(${f(k)})`} opacity={0.28} filter={`url(#${id})`}>{body}</g>
        </>
      ) : null}
      <g transform={`translate(${f(cx)} ${f(cy)}) scale(${f(k)})`}>{body}</g>
    </g>
  );
}

function shapes(kind: OccasionObject, fill: string, ground: string, dim: string, uid: string): ReactNode {
  switch (kind) {
    case "crescent": {
      const m = `${uid}-cm`;
      return (
        <>
          <defs>
            <mask id={m} maskUnits="userSpaceOnUse" x={-1.2} y={-1.2} width={2.4} height={2.4}>
              <circle cx={0} cy={0} r={0.92} fill="#FFFFFF" />
              <circle cx={0.36} cy={-0.16} r={0.8} fill="#000000" />
            </mask>
          </defs>
          <circle cx={0} cy={0} r={0.92} fill={fill} mask={`url(#${m})`} />
          <path d={star(0.5, -0.08, 0.2)} fill={fill} />
        </>
      );
    }
    case "fanous": {
      /* the Ramadan lantern: ring, dome, a six-sided body with its windows, a base */
      return (
        <>
          <circle cx={0} cy={-0.93} r={0.08} fill="none" stroke={fill} strokeWidth={0.04} />
          <path d="M0 -0.86 L0.3 -0.64 L-0.3 -0.64 Z" fill={fill} />
          <path d="M-0.36 -0.6 L0.36 -0.6 L0.5 -0.08 L0.38 0.5 L-0.38 0.5 L-0.5 -0.08 Z" fill={fill} />
          {[-0.22, 0, 0.22].map((x) => <rect key={x} x={x - 0.065} y={-0.44} width={0.13} height={0.76} rx={0.06} fill={ground} opacity={0.82} />)}
          <path d="M-0.28 0.54 L0.28 0.54 L0.18 0.72 L-0.18 0.72 Z" fill={fill} />
          <circle cx={0} cy={0.82} r={0.06} fill={fill} />
        </>
      );
    }
    case "lantern": {
      /* the Chinese lantern: round body with its ribs, caps and a tassel */
      return (
        <>
          <line x1={0} y1={-0.98} x2={0} y2={-0.7} stroke={fill} strokeWidth={0.035} />
          <rect x={-0.3} y={-0.74} width={0.6} height={0.12} rx={0.03} fill={fill} />
          <ellipse cx={0} cy={0} rx={0.74} ry={0.62} fill={fill} />
          {[0.25, 0.5].map((q) => <ellipse key={q} cx={0} cy={0} rx={0.74 * q} ry={0.62} fill="none" stroke={dim} strokeWidth={0.025} />)}
          <line x1={0} y1={-0.62} x2={0} y2={0.62} stroke={dim} strokeWidth={0.025} />
          <rect x={-0.3} y={0.62} width={0.6} height={0.12} rx={0.03} fill={fill} />
          {[-0.08, 0, 0.08].map((x) => <line key={x} x1={x} y1={0.74} x2={x * 1.4} y2={1.0} stroke={fill} strokeWidth={0.03} />)}
        </>
      );
    }
    case "moon":
      return (
        <>
          <circle cx={0} cy={0} r={0.9} fill={fill} />
          {[[-0.28, -0.22, 0.16], [0.3, 0.12, 0.11], [-0.05, 0.42, 0.08], [0.22, -0.4, 0.06]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={dim} opacity={0.35} />)}
        </>
      );
    case "tree":
      return (
        <>
          <path d={star(0, -0.98, 0.12)} fill={fill} />
          <path d="M0 -0.84 L0.42 -0.3 L-0.42 -0.3 Z" fill={fill} />
          <path d="M0 -0.52 L0.6 0.2 L-0.6 0.2 Z" fill={fill} />
          <path d="M0 -0.12 L0.8 0.72 L-0.8 0.72 Z" fill={fill} />
          <rect x={-0.1} y={0.72} width={0.2} height={0.24} fill={fill} />
          {[[-0.14, -0.38], [0.2, 0.02], [-0.3, 0.46], [0.36, 0.52], [0.02, 0.3]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={0.045} fill={ground} opacity={0.7} />)}
        </>
      );
    case "burst": {
      /* a firework of KOLEEX dots */
      const dots: ReactNode[] = [<circle key="c" cx={0} cy={0} r={0.07} fill={fill} />];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16;
        for (let j = 1; j <= 5; j++) {
          const d = 0.18 + j * 0.16;
          const r = 0.055 - j * 0.006;
          dots.push(<circle key={`${i}-${j}`} cx={f(Math.cos(a) * d)} cy={f(Math.sin(a) * d)} r={f(r)} fill={j > 3 ? dim : fill} />);
        }
      }
      return <>{dots}</>;
    }
    case "gear": {
      let d = "";
      const teeth = 12;
      for (let i = 0; i < teeth * 4; i++) {
        const a = (i * Math.PI * 2) / (teeth * 4);
        const rr = Math.floor(i / 2) % 2 ? 0.74 : 0.94;
        d += `${i ? "L" : "M"}${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}`;
      }
      return (
        <>
          <path d={`${d}Z`} fill={fill} />
          <circle cx={0} cy={0} r={0.3} fill={ground} />
          <circle cx={0} cy={0} r={0.5} fill="none" stroke={ground} strokeWidth={0.04} opacity={0.5} />
        </>
      );
    }
    case "leaf":
      return (
        <>
          <path d="M0 -0.98 C0.72 -0.56 0.7 0.42 0 0.86 C-0.7 0.42 -0.72 -0.56 0 -0.98 Z" fill={fill} />
          <line x1={0} y1={-0.8} x2={0} y2={0.98} stroke={ground} strokeWidth={0.035} opacity={0.75} />
          {[-0.45, -0.15, 0.15, 0.45].map((y) => (
            <g key={y}>
              <line x1={0} y1={y + 0.12} x2={0.34} y2={y - 0.08} stroke={ground} strokeWidth={0.025} opacity={0.6} />
              <line x1={0} y1={y + 0.12} x2={-0.34} y2={y - 0.08} stroke={ground} strokeWidth={0.025} opacity={0.6} />
            </g>
          ))}
        </>
      );
    case "flame":
      return (
        <>
          <path d="M0 -0.96 C0.36 -0.46 0.36 0.02 0 0.2 C-0.36 0.02 -0.36 -0.46 0 -0.96 Z" fill={fill} />
          <path d="M0 -0.5 C0.14 -0.26 0.14 -0.02 0 0.08 C-0.14 -0.02 -0.14 -0.26 0 -0.5 Z" fill={dim} />
          <path d="M-0.78 0.34 L0.78 0.34 C0.66 0.82 -0.66 0.82 -0.78 0.34 Z" fill={fill} />
        </>
      );
    case "flower":
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => <ellipse key={i} cx={0} cy={-0.5} rx={0.24} ry={0.46} fill={fill} transform={`rotate(${i * 60})`} />)}
          <circle cx={0} cy={0} r={0.22} fill={dim} />
        </>
      );
    case "wave":
      return (
        <>
          {[-0.45, 0, 0.45].map((y, i) => (
            <path key={y} d={`M-0.95 ${f(y)} C-0.6 ${f(y - 0.28)} -0.3 ${f(y - 0.28)} 0 ${f(y)} S0.6 ${f(y + 0.28)} 0.95 ${f(y)}`} fill="none" stroke={i === 1 ? fill : dim} strokeWidth={0.1} strokeLinecap="round" />
          ))}
        </>
      );
    default:
      return null;
  }
}
