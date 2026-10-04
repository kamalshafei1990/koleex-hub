/* ---------------------------------------------------------------------------
   Event badge — the premium set (owner, 30/09/2026: the certificates'
   designer level on every template, "keep the old designs also"). Six
   badges beside the first ten, each on one idea:

     p-guilloche   black, a silver guilloche band over the status
     p-underprint  white, the KOLEEX pattern across the top
     p-monolith    a black block carrying the pattern and the event
     p-knockout    the dots field, the logo in a framed clear window
     p-medallion   black, the foil medallion, the name in silver
     p-editorial   the first name as a light headline

   The book's rules hold (ch. 115): the name read from 2 m, the languages
   under the title, never a personal phone; the top 11 mm stay free for the
   lanyard slot.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "./types";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, INK, LIGHT_ON_INK, Logo, QrZone, WHITE, fit, logoHeight, textWidth, wrapBalanced } from "./card/parts";
import { asLang, fontOf, num, qrsOf, str } from "./card/model";
import { FoilSeal, MicroLine } from "./ornaments";
import { Pattern, patternOf } from "./patterns";

export const EVB_PREMIUM = ["p-guilloche", "p-underprint", "p-monolith", "p-knockout", "p-medallion", "p-editorial"] as const;
type P = (typeof EVB_PREMIUM)[number];
export const isEvbPremium = (v: TemplateValues) => (EVB_PREMIUM as readonly string[]).includes(String(v.style));
/** The premium badges printed on black. */
export const evbPremiumDark = (v: TemplateValues) => ["p-guilloche", "p-knockout", "p-medallion"].includes(String(v.style));
const styleOf = (v: TemplateValues): P => (isEvbPremium(v) ? (v.style as P) : "p-guilloche");

const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
const SILVER = ["#E5E5EA", "#FFFFFF", "#D1D1D6", "#AEAEB2"];
const HUB_BLUE = "#567FB2";

function read(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed, w = ctx.w, h = ctx.h;
  const lang = asLang(v.lang);
  const u = Math.min(w, h) / 86;
  return {
    b, w, h, W: w + 2 * b, H: h + 2 * b, u, x0: b + 7 * u, x1: b + w - 7 * u, cx: b + w / 2,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), name2: str(v, "name2"), title: str(v, "title"),
    company: v.companyOn === false ? "" : str(v, "company") || EVERYDAY_NAME_EN, langs: str(v, "langs"),
    role: str(v, "role").toUpperCase(), roleColour: String(v.roleColor || "black"),
    event: str(v, "event"), dates: str(v, "dates"), booth: str(v, "booth"),
    front: qrsOf(v).filter((q) => q.side === "front"),
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

/** The person: the name as large as it fits (Light), the name in its own
 *  script, the title in spaced capitals, the company, the languages, a
 *  microtext rule. Measured first, then set between top and bottom. */
function Person({ r, x, top, bottom, width, align, dark, silver, max }: { r: R; x: number; top: number; bottom: number; width: number; align: "left" | "right" | "center"; dark: boolean; silver?: boolean; max: number }) {
  const u = r.u;
  const lay = (y0: number) => {
    const nodes: ReactNode[] = [];
    let y = y0;
    const ns = max * r.k;
    const w1 = textWidth(r.name, ns, 300, r.font);
    let size = ns, lines = [r.name];
    if (w1 > width) {
      size = (ns * width) / w1;
      if (size < 7 * u && /\s/.test(r.name)) { size = ns * 0.8; lines = wrapBalanced(r.name, size, width, 300, r.font); const wd = Math.max(...lines.map((l) => textWidth(l, size, 300, r.font))); if (wd > width) size = (size * width) / wd; }
    }
    if (r.name) lines.forEach((l, i) => { y += i === 0 ? size * 0.78 : size * 1.06; nodes.push(<Txt key={`n${i}`} r={r} x={x} y={y} size={size} weight={300} fill={silver ? `url(#${r.uid}-esilver)` : dark ? WHITE : INK} align={align} max={width} spacing={-size * 0.012}>{l}</Txt>); });
    const sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
    const add = (text: string, s: number, fill: string, gap: number, weight = 400, sp?: number) => { if (!text) return; y += gap + s * 0.76; nodes.push(<Txt key={`${text}${gap}`} r={r} x={x} y={y} size={s} fill={fill} weight={weight} align={align} max={width} spacing={sp}>{text}</Txt>); };
    add(r.name2 && r.name2 !== r.name ? r.name2 : "", 4.8 * u, dark ? WHITE : INK, 2.4 * u, 300);
    add(r.title ? caps(r.title) : "", 3.1 * u, dark ? LIGHT_ON_INK : INK, 3.8 * u, 600, 3.1 * u * 0.2);
    add(r.company, 3.1 * u, sub, 1.8 * u);
    add(r.langs, 3 * u, sub, 3.6 * u, 400, 3 * u * 0.14);
    y += 3 * u;
    const rw = Math.min(18 * u, width);
    const rx = align === "center" ? x - rw / 2 : align === "right" ? x - rw : x;
    nodes.push(<MicroLine key="m" uid={r.uid} id={`ep${Math.round(y0)}`} font={r.font} size={0.45} x={rx} y={y} width={rw} fill={dark ? "#636366" : "#AEAEB2"} />);
    return { nodes, bottom: y };
  };
  const height = lay(0).bottom;
  const done = lay(r.front.length ? top : top + Math.max(0, (bottom - top - height) * 0.46));
  return { node: <g>{done.nodes}</g>, bottom: done.bottom };
}

/** The status band in the lanyards' colours; "black" turns white on a
 *  black badge. Returns its top. */
function RoleBand({ r, dark }: { r: R; dark: boolean }) {
  if (!r.role) return { node: null as ReactNode, top: r.b + r.h };
  const hgt = 11 * r.u;
  const top = r.b + r.h - hgt;
  const c = r.roleColour === "black" && dark ? "white" : r.roleColour;
  const fill = c === "black" ? INK : c === "grey" ? "#D1D1D6" : c === "blue" ? HUB_BLUE : WHITE;
  const text = c === "black" || c === "blue" ? WHITE : INK;
  const s = 4.2 * r.u;
  return {
    top,
    node: (
      <g>
        <rect x={0} y={top} width={r.W} height={r.H - top} fill={fill} />
        {c === "white" && !dark ? <rect x={0} y={top} width={r.W} height={0.3} fill={INK} /> : null}
        <Txt r={r} x={r.cx} y={top + hgt / 2 + s * 0.36} size={s} fill={text} weight={700} ltr spacing={s * 0.34} max={r.w - 10 * r.u}>{r.role}</Txt>
      </g>
    ),
  };
}
const eventLine = (r: R, dates = false) => [r.event, dates ? r.dates : "", r.booth].filter(Boolean).join("  ·  ");
function Codes({ r, top, bottom, fill }: { r: R; top: number; bottom: number; fill: string }) {
  if (!r.front.length || bottom - top < 8) return null;
  return <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={fill} max={16 * r.u} zone={{ x: r.x0, y: top, w: r.x1 - r.x0, h: bottom - top, dir: "row", align: "center" }} />;
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
      {paths.map((d, i) => <path key={i} d={d} strokeWidth={0.09} />)}
    </g>
  );
}

export function drawEvbPremium(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, u, cx } = r;
  const silverDefs = <defs><linearGradient id={`${r.uid}-esilver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}</linearGradient></defs>;
  const tall = h > w;
  switch (styleOf(v)) {
    case "p-guilloche": {
      const role = RoleBand({ r, dark: true });
      const T = 7 * u;
      const bandY = role.top - 4 * u - T;
      const lw = 0.4 * w;
      const top = b + 14 * u + logoHeight(lw) + 12 * u;
      const ev = eventLine(r);
      const p = Person({ r, x: cx, top, bottom: bandY - (ev ? 12 : 6) * u, width: w - 12 * u, align: "center", dark: true, max: 10.5 * u });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          <Logo x={cx - lw / 2} y={b + 14 * u} width={lw} fill={WHITE} />
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={bandY - (ev ? 10 : 4) * u} fill={GREY_ON_INK} />
          {ev ? <Txt r={r} x={cx} y={bandY - 4 * u} size={2.9 * u} fill={GREY_ON_INK} max={w - 12 * u} spacing={0.2 * u}>{ev}</Txt> : null}
          <Band x0={0} x1={W} y={bandY} T={T} color="#6E6E73" />
          {role.node}
        </>
      );
    }
    case "p-underprint": {
      const role = RoleBand({ r, dark: false });
      const lw = 0.36 * w;
      const top = b + 14 * u + logoHeight(lw) + 10 * u;
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const p = Person({ r, x: cx, top, bottom: evY - 10 * u, width: w - 12 * u, align: "center", dark: false, max: 10.5 * u });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          {/* the pattern stood up: its edge on the top trim, across the badge's full width; the slot and the logo stay clear */}
          <Pattern id={r.pattern} area={{ x0: 0, y0: b, w: W, h: top - 5 * u - b }} dark={false} mirror={r.rtl} up uid={`${r.uid}-eup`}
            clear={[{ x: cx - lw / 2 - 3 * u, y: b + 11 * u, w: lw + 6 * u, h: logoHeight(lw) + 6 * u }, { x: cx - 8.5, y: b + 4, w: 17, h: 7 }]} />
          <Logo x={cx - lw / 2} y={b + 14 * u} width={lw} fill={INK} />
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={evY - 4 * u} fill={GREY_ON_WHITE} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} max={w - 12 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }
    case "p-monolith": {
      const role = RoleBand({ r, dark: false });
      const block = b + (tall ? 0.34 : 0.4) * h;
      const lw = 0.32 * w;
      const start = r.rtl ? r.x1 : r.x0;
      const align = r.rtl ? "right" : "left";
      const boothY = role.top - 6 * u;
      const p = Person({ r, x: start, top: block + 9 * u, bottom: boothY - 10 * u, width: w - 14 * u, align, dark: false, max: 10 * u });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={block} fill={INK} />
          <g clipPath={`url(#${r.uid}-eblk)`}>
            <defs><clipPath id={`${r.uid}-eblk`}><rect x={0} y={0} width={W} height={block} /></clipPath></defs>
            <Pattern id={r.pattern} area={{ x0: 0, y0: 0, w: W, h: block }} dark mirror={r.rtl} uid={`${r.uid}-emp`}
              clear={[{ x: (r.rtl ? r.x1 - lw : r.x0) - 3 * u, y: b + 11 * u, w: lw + 6 * u, h: logoHeight(lw) + 6 * u },
                ...(r.event || r.dates ? [{ x: r.rtl ? b + w * 0.4 : 0, y: block - 14 * u, w: b + w * 0.6, h: 12 * u }] : [])]} />
          </g>
          <Logo x={r.rtl ? r.x1 - lw : r.x0} y={b + 14 * u} width={lw} fill={WHITE} />
          {r.event ? <Txt r={r} x={start} y={block - 9 * u} size={3.2 * u} fill={WHITE} weight={600} align={align} spacing={3.2 * u * 0.28} max={w - 14 * u}>{caps(r.event)}</Txt> : null}
          {r.dates ? <Txt r={r} x={start} y={block - 4.5 * u} size={2.8 * u} fill={GREY_ON_INK} weight={300} align={align} max={w - 14 * u}>{r.dates}</Txt> : null}
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={boothY - 6 * u} fill={GREY_ON_WHITE} />
          {r.booth ? <Txt r={r} x={start} y={boothY} size={4 * u} fill={INK} weight={700} align={align} max={w - 14 * u}>{r.booth}</Txt> : null}
          {role.node}
        </>
      );
    }
    case "p-knockout": {
      const role = RoleBand({ r, dark: true });
      const field = b + (tall ? 0.4 : 0.44) * h;
      /* the full logo in a framed clear window, below the lanyard slot */
      const lw = 0.44 * w;
      const lx = cx - lw / 2, ly = b + 11 * u + (field - b - 11 * u - logoHeight(lw)) / 2;
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const p = Person({ r, x: cx, top: field + 8 * u, bottom: evY - 10 * u, width: w - 12 * u, align: "center", dark: true, max: 10 * u });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          <defs>
            <mask id={`${r.uid}-ekm`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={field}>
              <rect x={0} y={0} width={W} height={field} fill="#FFFFFF" />
              <rect x={lx - 4 * u} y={ly - 4 * u} width={lw + 8 * u} height={logoHeight(lw) + 8 * u} fill="#000000" />
            </mask>
          </defs>
          <g mask={`url(#${r.uid}-ekm)`}><Dots area={{ x: 0, y: 0, w: W, h: field }} pitch={2.2 * u} r={0.42 * u} fill="#4D4D50" origin={{ x: cx, y: field / 2 }} uid={`${r.uid}-ekd`} /></g>
          <rect x={lx - 4 * u} y={ly - 4 * u} width={lw + 8 * u} height={logoHeight(lw) + 8 * u} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
          <Logo x={lx} y={ly} width={lw} fill={WHITE} />
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={evY - 4 * u} fill={GREY_ON_INK} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_INK} max={w - 12 * u} spacing={0.2 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }
    case "p-medallion": {
      const role = RoleBand({ r, dark: true });
      const rad = 10 * u;
      const cy = b + 14 * u + rad;
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const lw = 0.26 * w;
      const p = Person({ r, x: cx, top: cy + rad + 12 * u + logoHeight(lw), bottom: evY - 10 * u, width: w - 12 * u, align: "center", dark: true, silver: true, max: 10.5 * u });
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          {silverDefs}
          <FoilSeal uid={r.uid} font={r.font} cx={cx} cy={cy} rad={rad} dark />
          <Logo x={cx - lw / 2} y={cy + rad + 5 * u} width={lw} fill={WHITE} />
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={evY - 4 * u} fill={GREY_ON_INK} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_INK} max={w - 12 * u} spacing={0.2 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }
    default: {
      /* p-editorial: the first name as a light headline */
      const role = RoleBand({ r, dark: false });
      const start = r.rtl ? r.x1 : r.x0;
      const align = r.rtl ? "right" : "left";
      const width = w - 14 * u;
      const parts = r.name.split(/\s+/).filter(Boolean);
      const first = parts[0] ?? "", rest = parts.slice(1).join(" ");
      const fs = Math.min(19 * u * r.k, (19 * u * r.k * width) / Math.max(1, textWidth(first, 19 * u * r.k, 250, r.font)));
      let y = b + h * 0.36;
      const nodes: ReactNode[] = [];
      if (first) nodes.push(<Txt key="f" r={r} x={start} y={y} size={fs} fill={INK} weight={250} align={align} max={width} spacing={-fs * 0.02}>{first}</Txt>);
      if (rest) { y += 7.5 * u * r.k; nodes.push(<Txt key="l" r={r} x={start} y={y} size={6.4 * u * r.k} fill={INK} weight={500} align={align} max={width}>{rest}</Txt>); }
      y += 5 * u;
      const sub: Array<[string, number, string, number, number?]> = [[r.name2 && r.name2 !== r.name ? r.name2 : "", 4.6 * u, INK, 300], [r.title ? caps(r.title) : "", 3.4 * u, INK, 600, 3.4 * u * 0.2], [r.company, 3.1 * u, GREY_ON_WHITE, 400], [r.langs, 3 * u, GREY_ON_WHITE, 400, 3 * u * 0.14]];
      for (const [text, s, fill, weight, sp] of sub) { if (!text) continue; y += s * 1.7; nodes.push(<Txt key={text} r={r} x={start} y={y} size={s} fill={fill} weight={weight} align={align} max={width} spacing={sp}>{text}</Txt>); }
      y += 3.5 * u;
      nodes.push(<MicroLine key="m" uid={r.uid} id="eed" font={r.font} size={0.45} x={r.rtl ? start - 18 * u : start} y={y} width={18 * u} fill="#AEAEB2" />);
      const lw = 0.26 * w;
      const ev = eventLine(r, true);
      const footY = role.top - 6 * u;
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={r.rtl ? r.x1 - 12 * u : r.x0} y={b + 13 * u} width={12 * u} height={0.9 * u} fill={INK} />
          {r.event ? <Txt r={r} x={r.rtl ? r.x0 : r.x1} y={b + 14.5 * u} size={2.8 * u} fill={GREY_ON_WHITE} weight={600} align={r.rtl ? "left" : "right"} spacing={2.8 * u * 0.24} max={w * 0.5}>{caps(r.event)}</Txt> : null}
          {nodes}
          <Codes r={r} top={y + 5 * u} bottom={footY - logoHeight(lw) - (ev ? 11 : 5) * u} fill={GREY_ON_WHITE} />
          {ev ? <Txt r={r} x={start} y={footY - logoHeight(lw) - 5 * u} size={2.9 * u} fill={GREY_ON_WHITE} align={align} max={w - 14 * u}>{ev}</Txt> : null}
          <Logo x={r.rtl ? r.x0 : r.x1 - lw} y={footY - logoHeight(lw) + 0.5} width={lw} fill={INK} />
          {role.node}
        </>
      );
    }
  }
}
