/* ---------------------------------------------------------------------------
   Business card — the owner's references (30/09/2026: "please make exactly
   the same designs as I send"). Nine cards he picked, rebuilt as close as
   the brand allows: the same layout, positions, proportions, sizes and
   colours, measured from his pictures as fractions of the trim. Four swaps
   only: the full KOLEEX logo and our data for theirs; their artwork redrawn
   to look alike (their map is the KOLEEX dotted world map); our typefaces
   (Inter / Helvetica Neue); nothing of theirs reused.

     r-metal    black metal: the logo over a shippō pattern (raised gloss),
                a triangle hole in the corner, round corners
     r-minimal  black both sides: the big logo bottom-left; the name, the
                logo — title, and the contacts in three corners
     r-glow     round corners, rings of blue light
     r-frame    a white frame broken by the title; the dotted world map
     r-tabs     a white rim, the logo in a thin frame; black name tabs
     r-lockup   the logo and the descriptor centred; the contacts on white
     r-paper    a black front, a white paper back in spaced capitals
     r-disc     the logo on a white disc among rings; a ghost circle back
     r-round    round corners: a white front, a black back with icons

   The logo stays white or black (never silver) and is never cut; where a
   reference has its own words by the mark, the book's descriptor (ch. 21)
   takes their place. They start as drafts: the owner approves each one
   beside its reference.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "../types";
import { Logo, QrZone, logoHeight, textWidth, type PrintRow } from "./parts";
import { fontOf, isPictureQr, langOf, num, printedRows, qrsOf, str, type Lang, type QrItem } from "./model";
import { ContactIcon, iconOf, type IconKind } from "./icons";
import { WorldDots } from "./world";

export const REF_STYLES = ["r-metal", "r-minimal", "r-glow", "r-frame", "r-tabs", "r-lockup", "r-paper", "r-disc", "r-round"] as const;
type Ref = (typeof REF_STYLES)[number];
export const isReference = (v: TemplateValues) => (REF_STYLES as readonly string[]).includes(String(v.style));
const refOf = (v: TemplateValues): Ref => (isReference(v) ? (v.style as Ref) : "r-minimal");
/** The references that carry the descriptor by the logo. */
export const DESCRIPTOR_STYLES: readonly string[] = ["r-metal", "r-glow", "r-tabs", "r-lockup"];
/** The one reference that labels its lines ("Phone Number", "Mail"). */
export const LABELLED_REFS: readonly string[] = ["r-disc"];

/** The brand book's descriptor (ch. 21), in the card's language. */
export const DESCRIPTOR: Record<Lang, string> = { en: "Industrial Garment Machinery", zh: "工业服装机械", ar: "ماكينات صناعية للملابس" };

const ARABIC = /[؀-ۿ]/;
const NOT_LATIN = /[؀-ۿ⺀-鿿]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
type Align = "left" | "right" | "center";

function read(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed, w = ctx.w, h = ctx.h;
  const lang = langOf(v);
  const rtl = lang === "ar";
  const style = refOf(v);
  const all = qrsOf(v);
  const labels = LABELLED_REFS.includes(style) && v.labels !== false;
  const k = num(v, "scale", 100) / 100;
  return {
    b, w, h, W: w + 2 * b, H: h + 2 * b, lang, rtl, style, font: fontOf(v), k, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), title: str(v, "title"),
    rows: printedRows({ ...v, labels }) as PrintRow[],
    whatsapp: v.whatsapp === true,
    front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
    descriptor: v.descriptorOn === false ? "" : str(v, "descriptor") || DESCRIPTOR[lang],
    /** a point at a fraction of the trim — X mirrors in Arabic, x does not */
    X: (f: number) => b + (rtl ? 1 - f : f) * w,
    x: (f: number) => b + f * w,
    Y: (f: number) => b + f * h,
    /** a type size or a leading as a fraction of the trim's height, times the text slider */
    S: (f: number) => f * h * k,
    start: (rtl ? "right" : "left") as Align,
    end: (rtl ? "left" : "right") as Align,
  };
}
type R = ReturnType<typeof read>;

/** Width of a line in mm, letter spacing included. */
function tw(r: R, text: string, size: number, weight = 400, spacing = 0, italic = false) {
  return textWidth(text, size, weight, r.font, italic) + (spacing && !ARABIC.test(text) ? spacing * [...text].length : 0);
}

/** A line of text on the side of x it is asked for (physical), in its own
 *  direction. `squeeze` narrows the letters (a condensed face); `max`
 *  condenses a line that would run longer. */
function T({ r, x, y, size, children, fill, weight = 400, align = "left", max, spacing = 0, italic = false, squeeze = 1, lengthTo }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number; align?: Align;
  max?: number; spacing?: number; italic?: boolean; squeeze?: number; lengthTo?: number;
}) {
  if (!children) return null;
  const ar = ARABIC.test(children);
  const anchor = align === "center" ? "middle" : (align === "left") === !ar ? "start" : "end";
  const sp = ar ? 0 : spacing;
  const natural = tw(r, children, size, weight, sp, italic) * squeeze;
  /* Chrome spaces after the last letter too: an end-anchored line moves back by it */
  const dx = sp && !ar ? (anchor === "end" ? sp : anchor === "middle" ? sp / 2 : 0) : 0;
  const len = lengthTo && !ar ? { textLength: lengthTo / squeeze, lengthAdjust: "spacing" as const }
    : max !== undefined && max > 0 && natural > max ? { textLength: max / squeeze, lengthAdjust: "spacingAndGlyphs" as const } : {};
  const style = { fontFamily: r.font, fontSize: size, fontWeight: weight, fontStyle: italic ? "italic" : undefined, letterSpacing: sp || undefined, unicodeBidi: "plaintext" as const };
  const node = (
    <text x={squeeze === 1 ? x + dx : dx / squeeze} y={squeeze === 1 ? y : 0} direction={ar ? "rtl" : "ltr"} textAnchor={anchor} fill={fill} {...len} style={style}>{children}</text>
  );
  return squeeze === 1 ? node : <g transform={`translate(${x} ${y}) scale(${squeeze} 1)`}>{node}</g>;
}

const bg = (r: R, color: string) => <rect x={0} y={0} width={r.W} height={r.H} fill={color} />;

/** The QR codes of a side in a corner of the safe area (mirrored in
 *  Arabic), or at a given place; returns the drawing and the box it takes. */
function qrBox(r: R, items: QrItem[], at: { corner?: "tl" | "tr" | "bl" | "br"; x?: number; y?: number; alignEnd?: boolean }, size: number, dark: boolean) {
  const n = items.filter((q) => (isPictureQr(q) ? !!q.image : !!r.codes[q.id])).length;
  if (!n) return { node: null, box: null };
  const cap = items.some((q) => q.caption.trim()) ? 2.4 : 0;
  const zw = n * size + (n - 1) * 2.5, zh = size + cap;
  const x0 = r.b + 5, x1 = r.b + r.w - 5, y0 = r.b + 5, y1 = r.b + r.h - 5;
  let x: number, y: number, end: boolean;
  if (at.corner) {
    end = (at.corner[1] === "r") !== r.rtl;
    x = end ? x1 - zw : x0;
    y = at.corner[0] === "t" ? y0 : y1 - zh;
  } else {
    end = at.alignEnd === true;
    x = end ? (at.x ?? x1) - zw : at.x ?? x0;
    y = at.y ?? y0;
  }
  const node = <QrZone items={items} codes={r.codes} font={r.font} captionFill={dark ? "#98989D" : "#6E6E73"} max={size} zone={{ x, y, w: zw, h: zh, dir: "row", align: end ? "end" : "start" }} />;
  return { node, box: { x, y, w: zw, h: zh } };
}

/** The descriptor as a row of words ("INDUSTRIAL | GARMENT | MACHINERY");
 *  Chinese and Arabic keep their own phrase. */
const wordsRow = (s: string) => (NOT_LATIN.test(s) ? s : caps(s).split(/\s+/).filter(Boolean).join("  |  "));

/** The contact lines of the given kinds, in the person's order. */
const PHONES = ["mobile", "tel", "fax", "whatsapp", "wechat"];
const pick = (rows: PrintRow[], kinds: string[]) => rows.filter((row) => kinds.includes(row.kind ?? "custom"));

/** A line as printed: only the address wraps — greedily to `max` mm, two
 *  lines balanced to about the same width, the rest joined into the last. */
function linesOf(r: R, row: PrintRow, size: number, max: number, weight = 400, spacing = 0, maxLines = 2): string[] {
  const text = row.value;
  const w = (s: string) => tw(r, s, size, weight, spacing);
  if ((row.kind !== "address" && row.kind !== "custom") || w(text) <= max) return [text];
  const cjk = /[\u2E80-\u9FFF]/.test(text) && !/\s/.test(text);
  const units = cjk ? [...text] : text.split(/\s+/).filter(Boolean);
  const join = cjk ? "" : " ";
  const lines: string[] = [];
  let cur = "";
  for (const u of units) {
    const next = cur ? cur + join + u : u;
    if (cur && w(next) > max) { lines.push(cur); cur = u; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length === 2) {
    let best = lines, score = Infinity;
    for (let i = 1; i < units.length; i++) {
      const a = units.slice(0, i).join(join), b = units.slice(i).join(join);
      const wa = w(a), wb = w(b);
      const sc = (Math.max(0, wa - max) + Math.max(0, wb - max)) * 100 + Math.abs(wa - wb);
      if (sc < score) { score = sc; best = [a, b]; }
    }
    return best;
  }
  return lines.length <= maxLines ? lines : [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(join)];
}

/** A circular arc through three points (fractions of the trim), drawn a
 *  little past both ends so it runs into the bleed. */
function arcThrough(r: R, pts: Array<[number, number]>, extend = 0.12): string {
  const [a, m, c] = pts.map(([fx, fy]) => [r.x(fx), r.Y(fy)] as [number, number]);
  const d = 2 * (a[0] * (m[1] - c[1]) + m[0] * (c[1] - a[1]) + c[0] * (a[1] - m[1]));
  const sq = (p: [number, number]) => p[0] * p[0] + p[1] * p[1];
  const ux = (sq(a) * (m[1] - c[1]) + sq(m) * (c[1] - a[1]) + sq(c) * (a[1] - m[1])) / d;
  const uy = (sq(a) * (c[0] - m[0]) + sq(m) * (a[0] - c[0]) + sq(c) * (m[0] - a[0])) / d;
  const rad = Math.hypot(a[0] - ux, a[1] - uy);
  const ang = (p: [number, number]) => Math.atan2(p[1] - uy, p[0] - ux);
  const ta = ang(a), tm = ang(m), tc = ang(c);
  const norm = (t: number) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  /* the way round from a to c that passes m */
  const dir = norm(tm - ta) < norm(tc - ta) ? 1 : -1;
  const span = dir > 0 ? norm(tc - ta) : norm(ta - tc);
  const from = ta - dir * extend, total = span + 2 * extend;
  let path = "";
  for (let i = 0; i <= 48; i++) {
    const t = from + dir * (total * i) / 48;
    path += `${i ? "L" : "M"}${(ux + rad * Math.cos(t)).toFixed(3)} ${(uy + rad * Math.sin(t)).toFixed(3)}`;
  }
  return path;
}

/* ── r-metal ───────────────────────────────────────────────────────────── */

const METAL = { bg: "#141416", lens: "#2A2A2D", star: "#060607", text: "#E5E5EA", grey: "#8E8E93" };

/** The shippō pattern (interlocking circles): matte lenses, gloss stars. */
function Shippo({ r, area, pitch }: { r: R; area: { x: number; y: number; w: number; h: number }; pitch: number }) {
  const s = pitch, q = s / 2;
  const star = (cx: number, cy: number) =>
    `M${cx + q} ${cy}A${q} ${q} 0 0 0 ${cx} ${cy + q}A${q} ${q} 0 0 0 ${cx - q} ${cy}A${q} ${q} 0 0 0 ${cx} ${cy - q}A${q} ${q} 0 0 0 ${cx + q} ${cy}Z`;
  const id = `${r.uid}-shippo`;
  return (
    <g>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" x={area.x + (area.w % s) / 2} y={area.y} width={s} height={s}>
          <rect width={s} height={s} fill={METAL.lens} />
          <path d={[star(0, 0), star(s, 0), star(0, s), star(s, s), star(q, q)].join("")} fill={METAL.star} />
        </pattern>
      </defs>
      <rect x={area.x} y={area.y} width={area.w} height={area.h} fill={`url(#${id})`} />
    </g>
  );
}

function metalFront(r: R): ReactNode {
  const lw = 0.42 * r.w;
  const qr = qrBox(r, r.front, { corner: "tr" }, 9, true);
  return (
    <>
      {bg(r, METAL.bg)}
      <Shippo r={r} pitch={0.052 * r.w} area={{ x: r.x(0.018), y: r.Y(0.47), w: 0.964 * r.w, h: 0.495 * r.h }} />
      <Logo x={r.b + (r.w - lw) / 2} y={r.Y(0.265) - logoHeight(lw) / 2} width={lw} fill="#FFFFFF" />
      {qr.node}
    </>
  );
}

function metalBack(r: R): ReactNode {
  const ns = r.S(0.066), ts = r.S(0.038), cs = r.S(0.043);
  const nameY = r.Y(0.2);
  /* the contacts in the top end corner, one under another */
  const rows: ReactNode[] = [];
  let y = r.Y(0.15);
  /* the contacts take what the name and the title leave, 4 mm apart */
  const leftW = Math.min(0.4 * r.w, Math.max(tw(r, r.name, ns, 300, ns * 0.02), tw(r, caps(r.title), ts, 500, ts * 0.14)));
  const maxW = Math.max(28, Math.min(0.46 * r.w, 0.833 * r.w - leftW - 4));
  r.rows.forEach((row, i) => {
    const lines = linesOf(r, row, cs, maxW, 400, 0, 3);
    lines.forEach((l, j) => {
      rows.push(<T key={`${i}-${j}`} r={r} x={r.X(0.905)} y={y} size={cs} fill={METAL.text} align={r.end} max={maxW}>{l}</T>);
      y += j < lines.length - 1 ? r.S(0.066) : r.S(0.095);
    });
  });
  /* the foot: the logo and the descriptor; the QR codes after a rule */
  const lw = Math.min(25, 0.29 * r.w);
  const foot = r.Y(0.86);
  const qr = qrBox(r, r.back, { corner: "br" }, 10, true);
  const ruleX = qr.box ? (r.rtl ? qr.box.x + qr.box.w + 3 : qr.box.x - 3) : null;
  const dx = r.rtl ? r.X(0.072) - lw : r.X(0.072);
  const descX = r.rtl ? dx - 3.5 : dx + lw + 3.5;
  const ds = r.S(0.034);
  const descMax = (ruleX ?? r.X(0.93)) - descX;
  return (
    <>
      {bg(r, METAL.bg)}
      <T r={r} x={r.X(0.072)} y={nameY} size={ns} fill={METAL.text} weight={300} align={r.start} max={0.4 * r.w} spacing={ns * 0.02}>{r.name}</T>
      <T r={r} x={r.X(0.072)} y={nameY + ns * 0.45 + ts * 1.6} size={ts} fill={METAL.grey} weight={500} align={r.start} max={0.4 * r.w} spacing={ts * 0.14}>{caps(r.title)}</T>
      {rows}
      <Logo x={dx} y={foot - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      <T r={r} x={descX} y={foot - (logoHeight(lw) - ds * 0.72) / 2} size={ds} fill={METAL.grey} align={r.start} max={Math.abs(descMax) - 2} spacing={ds * 0.22}>{caps(r.descriptor)}</T>
      {ruleX !== null && qr.box ? <rect x={ruleX - 0.1} y={qr.box.y + 1} width={0.2} height={qr.box.h - 2} fill={METAL.grey} /> : null}
      {qr.node}
    </>
  );
}

/* ── r-minimal ─────────────────────────────────────────────────────────── */

const MINIMAL = "#121212";

function minimalFront(r: R): ReactNode {
  const lw = 0.46 * r.w;
  const qr = qrBox(r, r.front, { corner: "tr" }, 10, true);
  return (
    <>
      {bg(r, MINIMAL)}
      <Logo x={r.rtl ? r.X(0.053) - lw : r.X(0.053)} y={r.Y(0.84) - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      {qr.node}
    </>
  );
}

function minimalBack(r: R): ReactNode {
  const s = r.S(0.045);
  const base = r.Y(0.18);
  const nameW = Math.min(tw(r, caps(r.name), s, 500, s * 0.04), 0.42 * r.w);
  /* "logo —— title" in the end corner */
  const lw = 13, lh = logoHeight(lw), gap = 1.7, rule = 4.2;
  const room = 0.955 * r.w - 0.053 * r.w - nameW - 5 - lw - gap * 2 - rule;
  const italic = !NOT_LATIN.test(r.title);
  const titleW = Math.min(tw(r, r.title, s, 400, 0, italic), room);
  const dir = r.rtl ? -1 : 1;
  const titleStart = r.X(0.955) - dir * titleW; // the title's start edge, towards the middle
  const ruleEnd = titleStart - dir * gap, ruleStart = ruleEnd - dir * rule;
  const logoEdge = ruleStart - dir * gap;
  const logoX = r.rtl ? logoEdge : logoEdge - lw;
  /* the contacts, flush to the end, over the foot */
  const nodes: ReactNode[] = [];
  const lead = r.S(0.066);
  const lines = r.rows.flatMap((row) => linesOf(r, row, s, 0.55 * r.w));
  lines.forEach((l, i) => nodes.push(<T key={i} r={r} x={r.X(0.955)} y={r.Y(0.84) - (lines.length - 1 - i) * lead} size={s} fill="#FFFFFF" align={r.end} max={0.6 * r.w}>{l}</T>));
  const qr = qrBox(r, r.back, { corner: "bl" }, 11, true);
  return (
    <>
      {bg(r, MINIMAL)}
      <T r={r} x={r.X(0.053)} y={base} size={s} fill="#FFFFFF" weight={500} align={r.start} max={0.42 * r.w} spacing={s * 0.04}>{caps(r.name)}</T>
      {r.title ? (
        <>
          <Logo x={logoX} y={base - lh} width={lw} fill="#FFFFFF" />
          <rect x={Math.min(ruleStart, ruleEnd)} y={base - s * 0.34} width={rule} height={0.18} fill="#8E8E93" />
          <T r={r} x={r.X(0.955)} y={base} size={s} fill="#FFFFFF" align={r.end} italic={italic} max={Math.max(8, room)}>{r.title}</T>
        </>
      ) : <Logo x={r.rtl ? r.X(0.955) : r.X(0.955) - lw} y={base - lh} width={lw} fill="#FFFFFF" />}
      {nodes}
      {qr.node}
    </>
  );
}

/* ── r-glow ────────────────────────────────────────────────────────────── */

const GLOW = { bg: "#0E1317", inner: "#070A0D", ring: "#1E9BFF", core: "#A8DCFF" };

function GlowDefs({ r }: { r: R }) {
  return (
    <defs>
      <filter id={`${r.uid}-glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={0.9} /></filter>
      <filter id={`${r.uid}-glow2`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={2.6} /></filter>
    </defs>
  );
}
/** A line of blue light: a wide soft halo, a glow, a bright core. */
function LightLine({ r, d, circle, dim = 1 }: { r: R; d?: string; circle?: { cx: number; cy: number; rad: number }; dim?: number }) {
  const shape = (props: Record<string, unknown>) => (circle ? <circle cx={circle.cx} cy={circle.cy} r={circle.rad} fill="none" {...props} /> : <path d={d} fill="none" {...props} />);
  return (
    <g>
      {shape({ stroke: GLOW.ring, strokeWidth: 2.2, opacity: 0.45 * dim, filter: `url(#${r.uid}-glow2)` })}
      {shape({ stroke: GLOW.ring, strokeWidth: 0.9, opacity: 0.9 * dim, filter: `url(#${r.uid}-glow)` })}
      {shape({ stroke: GLOW.core, strokeWidth: 0.28, opacity: dim })}
    </g>
  );
}

function glowFront(r: R): ReactNode {
  const cx = r.x(0.5), cy = r.Y(0.5);
  const inner = 0.482 * r.h, outer = 0.68 * r.h;
  const lw = 0.28 * r.w;
  const ds = r.S(0.032);
  const qr = qrBox(r, r.front, { corner: "br" }, 8, true);
  return (
    <>
      {bg(r, GLOW.bg)}
      <GlowDefs r={r} />
      <defs>
        <radialGradient id={`${r.uid}-gin`} cx={cx} cy={cy} r={inner} gradientUnits="userSpaceOnUse">
          <stop offset={0.78} stopColor={GLOW.inner} />
          <stop offset={1} stopColor="#0B2033" />
        </radialGradient>
      </defs>
      <LightLine r={r} circle={{ cx, cy, rad: outer }} />
      <circle cx={cx} cy={cy} r={inner} fill={`url(#${r.uid}-gin)`} />
      <LightLine r={r} circle={{ cx, cy, rad: inner }} />
      <Logo x={cx - lw / 2} y={r.Y(0.462) - logoHeight(lw) / 2} width={lw} fill="#FFFFFF" />
      <T r={r} x={cx} y={r.Y(0.682)} size={ds} fill="#FFFFFF" weight={700} align="center" max={1.6 * inner} spacing={ds * 0.08}>{wordsRow(r.descriptor)}</T>
      {qr.node}
    </>
  );
}

function glowBack(r: R): ReactNode {
  /* two arcs of light through the top, the middle and the foot */
  const arc = (top: number, mid: number) => {
    const xt = top * r.w, xm = mid * r.w, half = r.h / 2;
    const dd = xm - xt;
    const rad = (dd * dd + half * half) / (2 * dd);
    return { cx: r.b + xm - rad, cy: r.Y(0.5), rad };
  };
  const a1 = arc(0.349, 0.425), a2 = arc(0.4735, 0.5245);
  const at = (a: { cx: number; cy: number; rad: number }, y: number) => a.cx + Math.sqrt(Math.max(0, a.rad * a.rad - (y - a.cy) ** 2));
  const art = (
    <g transform={r.rtl ? `translate(${r.W} 0) scale(-1 1)` : undefined}>
      <LightLine r={r} circle={a1} dim={0.6} />
      <LightLine r={r} circle={a2} />
    </g>
  );
  /* the name, condensed capitals, flush against the first arc */
  const ns = r.S(0.108), ts = r.S(0.05);
  const nameMax = 0.31 * r.w;
  /* the contacts: an icon in a ring that follows the second arc, then the line */
  const cs = r.S(0.044), ir = r.S(0.039);
  const textX = r.X(0.553);
  const qr = qrBox(r, r.back, { x: r.X(0.378), y: r.Y(0.66), alignEnd: !r.rtl }, 11, true);
  const items = r.rows.map((row) => ({ row, lines: linesOf(r, row, cs, 0.4 * r.w, 600, 0, 3) }));
  const step = r.S(0.125), inner = r.S(0.056);
  const span = items.reduce((t, it, i) => t + (i ? step : 0) + (it.lines.length - 1) * inner, 0);
  let y = Math.max(r.Y(0.14), r.Y(0.54) - span / 2);
  const nodes: ReactNode[] = [];
  items.forEach(({ row, lines }, i) => {
    const iy = y - cs * 0.36;
    /* the icons ride between the two arcs */
    const ax = (at(a1, iy) + at(a2, iy)) / 2 - 0.004 * r.w;
    const icx = r.rtl ? r.W - ax : ax;
    nodes.push(
      <g key={`i${i}`}>
        <circle cx={icx} cy={iy} r={ir} fill="none" stroke="#FFFFFF" strokeWidth={0.18} />
        <ContactIcon kind={iconOf(row.kind, "cursor")} cx={icx} cy={iy} size={ir * 1.05} color="#FFFFFF" />
      </g>,
    );
    lines.forEach((l, j) => nodes.push(<T key={`t${i}-${j}`} r={r} x={textX} y={y + j * inner} size={cs} fill="#FFFFFF" weight={600} align={r.start} max={0.4 * r.w}>{l}</T>));
    y += (lines.length - 1) * inner + step;
  });
  return (
    <>
      {bg(r, GLOW.bg)}
      <GlowDefs r={r} />
      {art}
      <T r={r} x={r.X(0.378)} y={r.Y(0.51)} size={ns} fill="#FFFFFF" weight={700} align={r.end} max={nameMax} squeeze={NOT_LATIN.test(r.name) ? 1 : 0.8} spacing={ns * 0.03}>{caps(r.name)}</T>
      <T r={r} x={r.X(0.37)} y={r.Y(0.51) + ts * 1.55} size={ts} fill="#E6E6E6" weight={600} align={r.end} max={nameMax}>{r.title}</T>
      {nodes}
      {qr.node}
    </>
  );
}

/* ── r-frame ───────────────────────────────────────────────────────────── */

const FRAME = { bg: "#151515", line: "#F2F2F2", name: "#EFEFEF", sub: "#C9C9C9", dots: "#303030" };

function frameFront(r: R): ReactNode {
  const L = r.x(0.067), Rt = r.x(0.93), T0 = r.Y(0.12), B = r.Y(0.88), sw = 0.42;
  const ns = r.S(0.054), ts = r.S(0.048);
  const ttlW = Math.min(tw(r, r.title, ts), 0.7 * r.w);
  const tEnd = r.X(0.873);
  const tStart = r.rtl ? tEnd + ttlW : tEnd - ttlW;
  const gapA = Math.min(tStart, tEnd) - 1.2, gapB = Math.max(tStart, tEnd) + 1.2;
  const lw = Math.min(30, 0.34 * r.w);
  const qr = qrBox(r, r.front, { x: r.rtl ? L + 2.5 : Rt - 2.5, y: T0 + 2.5, alignEnd: !r.rtl }, 9, true);
  return (
    <>
      {bg(r, FRAME.bg)}
      <g fill="none" stroke={FRAME.line} strokeWidth={sw}>
        <path d={`M${L} ${B}V${T0}H${Rt}V${B}`} />
        {r.title ? <path d={`M${L} ${B}H${gapA}M${gapB} ${B}H${Rt}`} /> : <path d={`M${L} ${B}H${Rt}`} />}
      </g>
      <Logo x={r.b + (r.w - lw) / 2} y={r.Y(0.45) - logoHeight(lw) / 2} width={lw} fill="#FFFFFF" />
      <T r={r} x={tEnd} y={r.Y(0.826)} size={ns} fill={FRAME.name} weight={500} align={r.end} max={0.72 * r.w} spacing={ns * 0.07}>{caps(r.name)}</T>
      <T r={r} x={tEnd} y={B + ts * 0.36} size={ts} fill={FRAME.sub} align={r.end} max={0.7 * r.w}>{r.title}</T>
      {qr.node}
    </>
  );
}

function frameBack(r: R): ReactNode {
  const ns = r.S(0.052), ts = r.S(0.048), cs = r.S(0.041);
  const lead = r.S(0.052), gap = r.S(0.042);
  const textX = r.X(0.279);
  const qr = qrBox(r, r.back, { corner: "br" }, 11, true);
  const room = (qr.box ? (r.rtl ? textX - (qr.box.x + qr.box.w + 2) : qr.box.x - 2 - textX) : 0.66 * r.w);
  const gs = ([["phone", PHONES], ["globe", ["email", "web", "linkedin", "custom"]], ["pin", ["address"]]] as Array<[IconKind, string[]]>)
    .map(([kind, kinds]) => ({ kind, lines: pick(r.rows, kinds).flatMap((row) => linesOf(r, row, cs, Math.max(20, room))) }))
    .filter((x) => x.lines.length);
  const span = gs.reduce((t, g, i) => t + (i ? lead + gap : 0) + (g.lines.length - 1) * lead, 0);
  const first = Math.min(r.Y(0.485), r.Y(0.9) - span);
  const nodes: ReactNode[] = [];
  let y = first;
  const iconX = r.X(0.1825);
  gs.forEach((g, i) => {
    nodes.push(<ContactIcon key={`i${i}`} kind={g.kind} cx={iconX} cy={y - cs * 0.36} size={r.S(0.034)} color="#FFFFFF" />);
    g.lines.forEach((l, j) => nodes.push(<T key={`t${i}-${j}`} r={r} x={textX} y={y + j * lead} size={cs} fill={FRAME.name} align={r.start} max={Math.max(20, room)} spacing={cs * 0.02}>{l}</T>));
    y += (g.lines.length - 1) * lead + lead + gap;
  });
  const last = y - lead - gap;
  const colTop = first - cs * 1.05, colBottom = last + cs * 0.3;
  return (
    <>
      {bg(r, FRAME.bg)}
      <WorldDots x={r.x(0.02)} y={r.Y(0.09)} w={0.93 * r.w} h={0.89 * r.h} r={0.2} fill={FRAME.dots} uid={`${r.uid}-w`} />
      <T r={r} x={textX} y={r.Y(0.281)} size={ns} fill={FRAME.name} weight={500} align={r.start} max={0.66 * r.w} spacing={ns * 0.07}>{caps(r.name)}</T>
      <T r={r} x={textX} y={r.Y(0.342)} size={ts} fill={FRAME.sub} align={r.start} max={0.66 * r.w}>{r.title}</T>
      {gs.length ? (
        <g fill={FRAME.sub}>
          <rect x={r.X(0.135) - 0.15} y={colTop} width={0.3} height={colBottom - colTop} />
          <rect x={r.X(0.23) - 0.15} y={colTop} width={0.3} height={colBottom - colTop} />
        </g>
      ) : null}
      {nodes}
      {qr.node}
    </>
  );
}

/* ── r-tabs ────────────────────────────────────────────────────────────── */

const TABS = { ink: "#0A0A0A", text: "#1C1C1E", rim: 1.6, round: 5 };

function tabsFront(r: R): ReactNode {
  const rim = TABS.rim;
  const lw = 0.4 * r.w, lh = logoHeight(lw);
  const padX = 0.034 * r.w, padT = 0.05 * r.h, padB = 0.06 * r.h;
  const bw = lw + padX * 2, bh = lh + padT + padB;
  const bx = r.b + (r.w - bw) / 2, by = r.Y(0.5) - bh / 2;
  const ds = r.S(0.03), sp = ds * 0.3;
  const dText = caps(r.descriptor);
  const dW = dText ? Math.min(tw(r, dText, ds, 500, sp), bw - 4) : 0;
  const cx = r.b + r.w / 2;
  const qr = qrBox(r, r.front, { corner: "br" }, 9, true);
  return (
    <>
      {bg(r, "#FFFFFF")}
      <rect x={r.b + rim} y={r.b + rim} width={r.w - rim * 2} height={r.h - rim * 2} rx={TABS.round - rim} fill={TABS.ink} />
      <g fill="none" stroke="#FFFFFF" strokeWidth={0.3}>
        <path d={`M${cx - (dW ? dW / 2 + 1.4 : 0)} ${by + bh}H${bx}V${by}H${bx + bw}V${by + bh}H${cx + (dW ? dW / 2 + 1.4 : 0)}`} />
      </g>
      <Logo x={bx + padX} y={by + padT} width={lw} fill="#FFFFFF" />
      <T r={r} x={cx} y={by + bh + ds * 0.36} size={ds} fill="#FFFFFF" weight={500} align="center" max={bw - 4} spacing={sp}>{dText}</T>
      {qr.node}
    </>
  );
}

function tabsBack(r: R): ReactNode {
  const rim = TABS.rim;
  const dir = r.rtl ? -1 : 1;
  /* the name tab from the end edge, the title tab from the start edge; they meet */
  const ns = r.S(0.083), ts = r.S(0.034);
  const nameW = Math.min(tw(r, r.name, ns, 600), 0.62 * r.w);
  const nameStart = r.rtl ? Math.max(r.X(0.5), r.X(0.93) + nameW) : Math.min(r.X(0.5), r.X(0.93) - nameW);
  const meet = nameStart - dir * 0.06 * r.w;
  const nTop = r.Y(0.28), nH = 0.145 * r.h;
  const tTop = r.Y(0.527), tH = 0.07 * r.h;
  /* the contacts under a hairline at the foot: the lines on one row, the address on the next */
  const cs0 = r.S(0.043), is = r.S(0.036), gapI = 0.9, gapX = 3.5;
  const x0 = r.b + rim + 3, x1 = r.b + r.w - rim - 3, avail = x1 - x0;
  const rowOf = (rows: PrintRow[]) => ({
    rows,
    fixed: rows.length * (is + gapI) + (rows.length - 1) * gapX,
    text: rows.reduce((t, row) => t + tw(r, row.value, cs0, 600), 0),
  });
  const lines = [r.rows.filter((row) => row.kind !== "address"), r.rows.filter((row) => row.kind === "address")].filter((x) => x.length).map(rowOf);
  /* one size for every row: smaller until it fits (to 78 %), then the words narrow */
  const f = Math.max(0.78, Math.min(1, ...lines.map((ln) => (avail - ln.fixed) / ln.text)));
  const cs = cs0 * f;
  const lastBase = r.Y(0.905), rowStep = r.S(0.075);
  const firstBase = lastBase - (lines.length - 1) * rowStep;
  const hair = firstBase - r.S(0.085);
  const nodes: ReactNode[] = [];
  lines.forEach((ln, li) => {
    const base = firstBase + li * rowStep;
    let x = r.rtl ? x1 : x0;
    const squeeze = Math.min(1, (avail - ln.fixed) / (ln.text * f));
    ln.rows.forEach((row, i) => {
      const w = tw(r, row.value, cs, 600) * squeeze;
      const icx = x + dir * is / 2;
      nodes.push(<ContactIcon key={`i${li}-${i}`} kind={iconOf(row.kind)} cx={icx} cy={base - cs * 0.36} size={is} color={TABS.text} />);
      const tx = x + dir * (is + gapI);
      nodes.push(<T key={`t${li}-${i}`} r={r} x={tx} y={base} size={cs} fill={TABS.text} weight={600} align={r.start} max={w + 0.01}>{row.value}</T>);
      x = tx + dir * (w + gapX);
    });
  });
  const qrSize = Math.min(10, hair - 2 - r.Y(0.62));
  const qr = qrSize >= 7 ? qrBox(r, r.back, { x: r.rtl ? x0 : x1, y: hair - 2 - qrSize - (r.back.some((q) => q.caption.trim()) ? 2.4 : 0), alignEnd: !r.rtl }, qrSize, false) : { node: null };
  const titleEnd = meet - dir * 0.03 * r.w;
  return (
    <>
      {bg(r, TABS.ink)}
      <rect x={r.b + rim} y={r.b + rim} width={r.w - rim * 2} height={r.h - rim * 2} rx={TABS.round - rim} fill="#FFFFFF" />
      {r.rtl
        ? <rect x={-4} y={nTop} width={meet + 4} height={nH} rx={1.8} fill={TABS.ink} />
        : <rect x={meet} y={nTop} width={r.W - meet + 4} height={nH} rx={1.8} fill={TABS.ink} />}
      {r.rtl
        ? <rect x={meet} y={tTop} width={r.W - meet + tH} height={tH} rx={tH / 2} fill={TABS.ink} />
        : <rect x={-tH} y={tTop} width={meet + tH} height={tH} rx={tH / 2} fill={TABS.ink} />}
      <T r={r} x={nameStart} y={nTop + nH / 2 + ns * 0.36} size={ns} fill="#FFFFFF" weight={600} align={r.start} max={0.62 * r.w}>{r.name}</T>
      <T r={r} x={titleEnd} y={tTop + tH / 2 + ts * 0.36} size={ts} fill="#FFFFFF" weight={600} align={r.end} max={Math.abs(titleEnd - (r.rtl ? x1 : x0))} spacing={ts * 0.06}>{caps(r.title)}</T>
      <rect x={r.x(0.03)} y={hair - 0.12} width={0.92 * r.w} height={0.24} fill={TABS.ink} />
      {nodes}
      {qr.node}
    </>
  );
}

/* ── r-lockup ──────────────────────────────────────────────────────────── */

/** The logo with the descriptor under it, spaced to the logo's width. */
function Lockup({ r, cx, top, lw, fill }: { r: R; cx: number; top: number; lw: number; fill: string }) {
  const ds = r.S(0.03);
  const d = caps(r.descriptor);
  const lh = logoHeight(lw);
  return (
    <g>
      <Logo x={cx - lw / 2} y={top} width={lw} fill={fill} />
      {d ? <T r={r} x={cx} y={top + lh + 0.065 * r.h + ds * 0.72} size={ds} fill={fill} align="center" max={lw * 1.8} spacing={ds * 0.2}>{d}</T> : null}
    </g>
  );
}
const lockupH = (r: R, lw: number) => logoHeight(lw) + (r.descriptor ? 0.065 * r.h + r.S(0.03) * 0.72 : 0);

function lockupFront(r: R): ReactNode {
  const lw = 0.28 * r.w;
  const qr = qrBox(r, r.front, { corner: "br" }, 10, true);
  return (
    <>
      {bg(r, "#000000")}
      <Lockup r={r} cx={r.b + r.w / 2} top={r.Y(0.5) - lockupH(r, lw) / 2} lw={lw} fill="#FFFFFF" />
      {qr.node}
    </>
  );
}

/** The channels a person can be reached on, as small round icons. */
function channels(r: R): IconKind[] {
  const kinds = new Set(r.rows.map((row) => row.kind));
  const out: IconKind[] = [];
  if (kinds.has("whatsapp") || (r.whatsapp && kinds.has("mobile"))) out.push("whatsapp");
  if (kinds.has("wechat")) out.push("wechat");
  if (kinds.has("linkedin")) out.push("linkedin");
  if (kinds.has("web")) out.push("globe");
  return out.slice(0, 3);
}

function lockupBack(r: R): ReactNode {
  const lw = 0.28 * r.w;
  const ns = r.S(0.072), ts = r.S(0.05), cs = r.S(0.05), lead = r.S(0.058);
  const x = r.X(0.092);
  const lines = r.rows.flatMap((row) => linesOf(r, row, cs, 0.58 * r.w));
  const last = r.Y(0.854);
  const first = last - (lines.length - 1) * lead;
  const titleY = first - r.S(0.121);
  const nameY = titleY - r.S(0.068);
  const icons = channels(r);
  const ir = 0.022 * r.h;
  const iy = last - cs * 0.36;
  /* the QR codes centred under the lockup, where the reference is empty */
  const qn = r.back.filter((q) => (isPictureQr(q) ? !!q.image : !!r.codes[q.id])).length;
  const qrW = qn * 11 + Math.max(0, qn - 1) * 2.5;
  const qr = qrBox(r, r.back, { x: r.X(0.752) - qrW / 2, y: r.Y(0.18) + lockupH(r, lw) + 0.1 * r.h }, 11, false);
  return (
    <>
      {bg(r, "#FFFFFF")}
      <Lockup r={r} cx={r.X(0.752)} top={r.Y(0.18)} lw={lw} fill="#000000" />
      <T r={r} x={x} y={nameY} size={ns} fill="#111111" align={r.start} max={0.6 * r.w} spacing={ns * 0.01}>{caps(r.name)}</T>
      <T r={r} x={x} y={titleY} size={ts} fill="#4A4A4A" align={r.start} max={0.6 * r.w}>{r.title}</T>
      {lines.map((l, i) => <T key={i} r={r} x={x} y={first + i * lead} size={cs} fill="#333333" align={r.start} max={0.6 * r.w}>{l}</T>)}
      {icons.map((kind, i) => {
        const cx = r.X(0.777 - (icons.length - 1 - i) * 0.039);
        return (
          <g key={kind}>
            <circle cx={cx} cy={iy} r={ir} fill="#000000" />
            <ContactIcon kind={kind} cx={cx} cy={iy} size={ir * 1.2} color="#FFFFFF" />
          </g>
        );
      })}
      <rect x={r.rtl ? -1 : r.X(0.807)} y={iy - 0.07} width={r.rtl ? r.X(0.807) + 1 : r.W - r.X(0.807) + 1} height={0.14} fill="#9A9A9A" />
      {qr.node}
    </>
  );
}

/* ── r-paper ───────────────────────────────────────────────────────────── */

function paperFront(r: R): ReactNode {
  const lw = 0.28 * r.w;
  const qr = qrBox(r, r.front, { corner: "br" }, 10, true);
  return (
    <>
      {bg(r, "#000000")}
      <Logo x={r.b + (r.w - lw) / 2} y={r.Y(0.5) - logoHeight(lw) / 2} width={lw} fill="#FFFFFF" />
      {qr.node}
    </>
  );
}

function paperBack(r: R): ReactNode {
  const ns = r.S(0.046), cs = r.S(0.044), sp = cs * 0.08;
  const lead = r.S(0.06), gap = r.S(0.096);
  const lw = 0.28 * r.w;
  const colX = r.X(0.555), colW = 0.385 * r.w;
  const contact = [...pick(r.rows, ["email"]), ...pick(r.rows, [...PHONES, "linkedin", "custom"])];
  const web = pick(r.rows, ["web"]), address = pick(r.rows, ["address"]);
  const blocks = [
    { lines: contact.flatMap((row) => [caps(row.value)]), bold: false },
    { lines: web.map((row) => caps(row.value)), bold: true },
    { lines: address.flatMap((row) => linesOf(r, { ...row, value: caps(row.value) }, cs, colW, 400, sp, 4)), bold: false },
  ].filter((b) => b.lines.length);
  const nodes: ReactNode[] = [];
  let y = r.Y(0.834);
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const bl = blocks[bi];
    for (let i = bl.lines.length - 1; i >= 0; i--) {
      nodes.push(<T key={`${bi}-${i}`} r={r} x={colX} y={y} size={cs} fill="#111111" weight={bl.bold ? 700 : 400} align={r.start} max={colW} spacing={sp}>{bl.lines[i]}</T>);
      y -= i ? lead : 0;
    }
    y -= gap;
  }
  const qr = qrBox(r, r.back, { corner: "tr" }, 11, false);
  return (
    <>
      {bg(r, "#FFFFFF")}
      <T r={r} x={r.X(0.104)} y={r.Y(0.195)} size={ns} fill="#111111" weight={600} align={r.start} max={0.44 * r.w} spacing={ns * 0.1}>{caps(r.name)}</T>
      {r.title ? <T r={r} x={r.X(0.104)} y={r.Y(0.195) + ns * 1.7} size={cs} fill="#555555" align={r.start} max={0.44 * r.w} spacing={sp}>{caps(r.title)}</T> : null}
      <Logo x={r.rtl ? r.X(0.104) - lw : r.X(0.104)} y={r.Y(0.832) - logoHeight(lw)} width={lw} fill="#000000" />
      {nodes}
      {qr.node}
    </>
  );
}

/* ── r-disc ────────────────────────────────────────────────────────────── */

const DISC_ARCS: Array<Array<[number, number]>> = [
  [[0, 0.18], [0.07, 0.075], [0.165, 0]],
  [[0.017, 1], [0.215, 0.47], [0.7, 0]],
  [[0.33, 1], [0.407, 0.698], [1, 0.108]],
  [[0.61, 1], [0.71, 0.658], [1, 0.35]],
  [[0.87, 1], [0.93, 0.85], [1, 0.73]],
];

function discFront(r: R): ReactNode {
  const cx = r.x(0.5), cy = r.Y(0.51);
  const rad = Math.min(0.139 * r.w, 0.3 * r.h);
  const lw = rad * 1.56;
  const band = `${arcThrough(r, DISC_ARCS[3])}L${r.W} ${r.H}Z`;
  const qr = qrBox(r, r.front, { corner: "bl" }, 9, true);
  return (
    <>
      {bg(r, "#171717")}
      <path d={band} fill="#101010" />
      <g fill="none" stroke="#3A3A3C" strokeWidth={0.22}>
        {DISC_ARCS.map((p, i) => <path key={i} d={arcThrough(r, p)} />)}
      </g>
      <circle cx={cx} cy={cy} r={rad} fill="#FFFFFF" />
      <Logo x={cx - lw / 2} y={cy - logoHeight(lw) / 2} width={lw} fill="#000000" />
      {qr.node}
    </>
  );
}

function discBack(r: R): ReactNode {
  const ns = r.S(0.07), ts = r.S(0.045), cs = r.S(0.045), lead = r.S(0.064);
  const gcx = r.X(0.96), gcy = r.Y(0.514), grad = 0.49 * r.h;
  const glw = Math.min(22, 0.26 * r.w);
  const logoC = r.rtl ? Math.max(gcx + grad * 0.45, r.b + 5 + glw / 2) : Math.min(gcx - grad * 0.45, r.b + r.w - 5 - glw / 2);
  const labelled = r.rows.some((row) => row.label);
  const labelX = r.X(0.059), valueX = labelled ? r.X(0.343) : labelX;
  const qr = qrBox(r, r.back, { corner: "tr" }, 11, false);
  const valueW = 0.93 * r.w - (labelled ? 0.343 : 0.059) * r.w;
  const lines = r.rows.flatMap((row) => linesOf(r, row, cs, valueW).map((l, i) => ({ label: i ? "" : row.label.replace(/[:：]\s*$/, "").trim(), l })));
  const first = r.Y(0.92) - (lines.length - 1) * lead;
  return (
    <>
      {bg(r, "#FFFFFF")}
      <circle cx={gcx} cy={gcy} r={grad} fill="#EDEDED" />
      <Logo x={logoC - glw / 2} y={gcy - logoHeight(glw) / 2} width={glw} fill="#FFFFFF" />
      <T r={r} x={r.X(0.056)} y={r.Y(0.15)} size={ns} fill="#111111" weight={500} align={r.start} max={0.7 * r.w}>{r.name}</T>
      <T r={r} x={r.X(0.056)} y={r.Y(0.21)} size={ts} fill="#1C1C1E" align={r.start} max={0.7 * r.w}>{r.title}</T>
      {lines.map(({ label, l }, i) => (
        <g key={i}>
          {label ? <T r={r} x={labelX} y={first + i * lead} size={cs} fill="#111111" weight={500} align={r.start} max={0.27 * r.w}>{label}</T> : null}
          <T r={r} x={valueX} y={first + i * lead} size={cs} fill="#111111" align={r.start} max={valueW}>{l}</T>
        </g>
      ))}
      {qr.node}
    </>
  );
}

/* ── r-round ───────────────────────────────────────────────────────────── */

function roundFront(r: R): ReactNode {
  const lw = 0.36 * r.w;
  const qr = qrBox(r, r.front, { corner: "br" }, 9, false);
  return (
    <>
      {bg(r, "#FFFFFF")}
      <Logo x={r.b + (r.w - lw) / 2} y={r.Y(0.5) - logoHeight(lw) / 2} width={lw} fill="#000000" />
      {qr.node}
    </>
  );
}

function roundBack(r: R): ReactNode {
  const ns = r.S(0.116), ts = r.S(0.052), cs = r.S(0.037);
  const qr = qrBox(r, r.back, { corner: "tr" }, 11, true);
  const nameMax = qr.box ? Math.abs((r.rtl ? qr.box.x + qr.box.w : qr.box.x) - r.X(0.124)) - 3 : 0.8 * r.w;
  const ir = r.S(0.032);
  const textX = r.X(0.175), room = 0.45 * r.w;
  const step = r.S(0.103), inner = r.S(0.05);
  let y = r.Y(0.527);
  const nodes: ReactNode[] = [];
  r.rows.forEach((row, i) => {
    const lines = linesOf(r, row, cs, room);
    const cy = y - cs * 0.36;
    nodes.push(
      <g key={`i${i}`}>
        <circle cx={r.X(0.14)} cy={cy} r={ir} fill="none" stroke="#FFFFFF" strokeWidth={0.18} />
        <ContactIcon kind={iconOf(row.kind, "cursor")} cx={r.X(0.14)} cy={cy} size={ir * 1.1} color="#FFFFFF" />
      </g>,
    );
    lines.forEach((l, j) => nodes.push(<T key={`t${i}-${j}`} r={r} x={textX} y={y + j * inner} size={cs} fill="#FFFFFF" align={r.start} max={room}>{l}</T>));
    y += (lines.length - 1) * inner + step;
  });
  const lw = 0.3 * r.w;
  return (
    <>
      {bg(r, "#000000")}
      <T r={r} x={r.X(0.124)} y={r.Y(0.274)} size={ns} fill="#FFFFFF" weight={500} align={r.start} max={nameMax}>{r.name}</T>
      <T r={r} x={r.X(0.124)} y={r.Y(0.359)} size={ts} fill="#FFFFFF" weight={500} align={r.start} max={nameMax}>{r.title}</T>
      {nodes}
      <Logo x={r.rtl ? r.X(0.913) : r.X(0.913) - lw} y={r.Y(0.85) - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      {qr.node}
    </>
  );
}

/* ── the sides, the die, the print notes ───────────────────────────────── */

export function drawReferenceFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  switch (r.style) {
    case "r-metal": return metalFront(r);
    case "r-glow": return glowFront(r);
    case "r-frame": return frameFront(r);
    case "r-tabs": return tabsFront(r);
    case "r-lockup": return lockupFront(r);
    case "r-paper": return paperFront(r);
    case "r-disc": return discFront(r);
    case "r-round": return roundFront(r);
    default: return minimalFront(r);
  }
}

export function drawReferenceBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  switch (r.style) {
    case "r-metal": return metalBack(r);
    case "r-glow": return glowBack(r);
    case "r-frame": return frameBack(r);
    case "r-tabs": return tabsBack(r);
    case "r-lockup": return lockupBack(r);
    case "r-paper": return paperBack(r);
    case "r-disc": return discBack(r);
    case "r-round": return roundBack(r);
    default: return minimalBack(r);
  }
}

/** The round corners (mm) of the references cut to shape. */
const ROUND: Partial<Record<Ref, number>> = { "r-metal": 3, "r-glow": 4, "r-tabs": TABS.round, "r-round": 5 };
const roundRect = (x: number, y: number, w: number, h: number, c: number) =>
  `M${x + c} ${y}H${x + w - c}A${c} ${c} 0 0 1 ${x + w} ${y + c}V${y + h - c}A${c} ${c} 0 0 1 ${x + w - c} ${y + h}H${x + c}A${c} ${c} 0 0 1 ${x} ${y + h - c}V${y + c}A${c} ${c} 0 0 1 ${x + c} ${y}Z`;

/** The die line: the round corners, and the metal card's triangle hole —
 *  top-left on the front, so top-right seen from the back. */
export function referenceDie(v: TemplateValues, pageId: string, { w, h, bleed: b }: { w: number; h: number; bleed: number }): string | null {
  if (!isReference(v)) return null;
  const style = refOf(v);
  const c = ROUND[style];
  if (!c) return null;
  let d = roundRect(b, b, w, h, c);
  if (style === "r-metal") {
    const i = 2, l = 4.2;
    d += pageId === "back" ? `M${b + w - i} ${b + i}h${-l}L${b + w - i} ${b + i + l}Z` : `M${b + i} ${b + i}h${l}L${b + i} ${b + i + l}Z`;
  }
  return d;
}

export function referenceSpecKeys(v: TemplateValues): string[] {
  switch (refOf(v)) {
    case "r-metal": return ["spec.rMetal", "spec.round3", "spec.rNotch"];
    case "r-glow": return ["spec.rGlow", "spec.round4", "spec.blackBoard"];
    case "r-frame": return ["spec.rFrame", "spec.rWorld", "spec.rBlackBoth", "spec.blackBoard"];
    case "r-tabs": return ["spec.rRim", "spec.round5", "spec.twoTone", "spec.whiteBoard"];
    case "r-lockup": return ["spec.twoTone", "spec.whiteBoard", "spec.edges"];
    case "r-paper": return ["spec.rPaper", "spec.edges"];
    case "r-disc": return ["spec.rGhost", "spec.twoTone", "spec.whiteBoard"];
    case "r-round": return ["spec.round5", "spec.twoTone", "spec.whiteBoard"];
    default: return ["spec.rBlackBoth", "spec.blackBoard", "spec.edges"];
  }
}
