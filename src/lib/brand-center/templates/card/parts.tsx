/* ---------------------------------------------------------------------------
   Business card — the drawing parts every style is built from (brand book
   ch. 91, 43, 44, 57). Everything in mm; text in the fill's typeface
   (fontOf); Arabic mirrors text placement, never the marks' shapes.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { PT } from "../types";
import { measure } from "../measure";
import type { QrItem } from "./model";
import { isPictureQr } from "./model";

export const INK = "#000000";
export const WHITE = "#FFFFFF";
/** Secondary text on black / on white, and hairlines (the book's greys). */
export const GREY_ON_INK = "#98989D";
export const GREY_ON_WHITE = "#6E6E73";
export const LIGHT_ON_INK = "#D1D1D6";
export const HAIRLINE_ON_WHITE = "#D2D2D7";
export const HAIRLINE_ON_INK = "#3A3A3C";

const LOGO_W = 719.83;
const LOGO_H = 107.57;
export const logoHeight = (width: number) => (width * LOGO_H) / LOGO_W;

/* ── marks ─────────────────────────────────────────────────────────────── */

export function Logo({ x, y, width, fill }: { x: number; y: number; width: number; fill: string }) {
  return <g transform={`translate(${x} ${y}) scale(${width / LOGO_W})`} fill={fill}><KoleexLogoPaths /></g>;
}

/** The horizontal group lockup (ch. 43): logo, hairline, and the name on
 *  three lines in Inter Light — the book's 1190 × 160 box, scaled to
 *  `width`. For wide, short spaces such as the back of the business card. */
export function GroupLockup({ x, y, width, fill, font, weight = 300, lines = ["KOLEEX", "INTERNATIONAL", "GROUP"] }: {
  x: number; y: number; width: number; fill: string; font: string; weight?: number; lines?: string[];
}) {
  const shown = lines.slice(0, 3);
  return (
    <g transform={`translate(${x} ${y}) scale(${width / 1190})`} fill={fill}>
      <g transform={`translate(0 26) scale(${720 / LOGO_W})`}><KoleexLogoPaths /></g>
      <rect x={786} y={0} width={3} height={160} />
      <text style={{ fontFamily: font, fontWeight: weight, fontSize: 40, letterSpacing: 1 }}>
        {shown.map((t, i) => <tspan key={i} x={846} y={[42, 99, 156][i + (3 - shown.length)]}>{t}</tspan>)}
      </text>
    </g>
  );
}
export const lockupHeight = (width: number) => (width * 160) / 1190;

/** One stroke of the X (ch. 57), as a parallelogram from (x, top) with
 *  horizontal ends: `width` across, leaning `lean` mm right per mm down. */
export function Stroke({ x, top, bottom, width, lean, fill = WHITE }: { x: number; top: number; bottom: number; width: number; lean: number; fill?: string }) {
  const dx = (bottom - top) * lean;
  return <polygon points={`${x},${top} ${x + width},${top} ${x + width + dx},${bottom} ${x + dx},${bottom}`} fill={fill} />;
}

/** The group's name as the book writes it (ch. 43): always English, always
 *  capitals — the owner's text is kept, set in capitals. */
export const lockupText = (text: string) => (text.trim() || "KOLEEX INTERNATIONAL GROUP").toUpperCase();
/** The same name on the horizontal lockup's three lines. */
export function lockupLines(text: string): string[] {
  const words = lockupText(text).split(/\s+/).filter(Boolean);
  if (words.length <= 3) return words;
  return [words[0], words.slice(1, -1).join(" "), words[words.length - 1]];
}

/** The stacked group lockup (ch. 43): the name under the logo in Inter
 *  Light, spaced to exactly the logo's width; capital height 0.2 × the
 *  logo's height, 0.3 × its height below it; in the logo's colour. Only for
 *  a logo 40 mm or wider (smaller: the logo alone). Returns the drawing and
 *  the height it adds under the logo. */
export const STACKED_MIN = 40;
export function stackedLine({ text, logo, fill, font }: { text: string; logo: { x: number; y: number; w: number }; fill: string; font: string }): { node: ReactNode; room: number } {
  const lh = logoHeight(logo.w);
  const cap = 0.2 * lh;
  const size = cap / 0.727; // Inter's capital height
  const top = logo.y + lh + 0.3 * lh;
  const node = (
    <text x={logo.x} y={top + cap} textLength={logo.w} lengthAdjust="spacing" fill={fill}
      style={{ fontFamily: font, fontSize: size, fontWeight: 300 }}>{lockupText(text)}</text>
  );
  return { node, room: 0.3 * lh + cap };
}

/** The Authorized badge (ch. 128) — the one mark an agent or distributor may
 *  show: black, a silver frame, the white logo, a silver hairline, then
 *  AUTHORIZED · <year> / <ROLE> / <place>. Every size is a share of `base`
 *  (the book's drawing is 220 wide); like the book's, the badge is as wide
 *  as its words need — at least 40 mm in print. */
const SILVER_STOPS = ["#AEAEB2", "#FFFFFF", "#D1D1D6", "#8E8E93"];
function badgeParts(base: number, year: string, role: string, place: string, font: string) {
  const pad = base * 0.06;
  const lw = base * 0.36;
  const s1 = base * 0.04, s2 = base * 0.052, s3 = base * 0.042, gap = base * 0.012;
  const l1 = `AUTHORIZED · ${year}`.toUpperCase(), l2 = role.toUpperCase();
  const spaced = (t: string, size: number, weight: number, track: number) => textWidth(t, size, weight, font) + t.length * size * track;
  const textW = Math.max(spaced(l1, s1, 600, 0.18), spaced(l2, s2, 700, 0.08), textWidth(place, s3, 500, font));
  const width = Math.max(40, pad * 4 + lw + 0.2 + textW);
  const height = pad * 2 + (s1 + s2 + s3) * 1.18 + gap * 2;
  return { pad, lw, s1, s2, s3, gap, l1, l2, width, height };
}
export function badgeSize(base: number, year: string, role: string, place: string, font: string) {
  const b = badgeParts(base, year, role, place, font);
  return { width: b.width, height: b.height };
}
export function AuthorizedBadge({ x, y, base, year, role, place, font, uid }: {
  x: number; y: number; base: number; year: string; role: string; place: string; font: string; uid: string;
}) {
  const { pad, lw, s1, s2, s3, gap, l1, l2, width, height: h } = badgeParts(base, year, role, place, font);
  const lx = x + pad;
  const divX = lx + lw + pad;
  const tx = divX + 0.2 + pad;
  const top = y + (h - ((s1 + s2 + s3) * 1.18 + gap * 2)) / 2;
  const silver = `url(#${uid}-silver)`;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-silver`} x1="0" y1="0" x2="1" y2="1">
          {SILVER_STOPS.map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={h} rx={base * 0.027} fill={INK} />
      <rect x={x + 0.25} y={y + 0.25} width={width - 0.5} height={h - 0.5} rx={base * 0.025} fill="none" stroke="#AEAEB2" strokeWidth={0.25} />
      <Logo x={lx} y={y + (h - logoHeight(lw)) / 2} width={lw} fill={WHITE} />
      <rect x={divX} y={y + pad} width={0.2} height={h - pad * 2} fill={silver} />
      <text x={tx} y={top + s1 * 0.95} fill={silver} style={{ fontFamily: font, fontSize: s1, fontWeight: 600, letterSpacing: s1 * 0.18 }}>{l1}</text>
      <text x={tx} y={top + s1 * 1.18 + gap + s2 * 0.95} fill={silver} style={{ fontFamily: font, fontSize: s2, fontWeight: 700, letterSpacing: s2 * 0.08 }}>{l2}</text>
      <text x={tx} y={top + (s1 + s2) * 1.18 + gap * 2 + s3 * 0.95} fill="#98989D" style={{ fontFamily: font, fontSize: s3, fontWeight: 500 }}>{place}</text>
    </g>
  );
}

/** The dots (ch. 57): one even grid, every dot the same size — grey or
 *  white on black, grey on white — filling `area` (a rect) and, when given,
 *  only inside `shape` (an SVG path in the same mm space). The grid is laid
 *  from `origin` so a card's pattern sits square on its trim. */
export function Dots({ area, pitch = 1.8, r = 0.32, fill, shape, origin, uid, opacity = 1 }: {
  area: { x: number; y: number; w: number; h: number }; pitch?: number; r?: number; fill: string; shape?: string;
  origin: { x: number; y: number }; uid: string; opacity?: number;
}) {
  return (
    <g opacity={opacity}>
      <defs>
        <pattern id={`${uid}-dots`} patternUnits="userSpaceOnUse" x={origin.x - pitch / 2} y={origin.y - pitch / 2} width={pitch} height={pitch}>
          <circle cx={pitch / 2} cy={pitch / 2} r={r} fill={fill} />
        </pattern>
        {shape ? <clipPath id={`${uid}-dotclip`}><path d={shape} /></clipPath> : null}
      </defs>
      <rect x={area.x} y={area.y} width={area.w} height={area.h} fill={`url(#${uid}-dots)`} clipPath={shape ? `url(#${uid}-dotclip)` : undefined} />
    </g>
  );
}

/** The book's wave (ch. 57, 280 × 150) as a closed shape filling the space
 *  under the curve, scaled into a box. */
export function waveShape(box: { x: number; y: number; w: number; h: number }): string {
  const X = (x: number) => box.x + (x / 280) * box.w;
  const Y = (y: number) => box.y + (y / 150) * box.h;
  return `M${X(0)} ${Y(96)} C ${X(60)} ${Y(60)}, ${X(120)} ${Y(140)}, ${X(180)} ${Y(92)} S ${X(280)} ${Y(66)}, ${X(280)} ${Y(66)} L${X(280)} ${Y(150)} L${X(0)} ${Y(150)} Z`;
}

/* ── text ──────────────────────────────────────────────────────────────── */

const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;

/** Width of a line in mm: measured in the typeface when one is given (in
 *  the browser), otherwise estimated from average advances. */
export function textWidth(text: string, size: number, weight = 400, font?: string, italic = false): number {
  if (font) {
    const m = measure(text, size, weight, font, italic);
    if (m !== null) return m;
  }
  let em = 0;
  for (const ch of text) em += CJK.test(ch) ? 1 : /[\u0600-\u06FF]/.test(ch) ? 0.5 : /[A-Z0-9@%&]/.test(ch) ? 0.64 : ch === " " ? 0.28 : 0.52;
  return em * size * (weight >= 600 ? 1.05 : weight <= 300 ? 0.97 : 1);
}

export function fit(text: string, size: number, max: number, weight = 400, font?: string, italic = false) {
  return max > 0 && textWidth(text, size, weight, font, italic) > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

/** Word-wrap to lines of at most `max` mm (CJK wraps between characters). */
export function wrap(text: string, size: number, max: number, maxLines = 2, weight = 400, font?: string, italic = false): string[] {
  const cjk = CJK.test(text) && !/\s/.test(text);
  const units = cjk ? Array.from(text) : glueSeparators(text.split(/\s+/).filter(Boolean));
  const join = cjk ? "" : " ";
  const lines: string[] = [];
  let cur = "";
  for (const u of units) {
    const next = cur ? cur + join + u : u;
    if (cur && textWidth(next, size, weight, font, italic) > max) { lines.push(cur); cur = u; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(join)];
}

/** A lone "·", "|" or "/" rides with the word before it — a line never
 *  starts or ends on a bare separator. */
function glueSeparators(words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (/^[·|/–—-]$/.test(w) && out.length) out[out.length - 1] += ` ${w}`;
    else out.push(w);
  }
  return out;
}

/** Two lines of about the same width (a designer's break: no word left
 *  alone on the second line), or one line when it fits. */
export function wrapBalanced(text: string, size: number, max: number, weight = 400, font?: string, italic = false): string[] {
  if (textWidth(text, size, weight, font, italic) <= max) return [text];
  const cjk = CJK.test(text) && !/\s/.test(text);
  const units = cjk ? Array.from(text) : glueSeparators(text.split(/\s+/).filter(Boolean));
  const join = cjk ? "" : " ";
  if (units.length < 2) return [text];
  let best: string[] = [text];
  let bestScore = Infinity;
  for (let i = 1; i < units.length; i++) {
    const a = units.slice(0, i).join(join), b = units.slice(i).join(join);
    const wa = textWidth(a, size, weight, font, italic), wb = textWidth(b, size, weight, font, italic);
    const over = Math.max(0, wa - max) + Math.max(0, wb - max);
    const score = over * 100 + Math.abs(wa - wb);
    if (score < bestScore) { bestScore = score; best = [a, b]; }
  }
  return best;
}

/** A line of text from its logical start: left, or right in Arabic. */
export function Line({ x, y, rtl, children, size, weight = 400, fill, max, anchor = "start", font, italic, spacing }: {
  x: number; y: number; rtl: boolean; children: string; size: number; weight?: number; fill: string; max?: number;
  anchor?: "start" | "middle" | "end"; font: string; italic?: boolean; spacing?: number;
}) {
  return (
    <text x={x} y={y} direction={rtl ? "rtl" : "ltr"} textAnchor={anchor} fill={fill} {...(max ? fit(children, size, max, weight, font, italic) : {})}
      style={{ fontFamily: font, fontSize: size, fontWeight: weight, fontStyle: italic ? "italic" : undefined, letterSpacing: spacing }}>{children}</text>
  );
}

export interface PrintRow { label: string; value: string; rtlValue: boolean; kind?: string }

/** Contact lines with the labels in their own column, so the values line
 *  up; the address may wrap. `y` is the first baseline (align "top") or the
 *  last (align "bottom"). */
export function ColumnRows({ rows, x, y, align, width, rtl, size, fill, labelFill, font, lead = 1.42, maxWrap = 2 }: {
  rows: PrintRow[]; x: number; y: number; align: "top" | "bottom"; width: number; rtl: boolean; size: number;
  fill: string; labelFill?: string; font: string; lead?: number; maxWrap?: number;
}) {
  const { labelW, room, lines } = layoutColumns(rows, size, width, maxWrap, font);
  const step = size * lead;
  const top = align === "top" ? y : y - (lines.length - 1) * step;
  const vx = rtl ? x - labelW : x + labelW;
  return (
    <g>
      {lines.map((l, i) => (
        <g key={i}>
          {l.label ? (
            <text x={x} y={top + i * step} direction={rtl ? "rtl" : "ltr"} textAnchor="start" fill={labelFill ?? fill}
              style={{ fontFamily: font, fontSize: size, fontWeight: 600 }}>{l.label}</text>
          ) : null}
          <text x={vx} y={top + i * step} direction={l.rtl ? "rtl" : "ltr"} textAnchor={rtl && !l.rtl ? "end" : "start"} fill={fill}
            {...fit(l.text, size, room, 400, font)} style={{ fontFamily: font, fontSize: size, fontWeight: 400 }}>{l.text}</text>
        </g>
      ))}
    </g>
  );
}
function layoutColumns(rows: PrintRow[], size: number, width: number, maxWrap: number, font?: string) {
  const labelW = rows.some((r) => r.label) ? Math.max(...rows.map((r) => (r.label ? textWidth(r.label, size, 600, font) + size * 0.6 : 0))) : 0;
  const room = width - labelW;
  /* Design review 29/09: only the address wraps — into two even lines; a
     phone, e-mail or link never breaks (it condenses a little instead). */
  const lines = rows.flatMap((r) => {
    const wraps = (r.kind === "address" || r.kind === "custom") && textWidth(r.value, size, 400, font) > room;
    const parts = wraps ? (maxWrap > 2 ? wrap(r.value, size, room, maxWrap, 400, font) : wrapBalanced(r.value, size, room, 400, font)) : [r.value];
    return parts.map((text, i) => ({ label: i ? "" : r.label, text, rtl: r.rtlValue }));
  });
  return { labelW, room, lines };
}
export function columnRowsSpan(rows: PrintRow[], size: number, width: number, lead = 1.42, maxWrap = 2, font?: string): number {
  return Math.max(0, layoutColumns(rows, size, width, maxWrap, font).lines.length - 1) * size * lead;
}

/** Contact lines as "Label value" on one line each (the owner's card), or
 *  centred. Each line is condensed to the width if needed. */
export function InlineRows({ rows, x, y, width, rtl, size, fill, labelFill, font, lead = 2, anchor = "start", labelWeight = 700 }: {
  rows: PrintRow[]; x: number; y: number; width: number; rtl: boolean; size: number; fill: string; labelFill?: string; font: string;
  lead?: number; anchor?: "start" | "middle"; labelWeight?: number;
}) {
  return (
    <g>
      {rows.map((r, i) => {
        const text = r.label ? `${r.label} ${r.value}` : r.value;
        return (
          <text key={i} x={x} y={y + i * size * lead} direction={rtl ? "rtl" : "ltr"} textAnchor={anchor} fill={fill}
            {...fit(text, size, width, 400, font)} style={{ fontFamily: font, fontSize: size }}>
            {r.label ? <tspan fontWeight={labelWeight} fill={labelFill ?? fill}>{r.label} </tspan> : null}
            <tspan fontWeight={400} direction={r.rtlValue ? "rtl" : "ltr"} unicodeBidi="embed">{r.value}</tspan>
          </text>
        );
      })}
    </g>
  );
}

/* ── QR codes ──────────────────────────────────────────────────────────── */

/** A generated QR (dark modules on white, quiet zone included); with
 *  `logo`, the KOLEEX logo on a white plate in the middle (level H). */
export function Qr({ modules, x, y, size, logo }: { modules: boolean[][]; x: number; y: number; size: number; logo?: boolean }) {
  const pad = size * 0.08;
  const cell = (size - pad * 2) / modules.length;
  let d = "";
  modules.forEach((row, r) => row.forEach((on, c) => {
    if (on) d += `M${(x + pad + c * cell).toFixed(3)} ${(y + pad + r * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
  }));
  const pw = size * 0.44;
  const ph = logoHeight(pw * 0.78) + size * 0.07;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.04} fill={WHITE} />
      <path d={d} fill={INK} shapeRendering="crispEdges" />
      {logo ? (
        <g>
          <rect x={x + (size - pw) / 2} y={y + (size - ph) / 2} width={pw} height={ph} fill={WHITE} />
          <Logo x={x + (size - pw * 0.78) / 2} y={y + (size - logoHeight(pw * 0.78)) / 2} width={pw * 0.78} fill={INK} />
        </g>
      ) : null}
    </g>
  );
}

export interface Zone { x: number; y: number; w: number; h: number; dir: "row" | "column"; align: "start" | "center" | "end" }

/** The QR codes of one side laid out in a zone: in a row or a column, as
 *  large as fits up to `max` mm, a caption under each when it has one. */
export function QrZone({ items, codes, zone, max, captionFill, font, gap = 2.5 }: {
  items: QrItem[]; codes: Record<string, boolean[][]>; zone: Zone; max: number; captionFill: string; font: string; gap?: number;
}) {
  const shown = items.filter((q) => (isPictureQr(q) ? !!q.image : !!codes[q.id]));
  if (!shown.length) return null;
  const n = shown.length;
  const capH = shown.some((q) => q.caption.trim()) ? 2.4 : 0;
  const along = zone.dir === "row" ? zone.w : zone.h;
  const across = zone.dir === "row" ? zone.h - capH : zone.w;
  const size = Math.max(6, Math.min(max, (along - gap * (n - 1) - (zone.dir === "column" ? capH * n : 0)) / n, across));
  const step = size + gap + (zone.dir === "column" ? capH : 0);
  const total = n * size + (n - 1) * gap + (zone.dir === "column" ? n * capH : 0);
  const startAlong = zone.align === "start" ? 0 : zone.align === "end" ? along - total : (along - total) / 2;
  return (
    <g>
      {shown.map((q, i) => {
        const a = startAlong + i * step;
        const qx = zone.dir === "row" ? zone.x + a : zone.x + (zone.w - size) / 2;
        const qy = zone.dir === "row" ? zone.y + (zone.h - capH - size) : zone.y + a;
        const body: ReactNode = isPictureQr(q)
          ? <image href={q.image} x={qx} y={qy} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
          : <Qr modules={codes[q.id]} x={qx} y={qy} size={size} logo={q.logo} />;
        return (
          <g key={q.id}>
            {body}
            {q.caption.trim() ? (
              <text x={qx + size / 2} y={qy + size + 1.9} textAnchor="middle" fill={captionFill}
                {...fit(q.caption.trim(), 4.5 * PT, size + gap)} style={{ fontFamily: font, fontSize: 4.5 * PT }}>{q.caption.trim()}</text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/* ── the portrait ──────────────────────────────────────────────────────── */

/** A photo in a box, black and white, zoomed (1–3) and moved (x / y
 *  −100…100) by the person, its edges melting into the black when `soft`. */
export function Photo({ href, box, zoom, px, py, soft, uid, tone = "bw", radius = 0 }: {
  href: string; box: { x: number; y: number; w: number; h: number }; zoom: number; px: number; py: number; soft: boolean; uid: string;
  /** "bw" the portrait cards; "muted" the book's team colour (ch. 66: cool, lower saturation). */
  tone?: "bw" | "muted"; radius?: number;
}) {
  const zw = box.w * zoom;
  const zh = box.h * zoom;
  /* Centred across, hung from the top; x / y move it up to half the box. */
  const ix = box.x + (box.w - zw) / 2 + (px / 100) * box.w * 0.5;
  const iy = box.y + (py / 100) * box.h * 0.5;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-photo`}><rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} /></clipPath>
        <filter id={`${uid}-bw`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values={tone === "bw" ? "0" : "0.78"} />
          <feComponentTransfer><feFuncR type="linear" slope="1.1" intercept="-0.04" /><feFuncG type="linear" slope="1.1" intercept="-0.04" /><feFuncB type="linear" slope="1.1" intercept="-0.04" /></feComponentTransfer>
        </filter>
        <radialGradient id={`${uid}-fade`} cx="0.5" cy="0.5" r="0.56" gradientTransform="translate(0.5 0.5) scale(1 1.3) translate(-0.5 -0.5)">
          <stop offset="0.52" stopColor="#FFFFFF" />
          <stop offset="0.94" stopColor="#000000" />
        </radialGradient>
        <mask id={`${uid}-mask`} maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill={`url(#${uid}-fade)`} /></mask>
      </defs>
      <g clipPath={`url(#${uid}-photo)`}>
        <g mask={soft ? `url(#${uid}-mask)` : undefined}>
          <image href={href} x={ix} y={iy} width={zw} height={zh} preserveAspectRatio="xMidYMin slice" filter={`url(#${uid}-bw)`} />
        </g>
      </g>
    </g>
  );
}

/** Where a portrait goes when there is none yet (the book's silhouette). */
export function PhotoPlaceholder({ box, label, font }: { box: { x: number; y: number; w: number; h: number }; label: string; font: string }) {
  const cx = box.x + box.w / 2;
  return (
    <g>
      <rect x={box.x + box.w * 0.2} y={box.y + box.h * 0.55} width={box.w * 0.6} height={box.h * 0.45} rx={box.w * 0.26} fill="#48484A" />
      <circle cx={cx} cy={box.y + box.h * 0.36} r={box.w * 0.17} fill="#8E8E93" />
      <text x={cx} y={box.y + box.h * 0.37} textAnchor="middle" fill={INK} style={{ fontFamily: font, fontSize: 5.5 * PT, fontWeight: 600 }}>{label}</text>
    </g>
  );
}
