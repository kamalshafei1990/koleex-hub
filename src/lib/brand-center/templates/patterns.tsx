/* ---------------------------------------------------------------------------
   The KOLEEX pattern (owner, 30/09/2026) — drawn from the Koleex AI: its
   dotted sphere and the motions it makes (the thinking scan, the aura, the
   lens of a sphere swelling out of a flat field). The owner chose thirteen
   from two rounds:

     scan            the thinking band, standing
     scan-edge       the pass reaching the edge
     scan-large      a coarser, bolder field
     aura-circle     the whole aura, as tall as its area
     aura-circle-edge the aura cut by the edge
     aura-corner     the aura from the top corner
     aura-lower      from the bottom corner
     aura-edge       blue light along the edge
     aura-edge-white the same in white and grey
     aura-rising     the aura rising from the foot
     aura-band       a band of blue light
     lens-edge       the swelling at the edge
     lens-corner     the swelling from the top corner

   Every pattern fills its area edge to edge — the full height of a card,
   never a square in the middle (owner) — and the dots scale with the
   area's height, so a card and a certificate carry the same rhythm. Black,
   white, grey and Hub Blue only. Never a piece of the logo; the full logo
   always sits on clean ground beside the pattern.
   --------------------------------------------------------------------------- */

export const PATTERNS = [
  "scan", "scan-edge", "scan-large",
  "aura-circle", "aura-circle-edge", "aura-corner", "aura-lower", "aura-edge", "aura-edge-white", "aura-rising", "aura-band",
  "lens-edge", "lens-corner",
] as const;
export type PatternKey = (typeof PATTERNS)[number];
export const patternOf = (x: unknown, d: PatternKey = "scan"): PatternKey | "none" =>
  x === "none" ? "none" : (PATTERNS as readonly string[]).includes(String(x)) ? (x as PatternKey) : d;

const BLUE = ["#567FB2", "#7FA9D6", "#BCD8F0"];
const g = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));
const f = (n: number) => n.toFixed(2);

export interface Area { x0: number; y0: number; w: number; h: number }
export interface Box { x: number; y: number; w: number; h: number }

/** The pattern's dots as one path per colour — a few thousand circles drawn
 *  as arcs in four paths, light enough for every thumbnail. `mirror` turns
 *  its direction (an Arabic page, or a pattern on the start side); `up`
 *  stands it on its side, its edge along the top — a band across a portrait
 *  badge spans the badge's width the way a card's field spans its height;
 *  `clear` keeps clean ground under the logo and the words (the full logo is
 *  never drawn over the pattern). */
export function Pattern({ id, area, dark, mirror = false, up = false, clear, uid = "pt", grain = 1 }: { id: PatternKey | "none"; area: Area; dark: boolean; mirror?: boolean; up?: boolean; clear?: Box[]; uid?: string; grain?: number }) {
  if (id === "none") return null;
  /* drawn in its own frame (x across to the edge, y along it), then placed */
  const x0 = 0, y0 = 0;
  const w = up ? area.h : area.w;
  const h = up ? area.w : area.h;
  /* the designs were drawn on a 540-high card side; `grain` coarsens the dots
     for a small picture (an email signature) without changing the shape */
  const k = (h / 540) * grain;
  const fg = dark ? "#FFFFFF" : "#000000";
  const dim = dark ? "#48484A" : "#C7C7CC";
  const blueOf = (v: number) => (v > 0.6 ? BLUE[dark ? 2 : 0] : v > 0.3 ? BLUE[1] : BLUE[0]);
  const buckets = new Map<string, { d: string[]; op: number }>();
  const add = (x: number, y: number, r: number, color: string, op = 1) => {
    const o = Math.round(op * 10) / 10;
    const key = `${color}|${o}`;
    const bk = buckets.get(key) ?? { d: [], op: o };
    const px = up ? y : x, py = up ? w - x : y;
    const X = area.x0 + (mirror ? area.w - px : px), Y = area.y0 + py;
    bk.d.push(`M${f(X - r)} ${f(Y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`);
    buckets.set(key, bk);
  };
  const grid = (pitch: number, fn: (x: number, y: number, u: number, v: number) => void) => {
    const p = pitch * k;
    for (let y = y0 + p / 2; y < y0 + h; y += p) for (let x = x0 + p / 2; x < x0 + w; x += p) fn(x, y, (x - x0) / w, (y - y0) / h);
  };
  const scanDot = (x: number, y: number, v: number, big = 1) => add(x, y, (1.1 + 2.3 * v) * k * big, v > 0.15 ? fg : dim, 0.45 + 0.55 * v);
  const auraDot = (x: number, y: number, v: number) => { if (v >= 0.05) add(x, y, (0.6 + 2.6 * v) * k, blueOf(v)); };
  const ring = (x: number, y: number, cx: number, cy: number, R: number, s: number) => g(Math.hypot(x - cx, y - cy) - R, s);

  switch (id) {
    case "scan": grid(14, (x, y, u) => scanDot(x, y, g(u - 0.58, 0.07))); break;
    case "scan-edge": grid(14, (x, y, u) => { const v = g(u - 0.93, 0.07); add(x, y, (1.1 + 2.4 * v) * k, v > 0.15 ? fg : dim, 0.45 + 0.55 * v); }); break;
    case "scan-large": grid(20, (x, y, u) => { const v = g(u - 0.6, 0.08); add(x, y, (1.6 + 3.8 * v) * k, v > 0.15 ? fg : dim, 0.45 + 0.55 * v); }); break;
    case "aura-circle": grid(10, (x, y) => auraDot(x, y, ring(x, y, x0 + w * 0.55, y0 + h / 2, h * 0.32, h * 0.075))); break;
    case "aura-circle-edge": grid(10, (x, y) => auraDot(x, y, ring(x, y, x0 + w * 0.95, y0 + h / 2, h * 0.38, h * 0.08))); break;
    case "aura-corner": grid(10, (x, y) => auraDot(x, y, ring(x, y, x0 + w, y0, h * 0.55, h * 0.14))); break;
    case "aura-lower": grid(10, (x, y) => auraDot(x, y, ring(x, y, x0 + w, y0 + h, h * 0.55, h * 0.14))); break;
    case "aura-edge": grid(10, (x, y, u) => { const v = g(1 - u, 0.22); if (v >= 0.06) add(x, y, (0.6 + 2.4 * v) * k, blueOf(v)); }); break;
    case "aura-edge-white": grid(10, (x, y, u) => { const v = g(1 - u, 0.22); if (v >= 0.06) add(x, y, (0.6 + 2.4 * v) * k, v > 0.45 ? fg : dim); }); break;
    case "aura-rising": grid(10, (x, y) => auraDot(x, y, ring(x, y, x0 + w * 0.55, y0 + h * 1.25, h * 0.85, h * 0.13))); break;
    case "aura-band": grid(10, (x, y, u, v) => auraDot(x, y, g(v - 0.5, 0.16) * (0.55 + 0.45 * Math.sin(u * Math.PI)))); break;
    case "lens-edge": grid(16, (x, y) => add(x, y, (0.9 + 5 * g(Math.hypot(x - (x0 + w), y - (y0 + h / 2)), h * 0.34)) * k, fg)); break;
    case "lens-corner": grid(16, (x, y) => add(x, y, (0.9 + 5.2 * g(Math.hypot(x - (x0 + w), y - y0), h * 0.45)) * k, fg)); break;
  }
  const paths = [...buckets.entries()].map(([key, bk]) => (
    <path key={key} d={bk.d.join("")} fill={key.split("|")[0]} opacity={bk.op < 1 ? bk.op : undefined} />
  ));
  if (!clear?.length) return <g>{paths}</g>;
  const mid = `${uid}-pclear`;
  return (
    <g>
      <defs>
        <mask id={mid} maskUnits="userSpaceOnUse" x={area.x0} y={area.y0} width={area.w} height={area.h}>
          <rect x={area.x0} y={area.y0} width={area.w} height={area.h} fill="#FFFFFF" />
          {clear.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill="#000000" />)}
        </mask>
      </defs>
      <g mask={`url(#${mid})`}>{paths}</g>
    </g>
  );
}

/** The pattern choices for a studio field: its words keys `pat.<key>`. */
export const patternOptions = (withNone = true) => [
  ...(withNone ? [{ value: "none", labelKey: "pat.none" }] : []),
  ...PATTERNS.map((p) => ({ value: p, labelKey: `pat.${p}` })),
];
