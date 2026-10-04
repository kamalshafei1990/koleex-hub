/* ---------------------------------------------------------------------------
   Brand Center — the fine ornaments every template may use (the owner,
   30/09/2026: designs "really made by a professional designer"): the
   guilloche band and rosette, microtext lines and the foil medallion
   seal. All in mm, one colour each. The logo is only ever used whole —
   never the K alone; the spirograph underprint went with it (owner: "this
   circle has no meaning") — the KOLEEX pattern (./patterns) took its place.
   --------------------------------------------------------------------------- */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { INK, textWidth } from "./card/parts";

/* ── the ornaments ─────────────────────────────────────────────────────────── */

/** A guilloche band — interlaced waves along each side between hairlines,
 *  a rosette in each corner: the fine line-work of certificates and
 *  banknotes, in one grey. */
export function Guilloche({ x0, y0, x1, y1, T, color }: { x0: number; y0: number; x1: number; y1: number; T: number; color: string }) {
  const waves = 8;
  const amp = T * 0.38;
  const lambda = T * 1.5;
  const paths: string[] = [];
  const side = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    const steps = Math.ceil(len / (lambda / 16));
    for (let k = 0; k < waves; k++) {
      const ph = (k / waves) * Math.PI * 2;
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const s = (i / steps) * len;
        const off = amp * Math.sin((s / lambda) * Math.PI * 2 + ph);
        const px = ax + dx * s + nx * off, py = ay + dy * s + ny * off;
        d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
      }
      paths.push(d);
    }
  };
  const c = T / 2;
  side(x0 + T, y0 + c, x1 - T, y0 + c, 0, 1);
  side(x0 + T, y1 - c, x1 - T, y1 - c, 0, 1);
  side(x0 + c, y0 + T, x0 + c, y1 - T, 1, 0);
  side(x1 - c, y0 + T, x1 - c, y1 - T, 1, 0);
  return (
    <g fill="none" stroke={color}>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} strokeWidth={0.3} />
      <rect x={x0 + T} y={y0 + T} width={x1 - x0 - 2 * T} height={y1 - y0 - 2 * T} strokeWidth={0.2} />
      {paths.map((d, i) => <path key={i} d={d} strokeWidth={0.09} />)}
      {[[x0 + c, y0 + c], [x1 - c, y0 + c], [x0 + c, y1 - c], [x1 - c, y1 - c]].map(([cx, cy]) => (
        <Rosette key={`${cx}-${cy}`} cx={cx} cy={cy} r0={T * 0.2} r1={T * 0.48} color={color} rings={5} lobes={8} width={0.07} />
      ))}
    </g>
  );
}
/** Wavy rings between r0 and r1 — a rosette of fine lines. */
export function Rosette({ cx, cy, r0, r1, color, rings = 7, lobes = 12, width = 0.09 }: { cx: number; cy: number; r0: number; r1: number; color: string; rings?: number; lobes?: number; width?: number }) {
  const out: string[] = [];
  const rm = (r0 + r1) / 2, a = (r1 - r0) / 2;
  for (let k = 0; k < rings; k++) {
    const ph = (k / rings) * Math.PI * 2 / lobes;
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const rr = rm + a * Math.sin(lobes * (t + ph));
      d += `${i ? "L" : "M"}${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
    }
    out.push(`${d}Z`);
  }
  return <g fill="none" stroke={color} strokeWidth={width}>{out.map((d, i) => <path key={i} d={d} />)}</g>;
}

/** Microtext: a line that is, close up, the group's name and tagline in
 *  1-point capitals — the fine print of certificates and banknotes. */
const MICRO = "KOLEEX INTERNATIONAL GROUP  ·  SHAPING THE FUTURE  ·  ";
export function MicroLine({ uid, id, font, x, y, width, fill, size = 0.5 }: { uid: string; id: string; font: string; x: number; y: number; width: number; fill: string; size?: number }) {
  const s = size;
  const unit = textWidth(MICRO, s, 500, font) || s * 32;
  const text = MICRO.repeat(Math.max(1, Math.ceil(width / unit) + 1));
  const cid = `${uid}-micro-${id}`;
  return (
    <g>
      <defs><clipPath id={cid}><rect x={x} y={y - s} width={width} height={s * 2} /></clipPath></defs>
      <text x={x} y={y + s * 0.36} direction="ltr" textAnchor="start" fill={fill} clipPath={`url(#${cid})`}
        style={{ fontFamily: font, fontSize: s, fontWeight: 500, letterSpacing: s * 0.04 }}>{text}</text>
    </g>
  );
}

/** The seal, a foil medallion: a scalloped silver rim, the tagline and the
 *  group's name around it, a guilloche band, and fine line-work at the
 *  centre. Never a piece of the logo (owner, 30/09/2026: "I only use the
 *  full logo"). */
export function FoilSeal({ uid, font, cx, cy, rad, dark }: { uid: string; font: string; cx: number; cy: number; rad: number; dark: boolean }) {
  const id = `${uid}-seal-${Math.round(cx * 10)}-${Math.round(cy * 10)}`;
  const rt = rad * 0.8;
  const ring = `M ${cx - rt} ${cy} a ${rt} ${rt} 0 1 1 ${rt * 2} 0 a ${rt} ${rt} 0 1 1 ${-rt * 2} 0`;
  let rim = "";
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * Math.PI * 2;
    const rr = rad * (1 - 0.028 * (1 - Math.cos(72 * t)) / 2);
    rim += `${i ? "L" : "M"}${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
  }
  const words = `${KOLEEX_COMPANY.tagline.replace(/\.$/, "")}  ·  KOLEEX INTERNATIONAL GROUP  ·  `;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          {["#F2F2F7", "#FFFFFF", "#D1D1D6", "#AEAEB2", "#E5E5EA"].map((c, i) => <stop key={i} offset={[0, 0.3, 0.55, 0.8, 1][i]} stopColor={c} />)}
        </linearGradient>
        <path id={`${id}-p`} d={ring} />
      </defs>
      <path d={`${rim}Z`} fill={`url(#${id}-g)`} stroke="#AEAEB2" strokeWidth={0.12} />
      <circle cx={cx} cy={cy} r={rad * 0.9} fill="none" stroke="#8E8E93" strokeWidth={0.18} />
      <text fill="#3A3A3C" style={{ fontFamily: font, fontSize: rad * 0.1, fontWeight: 600 }}>
        <textPath href={`#${id}-p`} textLength={2 * Math.PI * rt * 0.985} lengthAdjust="spacing">{words}</textPath>
      </text>
      <circle cx={cx} cy={cy} r={rad * 0.7} fill="none" stroke="#8E8E93" strokeWidth={0.18} />
      <Rosette cx={cx} cy={cy} r0={rad * 0.5} r1={rad * 0.68} color="#8E8E93" rings={8} lobes={24} width={0.06} />
      <circle cx={cx} cy={cy} r={rad * 0.48} fill={dark ? INK : "#F7F7F9"} stroke="#8E8E93" strokeWidth={0.18} />
      <Rosette cx={cx} cy={cy} r0={rad * 0.1} r1={rad * 0.42} color={dark ? "#8E8E93" : "#6E6E73"} rings={10} lobes={14} width={0.06} />
    </g>
  );
}


