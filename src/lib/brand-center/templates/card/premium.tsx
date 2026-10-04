/* ---------------------------------------------------------------------------
   Business card — the premium set (owner, 30/09/2026: designs "really made
   by a professional designer", "keep the old designs also"). Eight cards
   added beside the first twenty-five, with the certificates' finishing
   details scaled to a card:

     p-pattern     the KOLEEX pattern on black, the card's full height
     p-underprint  the KOLEEX pattern on white (the key kept from its first
                   drawing)
     p-guilloche   black, a silver guilloche band along the foot
     p-monolith    a black column carrying the pattern, the name on white
     p-knockout    the dots field with the logo in a framed clear window
     p-editorial   the name as a light headline
     p-swiss       a black band, the contacts in a hairline grid
     p-medallion   the foil medallion as the mark
     p-foil-line   one silver hairline across black

   The information side is the same everywhere: the name Light, the title
   in spaced capitals, a microtext rule, the contacts as small labels over
   values in one or two columns, the QR codes in the end corner.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "../types";
import { PT } from "../types";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, INK, Logo, QrZone, WHITE, fit, logoHeight, textWidth, wrapBalanced, type PrintRow } from "./parts";
import { FoilSeal, MicroLine } from "../ornaments";
import { Pattern, patternOf } from "../patterns";
import { fontOf, langOf, num, printedRows, qrsOf, str } from "./model";

export const PREMIUM_STYLES = ["p-pattern", "p-underprint", "p-guilloche", "p-monolith", "p-knockout", "p-editorial", "p-swiss", "p-medallion", "p-foil-line"] as const;
/** The styles that carry the KOLEEX pattern (it has a field of its own). */
export const PATTERN_CARD_STYLES = ["p-pattern", "p-underprint", "p-monolith"];
type Premium = (typeof PREMIUM_STYLES)[number];
export const isPremium = (v: TemplateValues) => (PREMIUM_STYLES as readonly string[]).includes(String(v.style));
const styleOf = (v: TemplateValues): Premium => (isPremium(v) ? (v.style as Premium) : "p-guilloche");

const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
const SILVER = ["#E5E5EA", "#FFFFFF", "#D1D1D6", "#AEAEB2"];

function read(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed, w = ctx.w, h = ctx.h;
  const lang = langOf(v);
  const all = qrsOf(v);
  const M = 5; // 1 mm inside the 4 mm safe margin
  return {
    b, w, h, W: w + 2 * b, H: h + 2 * b, x0: b + M, x1: b + w - M, y0: b + M, y1: b + h - M, cx: b + w / 2, cy: b + h / 2,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), title: str(v, "title"), rows: printedRows(v) as PrintRow[],
    front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
    pattern: patternOf(v.pattern, "scan-edge"),
  };
}
type R = ReturnType<typeof read>;

/** Text on the side of x it is asked for, whatever its direction. */
function Txt({ r, x, y, size, children, fill, weight = 400, align = "left", max, spacing, ltr }: {
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

const bg = (r: R, color: string) => <rect x={0} y={0} width={r.W} height={r.H} fill={color} />;
const silverDefs = (r: R) => (
  <defs><linearGradient id={`${r.uid}-psilver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}</linearGradient></defs>
);

/** The name (Light), the title in spaced capitals, a short microtext rule. */
function NameBlock({ r, x, y, width, align, dark, silver, size = 12 }: { r: R; x: number; y: number; width: number; align: "left" | "right" | "center"; dark: boolean; silver?: boolean; size?: number }) {
  const ns = size * PT * r.k;
  const ts = 5.2 * PT * r.k;
  const lines = r.name && textWidth(r.name, ns, 300, r.font) > width ? wrapBalanced(r.name, ns * 0.9, width, 300, r.font) : [r.name];
  const s = lines.length > 1 ? ns * 0.9 : ns;
  const nodes: ReactNode[] = [];
  let yy = y;
  if (r.name) lines.forEach((l, i) => { yy += i === 0 ? s * 0.8 : s * 1.1; nodes.push(<Txt key={`n${i}`} r={r} x={x} y={yy} size={s} fill={silver ? `url(#${r.uid}-psilver)` : dark ? WHITE : INK} weight={300} align={align} max={width} spacing={-s * 0.01}>{l}</Txt>); });
  if (r.title) { yy += ts * 2.2; nodes.push(<Txt key="t" r={r} x={x} y={yy} size={ts} fill={dark ? GREY_ON_INK : GREY_ON_WHITE} weight={600} align={align} max={width} spacing={ts * 0.18}>{caps(r.title)}</Txt>); }
  yy += 2.4;
  const rw = Math.min(16, width);
  const rx = align === "center" ? x - rw / 2 : align === "right" ? x - rw : x;
  nodes.push(<MicroLine key="m" uid={r.uid} id={`nb${Math.round(y * 10)}`} font={r.font} size={0.42} x={rx} y={yy} width={rw} fill={dark ? "#636366" : "#AEAEB2"} />);
  return { node: <g>{nodes}</g>, bottom: yy };
}

/** The contacts as small labels over values, in one or two columns, ending
 *  at `bottom`; the QR codes of this side in the end corner beside them. */
function Contacts({ r, x0, x1, bottom, dark, qrs, cols }: { r: R; x0: number; x1: number; bottom: number; dark: boolean; qrs: R["front"]; cols?: 1 | 2 }) {
  const n = qrs.filter((q) => (q.kind === "wechat" || q.kind === "image" ? !!q.image : !!r.codes[q.id])).length;
  const qSize = 12.5;
  const qW = n ? n * qSize + (n - 1) * 2 : 0;
  const width = x1 - x0 - (n ? qW + 3 : 0);
  const all = r.rows.map((row) => ({ label: caps(row.label.replace(/[:：]\s*$/, "").trim()), value: row.value, kind: row.kind }));
  /* the address runs across the full width, above the others */
  const address = all.filter((it) => it.kind === "address");
  const items = all.filter((it) => it.kind !== "address");
  const two = (cols ?? (items.length >= 3 && width >= 52 ? 2 : 1)) === 2;
  const perCol = two ? Math.ceil(items.length / 2) : items.length;
  const colW = two ? (width - 4) / 2 : width;
  const ls = 3.9 * PT * r.k, vs = 6.2 * PT * r.k, step = 5.1;
  const fg = dark ? WHITE : INK, sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
  const startX = r.rtl ? x1 : x0;
  const nodes: ReactNode[] = [];
  items.forEach((it, i) => {
    const col = two ? Math.floor(i / perCol) : 0;
    const row = two ? i % perCol : i;
    const rowsInCol = two ? (col === 0 ? perCol : items.length - perCol) : items.length;
    const y = bottom - (rowsInCol - 1 - row) * step;
    const cx = r.rtl ? startX - col * (colW + 4) : startX + col * (colW + 4);
    const align = r.rtl ? "right" : "left";
    if (it.label) nodes.push(<Txt key={`l${i}`} r={r} x={cx} y={y - vs - 0.55} size={ls} fill={sub} weight={600} align={align} max={colW} spacing={ls * 0.16}>{it.label}</Txt>);
    nodes.push(<Txt key={`v${i}`} r={r} x={cx} y={y} size={vs} fill={fg} align={align} max={colW} ltr={!ARABIC.test(it.value)}>{it.value}</Txt>);
  });
  /* the address block over the grid: its label, then one or two lines */
  const gridTop = bottom - ((two ? perCol : items.length) - 1) * step - vs - 0.55 - ls;
  let ay = gridTop - 2.2;
  const addrW = x1 - x0 - (n ? qW + 3 : 0);
  for (const a of [...address].reverse()) {
    const lines = textWidth(a.value, vs, 400, r.font) > addrW ? wrapBalanced(a.value, vs, addrW, 400, r.font) : [a.value];
    const align = r.rtl ? "right" : "left";
    for (let i = lines.length - 1; i >= 0; i--) {
      nodes.push(<Txt key={`a${ay}`} r={r} x={startX} y={ay} size={vs} fill={fg} align={align} max={addrW} ltr={!ARABIC.test(lines[i])}>{lines[i]}</Txt>);
      ay -= vs * 1.3;
    }
    if (a.label) nodes.push(<Txt key={`al${ay}`} r={r} x={startX} y={ay + vs * 1.3 - vs - 0.55} size={ls} fill={sub} weight={600} align={align} max={addrW} spacing={ls * 0.16}>{a.label}</Txt>);
    ay -= ls + 3;
  }
  const qx = r.rtl ? x0 : x1 - qW;
  return (
    <g>
      {nodes}
      {n ? <QrZone items={qrs} codes={r.codes} font={r.font} captionFill={sub} max={qSize} zone={{ x: qx, y: bottom - qSize - 0.5, w: qW, h: qSize + 2.4, dir: "row", align: r.rtl ? "start" : "end" }} /> : null}
    </g>
  );
}

/** A full information side: the name block on top, the contacts at the foot. */
function Info({ r, x0, x1, dark, qrs, silver, top, withLogo }: { r: R; x0: number; x1: number; dark: boolean; qrs: R["front"]; silver?: boolean; top?: number; withLogo?: boolean }) {
  const align = r.rtl ? "right" : "left";
  const lw = 17;
  const logoY = r.y0;
  const nameTop = withLogo ? logoY + logoHeight(lw) + 5.5 : top ?? r.y0 + 1;
  const nb = NameBlock({ r, x: r.rtl ? x1 : x0, y: nameTop, width: x1 - x0, align, dark, silver });
  return (
    <g>
      {withLogo ? <Logo x={r.rtl ? x1 - lw : x0} y={logoY} width={lw} fill={dark ? WHITE : INK} /> : null}
      {nb.node}
      <Contacts r={r} x0={x0} x1={x1} bottom={r.y1} dark={dark} qrs={qrs} />
    </g>
  );
}

/** Interlaced waves between two hairlines across the card — a guilloche
 *  band. */
function WaveBand({ x0, x1, y, T, color }: { x0: number; x1: number; y: number; T: number; color: string }) {
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

/* ── the fronts ────────────────────────────────────────────────────────── */

export function drawPremiumFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, cx } = r;
  switch (styleOf(v)) {
    case "p-guilloche": {
      const T = 6.5;
      const bandY = b + h - 4.5 - T;
      const lw = 34;
      return (
        <>
          {bg(r, INK)}
          <WaveBand x0={0} x1={W} y={bandY} T={T} color="#6E6E73" />
          <Logo x={cx - lw / 2} y={b + (h - 4.5 - T) / 2 - logoHeight(lw) / 2} width={lw} fill={WHITE} />
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_INK} max={10} zone={{ x: r.x1 - 10, y: r.y0, w: 10, h: 12, dir: "row", align: "end" }} />
        </>
      );
    }
    case "p-monolith": {
      const colW = 0.34 * w;
      const colX = r.rtl ? b + w - colW : 0;
      const colWW = r.rtl ? W - colX : b + colW;
      const lw = colW - 11;
      const pin = r.rtl ? b + w - 5 : b + 5;
      const tx0 = r.rtl ? r.x0 : b + colW + 6, tx1 = r.rtl ? b + w - colW - 6 : r.x1;
      const nb = NameBlock({ r, x: r.rtl ? tx1 : tx0, y: 0, width: tx1 - tx0, align: r.rtl ? "right" : "left", dark: false, size: 12.5 });
      const nbH = nb.bottom;
      const y0 = b + (h - nbH) / 2;
      return (
        <>
          {bg(r, WHITE)}
          <rect x={colX} y={0} width={colWW} height={H} fill={INK} />
          <g clipPath={`url(#${r.uid}-mcol)`}>
            <defs><clipPath id={`${r.uid}-mcol`}><rect x={colX} y={0} width={colWW} height={H} /></clipPath></defs>
            <Pattern id={r.pattern} area={{ x0: colX, y0: 0, w: colWW, h: H }} dark mirror={!r.rtl} uid={`${r.uid}-mp`}
              clear={[{ x: (r.rtl ? pin - lw : pin) - 2.5, y: r.y0 - 2.5, w: lw + 5, h: logoHeight(lw) + 5 }]} />
          </g>
          <Logo x={r.rtl ? pin - lw : pin} y={r.y0} width={lw} fill={WHITE} />
          <g transform={`translate(0 ${y0})`}>{nb.node}</g>
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_WHITE} max={11} zone={{ x: r.rtl ? r.x0 : r.x1 - 11, y: r.y1 - 13.4, w: 11, h: 13.4, dir: "row", align: "end" }} />
        </>
      );
    }
    case "p-knockout": {
      /* the dots field; the full logo in a clear window, framed in silver */
      const lw = 27;
      const lx = r.rtl ? r.x1 - lw : r.x0;
      const ly = r.y1 - logoHeight(lw);
      return (
        <>
          {bg(r, INK)}
          <defs>
            <mask id={`${r.uid}-kmask`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
              <rect x={lx - 3} y={ly - 3} width={lw + 6} height={logoHeight(lw) + 6} fill="#000000" />
            </mask>
          </defs>
          <g mask={`url(#${r.uid}-kmask)`}>
            <Dots area={{ x: 0, y: 0, w: W, h: H }} pitch={1.8} r={0.34} fill="#4D4D50" origin={{ x: cx, y: r.cy }} uid={`${r.uid}-kd`} />
          </g>
          <rect x={lx - 3} y={ly - 3} width={lw + 6} height={logoHeight(lw) + 6} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
          <Logo x={lx} y={ly} width={lw} fill={WHITE} />
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_INK} max={10} zone={{ x: r.rtl ? r.x0 : r.x1 - 10, y: r.y0, w: 10, h: 12, dir: "row", align: "end" }} />
        </>
      );
    }
    case "p-editorial": {
      const width = w - 10;
      const x = r.rtl ? r.x1 : r.x0;
      const ns = 19 * PT * r.k;
      const lines = r.name && textWidth(r.name, ns, 300, r.font) > width ? wrapBalanced(r.name, ns * 0.86, width, 300, r.font) : [r.name];
      const s = lines.length > 1 ? ns * 0.86 : ns;
      const ts = 5.4 * PT * r.k;
      const lw = 20;
      return (
        <>
          {bg(r, WHITE)}
          <rect x={r.rtl ? r.x1 - 8 : r.x0} y={r.y0} width={8} height={0.7} fill={INK} />
          {r.name ? lines.map((l, i) => <Txt key={l} r={r} x={x} y={r.y0 + 5 + s * 0.8 + i * s * 1.05} size={s} fill={INK} weight={300} align={r.rtl ? "right" : "left"} max={width} spacing={-s * 0.015}>{l}</Txt>) : null}
          {r.title ? <Txt r={r} x={x} y={r.y0 + 5 + s * 0.8 + (lines.length - 1) * s * 1.05 + ts * 2.4} size={ts} fill={GREY_ON_WHITE} weight={600} align={r.rtl ? "right" : "left"} max={width} spacing={ts * 0.2}>{caps(r.title)}</Txt> : null}
          <Logo x={r.rtl ? r.x0 : r.x1 - lw} y={r.y1 - logoHeight(lw)} width={lw} fill={INK} />
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_WHITE} max={11} zone={{ x: r.rtl ? r.x1 - 11 : r.x0, y: r.y1 - 13.4, w: 11, h: 13.4, dir: "row", align: "start" }} />
        </>
      );
    }
    case "p-swiss": {
      const band = b + 11;
      const lw = 19;
      return (
        <>
          {bg(r, WHITE)}
          <rect x={0} y={0} width={W} height={band} fill={INK} />
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={b + (band - b - logoHeight(lw)) / 2} width={lw} fill={WHITE} />
          <Info r={r} x0={r.x0} x1={r.x1} dark={false} qrs={r.front} top={band + 3.5} />
        </>
      );
    }
    case "p-pattern":
    case "p-underprint": {
      /* the KOLEEX pattern on the end half, the card's full height; the full
         logo on the clean half (owner 30/09: "the same height as the card") */
      const dark = styleOf(v) === "p-pattern";
      const lw = 30;
      const half = b + w * 0.52;
      const area = r.rtl ? { x0: 0, y0: 0, w: W - half, h: H } : { x0: half, y0: 0, w: W - half, h: H };
      return (
        <>
          {bg(r, dark ? INK : WHITE)}
          <Pattern id={r.pattern} area={area} dark={dark} mirror={r.rtl} uid={`${r.uid}-pc`} />
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={r.cy - logoHeight(lw) / 2} width={lw} fill={dark ? WHITE : INK} />
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={dark ? GREY_ON_INK : GREY_ON_WHITE} max={10} zone={{ x: r.rtl ? r.x1 - 10 : r.x0, y: r.y0, w: 10, h: 12, dir: "row", align: "start" }} />
        </>
      );
    }
    case "p-medallion": {
      const rad = 10.5;
      const lw = 26;
      const top = b + (h - (rad * 2 + 5 + logoHeight(lw))) / 2;
      return (
        <>
          {bg(r, INK)}
          <FoilSeal uid={r.uid} font={r.font} cx={cx} cy={top + rad} rad={rad} dark />
          <Logo x={cx - lw / 2} y={top + rad * 2 + 5} width={lw} fill={WHITE} />
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_INK} max={10} zone={{ x: r.x1 - 10, y: r.y1 - 12, w: 10, h: 12, dir: "row", align: "end" }} />
        </>
      );
    }
    default: {
      /* p-foil-line: one silver hairline across black */
      const lineY = b + h * 0.6;
      const lw = 26;
      const x = r.rtl ? r.x1 : r.x0;
      const nb = NameBlock({ r, x, y: lineY + 3.2, width: w - 10, align: r.rtl ? "right" : "left", dark: true, silver: true, size: 11 });
      return (
        <>
          {bg(r, INK)}
          {silverDefs(r)}
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={lineY - 5 - logoHeight(lw)} width={lw} fill={WHITE} />
          <rect x={0} y={lineY} width={W} height={0.3} fill={`url(#${r.uid}-psilver)`} />
          {nb.node}
          <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_INK} max={10} zone={{ x: r.rtl ? r.x0 : r.x1 - 10, y: r.y0, w: 10, h: 12, dir: "row", align: "end" }} />
        </>
      );
    }
  }
}

/* ── the backs ─────────────────────────────────────────────────────────── */

export function drawPremiumBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, h, cx } = r;
  switch (styleOf(v)) {
    case "p-guilloche":
      return (
        <>
          {bg(r, INK)}
          <Info r={r} x0={r.x0} x1={r.x1} dark qrs={r.back} withLogo />
        </>
      );
    case "p-pattern":
    case "p-monolith":
    case "p-editorial":
      return (
        <>
          {bg(r, INK)}
          <Info r={r} x0={r.x0} x1={r.x1} dark qrs={r.back} withLogo />
        </>
      );
    case "p-knockout":
    case "p-underprint":
      return (
        <>
          {bg(r, WHITE)}
          <Info r={r} x0={r.x0} x1={r.x1} dark={false} qrs={r.back} withLogo />
        </>
      );
    case "p-swiss": {
      const lw = 36;
      const ly = b + (h - logoHeight(lw)) / 2 - 2;
      return (
        <>
          {bg(r, INK)}
          <Logo x={cx - lw / 2} y={ly} width={lw} fill={WHITE} />
          <MicroLine uid={r.uid} id="swb" font={r.font} size={0.42} x={cx - lw / 2} y={ly + logoHeight(lw) + 4} width={lw} fill="#636366" />
          <QrZone items={r.back} codes={r.codes} font={r.font} captionFill={GREY_ON_INK} max={11} zone={{ x: r.x1 - 11, y: r.y1 - 13.4, w: 11, h: 13.4, dir: "row", align: "end" }} />
        </>
      );
    }
    case "p-medallion":
      return (
        <>
          {bg(r, INK)}
          {silverDefs(r)}
          <Info r={r} x0={r.x0} x1={r.x1} dark qrs={r.back} silver withLogo />
        </>
      );
    default:
      /* p-foil-line: the contacts on white */
      return (
        <>
          {bg(r, WHITE)}
          <Info r={r} x0={r.x0} x1={r.x1} dark={false} qrs={r.back} withLogo />
        </>
      );
  }
}

export function premiumSpecKeys(v: TemplateValues): string[] {
  switch (styleOf(v)) {
    case "p-guilloche": return ["spec.pGuilloche", "spec.whitePrint", "spec.blackBoard", "spec.pMicro", "spec.edges"];
    case "p-monolith": case "p-editorial": return ["spec.twoTone", "spec.pMicro", "spec.whiteBoard", "spec.edges"];
    case "p-knockout": return ["spec.pKnockout", "spec.whitePrint", "spec.blackBoard", "spec.pMicro", "spec.edges"];
    case "p-swiss": return ["spec.twoTone", "spec.pMicro", "spec.whiteBoard", "spec.edges"];
    case "p-underprint": return ["spec.pPattern", "spec.blackPrint", "spec.whiteBoard", "spec.edges"];
    case "p-pattern": return ["spec.pPattern", "spec.whitePrint", "spec.blackBoard", "spec.edges"];
    case "p-medallion": return ["spec.pMedallion", "spec.silverName", "spec.blackBoard", "spec.pMicro", "spec.edges"];
    default: return ["spec.pFoilLine", "spec.silverName", "spec.blackBoard", "spec.pMicro", "spec.edges"];
  }
}
