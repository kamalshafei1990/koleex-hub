/* ---------------------------------------------------------------------------
   Staff ID badge — the premium set (owner, 30/09/2026: the certificates'
   designer level on every template, "keep the old designs also"). Six
   badges beside the first six, 54 × 86 mm, each on one idea:

     p-guilloche   black, a silver guilloche band at the foot
     p-monolith    a black block carrying the KOLEEX pattern, the portrait
                   on its edge
     p-knockout    the dots field, the logo in a framed clear window
     p-editorial   white, the name as a light headline
     p-underprint  a round portrait on the KOLEEX pattern
     p-medallion   black, the foil medallion over the portrait

   The book's rules hold: the portrait 4 : 5 (round under the pattern),
   black and white or muted; the name, the title and the staff number and
   nothing personal beyond them.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "./types";
import { PT } from "./types";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, INK, Logo, Photo, PhotoPlaceholder, QrZone, WHITE, fit, logoHeight, textWidth, wrapBalanced } from "./card/parts";
import { asLang, fontOf, num, qrsOf, str } from "./card/model";
import { FoilSeal, MicroLine } from "./ornaments";
import { Pattern, patternOf } from "./patterns";

export const ID_PREMIUM = ["p-guilloche", "p-monolith", "p-knockout", "p-editorial", "p-underprint", "p-medallion"] as const;
type P = (typeof ID_PREMIUM)[number];
export const isIdPremium = (v: TemplateValues) => (ID_PREMIUM as readonly string[]).includes(String(v.style));
/** The premium badges printed on black (their back is black too). */
export const idPremiumDark = (v: TemplateValues) => ["p-guilloche", "p-knockout", "p-medallion"].includes(String(v.style));
const styleOf = (v: TemplateValues): P => (isIdPremium(v) ? (v.style as P) : "p-guilloche");

const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
const SILVER = ["#E5E5EA", "#FFFFFF", "#D1D1D6", "#AEAEB2"];

function read(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed, w = ctx.w, h = ctx.h;
  const lang = asLang(v.lang);
  return {
    b, w, h, W: w + 2 * b, H: h + 2 * b, x0: b + 4.5, x1: b + w - 4.5, cx: b + w / 2,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), title: str(v, "title"), dept: str(v, "dept"),
    staff: str(v, "staffNo"), label: str(v, "idLabel") || "ID", valid: str(v, "valid"), role: str(v, "role").toUpperCase(),
    photo: str(v, "photo"), front: qrsOf(v).filter((q) => q.side === "front"),
    pattern: patternOf(v.pattern, "scan-edge"),
  };
}
type R = ReturnType<typeof read>;

function Txt({ r, x, y, size, children, fill, weight = 400, align = "center", max, spacing, ltr }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number;
  align?: "left" | "right" | "center"; max?: number; spacing?: number; ltr?: boolean;
}) {
  const dir = ltr || !r.rtl ? "ltr" : "rtl";
  const anchor = align === "center" ? "middle" : align === "left" ? (dir === "ltr" ? "start" : "end") : (dir === "ltr" ? "end" : "start");
  const spaced = spacing && !ARABIC.test(children) ? spacing : undefined;
  return (
    <text x={x} y={y} textAnchor={anchor} direction={dir} fill={fill} {...(max ? fit(children, size, max, weight, r.font) : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: spaced, unicodeBidi: "plaintext", fontVariantNumeric: "tabular-nums" }}>{children}</text>
  );
}

function Portrait({ v, r, box, radius }: { v: TemplateValues; r: R; box: { x: number; y: number; w: number; h: number }; radius: number }) {
  return (
    <>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} fill={INK} />
      {r.photo
        ? <Photo href={r.photo} box={box} radius={radius} tone={v.bw === true ? "bw" : "muted"} zoom={num(v, "photoZoom", 100) / 100}
            px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={false} uid={`${r.uid}-pp`} />
        : <PhotoPlaceholder box={box} label="Photo" font={r.font} />}
    </>
  );
}

/** The person: the name (Light), the title in spaced capitals, the
 *  department, a microtext rule; returns its foot. */
function Person({ r, x, y, width, align, dark, silver, size = 13 }: { r: R; x: number; y: number; width: number; align: "left" | "right" | "center"; dark: boolean; silver?: boolean; size?: number }) {
  const ns = size * PT * r.k;
  const lines = r.name && textWidth(r.name, ns, 300, r.font) > width ? wrapBalanced(r.name, ns * 0.86, width, 300, r.font) : [r.name];
  const s = lines.length > 1 ? ns * 0.86 : ns;
  const ts = 5.2 * PT * r.k;
  const nodes: ReactNode[] = [];
  let y0 = y;
  if (r.name) lines.forEach((l, i) => { y0 += i === 0 ? s * 0.8 : s * 1.1; nodes.push(<Txt key={`n${i}`} r={r} x={x} y={y0} size={s} weight={300} fill={silver ? `url(#${r.uid}-isilver)` : dark ? WHITE : INK} align={align} max={width} spacing={-s * 0.01}>{l}</Txt>); });
  if (r.title) { y0 += ts * 2.3; nodes.push(<Txt key="t" r={r} x={x} y={y0} size={ts} fill={dark ? GREY_ON_INK : GREY_ON_WHITE} weight={600} align={align} max={width} spacing={ts * 0.16}>{caps(r.title)}</Txt>); }
  if (r.dept) { y0 += ts * 1.9; nodes.push(<Txt key="d" r={r} x={x} y={y0} size={ts} fill={dark ? GREY_ON_INK : GREY_ON_WHITE} align={align} max={width}>{r.dept}</Txt>); }
  y0 += 2.6;
  const rw = Math.min(14, width);
  const rx = align === "center" ? x - rw / 2 : align === "right" ? x - rw : x;
  nodes.push(<MicroLine key="m" uid={r.uid} id={`ip${Math.round(y * 10)}`} font={r.font} size={0.4} x={rx} y={y0} width={rw} fill={dark ? "#636366" : "#AEAEB2"} />);
  return { node: <g>{nodes}</g>, bottom: y0 };
}

/** "ID 0001 · Valid until 12/2027" in figures that line up. */
function IdLine({ r, x, y, align, fill }: { r: R; x: number; y: number; align: "left" | "right" | "center"; fill: string }) {
  const parts = [r.staff ? `${r.label} ${r.staff}` : "", r.valid].filter(Boolean);
  if (!parts.length) return null;
  return <Txt r={r} x={x} y={y} size={2.4} fill={fill} align={align} ltr spacing={0.12}>{parts.join("  ·  ")}</Txt>;
}
/** The status in spaced capitals, on a thin band or as a word. */
function Role({ r, y, dark, band }: { r: R; y: number; dark: boolean; band: boolean }) {
  if (!r.role) return null;
  const s = 6 * PT;
  if (!band) return <Txt r={r} x={r.cx} y={y} size={s} fill={dark ? WHITE : INK} weight={700} ltr spacing={s * 0.32}>{r.role}</Txt>;
  const top = r.b + r.h - 7;
  return (
    <g>
      <rect x={0} y={top} width={r.W} height={r.H - top} fill={dark ? WHITE : INK} />
      <Txt r={r} x={r.cx} y={top + 3.5 + s * 0.36} size={s} fill={dark ? INK : WHITE} weight={700} ltr spacing={s * 0.32}>{r.role}</Txt>
    </g>
  );
}
const Codes = ({ r, x, y, size, fill }: { r: R; x: number; y: number; size: number; fill: string }) =>
  r.front.length ? <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={fill} max={size} zone={{ x, y, w: size, h: size + 2.4, dir: "row", align: "center" }} /> : null;

export function drawIdPremium(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, cx } = r;
  const silverDefs = <defs><linearGradient id={`${r.uid}-isilver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}</linearGradient></defs>;
  switch (styleOf(v)) {
    case "p-guilloche": {
      /* black; the guilloche band across the foot */
      const lw = 26;
      const box = { x: cx - 12, y: b + 15, w: 24, h: 30 };
      const T = 5;
      const bandY = b + h - (r.role ? 7 : 0) - 4 - T;
      const p = Person({ r, x: cx, y: box.y + box.h + 3, width: w - 9, align: "center", dark: true });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          <Logo x={cx - lw / 2} y={b + 6} width={lw} fill={WHITE} />
          <rect x={box.x - 0.6} y={box.y - 0.6} width={box.w + 1.2} height={box.h + 1.2} rx={1.8} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
          <Portrait v={v} r={r} box={box} radius={1.4} />
          {p.node}
          <Band x0={0} x1={W} y={bandY} T={T} color="#6E6E73" />
          <IdLine r={r} x={cx} y={bandY - 2.2} align="center" fill={GREY_ON_INK} />
          <Role r={r} y={0} dark band />
        </>
      );
    }
    case "p-monolith": {
      /* a black block carrying the KOLEEX pattern; the portrait on its edge */
      const block = b + h * 0.42;
      const box = { x: r.rtl ? r.x0 : r.x1 - 20, y: block - 14, w: 20, h: 25 };
      const lw = 20;
      const start = r.rtl ? r.x1 : r.x0;
      const align = r.rtl ? "right" : "left";
      const p = Person({ r, x: start, y: box.y + box.h + 3.5, width: w - 9, align, dark: false });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={block} fill={INK} />
          <g clipPath={`url(#${r.uid}-iblk)`}>
            <defs><clipPath id={`${r.uid}-iblk`}><rect x={0} y={0} width={W} height={block} /></clipPath></defs>
            <Pattern id={r.pattern} area={{ x0: 0, y0: 0, w: W, h: block }} dark mirror={r.rtl} uid={`${r.uid}-imp`}
              clear={[{ x: (r.rtl ? r.x1 - lw : r.x0) - 2, y: b + 3.5, w: lw + 4, h: logoHeight(lw) + 4 }, ...(r.role ? [{ x: r.rtl ? r.x0 - 2 : r.x1 - 22, y: b + 3.5, w: 24, h: 6 }] : [])]} />
          </g>
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={b + 5.5} width={lw} fill={WHITE} />
          {r.role ? <Txt r={r} x={r.rtl ? r.x0 : r.x1} y={b + 5.5 + logoHeight(lw) * 0.85} size={4.6 * PT} fill={WHITE} weight={700} align={r.rtl ? "left" : "right"} ltr spacing={4.6 * PT * 0.3}>{r.role}</Txt> : null}
          <Portrait v={v} r={r} box={box} radius={1.2} />
          {p.node}
          <Codes r={r} x={r.rtl ? r.x0 : r.x1 - 11} y={b + h - 16} size={11} fill={GREY_ON_WHITE} />
          <IdLine r={r} x={start} y={b + h - 5} align={align} fill={GREY_ON_WHITE} />
        </>
      );
    }
    case "p-knockout": {
      /* the dots field across the top; the full logo in a framed window */
      const field = b + h * 0.28;
      const lw = 26;
      const lx = cx - lw / 2, ly = b + (h * 0.28 - logoHeight(lw)) / 2 + 1.5;
      const box = { x: cx - 10, y: field + 3, w: 20, h: 25 };
      const p = Person({ r, x: cx, y: box.y + box.h + 3, width: w - 9, align: "center", dark: true });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          <defs>
            <mask id={`${r.uid}-ikm`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={field}>
              <rect x={0} y={0} width={W} height={field} fill="#FFFFFF" />
              <rect x={lx - 3} y={ly - 3} width={lw + 6} height={logoHeight(lw) + 6} fill="#000000" />
            </mask>
          </defs>
          <g mask={`url(#${r.uid}-ikm)`}><Dots area={{ x: 0, y: 0, w: W, h: field }} pitch={1.8} r={0.34} fill="#4D4D50" origin={{ x: cx, y: field / 2 }} uid={`${r.uid}-ikd`} /></g>
          <rect x={lx - 3} y={ly - 3} width={lw + 6} height={logoHeight(lw) + 6} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
          <Logo x={lx} y={ly} width={lw} fill={WHITE} />
          <Portrait v={v} r={r} box={box} radius={1.2} />
          {p.node}
          <IdLine r={r} x={cx} y={b + h - (r.role ? 10 : 4.5)} align="center" fill={GREY_ON_INK} />
          <Role r={r} y={0} dark band />
        </>
      );
    }
    case "p-editorial": {
      const lw = 18;
      const start = r.rtl ? r.x1 : r.x0;
      const align = r.rtl ? "right" : "left";
      const box = { x: r.rtl ? r.x0 : r.x1 - 17, y: b + 5, w: 17, h: 21.25 };
      const p = Person({ r, x: start, y: b + h * 0.46, width: w - 9, align, dark: false, size: 16 });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={b + 5.5} width={lw} fill={INK} />
          <Portrait v={v} r={r} box={box} radius={1} />
          <rect x={r.rtl ? r.x1 - 8 : r.x0} y={b + h * 0.46 - 3} width={8} height={0.6} fill={INK} />
          {p.node}
          <Codes r={r} x={r.rtl ? r.x0 : r.x1 - 11} y={b + h - 17} size={11} fill={GREY_ON_WHITE} />
          <IdLine r={r} x={start} y={b + h - (r.role ? 11 : 5)} align={align} fill={GREY_ON_WHITE} />
          <Role r={r} y={0} dark={false} band />
        </>
      );
    }
    case "p-underprint": {
      /* a round portrait on the KOLEEX pattern, like a medal */
      const d = 26;
      const pcy = b + 13 + d / 2 + 2;
      const lw = 18;
      const box = { x: cx - d / 2, y: pcy - d / 2, w: d, h: d };
      const p = Person({ r, x: cx, y: pcy + d / 2 + 4.5, width: w - 9, align: "center", dark: false });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          {/* the pattern stood up: its edge on the top trim, across the badge's full width */}
          <Pattern id={r.pattern} area={{ x0: 0, y0: b, w: W, h: pcy - b }} dark={false} mirror={r.rtl} up uid={`${r.uid}-iup`}
            clear={[{ x: cx - lw / 2 - 2, y: b + 3, w: lw + 4, h: logoHeight(lw) + 4 }]} />
          <Logo x={cx - lw / 2} y={b + 5} width={lw} fill={INK} />
          <circle cx={cx} cy={pcy} r={d / 2 + 0.9} fill={WHITE} stroke="#AEAEB2" strokeWidth={0.2} />
          <Portrait v={v} r={r} box={box} radius={d / 2} />
          {p.node}
          <IdLine r={r} x={cx} y={b + h - (r.role ? 11 : 5)} align="center" fill={GREY_ON_WHITE} />
          <Role r={r} y={0} dark={false} band />
        </>
      );
    }
    default: {
      /* p-medallion: black, the foil medallion, a silver name */
      const rad = 6.5;
      const box = { x: cx - 11, y: b + 6 + rad * 2 + 3, w: 22, h: 27.5 };
      const p = Person({ r, x: cx, y: box.y + box.h + 3, width: w - 9, align: "center", dark: true, silver: true });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          {silverDefs}
          <FoilSeal uid={r.uid} font={r.font} cx={cx} cy={b + 6 + rad} rad={rad} dark />
          <Portrait v={v} r={r} box={box} radius={1.2} />
          {p.node}
          <IdLine r={r} x={cx} y={b + h - (r.role ? 10 : 4.5)} align="center" fill={GREY_ON_INK} />
          <Role r={r} y={0} dark band />
        </>
      );
    }
  }
}

/** Interlaced waves between two hairlines — a guilloche band. */
function Band({ x0, x1, y, T, color }: { x0: number; x1: number; y: number; T: number; color: string }) {
  const waves = 7, amp = T * 0.38, lambda = T * 1.6;
  const steps = Math.ceil((x1 - x0) / (lambda / 18));
  const paths: string[] = [];
  for (let k = 0; k < waves; k++) {
    const ph = (k / waves) * Math.PI * 2;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      d += `${i ? "L" : "M"}${x.toFixed(2)} ${(y + T / 2 + amp * Math.sin(((x - x0) / lambda) * Math.PI * 2 + ph)).toFixed(2)}`;
    }
    paths.push(d);
  }
  return (
    <g fill="none" stroke={color}>
      <line x1={x0} x2={x1} y1={y} y2={y} strokeWidth={0.2} />
      <line x1={x0} x2={x1} y1={y + T} y2={y + T} strokeWidth={0.2} />
      {paths.map((d, i) => <path key={i} d={d} strokeWidth={0.08} />)}
    </g>
  );
}
