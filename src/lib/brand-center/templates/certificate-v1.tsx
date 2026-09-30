/* ---------------------------------------------------------------------------
   Certificates — the first set of designs (plan step C13, 30/09/2026),
   kept beside the redesign at the owner's word: "keep the old designs
   also". Eight styles: the book's, a fine frame, the black card, a black
   band, a side panel, dots, minimal and award — their drawing exactly as
   first shipped (commit 1e91bd660). The words, kinds, fields and checks
   are the certificate template's own (certificate.tsx).
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { EVERYDAY_NAME_EN, legalNameEn } from "@/lib/legal-name";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import type { DrawContext, TemplateValues } from "./types";
import { asLang, fontOf, num, qrsOf, rowsOf, str } from "./card/model";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, INK, Logo, QrZone, WHITE, fit, logoHeight, textWidth, wrap, wrapBalanced } from "./card/parts";
import { LABELS, PLACEHOLDER, SILVER, issued } from "./certificate-common";

/** The first set's style keys; three carry "-1" where the redesign reused
 *  the name. */
export const V1_STYLES = ["book", "frame", "black-1", "band", "side", "dots-1", "minimal", "award-1"] as const;
type V1 = "book" | "frame" | "black" | "band" | "side" | "dots" | "minimal" | "award";
const v1Style = (v: TemplateValues): V1 => {
  const s = String(v.style).replace(/-1$/, "");
  return (["book", "frame", "black", "band", "side", "dots", "minimal", "award"] as const).includes(s as V1) ? (s as V1) : "book";
};

/* ── reading the fill ──────────────────────────────────────────────────── */

function read(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const w = ctx.w, h = ctx.h;
  const foot = v.foot === "none" ? "none" : v.foot === "everyday" ? "everyday" : "legal";
  return {
    b: ctx.bleed, w, h, W: w + ctx.bleed * 2, H: h + ctx.bleed * 2, tall: h > w,
    /** mm per mm of an A4's short side: everything grows with the paper */
    u: Math.min(w, h) / 210,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    heading: str(v, "heading"), pre: str(v, "pre"), name: str(v, "name") || PLACEHOLDER[lang], name2: str(v, "name2"), org: str(v, "org"),
    statement: str(v, "statement"),
    facts: rowsOf(v, "facts").filter((f) => f.on && f.value.trim()),
    date: str(v, "date"), number: str(v, "number"),
    sigs: [
      { name: str(v, "sig1Name"), role: str(v, "sig1Role"), image: str(v, "sig1Image") },
      ...(v.sig2On === false ? [] : [{ name: str(v, "sig2Name"), role: str(v, "sig2Role"), image: str(v, "sig2Image") }]),
    ],
    /* No seal around the logo (owner, 01/10/2026 — book ch. 40): a fill
       saved with the silver seal reads without it; the printer's dry-seal
       note stays. */
    seal: v.seal === "emboss" ? "emboss" : "none",
    foot, footName: foot === "legal" ? legalNameEn(issued(v)) : EVERYDAY_NAME_EN,
    qrs: qrsOf(v),
  };
}
type R = ReturnType<typeof read>;

/* ── type ──────────────────────────────────────────────────────────────── */

function Txt({ r, x, y, size, children, fill, weight = 400, anchor = "middle", max, spacing, ltr }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number;
  anchor?: "start" | "middle" | "end"; max?: number; spacing?: number; ltr?: boolean;
}) {
  /* letter-spacing would break the joins of Arabic letters */
  const spaced = spacing && !ARABIC.test(children) ? spacing : undefined;
  return (
    <text x={x} y={y} textAnchor={anchor} direction={ltr ? "ltr" : r.rtl ? "rtl" : "ltr"} fill={fill}
      {...(max ? fit(children, size, max, weight, r.font) : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: spaced, unicodeBidi: "plaintext", fontVariantNumeric: "tabular-nums" }}>{children}</text>
  );
}
/** Capitals with air — the heading and every small label. Chinese and
 *  Arabic keep their own shapes. */
const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());

interface Look { ink: string; sub: string; faint: string; nameFill?: string; accent: string; silverDefs?: boolean }

/** The body: the heading, the words before the name, the name (as large as
 *  it fits), the name in its own script, the organisation, the statement,
 *  the facts. Measured first, then placed between `top` and `bottom`. */
function Body({ r, x, top, bottom, width, align, look }: { r: R; x: number; top: number; bottom: number; width: number; align: "middle" | "start"; look: Look }) {
  const u = r.u;
  const lay = (y0: number) => {
    const nodes: ReactNode[] = [];
    let y = y0;
    const anchor = align;
    if (r.heading) {
      const s = (NOT_LATIN.test(r.heading) ? 6.2 : 4.2) * u;
      y += s;
      nodes.push(<Txt key="h" r={r} x={x} y={y} size={s} fill={look.sub} weight={600} anchor={anchor} max={width} spacing={s * 0.32}>{caps(r.heading)}</Txt>);
      y += 9 * u;
    }
    if (r.pre) { const s = 4.4 * u; y += s; nodes.push(<Txt key="p" r={r} x={x} y={y} size={s} fill={look.sub} anchor={anchor} max={width}>{r.pre}</Txt>); y += 5 * u; }
    /* the name: one line up to 16 mm, two balanced lines below 10 mm */
    const max = 16 * u * r.k, min = 10 * u * r.k;
    const w1 = textWidth(r.name, max, 700, r.font);
    let size = max, lines = [r.name];
    if (w1 > width) {
      size = (max * width) / w1;
      if (size < min && /\s/.test(r.name)) { size = max * 0.8; lines = wrapBalanced(r.name, size, width, 700, r.font); const wd = Math.max(...lines.map((l) => textWidth(l, size, 700, r.font))); if (wd > width) size = (size * width) / wd; }
    }
    lines.forEach((l, i) => { y += i === 0 ? size * 0.9 : size * 1.1; nodes.push(<Txt key={`n${i}`} r={r} x={x} y={y} size={size} fill={look.nameFill ?? look.ink} weight={700} anchor={anchor} max={width}>{l}</Txt>); });
    if (r.name2 && r.name2 !== r.name) { const s = 6.5 * u; y += s * 1.5; nodes.push(<Txt key="n2" r={r} x={x} y={y} size={s} fill={look.ink} anchor={anchor} max={width}>{r.name2}</Txt>); }
    if (r.org) { const s = 5 * u; y += s * 1.6; nodes.push(<Txt key="o" r={r} x={x} y={y} size={s} fill={look.ink} weight={500} anchor={anchor} max={width}>{r.org}</Txt>); }
    if (r.statement) {
      const s = 4.6 * u;
      const sw = Math.min(width, (r.tall ? 0.86 : 0.64) * r.w);
      y += 7 * u;
      wrap(r.statement, s, sw, 3, 400, r.font).forEach((l, i) => { y += i === 0 ? s : s * 1.45; nodes.push(<Txt key={`s${i}`} r={r} x={x} y={y} size={s} fill={look.sub} anchor={anchor} max={sw}>{l}</Txt>); });
    }
    if (r.facts.length) {
      y += 11 * u;
      const f = Facts({ r, x, y, width, align, look });
      nodes.push(<g key="facts">{f.node}</g>);
      y = f.bottom;
    }
    return { nodes, bottom: y };
  };
  const probe = lay(0).bottom;
  const y0 = top + Math.max(0, (bottom - top - probe) * 0.5);
  const done = lay(y0);
  return { node: <g>{done.nodes}</g>, bottom: done.bottom };
}

/** The facts: small capitals over the values, in columns; two rows when
 *  they do not fit across. */
function Facts({ r, x, y, width, align, look }: { r: R; x: number; y: number; width: number; align: "middle" | "start"; look: Look }) {
  const u = r.u;
  const ls = 2.7 * u, vs = 4.2 * u, gap = 12 * u;
  const cells = r.facts.map((f) => ({ label: caps(f.label.trim()), value: f.value.trim(), w: 0 }));
  for (const c of cells) c.w = Math.max(textWidth(c.label, ls, 600, r.font) + c.label.length * ls * 0.18, textWidth(c.value, vs, 500, r.font), 18 * u);
  const rows: (typeof cells)[] = [];
  let cur: typeof cells = [], used = 0;
  for (const c of cells) {
    if (cur.length && used + gap + c.w > width) { rows.push(cur); cur = []; used = 0; }
    used += (cur.length ? gap : 0) + c.w; cur.push(c);
  }
  if (cur.length) rows.push(cur);
  const nodes: ReactNode[] = [];
  let yy = y;
  rows.forEach((row, ri) => {
    const total = row.reduce((a, c) => a + c.w, 0) + gap * (row.length - 1);
    let cx = align === "middle" ? x - total / 2 : r.rtl ? x - total : x;
    const ordered = r.rtl ? [...row].reverse() : row;
    for (const c of ordered) {
      const mid = cx + c.w / 2;
      const anchor = align === "middle" ? "middle" : r.rtl ? "end" : "start";
      const tx = align === "middle" ? mid : r.rtl ? cx + c.w : cx;
      nodes.push(
        <g key={`${ri}-${c.label}`}>
          <Txt r={r} x={tx} y={yy + ls} size={ls} fill={look.faint} weight={600} anchor={anchor} max={c.w} spacing={ls * 0.18}>{c.label}</Txt>
          <Txt r={r} x={tx} y={yy + ls + 2.2 * u + vs} size={vs} fill={look.ink} weight={500} anchor={anchor} max={c.w}>{c.value}</Txt>
        </g>,
      );
      cx += c.w + gap;
    }
    yy += ls + 2.2 * u + vs + (ri < rows.length - 1 ? 7 * u : 0);
  });
  return { node: <g>{nodes}</g>, bottom: yy };
}

/** The signatures, the date and the number on one line: the value (or a
 *  scanned signature) over a rule, the label under it. */
function SignRow({ r, x0, x1, y, look, align = "middle" }: { r: R; x0: number; x1: number; y: number; look: Look; align?: "middle" | "start" }) {
  const u = r.u;
  const L = LABELS[r.lang];
  type Block = { key: string; value?: string; image?: string; label: string; name?: string; strong?: boolean };
  const blocks: Block[] = [
    ...r.sigs.map((s, i) => ({ key: `sig${i}`, image: s.image, name: s.name, label: s.role, strong: true })),
    { key: "date", value: r.date, label: L.date },
    { key: "no", value: r.number, label: L.number },
  ];
  const n = blocks.length;
  const bw = Math.min(60 * u, ((x1 - x0) - (n - 1) * 10 * u) / n);
  const span = align === "middle" ? x1 - x0 : n * bw + (n - 1) * 12 * u;
  const step = n > 1 ? (span - bw) / (n - 1) : 0;
  const ordered = r.rtl ? [...blocks].reverse() : blocks;
  const start = align === "middle" ? x0 : r.rtl ? x1 - span : x0;
  return (
    <g>
      {ordered.map((bk, i) => {
        const bx = start + i * step;
        const cx = bx + bw / 2;
        return (
          <g key={bk.key}>
            {bk.image ? <image href={bk.image} x={bx + 4 * u} y={y - 17 * u} width={bw - 8 * u} height={15.5 * u} preserveAspectRatio="xMidYMax meet" /> : null}
            {bk.value ? <Txt r={r} x={cx} y={y - 2 * u} size={4 * u} fill={look.ink} weight={500} max={bw} ltr>{bk.value}</Txt> : null}
            <rect x={bx} y={y} width={bw} height={bk.strong ? 0.3 : 0.2} fill={bk.strong ? look.ink : look.faint} />
            {bk.name ? <Txt r={r} x={cx} y={y + 5.2 * u} size={3.6 * u} fill={look.ink} weight={600} max={bw}>{bk.name}</Txt> : null}
            {bk.label ? <Txt r={r} x={cx} y={y + (bk.name ? 9.8 * u : 5.2 * u)} size={3 * u} fill={look.sub} max={bw}>{bk.label}</Txt> : null}
          </g>
        );
      })}
    </g>
  );
}

/** A silver foil seal: the group's name around the rim, the logo inside. */
function Seal({ r, cx, cy, rad, dark }: { r: R; cx: number; cy: number; rad: number; dark: boolean }) {
  if (r.seal !== "silver") return null;
  const id = `${r.uid}-seal`;
  const rt = rad * 0.76;
  const ring = `M ${cx - rt} ${cy} a ${rt} ${rt} 0 1 1 ${rt * 2} 0 a ${rt} ${rt} 0 1 1 ${-rt * 2} 0`;
  const lw = rad * 0.92;
  const words = `${KOLEEX_COMPANY.tagline.replace(/\.$/, "")}  ·  KOLEEX INTERNATIONAL GROUP  ·  `;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient>
        <path id={`${id}-p`} d={ring} />
      </defs>
      <circle cx={cx} cy={cy} r={rad} fill={`url(#${id}-g)`} />
      <circle cx={cx} cy={cy} r={rad * 0.95} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
      <circle cx={cx} cy={cy} r={rad * 0.58} fill={dark ? INK : WHITE} stroke="#8E8E93" strokeWidth={0.2} />
      <text fill="#3A3A3C" style={{ fontFamily: r.font, fontSize: rad * 0.13, fontWeight: 600, letterSpacing: rad * 0.02 }}>
        <textPath href={`#${id}-p`} textLength={2 * Math.PI * rt * 0.98} lengthAdjust="spacing">{words}</textPath>
      </text>
      <Logo x={cx - lw / 2} y={cy - logoHeight(lw) / 2} width={lw} fill={dark ? WHITE : INK} />
    </g>
  );
}

/** The foot: the black strip with the legal name (English and Chinese) and
 *  the grey tagline — the house strips of every Koleex document — or the
 *  everyday name. Returns its top. */
function Foot({ r, dark }: { r: R; dark: boolean }) {
  const u = r.u;
  if (r.foot === "none") return { node: null as ReactNode, top: r.b + r.h };
  const s = 2.9 * u;
  if (dark) {
    /* inside the black card's silver frame (10 mm in) */
    const top = r.b + r.h - 26 * u;
    return {
      top,
      node: (
        <g>
          <rect x={r.b + 30 * u} y={top} width={r.w - 60 * u} height={0.2} fill="#48484A" />
          <Txt r={r} x={r.b + r.w / 2} y={top + 6 * u} size={s} fill={GREY_ON_INK} weight={600} spacing={s * 0.06} ltr max={r.w - 40 * u}>
            {r.foot === "legal" ? `${r.footName}   ${KOLEEX_COMPANY.zh}` : r.footName}
          </Txt>
          <Txt r={r} x={r.b + r.w / 2} y={top + 10.5 * u} size={s * 0.9} fill="#636366" weight={600} spacing={s * 0.3} ltr>{KOLEEX_COMPANY.tagline}</Txt>
        </g>
      ),
    };
  }
  const bh = 8 * u, gh = 6 * u;
  const top = r.b + r.h - bh - gh;
  const pad = 14 * u;
  return {
    top,
    node: (
      <g>
        <rect x={0} y={top} width={r.W} height={bh} fill={INK} />
        {r.foot === "legal" ? (
          <>
            <Txt r={r} x={r.b + pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="start" spacing={s * 0.05} ltr max={r.w * 0.55}>{r.footName}</Txt>
            <Txt r={r} x={r.b + r.w - pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="end" ltr max={r.w * 0.38}>{KOLEEX_COMPANY.zh}</Txt>
          </>
        ) : (
          <>
            <Txt r={r} x={r.b + pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="start" spacing={s * 0.05} ltr>{r.footName}</Txt>
            <Txt r={r} x={r.b + r.w - pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} anchor="end" ltr>{KOLEEX_COMPANY.web}</Txt>
          </>
        )}
        <rect x={0} y={top + bh} width={r.W} height={r.H - top - bh} fill="#F5F5F7" />
        <Txt r={r} x={r.b + r.w / 2} y={top + bh + gh / 2 + s * 0.34} size={s * 0.9} fill={GREY_ON_WHITE} weight={600} spacing={s * 0.32} ltr>{KOLEEX_COMPANY.tagline}</Txt>
      </g>
    ),
  };
}

/** QR codes (a link to check the certificate, the website …) in a corner. */
function Codes({ r, x, y, size, look }: { r: R; x: number; y: number; size: number; look: Look }) {
  if (!r.qrs.length) return null;
  const n = r.qrs.length;
  return <QrZone items={r.qrs} codes={r.codes} font={r.font} captionFill={look.sub} max={size} zone={{ x, y, w: n * size + (n - 1) * 3 * r.u, h: size + 3 * r.u, dir: "row", align: "start" }} />;
}

/* ── the eight styles ──────────────────────────────────────────────────── */

const LIGHT: Look = { ink: INK, sub: GREY_ON_WHITE, faint: "#8E8E93", accent: INK };

export function pageV1(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, u, tall } = r;
  const cx = b + w / 2;
  const style = v1Style(v);
  const sealR = 17 * u;
  const qrSize = 18 * u;

  if (style === "black") {
    /* Black card, silver print: the white logo, silver heading and name. */
    const look: Look = { ink: WHITE, sub: "#AEAEB2", faint: "#8E8E93", nameFill: `url(#${r.uid}-silver)`, accent: WHITE };
    const foot = Foot({ r, dark: true });
    const lw = (tall ? 0.34 : 0.2) * w;
    const logoY = b + 22 * u;
    const signY = foot.top - 18 * u;
    const reserve = tall && r.seal === "silver" ? 2 * sealR + 22 * u : 26 * u;
    const body = Body({ r, x: cx, top: logoY + logoHeight(lw) + 12 * u, bottom: signY - reserve, width: w * 0.78, align: "middle", look });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={INK} />
        <defs><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient></defs>
        <rect x={b + 10 * u} y={b + 10 * u} width={w - 20 * u} height={h - 20 * u} fill="none" stroke={`url(#${r.uid}-silver)`} strokeWidth={0.35} />
        <Logo x={cx - lw / 2} y={logoY} width={lw} fill={WHITE} />
        {body.node}
        <SignRow r={r} x0={b + (tall ? 20 : 48) * u} x1={b + w - (tall ? 20 : 48) * u} y={signY} look={look} />
        <Seal r={r} cx={tall ? cx : b + w - 34 * u} cy={tall ? signY - 36 * u : b + 34 * u} rad={sealR} dark />
        <Codes r={r} x={b + 16 * u} y={b + 16 * u} size={qrSize} look={look} />
        {foot.node}
      </>
    );
  }

  if (style === "side" && !tall) {
    /* A black panel on the start side with the logo and the kind; the
       certificate left-aligned on white. */
    const pw = 0.3 * w;
    const panelX = r.rtl ? b + w - pw : 0;
    const panelW = r.rtl ? W - panelX : b + pw;
    const colX = r.rtl ? b + 16 * u : b + pw + 18 * u;
    const colW = w - pw - 34 * u;
    const start = r.rtl ? colX + colW : colX;
    const foot = Foot({ r, dark: false });
    const signY = foot.top - 24 * u;
    const lw = pw - 30 * u;
    const pcx = panelX + panelW / 2;
    const body = Body({ r, x: start, top: b + 18 * u, bottom: signY - 24 * u, width: colW, align: "start", look: LIGHT });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={WHITE} />
        <rect x={panelX} y={0} width={panelW} height={foot.top} fill={INK} />
        <Logo x={pcx - lw / 2} y={b + 24 * u} width={lw} fill={WHITE} />
        <Seal r={r} cx={pcx} cy={foot.top - 40 * u} rad={sealR} dark />
        {body.node}
        <SignRow r={r} x0={colX} x1={colX + colW} y={signY} look={LIGHT} align="start" />
        <Codes r={r} x={pcx - qrSize / 2} y={b + 24 * u + logoHeight(lw) + 16 * u} size={qrSize} look={{ ...LIGHT, sub: GREY_ON_INK }} />
        {foot.node}
      </>
    );
  }

  if (style === "minimal") {
    /* Swiss: the logo and the heading on the top line, the name large from
       the start edge, a hairline, the facts; signatures at the foot. */
    const m = 20 * u;
    const start = r.rtl ? b + w - m : b + m;
    const foot = Foot({ r, dark: false });
    const signY = foot.top - 22 * u;
    const lw = (tall ? 0.3 : 0.17) * w;
    const bodyR = { ...r, heading: "" };
    const body = Body({ r: bodyR, x: start, top: b + m + logoHeight(lw) + 16 * u, bottom: signY - 26 * u, width: w - 2 * m, align: "start", look: LIGHT });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={WHITE} />
        <Logo x={r.rtl ? b + w - m - lw : b + m} y={b + m} width={lw} fill={INK} />
        {r.heading ? <Txt r={r} x={r.rtl ? b + m : b + w - m} y={b + m + logoHeight(lw) * 0.85} size={3.6 * u} fill={INK} weight={600} anchor={r.rtl ? "start" : "end"} spacing={3.6 * u * 0.3} max={w * 0.45}>{caps(r.heading)}</Txt> : null}
        <rect x={b + m} y={b + m + logoHeight(lw) + 7 * u} width={w - 2 * m} height={0.25} fill={INK} />
        {body.node}
        <SignRow r={r} x0={b + m} x1={b + w - m} y={signY} look={LIGHT} align="start" />
        <Seal r={r} cx={r.rtl ? b + m + sealR : b + w - m - sealR} cy={signY - sealR - 12 * u} rad={sealR} dark={false} />
        <Codes r={r} x={r.rtl ? b + m : b + w - m - qrSize * r.qrs.length} y={signY - qrSize - 14 * u} size={qrSize} look={LIGHT} />
        {foot.node}
      </>
    );
  }

  /* The centred family: book, frame, band, dots, award (and side on a
     portrait page, which becomes a band). */
  const foot = Foot({ r, dark: false });
  const signY = foot.top - (style === "frame" ? 30 : tall ? 26 : 22) * u;
  const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
  let top: number;
  let look = LIGHT;
  let bodyR = r;
  const lwBook = (tall ? 0.32 : 0.2) * w;

  if (style === "band" || (style === "side" && tall)) {
    const bandH = (tall ? 0.16 : 0.22) * h;
    const lw = (tall ? 0.3 : 0.18) * w;
    nodes.push(<rect key="band" x={0} y={0} width={W} height={b + bandH} fill={INK} />);
    nodes.push(<Logo key="logo" x={r.rtl ? b + w - 18 * u - lw : b + 18 * u} y={b + bandH / 2 - logoHeight(lw) / 2} width={lw} fill={WHITE} />);
    if (r.heading) nodes.push(<Txt key="head" r={r} x={r.rtl ? b + 18 * u : b + w - 18 * u} y={b + bandH / 2 + 1.5 * u} size={4.2 * u} fill={WHITE} weight={600} anchor={r.rtl ? "start" : "end"} spacing={4.2 * u * 0.3} max={w * 0.5}>{caps(r.heading)}</Txt>);
    bodyR = { ...r, heading: "" };
    top = b + bandH + 14 * u;
  } else if (style === "dots") {
    const bandH = (tall ? 0.2 : 0.26) * h;
    const lw = (tall ? 0.3 : 0.2) * w;
    const lh = logoHeight(lw);
    const ly = b + bandH / 2 - lh / 2 + 2 * u;
    const px = lw / 2 + lh * 1.2, py = lh * 1.2;
    nodes.push(<rect key="band" x={0} y={0} width={W} height={b + bandH} fill={INK} />);
    nodes.push(<Dots key="dots" area={{ x: 0, y: 0, w: W, h: b + bandH }} pitch={3.2 * u} r={0.55 * u} fill="#4D4D50" origin={{ x: cx, y: ly + lh / 2 }} uid={`${r.uid}-d`} />);
    nodes.push(<rect key="panel" x={cx - px} y={ly + lh / 2 - py - lh / 2} width={px * 2} height={py * 2 + lh} fill={INK} />);
    nodes.push(<Logo key="logo" x={cx - lw / 2} y={ly} width={lw} fill={WHITE} />);
    top = b + bandH + 12 * u;
  } else if (style === "award") {
    /* An honour: the heading large and spaced, the name huge in silver-grey
       over a silver rule, the seal in the middle of the foot. */
    look = { ...LIGHT, nameFill: INK };
    nodes.push(<defs key="defs"><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="0">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient></defs>);
    const lw = (tall ? 0.24 : 0.13) * w;
    nodes.push(<Logo key="logo" x={cx - lw / 2} y={b + 20 * u} width={lw} fill={INK} />);
    if (r.heading) {
      const s = 9 * u;
      nodes.push(<Txt key="head" r={r} x={cx} y={b + 20 * u + logoHeight(lw) + 22 * u} size={s} fill={INK} weight={300} spacing={s * 0.22} max={w * 0.86}>{caps(r.heading)}</Txt>);
      nodes.push(<rect key="rule" x={cx - 30 * u} y={b + 20 * u + logoHeight(lw) + 29 * u} width={60 * u} height={0.8 * u} fill={`url(#${r.uid}-silver)`} />);
    }
    bodyR = { ...r, heading: "" };
    top = b + 20 * u + logoHeight(lw) + 34 * u;
  } else {
    /* book and frame: the logo centred at the top (ch. 99) */
    if (style === "frame") {
      nodes.push(<rect key="f1" x={b + 9 * u} y={b + 9 * u} width={w - 18 * u} height={foot.top - b - 18 * u + (r.foot === "none" ? 9 * u : 0)} fill="none" stroke={INK} strokeWidth={0.5} />);
      nodes.push(<rect key="f2" x={b + 11.5 * u} y={b + 11.5 * u} width={w - 23 * u} height={foot.top - b - 23 * u + (r.foot === "none" ? 9 * u : 0)} fill="none" stroke={INK} strokeWidth={0.2} />);
    }
    nodes.push(<Logo key="logo" x={cx - lwBook / 2} y={b + (style === "frame" ? 26 : 22) * u} width={lwBook} fill={INK} />);
    top = b + (style === "frame" ? 26 : 22) * u + logoHeight(lwBook) + 14 * u;
  }

  const bodyW = w * (tall ? 0.8 : 0.72);
  const sealCentred = style === "award" || tall;
  const reserve = sealCentred && r.seal === "silver" ? 2 * sealR + 22 * u : 24 * u;
  const body = Body({ r: bodyR, x: cx, top, bottom: signY - reserve, width: bodyW, align: "middle", look });
  nodes.push(<g key="body">{body.node}</g>);
  const sx = tall ? 20 : style === "award" ? 40 : 48;
  nodes.push(<SignRow key="sign" r={r} x0={b + sx * u} x1={b + w - sx * u} y={signY} look={look} />);
  if (sealCentred) nodes.push(<Seal key="seal" r={r} cx={cx} cy={signY - sealR - 12 * u} rad={sealR} dark={false} />);
  else nodes.push(<Seal key="seal" r={r} cx={b + w - 38 * u} cy={b + (style === "band" || style === "dots" ? h * 0.26 + 26 * u : 36 * u)} rad={sealR} dark={false} />);
  nodes.push(<Codes key="qr" r={r} x={b + (style === "frame" ? 20 : 16) * u} y={foot.top - qrSize - (style === "frame" ? 18 : 12) * u} size={qrSize} look={look} />);
  nodes.push(<g key="foot">{foot.node}</g>);
  return <>{nodes}</>;
}

