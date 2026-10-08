/* ---------------------------------------------------------------------------
   Staff ID badge — the owner's references (30/09/2026, item 2 of his
   references: "make exactly the same designs as I send"). Seven badges he
   picked, rebuilt on the 54 × 86 mm badge from his pictures, measured as
   fractions of the card; the same four swaps as the business cards: the
   full KOLEEX logo and our data, their artwork redrawn alike, our
   typefaces, their colours kept.

     r-wave         the portrait over a charcoal panel with an S-curve;
                    the back a giant line of type up the card
     r-wave-white   the same on white; the back the logo, the group's name
                    stepped under it and the staff number as a barcode
     r-dots         black: a round portrait, a stream of white dots
     r-bold         black, no portrait: the name in bold capitals, tonal
                    curves in the corner
     r-gradient     black: the name Light and large over a colour panel
     r-staff        black: the name, the logo, and STAFF in large type
     r-notch        white: the portrait in a frame notched for the logo
                    and the name

   The cards are round-cornered and punched (slot or round hole): the die
   line cuts them on screen. Where a reference front has no logo it gets
   one (a switch). They start as drafts until the owner approves them.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import JsBarcode from "jsbarcode";
import type { DrawContext, TemplateValues } from "./types";
import { Logo, Photo, PhotoPlaceholder, QrZone, lockupLines, logoHeight, textWidth } from "./card/parts";
import { asLang, fontOf, isPictureQr, num, qrsOf, str, type Lang, type QrItem } from "./card/model";

export const ID_REFS = ["r-wave", "r-wave-white", "r-dots", "r-bold", "r-gradient", "r-staff", "r-notch"] as const;
type IdRef = (typeof ID_REFS)[number];
export const isIdRef = (v: TemplateValues) => (ID_REFS as readonly string[]).includes(String(v.style));
const refOf = (v: TemplateValues): IdRef => (isIdRef(v) ? (v.style as IdRef) : "r-wave");
/** The references that carry a portrait. */
export const ID_REF_PHOTO: readonly string[] = ["r-wave", "r-wave-white", "r-dots", "r-notch"];
/** The references whose own front has no logo (the logo is a switch). */
export const ID_REF_LOGO_SWITCH: readonly string[] = ["r-wave", "r-wave-white"];

/** The giant line on the back of r-wave: the tagline as a hashtag (book
 *  ch. 20 "Shaping the Future."; the reference had its brand's hashtag). */
export const BIG_LINE: Record<Lang, string> = { en: "#ShapingTheFuture", zh: "#塑造未来", ar: "#نشكّل_المستقبل" };

const ARABIC = /[؀-ۿ]/;
const NOT_LATIN = /[؀-ۿ⺀-鿿]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
type Align = "left" | "right" | "center";

function read(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed, w = ctx.w, h = ctx.h;
  const lang = asLang(v.lang);
  const rtl = lang === "ar";
  const k = num(v, "scale", 100) / 100;
  const all = qrsOf(v);
  const staff = str(v, "staffNo"), label = str(v, "idLabel") || "ID", valid = str(v, "valid");
  return {
    b, w, h, W: w + 2 * b, H: h + 2 * b, lang, rtl, style: refOf(v), font: fontOf(v), k, uid: ctx.uid, codes: ctx.qrs, v,
    name: str(v, "name"), title: str(v, "title"), staff, role: str(v, "role"), photo: str(v, "photo"),
    idText: [staff ? `${label} ${staff}` : "", valid].filter(Boolean).join("  ·  "),
    front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
    logoFront: v.logoFront !== false,
    /** a point at a fraction of the card — X mirrors in Arabic, x does not */
    X: (f: number) => b + (rtl ? 1 - f : f) * w,
    x: (f: number) => b + f * w,
    Y: (f: number) => b + f * h,
    /** a type size as a fraction of the card's height, times the text slider */
    S: (f: number) => f * h * k,
    start: (rtl ? "right" : "left") as Align,
    end: (rtl ? "left" : "right") as Align,
  };
}
type R = ReturnType<typeof read>;

function tw(r: R, text: string, size: number, weight = 400, spacing = 0) {
  return textWidth(text, size, weight, r.font) + (spacing && !ARABIC.test(text) ? spacing * [...text].length : 0);
}

/** A line of text on the side of x it is asked for (physical), in its own
 *  direction; `max` condenses a line that would run longer. */
function T({ r, x, y, size, children, fill, weight = 400, align = "left", max, spacing = 0 }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number; align?: Align; max?: number; spacing?: number;
}) {
  if (!children) return null;
  const ar = ARABIC.test(children);
  const anchor = align === "center" ? "middle" : (align === "left") === !ar ? "start" : "end";
  const sp = ar ? 0 : spacing;
  const over = max !== undefined && max > 0 && tw(r, children, size, weight, sp) > max;
  /* Chrome spaces after the last letter too: an end-anchored line moves back by it */
  const dx = sp ? (anchor === "end" ? sp : anchor === "middle" ? sp / 2 : 0) : 0;
  return (
    <text x={x + dx} y={y} direction={ar ? "rtl" : "ltr"} textAnchor={anchor} fill={fill}
      {...(over ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: sp || undefined, unicodeBidi: "plaintext" }}>{children}</text>
  );
}

/** The name on two lines — the first name, then the rest (as the
 *  references set it); one line when it is one word or Chinese. */
function twoLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || /[⺀-鿿]/.test(name)) return name ? [name] : [];
  return [words[0], words.slice(1).join(" ")];
}

const bg = (r: R, color: string) => <rect x={0} y={0} width={r.W} height={r.H} fill={color} />;

/** The portrait in a box, or the book's silhouette on a grey ground. */
function Portrait({ r, box, radius = 0, clip }: { r: R; box: { x: number; y: number; w: number; h: number }; radius?: number; clip?: string }) {
  const v = r.v;
  const body = r.photo
    ? <Photo href={r.photo} box={box} radius={radius} tone={v.bw === true ? "bw" : "muted"} zoom={num(v, "photoZoom", 100) / 100}
        px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={false} uid={`${r.uid}-p`} />
    : (
      <g>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} fill="#C7CBD0" />
        <PhotoPlaceholder box={{ x: box.x + box.w * 0.22, y: box.y + box.h * 0.12, w: box.w * 0.56, h: box.h * 0.88 }} label="Photo" font={r.font} />
      </g>
    );
  if (!clip) return body;
  return (
    <g>
      <defs><clipPath id={`${r.uid}-pc`}><path d={clip} /></clipPath></defs>
      <g clipPath={`url(#${r.uid}-pc)`}>{body}</g>
    </g>
  );
}

/** QR codes of a side at a place: its start corner x (mirrored when asked). */
function qrs(r: R, items: QrItem[], at: { x: number; y: number; alignEnd: boolean }, size: number, dark: boolean) {
  const n = items.filter((q) => (isPictureQr(q) ? !!q.image : !!r.codes[q.id])).length;
  if (!n) return null;
  const cap = items.some((q) => q.caption.trim()) ? 2.4 : 0;
  const zw = n * size + (n - 1) * 2;
  return <QrZone items={items} codes={r.codes} font={r.font} captionFill={dark ? "#98989D" : "#6E6E73"} max={size}
    zone={{ x: at.alignEnd ? at.x - zw : at.x, y: at.y, w: zw, h: size + cap, dir: "row", align: at.alignEnd ? "end" : "start" }} />;
}
/** QR codes in a corner of the safe area (mirrored in Arabic). */
function cornerQrs(r: R, items: QrItem[], corner: "tl" | "tr" | "bl" | "br", size: number, dark: boolean) {
  const end = (corner[1] === "r") !== r.rtl;
  const cap = items.some((q) => q.caption.trim()) ? 2.4 : 0;
  return qrs(r, items, { x: end ? r.b + r.w - 4 : r.b + 4, y: corner[0] === "t" ? r.b + 4 : r.b + r.h - 4 - size - cap, alignEnd: end }, size, dark);
}

/* ── r-wave / r-wave-white ─────────────────────────────────────────────── */

/** The panel under the portrait: its top edge flat at `yl`, an S-curve
 *  from x `a` to x `c` down to `yr`, flat again to the far edge (mirrored
 *  in Arabic). */
function wavePanel(r: R, yl: number, yr: number, a: number, c: number): string {
  const m = (a + c) / 2;
  const px = (f: number) => (r.rtl ? r.W - (r.b + f * r.w) : r.b + f * r.w);
  const [x0, x1] = r.rtl ? [r.W, 0] : [0, r.W];
  return `M${x0} ${r.Y(yl)}H${px(a)}C${px(m)} ${r.Y(yl)} ${px(m)} ${r.Y(yr)} ${px(c)} ${r.Y(yr)}H${x1}V${r.H}H${x0}Z`;
}

function waveFront(r: R, white: boolean): ReactNode {
  const panel = white ? "#FFFFFF" : "#202022";
  const ink = white ? "#1F1F21" : "#FFFFFF";
  const geo = white ? { yl: 0.66, yr: 0.737, a: 0.68, c: 0.88 } : { yl: 0.609, yr: 0.688, a: 0.69, c: 0.848 };
  const ns = white ? r.S(0.054) : r.S(0.046);
  const lines = twoLines(r.name);
  const base = white ? [0.743, 0.816] : [0.684, 0.739];
  const lw = 0.34 * r.w;
  const footY = r.Y(0.955);
  const ts = white ? r.S(0.03) : r.S(0.024);
  const is = white ? r.S(0.021) : r.S(0.024);
  const titleW = Math.min(tw(r, r.title, ts, white ? 400 : 500), 0.58 * r.w);
  const idW = Math.min(tw(r, r.idText, is), 0.36 * r.w);
  const dir = r.rtl ? -1 : 1;
  const ruleA = r.X(0.066) + dir * (titleW + 2), ruleB = r.X(white ? 0.933 : 0.937) - dir * (idW + 2);
  return (
    <>
      {bg(r, panel)}
      <Portrait r={r} box={{ x: 0, y: 0, w: r.W, h: r.Y(geo.yr + 0.02) }} />
      <path d={wavePanel(r, geo.yl, geo.yr, geo.a, geo.c)} fill={panel} />
      {lines.map((l, i) => <T key={i} r={r} x={r.X(0.066)} y={r.Y(base[i])} size={ns} fill={ink} weight={500} align={r.start} max={0.86 * r.w}>{l}</T>)}
      {r.logoFront ? <Logo x={r.rtl ? r.X(white ? 0.933 : 0.937) : r.X(white ? 0.933 : 0.937) - lw} y={r.Y(white ? 0.785 : 0.8)} width={lw} fill={ink} /> : null}
      <T r={r} x={r.X(0.066)} y={footY} size={ts} fill={white ? "#555558" : "#FFFFFF"} weight={white ? 400 : 500} align={r.start} max={0.58 * r.w}>{r.title}</T>
      {white && r.title && r.idText && (ruleB - ruleA) * dir > 3 ? <rect x={Math.min(ruleA, ruleB)} y={footY - ts * 0.35} width={Math.abs(ruleB - ruleA)} height={0.12} fill="#D1D1D6" /> : null}
      <T r={r} x={r.X(white ? 0.933 : 0.937)} y={footY} size={is} fill={white ? "#8E8E93" : "#FFFFFF"} weight={white ? 400 : 500} align={r.end} max={0.36 * r.w}>{r.idText}</T>
      {cornerQrs(r, r.front, "tr", 11, !white)}
    </>
  );
}

/** r-wave's back: one line of type, very large, up the card — it runs off
 *  the top as the reference's does; the logo at the foot. */
function waveBack(r: R): ReactNode {
  const text = str(r.v, "bigText") || BIG_LINE[r.lang];
  const size = 0.26 * r.w / 0.727 * r.k;
  const baseX = r.x(0.64), startY = r.Y(0.84);
  const lw = 0.4 * r.w;
  /* up the card from the foot; Arabic reads from the top down, so its
     first word sits at the top and the line runs off at the foot */
  const ar = ARABIC.test(text);
  return (
    <>
      {bg(r, "#202022")}
      <defs><clipPath id={`${r.uid}-big`}><rect x={0} y={0} width={r.W} height={startY} /></clipPath></defs>
      <g clipPath={`url(#${r.uid}-big)`}>
        <g transform={`translate(${baseX} ${startY}) rotate(-90)`}>
          <text x={ar ? startY - r.b - 3 : 0} y={0} direction={ar ? "rtl" : "ltr"} textAnchor="start" fill="#FFFFFF"
            style={{ fontFamily: r.font, fontSize: size, fontWeight: 400, unicodeBidi: "plaintext" }}>{text}</text>
        </g>
      </g>
      <Logo x={r.rtl ? r.X(0.08) - lw : r.X(0.08)} y={r.Y(0.945) - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      {cornerQrs(r, r.back, "br", 10, true)}
    </>
  );
}

/** The staff number as a Code 128 barcode (jsbarcode's own encoder, the
 *  one the product form's barcodes use), on a white label. */
function Barcode({ r, x, y, w, h, text }: { r: R; x: number; y: number; w: number; h: number; text: string }) {
  const out: { encodings?: Array<{ data: string }> } = {};
  if (text) {
    try { JsBarcode(out, text, { format: "CODE128" }); } catch { /* a character Code 128 cannot carry: the label stays empty */ }
  }
  const bits = out.encodings?.map((e) => e.data).join("") ?? "";
  const quiet = 10;
  const mod = bits ? (w - 2) / (bits.length + quiet * 2) : 0;
  let d = "";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") d += `M${(x + 1 + (quiet + i) * mod).toFixed(3)} ${(y + 1).toFixed(3)}h${mod.toFixed(3)}v${(h * 0.66).toFixed(3)}h-${mod.toFixed(3)}z`;
  }
  const cs = Math.min(1.25, h * 0.16);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#FFFFFF" />
      {d ? <path d={d} fill="#000000" shapeRendering="crispEdges" /> : null}
      <text x={x + w / 2} y={y + h - 0.9} textAnchor="middle" fill={bits ? "#1C1C1E" : "#8E8E93"}
        style={{ fontFamily: r.font, fontSize: cs, letterSpacing: cs * 0.1 }}>{text || "Staff number"}</text>
    </g>
  );
}

/** r-wave-white's back: the logo, the group's name stepped in under it
 *  (the reference's two-line name), the staff number as a barcode. */
function waveWhiteBack(r: R): ReactNode {
  const lw = 0.62 * r.w;
  const logoBase = r.Y(0.467);
  const rest = lockupLines(str(r.v, "company")).slice(1).join(" ") || "INTERNATIONAL GROUP";
  const x2 = r.X(0.323);
  const room = 0.61 * r.w;
  const s2 = Math.min(r.S(0.04), room / (tw(r, rest, 1, 300, 0.06) || 1));
  return (
    <>
      {bg(r, "#1D1D1F")}
      <Logo x={r.rtl ? r.X(0.194) - lw : r.X(0.194)} y={logoBase - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      <T r={r} x={x2} y={logoBase + 0.075 * r.h} size={s2} fill="#FFFFFF" weight={300} align={r.start} max={room} spacing={s2 * 0.06}>{rest}</T>
      <Barcode r={r} x={r.x(0.284)} y={r.Y(0.83)} w={0.434 * r.w} h={0.103 * r.h} text={r.staff} />
      {cornerQrs(r, r.back, "tr", 10, true)}
    </>
  );
}

/* ── r-dots ────────────────────────────────────────────────────────────── */

/** A stream of dots growing along a wedge — the reference's halftone
 *  swoosh, drawn as the KOLEEX dots. `grow` 1 grows to the right, −1 to
 *  the left (mirrored). One path of circles. */
function DotStream({ r, x0, x1, yMid, fill, grow = 1 }: { r: R; x0: number; x1: number; yMid: number; fill: string; grow?: 1 | -1 }) {
  const rows = 9, pitch = 1.35, step = 1.45, rise = 0.1;
  let d = "";
  for (let i = 0; i < rows; i++) {
    const o = i - (rows - 1) / 2;
    const start = x0 + Math.abs(o) * 2.6 + (o > 2 ? 6 : 0);
    for (let x = start; x <= x1 + 1; x += step) {
      const t = Math.min(1, Math.max(0, (x - start) / (x1 - start)));
      const rad = 0.52 * (0.18 + 0.82 * Math.pow(t, 1.25)) * (1 - 0.07 * Math.abs(o));
      const y = yMid + o * pitch - (x - x0) * rise;
      const cx = grow === 1 ? x : r.W - x;
      d += `M${(cx - rad).toFixed(3)} ${y.toFixed(3)}a${rad.toFixed(3)} ${rad.toFixed(3)} 0 1 0 ${(2 * rad).toFixed(3)} 0a${rad.toFixed(3)} ${rad.toFixed(3)} 0 1 0 ${(-2 * rad).toFixed(3)} 0z`;
    }
  }
  return <path d={d} fill={fill} />;
}

function dotsFront(r: R): ReactNode {
  const cx = r.x(0.5), cy = r.Y(0.37), rad = 0.19 * r.w;
  const ns = r.S(0.046), ts = r.S(0.03);
  const lw = 0.42 * r.w;
  const dot = 0.012 * r.w;
  return (
    <>
      {bg(r, "#161616")}
      <circle cx={r.X(0.105)} cy={r.Y(0.12)} r={dot} fill="#FFFFFF" />
      <circle cx={r.X(0.14)} cy={r.Y(0.12)} r={dot} fill="#FFFFFF" />
      <Portrait r={r} box={{ x: cx - rad, y: cy - rad, w: rad * 2, h: rad * 2 }} radius={rad} />
      <T r={r} x={cx} y={r.Y(0.575)} size={ns} fill="#FFFFFF" weight={500} align="center" max={0.88 * r.w}>{r.name}</T>
      <T r={r} x={cx} y={r.Y(0.575) + ts * 1.9} size={ts} fill="#AEAEB2" align="center" max={0.86 * r.w}>{r.title}</T>
      <DotStream r={r} x0={r.x(0.44)} x1={r.W} yMid={r.Y(0.765)} fill="#FFFFFF" grow={r.rtl ? -1 : 1} />
      <Logo x={r.rtl ? r.X(0.12) - lw : r.X(0.12)} y={r.Y(0.93) - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      <T r={r} x={r.X(0.9)} y={r.Y(0.93)} size={r.S(0.022)} fill="#8E8E93" align={r.end} max={0.36 * r.w}>{r.idText}</T>
      {cornerQrs(r, r.front, "tr", 10, true)}
    </>
  );
}

/** The return block (the badge's back text): who to return it to. */
function ReturnBlock({ r, x, y, align, ink, sub, width, capsLast }: { r: R; x: number; y: number; align: Align; ink: string; sub: string; width: number; capsLast?: boolean }) {
  const v = r.v;
  const ts = r.S(0.024), ls = r.S(0.028);
  const nodes: ReactNode[] = [];
  let yy = y;
  const title = str(v, "returnTitle");
  if (title) { nodes.push(<T key="t" r={r} x={x} y={yy} size={ts} fill={sub} align={align} max={width}>{title}</T>); yy += ls * 1.7; }
  const lines = [str(v, "returnLine1"), str(v, "returnLine2"), str(v, "returnLine3")].filter(Boolean);
  lines.forEach((l, i) => {
    const last = i === lines.length - 1 && capsLast;
    nodes.push(<T key={i} r={r} x={x} y={yy} size={ls} fill={i === 0 ? ink : sub} weight={i === 0 ? 600 : last ? 500 : 400} align={align} max={width} spacing={last ? ls * 0.08 : 0}>{last ? caps(l) : l}</T>);
    yy += ls * 1.45;
  });
  return { node: <g>{nodes}</g>, bottom: yy };
}

function dotsBack(r: R): ReactNode {
  const lw = 0.42 * r.w;
  const block = ReturnBlock({ r, x: r.X(0.1), y: 0, align: r.start, ink: "#1C1C1E", sub: "#6E6E73", width: 0.8 * r.w, capsLast: true });
  const lift = r.Y(0.93) - block.bottom + r.S(0.028) * 1.45;
  return (
    <>
      {bg(r, "#ECECEE")}
      <Logo x={r.rtl ? r.X(0.1) - lw : r.X(0.1)} y={r.Y(0.1)} width={lw} fill="#1C1C1E" />
      <DotStream r={r} x0={r.x(0.44)} x1={r.W} yMid={r.Y(0.56)} fill="#BDBDC2" grow={r.rtl ? 1 : -1} />
      <g transform={`translate(0 ${lift})`}>{block.node}</g>
      {cornerQrs(r, r.back, "tr", 10, false)}
    </>
  );
}

/* ── r-bold ────────────────────────────────────────────────────────────── */

/** Tonal curves in the foot corner: five concentric bands, dark on black. */
function Curves({ r, color }: { r: R; color: string }) {
  const cx = r.rtl ? r.W - (r.b + 1.106 * r.w) : r.b + 1.106 * r.w;
  const cy = r.Y(1.1);
  const outer = Math.hypot(1.106 * r.w - 0.35 * r.w, 0.1 * r.h);
  return (
    <g fill="none" stroke={color} strokeWidth={1.8}>
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={cx} cy={cy} r={outer - i * 4.2} />)}
    </g>
  );
}

function boldFront(r: R): ReactNode {
  const lw = 0.44 * r.w;
  const ns = r.S(0.062), ts = r.S(0.028);
  const lines = twoLines(caps(r.name));
  return (
    <>
      {bg(r, "#141414")}
      <Curves r={r} color="#232325" />
      <Logo x={r.rtl ? r.X(0.9) : r.X(0.9) - lw} y={r.Y(0.16)} width={lw} fill="#FFFFFF" />
      {lines.map((l, i) => <T key={i} r={r} x={r.X(0.16)} y={r.Y(0.42 + i * 0.07)} size={ns} fill="#FFFFFF" weight={600} align={r.start} max={0.78 * r.w}>{l}</T>)}
      <T r={r} x={r.X(0.16)} y={r.Y(0.42 + (lines.length - 1) * 0.07 + 0.07)} size={ts} fill="#8E8E93" align={r.start} max={0.78 * r.w} spacing={ts * 0.04}>{caps(r.title)}</T>
      <T r={r} x={r.X(0.13)} y={r.Y(0.93)} size={r.S(0.022)} fill="#FFFFFF" align={r.start} max={0.6 * r.w} spacing={0.08}>{r.idText}</T>
      {cornerQrs(r, r.front, "tl", 10, true)}
    </>
  );
}

function boldBack(r: R): ReactNode {
  const lw = 0.44 * r.w;
  const block = ReturnBlock({ r, x: r.X(0.16), y: r.Y(0.42), align: r.start, ink: "#FFFFFF", sub: "#8E8E93", width: 0.74 * r.w });
  return (
    <>
      {bg(r, "#141414")}
      <Curves r={r} color="#232325" />
      <Logo x={r.rtl ? r.X(0.9) : r.X(0.9) - lw} y={r.Y(0.16)} width={lw} fill="#FFFFFF" />
      {block.node}
      {qrs(r, r.back, { x: r.X(0.16), y: block.bottom + 1, alignEnd: r.rtl }, 12, true)}
      <T r={r} x={r.X(0.13)} y={r.Y(0.93)} size={r.S(0.022)} fill="#FFFFFF" align={r.start} max={0.6 * r.w} spacing={0.08}>{r.idText}</T>
    </>
  );
}

/* ── r-gradient ────────────────────────────────────────────────────────── */

function gradientFront(r: R): ReactNode {
  const lw = 0.32 * r.w;
  const ns = r.S(0.08), ts = r.S(0.036);
  const lines = twoLines(r.name);
  const px = r.x(0.063), pw = 0.878 * r.w, py = r.Y(0.5), ph = 0.457 * r.h;
  const id = `${r.uid}-g`;
  const tx = r.X(0.063);
  return (
    <>
      {bg(r, "#141416")}
      <defs>
        <radialGradient id={`${id}p`} cx={r.rtl ? 0.05 : 0.95} cy={0.02} r={1.05}>
          <stop offset={0} stopColor="#8F6FE6" stopOpacity={0.95} />
          <stop offset={0.45} stopColor="#6450C4" stopOpacity={0.62} />
          <stop offset={0.9} stopColor="#3B2F7A" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}b`} cx={r.rtl ? 1 : 0} cy={1} r={0.85}>
          <stop offset={0} stopColor="#3E5CEB" stopOpacity={0.95} />
          <stop offset={0.85} stopColor="#3E5CEB" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}d`} x1={r.rtl ? 1 : 0} y1={0} x2={r.rtl ? 0.35 : 0.65} y2={0.75}>
          <stop offset={0} stopColor="#0E0E12" stopOpacity={0.95} />
          <stop offset={1} stopColor="#0E0E12" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={px} y={py} width={pw} height={ph} rx={0.035 * r.w} fill="#1B1A26" />
      <rect x={px} y={py} width={pw} height={ph} rx={0.035 * r.w} fill={`url(#${id}p)`} />
      <rect x={px} y={py} width={pw} height={ph} rx={0.035 * r.w} fill={`url(#${id}b)`} />
      <rect x={px} y={py} width={pw} height={ph} rx={0.035 * r.w} fill={`url(#${id}d)`} />
      <Logo x={r.rtl ? r.X(0.063) - lw : r.X(0.063)} y={r.Y(0.045)} width={lw} fill="#FFFFFF" />
      {lines.map((l, i) => <T key={i} r={r} x={tx} y={r.Y(0.259 + i * 0.085)} size={ns} fill="#FFFFFF" weight={300} align={r.start} max={0.87 * r.w} spacing={-ns * 0.01}>{l}</T>)}
      <T r={r} x={tx} y={r.Y(0.259 + (lines.length - 1) * 0.085 + 0.076)} size={ts} fill="#E5E5EA" weight={300} align={r.start} max={0.87 * r.w}>{r.title}</T>
      <T r={r} x={r.X(0.1)} y={r.Y(0.93)} size={r.S(0.022)} fill="#FFFFFF" align={r.start} max={0.6 * r.w}>{r.idText}</T>
      {qrs(r, r.front, { x: r.X(0.9), y: r.Y(0.93) - 12, alignEnd: !r.rtl }, 10, true)}
    </>
  );
}

function gradientBack(r: R): ReactNode {
  const lw = 0.874 * r.w;
  return (
    <>
      {bg(r, "#141416")}
      <Logo x={r.x(0.063)} y={r.Y(0.93) - logoHeight(lw)} width={lw} fill="#FFFFFF" />
      {cornerQrs(r, r.back, "tl", 11, true)}
    </>
  );
}

/* ── r-staff ───────────────────────────────────────────────────────────── */

function staffFront(r: R): ReactNode {
  const cx = r.x(0.5);
  const ns = r.S(0.052), ts = r.S(0.024), rs = r.S(0.106);
  const lw = 0.56 * r.w;
  return (
    <>
      {bg(r, "#000000")}
      <T r={r} x={cx} y={r.Y(0.297)} size={ns} fill="#FFFFFF" weight={700} align="center" max={0.86 * r.w}>{r.name}</T>
      <T r={r} x={cx} y={r.Y(0.345)} size={ts} fill="#E5E5EA" weight={500} align="center" max={0.86 * r.w} spacing={ts * 0.2}>{caps(r.title)}</T>
      <T r={r} x={cx} y={r.Y(0.345) + ts * 1.9} size={r.S(0.02)} fill="#8E8E93" align="center" max={0.8 * r.w}>{r.idText}</T>
      <Logo x={cx - lw / 2} y={r.Y(0.6) - logoHeight(lw) / 2} width={lw} fill="#FFFFFF" />
      <T r={r} x={cx} y={r.Y(0.937)} size={rs} fill="#FFFFFF" weight={700} align="center" max={0.84 * r.w}>{caps(r.role)}</T>
      {qrs(r, r.front, { x: cx - 5, y: r.Y(0.7), alignEnd: false }, 10, true)}
    </>
  );
}

/* ── r-notch ───────────────────────────────────────────────────────────── */

/** A rounded frame with two notches cut from it: one at the top end corner
 *  (the logo's), one at the bottom start corner (the name's). Mirrored in
 *  Arabic. */
function notchedFrame(r: R, f: { x0: number; y0: number; x1: number; y1: number; nx: number; ny: number; mx: number; my: number; c: number }): string {
  const X = (x: number) => (r.rtl ? r.W - x : x);
  const s = r.rtl ? 0 : 1, t = r.rtl ? 1 : 0; // a convex corner, a concave one (flipped when mirrored)
  const { x0, y0, x1, y1, nx, ny, mx, my, c } = f;
  const A = (x: number, y: number, sweep: number) => `A${c} ${c} 0 0 ${sweep} ${X(x)} ${y}`;
  return [
    `M${X(x0 + c)} ${y0}`, `H${X(nx - c)}`, A(nx, y0 + c, s), `V${ny - c}`, A(nx + c, ny, t), `H${X(x1 - c)}`, A(x1, ny + c, s),
    `V${y1 - c}`, A(x1 - c, y1, s), `H${X(mx + c)}`, A(mx, y1 - c, s), `V${my + c}`, A(mx - c, my, t), `H${X(x0 + c)}`, A(x0, my - c, s),
    `V${y0 + c}`, A(x0 + c, y0, s), "Z",
  ].join("");
}

function notchFront(r: R): ReactNode {
  const x0 = r.x(0.074), x1 = r.x(0.922), y0 = r.Y(0.346), y1 = r.Y(0.953), c = 2.6;
  const lw = 0.34 * r.w, lh = logoHeight(lw);
  const nx = x1 - (lw + 6), ny = y0 + Math.max(lh + 7, 0.12 * r.h);
  const ns = r.S(0.04);
  const lines = twoLines(caps(r.name));
  const nameW = Math.max(0, ...lines.map((l) => tw(r, l, ns)));
  const mx = Math.min(x0 + 0.62 * r.w, Math.max(x0 + 0.378 * r.w, x0 + nameW + 5));
  /* the name sits on the foot of the notch; the notch rises over its lines */
  const lead = (r.Y(0.913) - r.Y(0.863)) * r.k;
  const firstBase = r.Y(0.913) - (lines.length - 1) * lead;
  const my = firstBase - ns * 0.76 - 2.8;
  const frame = notchedFrame(r, { x0, y0, x1, y1, nx, ny, mx, my, c });
  const ts = r.S(0.018);
  /* the title stays clear of the slot: it wraps into the corner */
  const room = r.w / 2 - 7.25 - 2 - 0.078 * r.w;
  const head = [...splitTitle(r, r.title, ts, room), r.idText].filter(Boolean);
  const logoCx = r.rtl ? r.W - (nx + x1) / 2 : (nx + x1) / 2;
  return (
    <>
      {bg(r, "#FFFFFF")}
      <rect x={r.X(0.08) - (r.rtl ? 0.95 : 0)} y={r.Y(0.031)} width={0.95} height={0.95} fill="#7B61FF" />
      {head.map((l, i) => <T key={i} r={r} x={r.X(0.078)} y={r.Y(0.074) + i * ts * 1.2} size={ts} fill="#1C1C1E" weight={500} align={r.start} max={room}>{caps(l)}</T>)}
      <Portrait r={r} box={{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }} clip={frame} />
      <Logo x={logoCx - lw / 2} y={y0 + (ny - y0 - lh) / 2} width={lw} fill="#1C1C1E" />
      {lines.map((l, i) => <T key={i} r={r} x={r.X(0.078)} y={firstBase + i * lead} size={ns} fill="#1C1C1E" align={r.start} max={0.6 * r.w}>{l}</T>)}
      {cornerQrs(r, r.front, "tr", 9, false)}
    </>
  );
}
/** The small title at the top, wrapped word by word to `max` (three lines
 *  at most; the rest joins the last). */
function splitTitle(r: R, text: string, size: number, max: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && tw(r, caps(next), size, 500) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length <= 3 ? lines : [...lines.slice(0, 2), lines.slice(2).join(" ")];
}

/* ── the backs the references do not show ──────────────────────────────── */

/** The return back in the style's colours: the logo, who to return it to,
 *  the back's QR codes, the staff number. */
function returnBack(r: R, dark: boolean): ReactNode {
  const lw = 0.5 * r.w;
  const ink = dark ? "#FFFFFF" : "#1C1C1E", sub = dark ? "#98989D" : "#6E6E73";
  const block = ReturnBlock({ r, x: r.x(0.5), y: r.Y(0.3), align: "center", ink, sub, width: 0.86 * r.w });
  const n = r.back.length;
  return (
    <>
      {bg(r, dark ? "#000000" : "#FFFFFF")}
      <Logo x={r.x(0.5) - lw / 2} y={r.Y(0.16)} width={lw} fill={ink} />
      {block.node}
      {n ? qrs(r, r.back, { x: r.x(0.5) - (n * 14 + (n - 1) * 2) / 2, y: block.bottom + 2, alignEnd: false }, 14, dark) : null}
      <T r={r} x={r.x(0.5)} y={r.Y(0.94)} size={r.S(0.022)} fill={sub} align="center" max={0.8 * r.w}>{r.idText}</T>
    </>
  );
}

/* ── the sides, the die, the print notes ───────────────────────────────── */

export function drawIdRefFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  switch (r.style) {
    case "r-wave-white": return waveFront(r, true);
    case "r-dots": return dotsFront(r);
    case "r-bold": return boldFront(r);
    case "r-gradient": return gradientFront(r);
    case "r-staff": return staffFront(r);
    case "r-notch": return notchFront(r);
    default: return waveFront(r, false);
  }
}

export function drawIdRefBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  switch (r.style) {
    case "r-wave-white": return waveWhiteBack(r);
    case "r-dots": return dotsBack(r);
    case "r-bold": return boldBack(r);
    case "r-gradient": return gradientBack(r);
    case "r-staff": return returnBack(r, true);
    case "r-notch": return returnBack(r, false);
    default: return waveBack(r);
  }
}

/** The punch of each reference: a slot (w × h, its top from the card's top)
 *  or a round hole (Ø, its centre from the top) — all at the top centre. */
const PUNCH: Record<IdRef, { slot: [number, number, number] } | { hole: [number, number] }> = {
  "r-wave": { slot: [12.7, 3.2, 3] },
  "r-wave-white": { hole: [4, 5] },
  "r-dots": { hole: [4.5, 6] },
  "r-bold": { hole: [4, 5.5] },
  "r-gradient": { hole: [3.6, 5.8] },
  "r-staff": { slot: [14, 3.1, 5.4] },
  "r-notch": { slot: [14.5, 2.4, 7.3] },
};
const CORNER = 3.2;

/** The die line: round corners (CR80) and the punch — the same on both
 *  sides, as the card is cut through. */
export function idRefDie(v: TemplateValues, _page: string, { w, h, bleed: b }: { w: number; h: number; bleed: number }): string | null {
  if (!isIdRef(v)) return null;
  const c = CORNER;
  let d = `M${b + c} ${b}H${b + w - c}A${c} ${c} 0 0 1 ${b + w} ${b + c}V${b + h - c}A${c} ${c} 0 0 1 ${b + w - c} ${b + h}H${b + c}A${c} ${c} 0 0 1 ${b} ${b + h - c}V${b + c}A${c} ${c} 0 0 1 ${b + c} ${b}Z`;
  const p = PUNCH[refOf(v)];
  const cx = b + w / 2;
  if ("slot" in p) {
    const [sw, sh, top] = p.slot, q = sh / 2, y = b + top;
    d += `M${cx - sw / 2 + q} ${y}H${cx + sw / 2 - q}A${q} ${q} 0 0 1 ${cx + sw / 2 - q} ${y + sh}H${cx - sw / 2 + q}A${q} ${q} 0 0 1 ${cx - sw / 2 + q} ${y}Z`;
  } else {
    const [dia, cy] = p.hole, q = dia / 2;
    d += `M${cx - q} ${b + cy}A${q} ${q} 0 1 0 ${cx + q} ${b + cy}A${q} ${q} 0 1 0 ${cx - q} ${b + cy}Z`;
  }
  return d;
}

export function idRefSpecKeys(v: TemplateValues): string[] {
  const s = refOf(v);
  const punch = "slot" in PUNCH[s] ? "spec.idSlot" : "spec.idHole";
  const own: Partial<Record<IdRef, string[]>> = {
    "r-wave-white": ["spec.idBarcode"],
    "r-gradient": ["spec.idGradient"],
    "r-dots": ["spec.idDots"],
  };
  return ["spec.idCard", "spec.idRound", punch, ...(own[s] ?? []), "spec.badge3"];
}

/** The photo is required only where the reference has one. */
export const idRefNeedsPhoto = (v: TemplateValues) => !isIdRef(v) || ID_REF_PHOTO.includes(String(v.style));
