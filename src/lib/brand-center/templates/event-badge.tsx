/* ---------------------------------------------------------------------------
   Event badge (plan step C12; brand book ch. 115 "Badges and lanyards").

   The book's badge is the standard style: 86 × 120 mm, a black band with
   the white logo, the name large enough to read from 2 m, the title, and
   the languages the person speaks under it — never a personal phone
   number. Owner, 29/09/2026: professional designs first, everything
   editable, a small break of the book is fine. So: ten styles, three
   sizes, a status band (STAFF / VISITOR / VIP …) in the lanyards' colours,
   the event, the booth, a portrait, QR codes, and a back that repeats the
   front (a badge on a lanyard turns round) or carries the event.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { BcPerson } from "@/lib/brand-center/client";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import type { DrawContext, QrRequest, TemplateDef, TemplateItem, TemplateValues } from "./types";
import { asLang, fontOf, isPictureQr, list, num, qrsOf, str, type QrItem } from "./card/model";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, HAIRLINE_ON_WHITE, INK, LIGHT_ON_INK, Logo, Photo, PhotoPlaceholder, QrZone, WHITE, fit, logoHeight, textWidth, wrapBalanced, type Zone } from "./card/parts";
import { nameIn, titleOf } from "./person";
import { EVB_PREMIUM, drawEvbPremium, evbPremiumDark, isEvbPremium } from "./event-badge-premium";
import { patternOptions } from "./patterns";

/** The first ten, then the premium set (owner 30/09/2026) beside them. */
export const EVB_STYLES = ["book", "black", "photo", "big-name", "event", "dots", "split", "minimal", "silver", "landscape", ...EVB_PREMIUM] as const;
type Style = (typeof EVB_STYLES)[number];
const styleOf = (v: TemplateValues): Style => ((EVB_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as Style) : "book");
const SIZES: Record<string, { w: number; h: number }> = { "86x120": { w: 86, h: 120 }, "100x140": { w: 100, h: 140 }, "105x148": { w: 105, h: 148 } };
/** The status band in the lanyards' colours (library: black staff, grey
 *  visitor, white VIP) and Hub Blue. */
const ROLE_COLOURS = ["black", "grey", "white", "blue"] as const;
const HUB_BLUE = "#567FB2";
const SILVER = ["#E5E5EA", "#FFFFFF", "#D1D1D6", "#AEAEB2"];

function read(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const all = qrsOf(v);
  const w = ctx.w, h = ctx.h;
  return {
    b: ctx.bleed, w, h, W: w + ctx.bleed * 2, H: h + ctx.bleed * 2,
    /** mm per mm of the book's 86-wide badge: everything grows with the size */
    u: Math.min(w, h) / 86,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), name2: str(v, "name2"), title: str(v, "title"),
    company: v.companyOn === false ? "" : str(v, "company"), langs: str(v, "langs"),
    role: str(v, "role").toUpperCase(), roleColour: ROLE_COLOURS.includes(v.roleColor as (typeof ROLE_COLOURS)[number]) ? (v.roleColor as (typeof ROLE_COLOURS)[number]) : "black",
    event: str(v, "event"), dates: str(v, "dates"), booth: str(v, "booth"),
    photo: str(v, "photo"), front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
  };
}
type R = ReturnType<typeof read>;

/* ── type ──────────────────────────────────────────────────────────────── */

/** The name as large as it can be: one line up to `max`, shrinking to
 *  `min`; below that, two balanced lines. */
function nameFit(r: R, text: string, max: number, min: number, width: number, weight = 700): { lines: string[]; size: number } {
  if (!text) return { lines: [], size: max };
  const w1 = textWidth(text, max, weight, r.font);
  if (w1 <= width) return { lines: [text], size: max };
  const one = (max * width) / w1;
  if (one >= min || !/\s/.test(text.trim())) return { lines: [text], size: Math.max(one, min * 0.8) };
  let size = max * 0.82;
  const lines = wrapBalanced(text, size, width, weight, r.font);
  const widest = Math.max(...lines.map((l) => textWidth(l, size, weight, r.font)));
  if (widest > width) size = (size * width) / widest;
  return { lines, size };
}

function Txt({ r, x, y, size, children, fill, weight = 400, anchor = "middle", max, spacing, dirOf }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number;
  anchor?: "start" | "middle" | "end"; max?: number; spacing?: number; dirOf?: "ltr";
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} direction={dirOf ?? (r.rtl ? "rtl" : "ltr")} fill={fill}
      {...(max ? fit(children, size, max, weight, r.font) : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: spacing, unicodeBidi: "plaintext" }}>{children}</text>
  );
}

/** The person: the name (as large as fits), the name in another script,
 *  the title, the company, the languages. Returns the drawing and its foot. */
function Person({ r, x, y, width, align, ink, sub, max, min, nameFill, weight = 700 }: {
  r: R; x: number; y: number; width: number; align: "middle" | "start"; ink: string; sub: string; max: number; min: number; nameFill?: string; weight?: number;
}) {
  const u = r.u;
  const nf = nameFit(r, r.name, max * r.k, min * r.k, width, weight);
  const nodes: ReactNode[] = [];
  let yy = y;
  nf.lines.forEach((l, i) => {
    yy += (i === 0 ? nf.size * 0.76 : nf.size * 1.08);
    nodes.push(<Txt key={`n${i}`} r={r} x={x} y={yy} size={nf.size} fill={nameFill ?? ink} weight={weight} anchor={align} max={width}>{l}</Txt>);
  });
  const add = (text: string, size: number, fill: string, gap: number, o: { weight?: number; spacing?: number } = {}) => {
    if (!text) return;
    yy += gap + size * 0.76;
    nodes.push(<Txt key={`${text}-${gap}`} r={r} x={x} y={yy} size={size} fill={fill} weight={o.weight} anchor={align} max={width} spacing={o.spacing}>{text}</Txt>);
  };
  add(r.name2 && r.name2 !== r.name ? r.name2 : "", 4.8 * u * r.k, ink, 2.4 * u);
  add(r.title, 4.2 * u, sub, 3.6 * u);
  add(r.company, 3.3 * u, sub, 1.9 * u);
  add(r.langs, 3.0 * u, sub, 4.2 * u, { spacing: 3.0 * u * 0.14 });
  return { node: <g>{nodes}</g>, bottom: yy };
}

type PersonOpts = Omit<Parameters<typeof Person>[0], "y">;
/** The person balanced in the space between `top` and `bottom` (a touch
 *  above the middle) — or hung from the top when QR codes follow. */
function Centred(o: PersonOpts, top: number, bottom: number) {
  if (o.r.front.length) return Person({ ...o, y: top });
  const height = Person({ ...o, y: 0 }).bottom;
  return Person({ ...o, y: top + Math.max(0, (bottom - top - height) * 0.46) });
}

/** The status band at the foot, in the lanyards' colours. On a dark badge
 *  "black" turns white so it never disappears. Returns its top. */
function RoleBand({ r, x, w, dark }: { r: R; x: number; w: number; dark: boolean }) {
  if (!r.role) return { node: null as ReactNode, top: r.b + r.h };
  const hgt = 12 * r.u;
  const top = r.b + r.h - hgt;
  const c = r.roleColour === "black" && dark ? "white" : r.roleColour;
  const fill = c === "black" ? INK : c === "grey" ? "#D1D1D6" : c === "blue" ? HUB_BLUE : WHITE;
  const text = c === "black" || c === "blue" ? WHITE : INK;
  const s = 4.4 * r.u;
  return {
    top,
    node: (
      <g>
        <rect x={x} y={top} width={w} height={r.H - top} fill={fill} />
        {c === "white" && !dark ? <rect x={x} y={top} width={w} height={0.3} fill={INK} /> : null}
        <Txt r={r} x={x + w / 2} y={top + hgt / 2 + s * 0.36} size={s} fill={text} weight={700} max={w - 8 * r.u} spacing={s * 0.28} dirOf="ltr">{r.role}</Txt>
      </g>
    ),
  };
}

/** "CISMA 2025 · Hall W5 · Booth C42" — the event on one small line. */
function eventLine(r: R, withDates = false) {
  return [r.event, withDates ? r.dates : "", r.booth].filter(Boolean).join("  ·  ");
}

/** The front's QR codes between the person and the foot. */
function Codes({ r, top, bottom, x, w, align, fill, max = 18 }: { r: R; top: number; bottom: number; x: number; w: number; align: Zone["align"]; fill: string; max?: number }) {
  if (!r.front.length || bottom - top < 8) return null;
  return <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={fill} max={max * r.u} zone={{ x, y: top, w, h: bottom - top, dir: "row", align }} />;
}

function Portrait({ v, r, box, round }: { v: TemplateValues; r: R; box: { x: number; y: number; w: number; h: number }; round: boolean }) {
  const radius = round ? box.w / 2 : 2 * r.u;
  return (
    <>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} fill={INK} />
      {r.photo
        ? <Photo href={r.photo} box={box} radius={radius} tone={v.bw === false ? "muted" : "bw"} zoom={num(v, "photoZoom", 100) / 100}
            px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={false} uid={`${r.uid}-p`} />
        : <PhotoPlaceholder box={box} label="Photo" font={r.font} />}
    </>
  );
}

/* ── the ten fronts ────────────────────────────────────────────────────── */

function front(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isEvbPremium(v)) return drawEvbPremium(v, ctx);
  const r = read(v, ctx);
  const { b, w, h, W, H, u } = r;
  const cx = b + w / 2;
  const start = r.rtl ? b + w - 7 * u : b + 7 * u;
  const style = styleOf(v);

  switch (style) {
    case "black":
    case "silver": {
      /* All black: the white logo on top, the name white — or silver foil. */
      const silver = style === "silver";
      const role = RoleBand({ r, x: 0, w: W, dark: true });
      const lw = 0.4 * w;
      const top = b + 14 * u;
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const p = Centred({ r, x: cx, width: w - 12 * u, align: "middle", ink: WHITE, sub: GREY_ON_INK, max: 10 * u, min: 6.5 * u, nameFill: silver ? `url(#${r.uid}-silver)` : undefined, weight: silver ? 600 : 700 },
        top + logoHeight(lw) + (silver ? 16 : 12) * u, evY - 10 * u);
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={INK} />
          {silver ? <defs><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}</linearGradient></defs> : null}
          <Logo x={cx - lw / 2} y={top} width={lw} fill={WHITE} />
          {silver ? <rect x={cx - 6 * u} y={top + logoHeight(lw) + 10 * u} width={12 * u} height={0.35} fill={`url(#${r.uid}-silver)`} /> : null}
          {p.node}
          <Codes r={r} top={p.bottom + 5 * u} bottom={evY - 5 * u} x={b + 6 * u} w={w - 12 * u} align="center" fill={GREY_ON_INK} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={silver ? LIGHT_ON_INK : GREY_ON_INK} max={w - 12 * u} spacing={0.2 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "photo": {
      /* The band, a portrait on its edge ringed in white, the name below. */
      const band = b + 0.3 * h;
      const lw = 0.36 * w;
      const d = 0.42 * w;
      const box = { x: cx - d / 2, y: band - d * 0.35, w: d, h: d };
      /* the logo between the lanyard slot (the top 11 mm) and the portrait */
      const logoY = (b + 11 * u + box.y - 1.2 * u) / 2 - logoHeight(lw) / 2;
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const p = Person({ r, x: cx, y: box.y + d + 6 * u, width: w - 12 * u, align: "middle", ink: INK, sub: GREY_ON_WHITE, max: 9 * u, min: 6 * u });
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const round = v.photoShape !== "rounded";
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={band} fill={INK} />
          <Logo x={cx - lw / 2} y={logoY} width={lw} fill={WHITE} />
          <rect x={box.x - 1.2 * u} y={box.y - 1.2 * u} width={d + 2.4 * u} height={d + 2.4 * u} rx={round ? (d + 2.4 * u) / 2 : 3 * u} fill={WHITE} />
          <Portrait v={v} r={r} box={box} round={round} />
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={evY - 4 * u} x={b + 6 * u} w={w - 12 * u} align="center" fill={GREY_ON_WHITE} max={14} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} max={w - 12 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "big-name": {
      /* The first name as the headline, the rest of the name under it —
         read from across the hall. */
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const parts = r.name.split(/\s+/).filter(Boolean);
      const first = parts[0] ?? "";
      const rest = parts.slice(1).join(" ");
      const width = w - 14 * u;
      const anchor = "start";
      const fs = Math.min(18 * u * r.k, (18 * u * r.k * width) / Math.max(1, textWidth(first, 18 * u * r.k, 800, r.font)));
      let y = b + 0.4 * h;
      const nodes: ReactNode[] = [];
      if (first) { nodes.push(<Txt key="f" r={r} x={start} y={y} size={fs} fill={INK} weight={800} anchor={anchor} max={width} spacing={-0.02 * fs}>{first}</Txt>); }
      if (rest) { y += 7.2 * u * r.k; nodes.push(<Txt key="l" r={r} x={start} y={y} size={6.2 * u * r.k} fill={INK} weight={400} anchor={anchor} max={width}>{rest}</Txt>); }
      const sub: Array<[string, number, string, number?]> = [[r.name2 && r.name2 !== r.name ? r.name2 : "", 4.6 * u, INK], [r.title, 4.2 * u, GREY_ON_WHITE], [r.company, 3.3 * u, GREY_ON_WHITE]];
      y += 4 * u;
      nodes.push(<rect key="rule" x={r.rtl ? start - 10 * u : start} y={y} width={10 * u} height={0.6 * u} fill={INK} />);
      y += 2 * u;
      for (const [text, s, fill] of sub) { if (!text) continue; y += s * 1.5; nodes.push(<Txt key={text} r={r} x={start} y={y} size={s} fill={fill} anchor={anchor} max={width}>{text}</Txt>); }
      if (r.langs) { y += 3.0 * u * 2.2; nodes.push(<Txt key="lg" r={r} x={start} y={y} size={3.0 * u} fill={GREY_ON_WHITE} anchor={anchor} max={width} spacing={0.35 * u}>{r.langs}</Txt>); }
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const lw = 0.3 * w;
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <Logo x={r.rtl ? b + w - 7 * u - lw : b + 7 * u} y={b + 12 * u} width={lw} fill={INK} />
          {nodes}
          <Codes r={r} top={y + 5 * u} bottom={evY - 4 * u} x={b + 7 * u} w={w - 14 * u} align={r.rtl ? "start" : "end"} fill={GREY_ON_WHITE} max={16} />
          {ev ? <Txt r={r} x={start} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} anchor={anchor} max={width}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "event": {
      /* The event leads: the context header (ch. 43) — logo | event — and
         the dates on black; the person; the booth at the foot. */
      const head = b + 0.3 * h;
      const lw = 0.34 * w;
      const lh = logoHeight(lw);
      const ev = r.event || "EVENT";
      const es = 0.9 * lh;
      const evW = Math.min(w - 16 * u - lw - 2 * lh, textWidth(ev, es, 400, r.font));
      const total = lw + 2 * lh + evW;
      const x0 = cx - total / 2;
      const hy = b + 0.3 * h * 0.42;
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const boothY = role.top - 6 * u;
      const p = Centred({ r, x: cx, width: w - 12 * u, align: "middle", ink: INK, sub: GREY_ON_WHITE, max: 10 * u, min: 6.5 * u }, head + 8 * u, boothY - 12 * u);
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={head} fill={INK} />
          <Logo x={x0} y={hy - lh / 2} width={lw} fill={WHITE} />
          <rect x={x0 + lw + lh} y={hy - lh / 2} width={0.3} height={lh} fill={WHITE} />
          <Txt r={r} x={x0 + lw + 2 * lh} y={hy + es * 0.36} size={es} fill={WHITE} anchor="start" max={evW} dirOf="ltr">{ev}</Txt>
          {r.dates ? <Txt r={r} x={cx} y={hy + lh + 6 * u} size={3.2 * u} fill={LIGHT_ON_INK} weight={300} max={w - 12 * u} spacing={0.15 * u}>{r.dates}</Txt> : null}
          {p.node}
          <Codes r={r} top={p.bottom + 5 * u} bottom={boothY - 6 * u} x={b + 6 * u} w={w - 12 * u} align="center" fill={GREY_ON_WHITE} max={16} />
          {r.booth ? <Txt r={r} x={cx} y={boothY} size={4.2 * u} fill={INK} weight={700} max={w - 12 * u}>{r.booth}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "dots": {
      /* The dots field (ch. 57) across the top, the logo on its clear panel. */
      const head = b + 0.36 * h;
      const lw = 0.44 * w;
      const lh = logoHeight(lw);
      const ly = b + 0.36 * h * 0.5 - lh / 2;
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const p = Centred({ r, x: cx, width: w - 12 * u, align: "middle", ink: INK, sub: GREY_ON_WHITE, max: 9.5 * u, min: 6 * u }, head + 8 * u, evY - 10 * u);
      const px = lw / 2 + lh * 1.1, py = lh * 1.1;
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={head} fill={INK} />
          <Dots area={{ x: 0, y: 0, w: W, h: head }} pitch={2.2 * u} r={0.4 * u} fill="#4D4D50" origin={{ x: cx, y: ly + lh / 2 }} uid={`${r.uid}-d`} />
          <rect x={cx - px} y={ly + lh / 2 - py - lh / 2} width={px * 2} height={py * 2 + lh} fill={INK} />
          <Logo x={cx - lw / 2} y={ly} width={lw} fill={WHITE} />
          {p.node}
          <Codes r={r} top={p.bottom + 5 * u} bottom={evY - 4 * u} x={b + 6 * u} w={w - 12 * u} align="center" fill={GREY_ON_WHITE} max={16} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} max={w - 12 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "split": {
      /* Two tones: the name white on the black half, the rest on white. */
      const mid = b + 0.56 * h;
      const width = w - 14 * u;
      const nf = nameFit(r, r.name, 10.5 * u * r.k, 7 * u * r.k, width);
      const nameBottom = mid - 7 * u;
      const lines = nf.lines;
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const lw = 0.28 * w;
      let y = mid + 9 * u;
      const lower: ReactNode[] = [];
      for (const [text, s, fill, weight] of [[r.name2 && r.name2 !== r.name ? r.name2 : "", 4.6 * u, INK, 400], [r.title, 4.2 * u, INK, 600], [r.company, 3.3 * u, GREY_ON_WHITE, 400], [r.langs, 3.0 * u, GREY_ON_WHITE, 400]] as Array<[string, number, string, number]>) {
        if (!text) continue;
        lower.push(<Txt key={text} r={r} x={start} y={y} size={s} fill={fill} weight={weight} anchor="start" max={width} spacing={text === r.langs ? 0.3 * u : undefined}>{text}</Txt>);
        y += s * 1.75;
      }
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={mid} fill={INK} />
          <Logo x={r.rtl ? b + w - 7 * u - lw : b + 7 * u} y={b + 11 * u} width={lw} fill={WHITE} />
          {lines.map((l, i) => (
            <Txt key={l} r={r} x={start} y={nameBottom - (lines.length - 1 - i) * nf.size * 1.08} size={nf.size} fill={WHITE} weight={700} anchor="start" max={width}>{l}</Txt>
          ))}
          {lower}
          <Codes r={r} top={y} bottom={evY - 4 * u} x={b + 7 * u} w={w - 14 * u} align={r.rtl ? "start" : "end"} fill={GREY_ON_WHITE} max={15} />
          {ev ? <Txt r={r} x={start} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} anchor="start" max={width}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }

    case "minimal": {
      /* White and Swiss: the logo and the role on the top line, the name
         low and large, a hairline, the event at the foot. */
      const width = w - 14 * u;
      const lw = 0.3 * w;
      const nf = nameFit(r, r.name, 10 * u * r.k, 6.5 * u * r.k, width);
      let y = b + 0.5 * h;
      const nodes: ReactNode[] = nf.lines.map((l, i) => <Txt key={l} r={r} x={start} y={y + i * nf.size * 1.08} size={nf.size} fill={INK} weight={700} anchor="start" max={width}>{l}</Txt>);
      y += (nf.lines.length - 1) * nf.size * 1.08;
      for (const [text, s, fill] of [[r.name2 && r.name2 !== r.name ? r.name2 : "", 4.6 * u, INK], [r.title, 4.2 * u, GREY_ON_WHITE], [r.company, 3.3 * u, GREY_ON_WHITE]] as Array<[string, number, string]>) {
        if (!text) continue;
        y += s * 1.6;
        nodes.push(<Txt key={text} r={r} x={start} y={y} size={s} fill={fill} anchor="start" max={width}>{text}</Txt>);
      }
      const ruleY = y + 5 * u;
      const ev = eventLine(r, true);
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <Logo x={r.rtl ? b + w - 7 * u - lw : b + 7 * u} y={b + 12 * u} width={lw} fill={INK} />
          {r.role ? <Txt r={r} x={r.rtl ? b + 7 * u : b + w - 7 * u} y={b + 12 * u + logoHeight(lw) * 0.82} size={3 * u} fill={INK} weight={700} anchor="end" spacing={0.9 * u} dirOf="ltr">{r.role}</Txt> : null}
          {nodes}
          <rect x={b + 7 * u} y={ruleY} width={w - 14 * u} height={0.25} fill={HAIRLINE_ON_WHITE} />
          {r.langs ? <Txt r={r} x={start} y={ruleY + 6.5 * u} size={3.0 * u} fill={GREY_ON_WHITE} anchor="start" max={width} spacing={0.35 * u}>{r.langs}</Txt> : null}
          <Codes r={r} top={ruleY + 9 * u} bottom={b + h - 14 * u} x={b + 7 * u} w={w - 14 * u} align={r.rtl ? "start" : "end"} fill={GREY_ON_WHITE} max={16} />
          {ev ? <Txt r={r} x={start} y={b + h - 8 * u} size={2.9 * u} fill={INK} anchor="start" max={width}>{ev}</Txt> : null}
        </>
      );
    }

    case "landscape": {
      /* 120 × 86: the black panel with the logo and the role, the person on
         white. */
      /* the panel on the start side: left, or right in Arabic */
      const panel = b + 0.34 * w;
      const colW = w - 0.34 * w - 16 * u;
      const colX = r.rtl ? b + 8 * u : panel + 8 * u;
      const lw = 0.34 * w - 14 * u;
      const pStart = r.rtl ? colX + colW : colX;
      const p = Centred({ r, x: pStart, width: colW, align: "start", ink: INK, sub: GREY_ON_WHITE, max: 10 * u, min: 6.5 * u }, b + 10 * u, b + h - 18 * u);
      const ev = eventLine(r);
      const panelX = r.rtl ? b + w - 0.34 * w : 0;
      const panelW = r.rtl ? W - panelX : panel;
      const pcx = panelX + panelW / 2;
      const rs = 3.6 * r.u;
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={panelX} y={0} width={panelW} height={H} fill={INK} />
          <Logo x={pcx - lw / 2} y={b + h / 2 - logoHeight(lw) / 2 - (r.role ? 4 * u : 0)} width={lw} fill={WHITE} />
          {r.role ? <Txt r={r} x={pcx} y={b + h / 2 + 8 * u} size={rs} fill={r.roleColour === "blue" ? "#7FA9D6" : WHITE} weight={700} max={panelW - 8 * u} spacing={rs * 0.28} dirOf="ltr">{r.role}</Txt> : null}
          {p.node}
          <Codes r={r} top={p.bottom + 4 * u} bottom={b + h - 12 * u} x={colX} w={colW} align={r.rtl ? "start" : "end"} fill={GREY_ON_WHITE} max={16} />
          {ev ? <Txt r={r} x={pStart} y={b + h - 7 * u} size={2.9 * u} fill={GREY_ON_WHITE} anchor="start" max={colW}>{ev}</Txt> : null}
        </>
      );
    }

    default: {
      /* The book (ch. 115): the black band with the white logo, the name
         large, the title, the languages; the role at the foot. */
      const band = b + 0.26 * h;
      const lw = 0.47 * w;
      const role = RoleBand({ r, x: 0, w: W, dark: false });
      const ev = eventLine(r);
      const evY = role.top - 5 * u;
      const p = Centred({ r, x: cx, width: w - 12 * u, align: "middle", ink: INK, sub: GREY_ON_WHITE, max: 10 * u, min: 6.5 * u }, band + 8 * u, evY - 10 * u);
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={WHITE} />
          <rect x={0} y={0} width={W} height={band} fill={INK} />
          <Logo x={cx - lw / 2} y={b + (0.26 * h - logoHeight(lw)) / 2 + 2 * u} width={lw} fill={WHITE} />
          {p.node}
          <Codes r={r} top={p.bottom + 5 * u} bottom={evY - 4 * u} x={b + 6 * u} w={w - 12 * u} align="center" fill={GREY_ON_WHITE} max={16} />
          {ev ? <Txt r={r} x={cx} y={evY} size={2.9 * u} fill={GREY_ON_WHITE} max={w - 12 * u}>{ev}</Txt> : null}
          {role.node}
        </>
      );
    }
  }
}

/* ── the back ──────────────────────────────────────────────────────────── */

/** "Same as the front" (a badge turns on its lanyard), or the event: the
 *  logo, the event, the dates, the booth, the back's QR codes, the site. */
function back(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (v.backMode !== "info") return front(v, ctx);
  const r = read(v, ctx);
  const { b, w, h, W, H, u } = r;
  const cx = b + w / 2;
  const dark = styleOf(v) === "black" || styleOf(v) === "silver" || evbPremiumDark(v);
  const ink = dark ? WHITE : INK, sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
  const lw = 0.44 * Math.min(w, h * 0.8);
  let y = b + 14 * u + logoHeight(lw);
  const nodes: ReactNode[] = [];
  for (const [text, s, fill, weight] of [[r.event, 6 * u, ink, 700], [r.dates, 3.6 * u, sub, 300], [r.booth, 4.4 * u, ink, 600]] as Array<[string, number, string, number]>) {
    if (!text) continue;
    y += s * 2;
    nodes.push(<Txt key={text} r={r} x={cx} y={y} size={s} fill={fill} weight={weight} max={w - 12 * u}>{text}</Txt>);
  }
  const zone: Zone = { x: b + 8 * u, y: y + 8 * u, w: w - 16 * u, h: Math.max(8, b + h - 16 * u - (y + 8 * u)), dir: "row", align: "center" };
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={dark ? INK : WHITE} />
      <Logo x={cx - lw / 2} y={b + 14 * u} width={lw} fill={ink} />
      {nodes}
      <QrZone items={r.back} codes={r.codes} font={r.font} captionFill={sub} max={28 * u} zone={zone} />
      <Txt r={r} x={cx} y={b + h - 8 * u} size={3 * u} fill={sub} spacing={0.3 * u} dirOf="ltr">{KOLEEX_COMPANY.web}</Txt>
    </>
  );
}

/* ── the template ──────────────────────────────────────────────────────── */

function qrRequests(v: TemplateValues): QrRequest[] {
  const out: QrRequest[] = [];
  for (const q of qrsOf(v) as QrItem[]) {
    if (isPictureQr(q)) continue;
    let text: string | null = null;
    if (q.kind === "web") text = `https://${KOLEEX_COMPANY.web}`;
    else if (q.kind === "link") text = q.link.trim() || null;
    else if (q.kind === "staff") text = str(v, "staffNo") || null;
    else if (q.kind === "contact" && str(v, "name")) {
      /* Name, title, company, work email — never a personal phone (ch. 115). */
      text = ["BEGIN:VCARD", "VERSION:3.0", `FN:${str(v, "name")}`, `ORG:${EVERYDAY_NAME_EN}`, str(v, "title") ? `TITLE:${str(v, "title")}` : "",
        str(v, "email") ? `EMAIL;TYPE=WORK:${str(v, "email")}` : "", `URL:https://${KOLEEX_COMPANY.web}`, "END:VCARD"].filter(Boolean).join("\n");
    }
    if (text) out.push({ id: q.id, text, level: q.logo ? "H" : "M" });
  }
  return out;
}

function fromPerson(p: BcPerson, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  return {
    name: nameIn(p, lang), title: titleOf(p, lang), titleKey: p.title ?? "", email: p.email ?? "", staffNo: p.staffNo ?? "",
    ...(typeof v.photo === "string" && v.photo.startsWith("data:") ? {} : { photo: p.photo ?? "" }),
  };
}

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));
const hasPhoto = (v: TemplateValues) => isStyle("photo")(v) && !!str(v, "photo");

export const eventBadge: TemplateDef = {
  id: "event-badge",
  itemKey: "event-papers",
  nameKey: "evb.name",
  size: (v) => {
    const s = SIZES[typeof v.size === "string" ? v.size : ""] ?? SIZES["86x120"];
    return styleOf(v) === "landscape" ? { w: s.h, h: s.w } : s;
  },
  bleed: 3,
  safe: 4,
  fields: [
    { key: "style", kind: "choice", labelKey: "tpl.f.style", group: "look", options: EVB_STYLES.map((s) => ({ value: s, labelKey: `evb.style.${s}` })) },
    { key: "size", kind: "choice", labelKey: "tpl.f.size", group: "look", options: [
      { value: "86x120", labelKey: "evb.size.86x120" }, { value: "100x140", labelKey: "evb.size.100x140" }, { value: "105x148", labelKey: "evb.size.105x148" },
    ] },
    { key: "lang", kind: "choice", labelKey: "evb.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "font", kind: "choice", labelKey: "tpl.f.font", group: "look", options: [
      { value: "inter", labelKey: "tpl.font.inter" }, { value: "helvetica", labelKey: "tpl.font.helvetica" },
    ] },
    { key: "scale", kind: "range", labelKey: "evb.f.scale", group: "look", min: 70, max: 130, step: 5, unit: "%" },
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(), when: (v) => ["p-monolith", "p-underprint"].includes(String(v.style)) },

    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 40 },
    { key: "name2", kind: "text", labelKey: "evb.f.name2", group: "person", max: 40, hintKey: "evb.f.name2Hint" },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "companyOn", kind: "switch", labelKey: "evb.f.companyOn", group: "person" },
    { key: "company", kind: "text", labelKey: "tpl.f.company", group: "person", max: 60, when: (v) => v.companyOn !== false },
    { key: "langs", kind: "text", labelKey: "evb.f.langs", group: "person", max: 60, placeholder: "EN · العربية · 中文", hintKey: "evb.f.langsHint" },

    { key: "role", kind: "text", labelKey: "evb.f.role", group: "event", max: 20, hintKey: "evb.f.roleHint" },
    { key: "roleColor", kind: "choice", labelKey: "evb.f.roleColor", group: "event", options: ROLE_COLOURS.map((c) => ({ value: c, labelKey: `evb.role.${c}` })) },
    { key: "event", kind: "text", labelKey: "evb.f.event", group: "event", max: 40, placeholder: "CISMA 2025" },
    { key: "dates", kind: "text", labelKey: "evb.f.dates", group: "event", max: 40, placeholder: "24–27 September 2025" },
    { key: "booth", kind: "text", labelKey: "evb.f.booth", group: "event", max: 40, placeholder: "Hall W5 · Booth C42" },

    { key: "photo", kind: "image", labelKey: "tpl.f.photo", group: "photo", hintKey: "tpl.f.badgePhotoHint", fromPerson: "photo", when: isStyle("photo") },
    { key: "photoShape", kind: "choice", labelKey: "sig.f.photoShape", group: "photo", when: isStyle("photo"), options: [
      { value: "circle", labelKey: "sig.shape.circle" }, { value: "rounded", labelKey: "sig.shape.rounded" },
    ] },
    { key: "photoZoom", kind: "range", labelKey: "tpl.f.photoZoom", group: "photo", min: 100, max: 300, step: 5, unit: "%", when: hasPhoto },
    { key: "photoX", kind: "range", labelKey: "tpl.f.photoX", group: "photo", min: -100, max: 100, step: 2, when: hasPhoto },
    { key: "photoY", kind: "range", labelKey: "tpl.f.photoY", group: "photo", min: -100, max: 100, step: 2, when: hasPhoto },
    { key: "bw", kind: "switch", labelKey: "tpl.f.bw", group: "photo", when: isStyle("photo") },

    { key: "backMode", kind: "choice", labelKey: "evb.f.backMode", group: "back", options: [
      { value: "same", labelKey: "evb.back.same" }, { value: "info", labelKey: "evb.back.info" }, { value: "none", labelKey: "evb.back.none" },
    ] },
    { key: "qrs", kind: "qrs", labelKey: "tpl.f.qrs", group: "qr", langKey: "lang" },
  ],
  defaults: {
    style: "book", size: "86x120", lang: "en", font: "inter", scale: 100, pattern: "scan-edge",
    name: "", name2: "", title: "", titleKey: "", email: "", staffNo: "", companyOn: true, company: EVERYDAY_NAME_EN, langs: "",
    role: "", roleColor: "black", event: "", dates: "", booth: "",
    photo: "", photoShape: "circle", photoZoom: 100, photoX: 0, photoY: 0, bw: true,
    backMode: "same",
    qrs: [] as TemplateItem[],
  },
  pages: [{ id: "front", draw: front }, { id: "back", draw: back }],
  pagesFor: (v) => (v.backMode === "none" ? ["front"] : ["front", "back"]),
  qrRequests,
  fromPerson,
  specKeys: (v) => ["evb.spec.paper", "evb.spec.slot", "evb.spec.read", "evb.spec.never", ...(v.backMode === "same" ? ["evb.spec.back"] : [])],
  fillName: (v, t) => t(`evb.style.${styleOf(v)}`),
  forSaving: (v, keepPerson) => ({
    ...v, photo: "", qrs: list(v, "qrs").map((q) => ({ ...q, image: "" })),
    ...(keepPerson ? {} : { name: "", name2: "", title: "", titleKey: "", email: "", staffNo: "", langs: "" }),
  }),
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (isStyle("photo")(v) && !str(v, "photo")) return "studio.needPhoto";
    for (const q of qrsOf(v)) {
      if (q.kind === "link" && !q.link.trim()) return "studio.needQrLink";
      if (isPictureQr(q) && !q.image) return "studio.needQrImage";
    }
    return null;
  },
};
