/* ---------------------------------------------------------------------------
   Business card — the approved styles (brand book ch. 91; owner 28–29/09:
   "more styles, very professional and organised", and "follow the card I
   sent, exactly").

     classic       the owner's own card, measured from it: portrait with the
                   X stroke, white bar, "Label: value" lines, the name with
                   its dot, a slash and the title in italics; back = logo |
                   rule | KOLEEX INTERNATIONAL GROUP and the white QR strip
     management    the book's portrait card (ch. 91)
     executive     the portrait card's layout without a photo — type only
     team-black    the book's card: logo front, details back
     team-white    its white version
     vertical      team-black standing
     vertical-white
     centered      everything on one centre line
     grid          white, Swiss: hairlines, two columns
     sales         the light line on the front (ch. 57)
     technician    the service hotline leads the back
     dealer        the agent's own card with the Authorized badge (ch. 128)
     bilingual     English on the front, Chinese or Arabic on the back

   Every style takes the same slots; QR codes go to the side the person
   picks, in that style's QR place.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "../types";
import { PT } from "../types";
import {
  AuthorizedBadge, ColumnRows, Dots, GREY_ON_INK, GREY_ON_WHITE, GroupLockup, HAIRLINE_ON_WHITE, INK, InlineRows, LIGHT_ON_INK, Line, Logo,
  Photo, PhotoPlaceholder, QrZone, STACKED_MIN, badgeSize, Stroke, WHITE, columnRowsSpan, fit, waveShape, wrapBalanced, lockupHeight, lockupLines, logoHeight, stackedLine, textWidth, type PrintRow, type Zone,
} from "./parts";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import { asLang, fontOf, langOf, num, printedRows, qrsOf, relangRows, rowsOf, str, type Lang } from "./model";
import { PREMIUM_STYLES, drawPremiumBack, drawPremiumFront, isPremium, premiumSpecKeys } from "./premium";
import { REF_STYLES, drawReferenceBack, drawReferenceFront, isReference, referenceSpecKeys } from "./reference";

export const STYLES = [
  "classic", "management", "executive", "vertical-portrait",
  "team-black", "team-white", "silver", "name-first",
  "dots-field", "dots-field-white", "dots-wave", "dots-vertical",
  "split", "band", "rules", "grid", "centered", "centered-white",
  "vertical", "vertical-white", "sales", "light-white", "technician", "bilingual", "dealer",
  /* the premium set (owner 30/09/2026), beside the first twenty-five */
  ...PREMIUM_STYLES,
  /* the owner's nine references, rebuilt (30/09/2026) — drafts until he approves them */
  ...REF_STYLES,
] as const;
export type CardStyle = (typeof STYLES)[number];
export const styleOf = (v: TemplateValues): CardStyle => ((STYLES as readonly string[]).includes(String(v.style)) ? (v.style as CardStyle) : "team-black");
export const PORTRAIT_STYLES: CardStyle[] = ["classic", "management", "vertical-portrait"];
/** Where the name with the logo has no place (ch. 43/44): the lockup backs
 *  carry it already; the portrait fronts' logos are under 40 mm (the logo
 *  alone); the dealer card is co-branded. */
export const NO_COMPANY_BACK: CardStyle[] = ["classic", "management", "executive", "dealer", ...PREMIUM_STYLES, ...REF_STYLES];
export const NO_COMPANY_FRONT: CardStyle[] = ["classic", "management", "executive", "dealer", "vertical-portrait", "split", "name-first", ...PREMIUM_STYLES, ...REF_STYLES];
export const VERTICAL_STYLES: CardStyle[] = ["vertical", "vertical-white", "dots-vertical", "vertical-portrait"];

const INSET = 5; // text and marks stay 1 mm inside the 4 mm safe margin

function frame({ w, h, bleed: b }: DrawContext) {
  return {
    b, w, h, W: w + b * 2, H: h + b * 2, left: b + INSET, right: b + w - INSET, top: b + INSET, bottom: b + h - INSET, inner: w - INSET * 2,
    /** A point at fractions of the trim (the owner's card was measured so). */
    fx: (f: number) => b + f * w, fy: (f: number) => b + f * h,
  };
}

const WORDS: Record<string, Record<Lang, string>> = {
  hotline: { en: "Service hotline", zh: "服务热线", ar: "خط الخدمة" },
  dealer: { en: "Authorized dealer", zh: "授权经销商", ar: "موزّع معتمد" },
  addPhoto: { en: "Photo", zh: "照片", ar: "الصورة" },
  addLogo: { en: "AGENT'S LOGO", zh: "代理商标志", ar: "لوجو الوكيل" },
};
const word = (lang: Lang, k: string) => WORDS[k][lang];

/** Everything a style needs from the fill, sized by the text-size slider. */
function read(v: TemplateValues, ctx: DrawContext) {
  const lang = langOf(v);
  const k = num(v, "scale", 100) / 100;
  const all = qrsOf(v);
  return {
    f: frame(ctx), lang, rtl: lang === "ar", font: fontOf(v), k,
    name: str(v, "name"), title: str(v, "title"), rows: printedRows(v) as PrintRow[],
    front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
    codes: ctx.qrs, uid: ctx.uid,
    /** The group's name with the logo (ch. 43): on the back by default, on the front when asked. */
    company: typeof v.company === "string" ? v.company.trim() : EVERYDAY_NAME_EN,
    companyOn: { front: v.companyFront === true, back: v.companyBack !== false } as Record<"front" | "back", boolean>,
  };
}

/** The book's two ways to put the name with the logo (ch. 43):
 *  · the stacked lockup under a logo of 40 mm or more (a face's logo);
 *  · the horizontal lockup — logo | hairline | three lines — for the wide,
 *    short top of an information side ("the back of the business card"). */
const HORIZONTAL_W = 25 * 1190 / 720; // its logo is 25 mm, the book's card logo
function stacked(r: Read, side: "front" | "back", logo: { x: number; y: number; w: number }, fill: string) {
  return r.companyOn[side] && logo.w >= STACKED_MIN - 0.01 ? stackedLine({ text: r.company, logo, fill, font: r.font }) : { node: null, room: 0 };
}
function topMark(r: Read, side: "front" | "back", at: { x: number; y: number; rtl: boolean; w?: number; logoW?: number }, fill: string) {
  if (r.companyOn[side]) {
    const w = at.w ?? HORIZONTAL_W;
    const x = at.rtl ? at.x - w : at.x;
    return { node: <GroupLockup x={x} y={at.y} width={w} fill={fill} font={r.font} lines={lockupLines(r.company)} />, height: lockupHeight(w), width: w };
  }
  const lw = at.logoW ?? 25;
  return { node: <Logo x={at.rtl ? at.x - lw : at.x} y={at.y} width={lw} fill={fill} />, height: logoHeight(lw), width: lw };
}
type Read = ReturnType<typeof read>;

const fill = (f: ReturnType<typeof frame>, color: string) => <rect x={0} y={0} width={f.W} height={f.H} fill={color} />;

/** The QR place in a corner: bottom-end (or bottom-start in Arabic). */
function cornerZone(r: Read, count: number, max: number, corner: "end" | "center" = "end"): { zone: Zone; used: number } {
  const { f, rtl } = r;
  const size = max;
  const cap = 2.4;
  const used = count ? Math.min(count * size + (count - 1) * 2.5, f.inner * 0.55) : 0;
  const zx = corner === "center" ? f.b + (f.w - used) / 2 : rtl ? f.left : f.right - used;
  return { zone: { x: zx, y: f.bottom - size - cap, w: used, h: size + cap, dir: "row", align: corner === "center" ? "center" : rtl ? "start" : "end" }, used };
}

/* ── the owner's card (measured from it, as fractions of the trim) ─────── */

const C = {
  stroke: { x: 0.0547, top: 0.1021, bottom: 0.56, width: 0.0584, lean: 0.316 },
  photo: { right: 0.62 },
  logo: { x: 0.794, y: 0.0615, w: 0.1513 },
  bar: { x: 0.576, y: 0.2435, w: 0.0817, h: 0.0157 },
  rows: { x: 0.5775, end: 0.9453, first: 0.3247, size: 0.0257, lead: 0.051 },
  name: { x: 0.0734, base: 0.8233, size: 0.1314 },
  slash: { top: 0.7199, bottom: 0.8285, thick: 0.0083, lean: 0.0207, gap: 0.0343 },
  title: { gap: 0.0743, base: 0.8183, size: 0.0456, lead: 0.0536 },
  back: {
    strip: 0.7949, logo: { x: 0.0906, y: 0.464, w: 0.28 }, rule: { x: 0.4199, top: 0.3801, bottom: 0.6199, w: 0.0023 },
    text: { x: 0.4708, base: [0.4626, 0.5164, 0.5688], size: 0.0438 }, qr: { top: 0.1769, size: 0.1504, gap: 0.1258 },
  },
};

function classicFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const photoBox = { x: 0, y: 0, w: f.fx(C.photo.right), h: f.H };
  const photo = str(v, "photo");
  const end = f.fx(C.rows.end);

  /* Name — "Xiang.Zhizhen": the space between the names becomes the card's
     square dot when asked (Helvetica's full stop is square). */
  const nameSize = f.h * C.name.size * k;
  const parts = r.name.split(/\s+/).filter(Boolean);
  const dot = v.nameSep !== "space" && parts.length > 1 && !rtl;
  const nameW = dot
    ? textWidth(parts[0], nameSize, 400, font) + nameSize * 0.2 + textWidth(".", nameSize, 700, font) + textWidth(parts.slice(1).join(" "), nameSize, 400, font)
    : textWidth(r.name, nameSize, 400, font);
  const nameMax = end - f.fx(C.name.x);
  const shownNameW = Math.min(nameW, nameMax);
  /* In Arabic the text band runs from the right edge: name, slash, title.
     The marks (photo, X stroke, logo, bar) never move. */
  const nameLeft = rtl ? end - shownNameW : f.fx(C.name.x);

  const sBottom = f.fy(C.name.base) + (f.fy(C.slash.bottom) - f.fy(C.name.base)) * k;
  const sTop = f.fy(C.name.base) - (f.fy(C.name.base) - f.fy(C.slash.top)) * k;
  const thick = f.w * C.slash.thick * k;
  const lean = f.w * C.slash.lean * k;
  const gap = f.w * C.slash.gap * k;
  const sx = rtl ? nameLeft - gap - thick - lean : nameLeft + shownNameW + gap;
  const titleSize = f.h * C.title.size * k;
  const titleStart = rtl ? sx - f.w * 0.02 : sx + f.w * C.title.gap * k;
  const titleRoom = rtl ? titleStart - f.fx(0.03) : end - titleStart;
  const beside = !!r.title && titleRoom > f.w * 0.16;
  /* Italics are Latin; Chinese and Arabic stay upright. */
  const italic = v.italic !== false && !/[\u0600-\u06FF\u2E80-\u9FFF]/.test(r.title);
  /* His card sets the title a little narrower than Helvetica's own width:
     wrap against 12 % more room, then condense to the real room. */
  const titleLines = r.title ? (beside ? wrapBalanced(r.title, titleSize, titleRoom * 1.12, 400, font, italic) : [r.title]) : [];
  const slashPts = `${sx},${sBottom} ${sx + thick},${sBottom} ${sx + thick + lean},${sTop} ${sx + lean},${sTop}`;

  const rowsSize = f.h * C.rows.size * k;
  const rowsW = end - f.fx(C.rows.x);
  const rowsEnd = f.fy(C.rows.first) + Math.max(0, r.rows.length - 1) * f.h * C.rows.lead;

  return (
    <>
      {fill(f, INK)}
      {v.stroke !== false ? (
        <Stroke x={f.fx(C.stroke.x)} top={f.fy(C.stroke.top)} bottom={f.fy(C.stroke.bottom)} width={f.w * C.stroke.width} lean={C.stroke.lean * f.w / f.h} />
      ) : null}
      {photo
        ? <Photo href={photo} box={photoBox} zoom={num(v, "photoZoom", 100) / 100} px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={v.soft !== false} uid={`${r.uid}-p`} />
        : <PhotoPlaceholder box={{ x: f.fx(0.08), y: f.fy(0.08), w: f.w * 0.42, h: f.h * 0.92 + f.b }} label={word(r.lang, "addPhoto")} font={font} />}
      <Logo x={f.fx(C.logo.x)} y={f.fy(C.logo.y)} width={f.w * C.logo.w} fill={WHITE} />
      {v.bar !== false ? (
        <rect x={rtl ? end - f.w * C.bar.w : f.fx(C.bar.x)} y={f.fy(C.bar.y)} width={f.w * C.bar.w} height={f.h * C.bar.h} fill={WHITE} />
      ) : null}
      <InlineRows rows={r.rows} x={rtl ? end : f.fx(C.rows.x)} y={f.fy(C.rows.first)} width={rowsW} rtl={rtl} size={rowsSize} fill={WHITE} font={font} lead={C.rows.lead / C.rows.size} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={f.w * 0.13}
        zone={{ x: f.fx(C.rows.x), y: rowsEnd + rowsSize * 1.4, w: rowsW, h: Math.max(6, f.fy(0.7) - rowsEnd - rowsSize * 2), dir: "row", align: rtl ? "end" : "start" }} />
      {r.name ? (
        <text x={nameLeft} y={f.fy(C.name.base)} direction="ltr" textAnchor="start" fill={WHITE}
          {...(nameW > nameMax ? { textLength: nameMax, lengthAdjust: "spacingAndGlyphs" as const } : {})}
          style={{ fontFamily: font, fontSize: nameSize, fontWeight: 400, unicodeBidi: "plaintext" }}>
          {dot ? (
            <>
              <tspan>{parts[0]}</tspan>
              <tspan dx={nameSize * 0.1} fontWeight={700}>.</tspan>
              <tspan dx={nameSize * 0.1}>{parts.slice(1).join(" ")}</tspan>
            </>
          ) : r.name}
        </text>
      ) : null}
      {r.name && r.title && beside && v.slash !== false ? <polygon points={slashPts} fill={WHITE} /> : null}
      {titleLines.map((line, i) => (
        <Line key={i} x={beside ? titleStart : rtl ? end : f.fx(C.name.x)} rtl={rtl} font={font} italic={italic} size={titleSize} fill={WHITE}
          max={beside ? titleRoom : f.inner}
          y={beside ? f.fy(C.title.base) - (titleLines.length - 1 - i) * f.h * C.title.lead * k : f.fy(C.name.base) - nameSize * 0.95}>{line}</Line>
      ))}
    </>
  );
}

/** The owner's back: logo | rule | KOLEEX / INTERNATIONAL / GROUP (his
 *  proportions, regular weight) and the white strip with his QR codes. */
function classicBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const B = C.back;
  const strip = r.back.length > 0;
  const groupW = B.text.x + 0.2 - B.logo.x; // the lockup's measured width, as a fraction
  const shift = strip ? 0 : ((1 - groupW) / 2 - B.logo.x) * f.w;
  const textSize = f.h * B.text.size;
  return (
    <>
      {fill(f, INK)}
      <g transform={`translate(${shift} 0)`}>
        <Logo x={f.fx(B.logo.x)} y={f.fy(0.5) - logoHeight(f.w * B.logo.w) / 2} width={f.w * B.logo.w} fill={WHITE} />
        <rect x={f.fx(B.rule.x)} y={f.fy(B.rule.top)} width={Math.max(0.18, f.w * B.rule.w)} height={f.fy(B.rule.bottom) - f.fy(B.rule.top)} fill={WHITE} />
        {["KOLEEX", "INTERNATIONAL", "GROUP"].map((t, i) => (
          <text key={t} x={f.fx(B.text.x)} y={f.fy(B.text.base[i])} fill={WHITE} style={{ fontFamily: font, fontSize: textSize, fontWeight: 400 }}>{t}</text>
        ))}
      </g>
      {strip ? <rect x={f.fx(B.strip)} y={0} width={f.W - f.fx(B.strip)} height={f.H} fill={WHITE} /> : null}
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={f.w * B.qr.size} gap={f.h * B.qr.gap}
        zone={{ x: f.fx(B.strip), y: f.fy(B.qr.top), w: f.w * (1 - B.strip), h: f.fy(1 - B.qr.top) - f.fy(B.qr.top), dir: "column", align: "center" }} />
    </>
  );
}

/* ── the book's portrait card, and the type-only executive ─────────────── */

function portraitName(r: Read, light: string) {
  const { f, rtl, font, k } = r;
  const nameSize = 5.1 * k;
  const titleSize = 2.45 * k;
  const nameW = Math.min(textWidth(r.name, nameSize, 600, font), f.inner * 0.66);
  const room = f.inner - nameW - 2.6;
  const beside = room >= 22;
  const lines = r.title ? (beside ? wrapBalanced(r.title, titleSize, room, 300, font) : [r.title]) : [];
  const nameX = rtl ? f.right : f.left;
  const titleX = beside ? (rtl ? f.right - nameW - 2.6 : f.left + nameW + 2.6) : nameX;
  return (
    <>
      {r.name ? <Line x={nameX} y={f.bottom} rtl={rtl} font={font} size={nameSize} weight={600} fill={WHITE} max={f.inner * 0.66}>{r.name}</Line> : null}
      {lines.map((line, i) => (
        <Line key={i} x={titleX} y={beside ? f.bottom - (lines.length - 1 - i) * titleSize * 1.28 : f.bottom - nameSize * 1.15}
          rtl={rtl} font={font} size={titleSize} weight={300} fill={light} max={beside ? room : f.inner}>{line}</Line>
      ))}
    </>
  );
}

function portraitFront(v: TemplateValues, ctx: DrawContext, withPhoto: boolean): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const lw = 0.233 * f.w;
  const colX = f.b + 0.573 * f.w;
  const colW = f.right - colX;
  const size = 6 * PT * k;
  const top = f.b + 0.3 * f.h;
  const span = columnRowsSpan(r.rows, size, colW, 1.42, 3, font);
  const photo = str(v, "photo");
  const box = { x: f.b + 0.1 * f.w, y: f.b + 0.1 * f.h, w: 0.42 * f.w, h: f.H - (f.b + 0.1 * f.h) };
  return (
    <>
      {fill(f, INK)}
      {/* Design review 29/09: the stroke ends behind the head — below it, it
          showed beside the shoulder as a stray white wedge. */}
      {withPhoto && v.stroke !== false ? <Stroke x={f.b + 0.073 * f.w - Math.tan((42 * Math.PI) / 180) * f.b} top={0} bottom={f.b + 0.5 * f.h} width={0.073 * f.w} lean={Math.tan((42 * Math.PI) / 180)} /> : null}
      {withPhoto ? (photo
        ? <Photo href={photo} box={box} zoom={num(v, "photoZoom", 100) / 100} px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={v.soft !== false} uid={`${r.uid}-p`} />
        : <PhotoPlaceholder box={box} label={word(r.lang, "addPhoto")} font={font} />) : null}
      {withPhoto ? <ShadeBottom f={f} uid={r.uid} /> : null}
      <Logo x={f.right - lw} y={f.top} width={lw} fill={WHITE} />
      <ColumnRows rows={r.rows} x={rtl ? f.right : colX} y={top} align="top" width={colW} rtl={rtl} size={size} fill={WHITE} font={font} maxWrap={3} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={12}
        zone={{ x: colX, y: top + span + size * 2, w: colW, h: Math.max(6, f.bottom - 9 - (top + span + size * 2)), dir: "row", align: rtl ? "end" : "start" }} />
      {portraitName(r, LIGHT_ON_INK)}
    </>
  );
}

function ShadeBottom({ f, uid }: { f: ReturnType<typeof frame>; uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity="0" /><stop offset="1" stopColor={INK} stopOpacity="0.78" /></linearGradient>
      </defs>
      <rect x={0} y={f.b + f.h - 17} width={f.W} height={f.H - (f.b + f.h - 17)} fill={`url(#${uid}-shade)`} />
    </>
  );
}

/** The book's portrait back: the horizontal lockup (Inter Light), the QR
 *  codes on a white strip. */
function lockupBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const stripW = r.back.length ? 21 : 0;
  const lockW = Math.min(52, f.w - stripW - 16);
  const lockH = lockupHeight(lockW);
  const stripX = f.b + f.w - stripW;
  return (
    <>
      {fill(f, INK)}
      <GroupLockup x={f.b + (f.w - stripW - lockW) / 2} y={f.b + (f.h - lockH) / 2} width={lockW} fill={WHITE} font={font} />
      {stripW ? <rect x={stripX} y={0} width={f.W - stripX} height={f.H} fill={WHITE} /> : null}
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={13} gap={3.2}
        zone={{ x: stripX, y: f.top, w: stripW, h: f.bottom - f.top, dir: "column", align: "center" }} />
    </>
  );
}

/* ── the info side: team, vertical, technician, dealer, bilingual ──────── */

interface InfoOpts {
  dark: boolean;
  top?: "logo" | "agent";
  /** Which face this is — the company line has a switch per face. */
  side: "front" | "back";
  hotline?: string;
  name?: string; title?: string; rows?: PrintRow[]; lang?: Lang;
  qrs: Read["back"];
  /** Drawn right over the ground (a dotted panel …). */
  under?: ReactNode;
  /** Millimetres kept free on the end side (a panel beside the text). */
  reserve?: number;
  /** Where the QR codes go instead of the bottom-end corner. */
  qrZone?: Zone;
  /** The name as a headline in silver (foil) — the silver style. */
  silverName?: boolean;
  /** The lines centred in the space under the logo (a back without a name). */
  rowsMiddle?: boolean;
}

function infoSide(v: TemplateValues, ctx: DrawContext, o: InfoOpts): ReactNode {
  const r0 = read(v, ctx);
  const lang = o.lang ?? r0.lang;
  const rtl = lang === "ar";
  const r = { ...r0, lang, rtl, name: o.name ?? r0.name, title: o.title ?? r0.title, rows: o.rows ?? r0.rows };
  const { f, font, k } = r;
  const fg = o.dark ? WHITE : INK;
  const sub = o.dark ? GREY_ON_INK : GREY_ON_WHITE;
  const vertical = ctx.h > ctx.w;
  const start = rtl ? f.right : f.left;

  const mark = topMark(r, o.side, { x: rtl ? f.right : f.left, y: f.top, rtl }, fg);
  const top = o.top === "agent"
    ? { node: agentLogo({ x: rtl ? f.right - 32 : f.left, y: f.top, w: 32, h: 8, href: str(v, "dealerLogo"), placeholder: word(lang, "addLogo"), font }), bottom: f.top + 8 }
    : { node: mark.node, bottom: f.top + mark.height };

  const nameSize = 9 * PT * k;
  const titleSize = 7 * PT * k;
  const rowsSize = 6.5 * PT * k;
  const nameY = vertical ? top.bottom + 23.3 : top.bottom + 11.5;
  const n = o.qrs.length;
  const qrMax = vertical ? 14 : 15;
  /* Design review 29/09: the codes follow the text's edge (no centred QR
     under start-aligned text). */
  const corner = cornerZone(r, n, qrMax, "end");
  const reserve = o.reserve ?? 0;
  const qrBeside = !o.qrZone && !vertical && n;
  const rowsWidth = (qrBeside ? f.inner - corner.used - 3 : f.inner) - (o.qrZone ? 0 : 0) - reserve;
  const span = columnRowsSpan(r.rows, 6.5 * PT * k, f.inner - (qrBeside ? corner.used + 3 : 0) - (o.reserve ?? 0), 1.42, 2, font);
  const rowsBottom = o.rowsMiddle ? top.bottom + (f.bottom - top.bottom + span) / 2 + 1 : vertical && n && !o.qrZone ? corner.zone.y - 3 : f.bottom;
  const textMax = f.inner - reserve;
  const silverId = `${r.uid}-silvername`;

  return (
    <>
      {fill(f, o.dark ? INK : WHITE)}
      {o.under}
      {top.node}
      {o.hotline ? (
        <g>
          <Line x={rtl ? f.left : f.right} y={f.top + 1.9} rtl={rtl} anchor="end" font={font} size={5.5 * PT} fill={sub}>{word(lang, "hotline")}</Line>
          <text x={rtl ? f.left : f.right} y={f.top + 6.4} textAnchor={rtl ? "start" : "end"} direction="ltr" fill={fg} {...fit(o.hotline, 10 * PT * k, f.inner * 0.5, 600, font)}
            style={{ fontFamily: font, fontSize: 10 * PT * k, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{o.hotline}</text>
        </g>
      ) : null}
      {o.silverName ? (
        <defs><linearGradient id={silverId} x1="0" y1="0" x2="1" y2="1">{["#E5E5EA", "#FFFFFF", "#D1D1D6", "#AEAEB2"].map((c, i) => <stop key={c} offset={[0, 0.35, 0.6, 1][i]} stopColor={c} />)}</linearGradient></defs>
      ) : null}
      {r.name ? (
        <Line x={start} y={o.silverName ? nameY + 1.2 : nameY} rtl={rtl} font={font} size={o.silverName ? 13 * PT * k : nameSize} weight={o.silverName ? 500 : 600}
          fill={o.silverName ? `url(#${silverId})` : fg} max={textMax}>{r.name}</Line>
      ) : null}
      {r.title ? <Line x={start} y={(o.silverName ? nameY + 1.2 : nameY) + titleSize * 1.55 + (o.silverName ? 0.8 : 0)} rtl={rtl} font={font} size={titleSize} fill={sub} max={textMax}>{r.title}</Line> : null}
      <ColumnRows rows={r.rows} x={start} y={rowsBottom} align="bottom" width={rowsWidth} rtl={rtl} size={rowsSize} fill={fg} font={font} />
      <QrZone items={o.qrs} codes={r.codes} font={font} captionFill={sub} max={qrMax} zone={o.qrZone ?? corner.zone} />
    </>
  );
}

/** A logo-only face (the book's team front), with any QR codes put on it
 *  small in the bottom corner. */
function logoFace(v: TemplateValues, ctx: DrawContext, dark: boolean, logoW = 40, side: "front" | "back" = "front"): ReactNode {
  const r0 = read(v, ctx);
  /* A back drawn as a logo face reads the back's switch and the back's codes. */
  const r = side === "back" ? { ...r0, companyOn: { ...r0.companyOn, front: r0.companyOn.back }, front: r0.back } : r0;
  const { f, font } = r;
  /* With the name, the logo is at least the stacked lockup's 40 mm. */
  const lw = Math.min(r.companyOn.front ? Math.max(logoW, STACKED_MIN) : logoW, f.inner - 4);
  const vertical = ctx.h > ctx.w;
  const corner = cornerZone(r, r.front.length, 12, vertical ? "center" : "end");
  const probe = stacked(r, "front", { x: 0, y: 0, w: lw }, WHITE);
  const ly = (r.front.length && vertical ? f.b + f.h * 0.4 - logoHeight(lw) / 2 : f.b + (f.h - logoHeight(lw)) / 2) - probe.room / 2;
  const lx = f.b + (f.w - lw) / 2;
  const ink = dark ? WHITE : INK;
  return (
    <>
      {fill(f, dark ? INK : WHITE)}
      <Logo x={lx} y={ly} width={lw} fill={ink} />
      {stacked(r, "front", { x: lx, y: ly, w: lw }, ink).node}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={dark ? GREY_ON_INK : GREY_ON_WHITE} max={12} zone={corner.zone} />
    </>
  );
}

/* ── the other faces ───────────────────────────────────────────────────── */

/** Sales: the logo bottom-start, one light line above it (the book's curve,
 *  never across the logo or text). */
function salesFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font } = r;
  const lw = 30;
  const sx = (x: number) => (x / 640) * f.W;
  const sy = (y: number) => (y / 220) * (f.H * 0.72);
  const d = `M${sx(-10)} ${sy(180)} C ${sx(140)} ${sy(180)}, ${sx(170)} ${sy(70)}, ${sx(330)} ${sy(66)} S ${sx(540)} ${sy(130)}, ${sx(650)} ${sy(40)}`;
  const corner = cornerZone(r, r.front.length, 12, "end");
  return (
    <>
      {fill(f, INK)}
      <path d={d} fill="none" stroke={WHITE} strokeOpacity={0.14} strokeWidth={1.6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={WHITE} strokeWidth={0.32} strokeLinecap="round" />
      {(() => {
        const w = r.companyOn.front ? STACKED_MIN : lw;
        const room = stacked(r, "front", { x: 0, y: 0, w }, WHITE).room;
        const logo = { x: rtl ? f.right - w : f.left, y: f.bottom - logoHeight(w) - room, w };
        return (
          <>
            <Logo x={logo.x} y={logo.y} width={w} fill={WHITE} />
            {stacked(r, "front", logo, WHITE).node}
          </>
        );
      })()}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={12} zone={corner.zone} />
    </>
  );
}

/** The agent's own logo in a box (contained, its own colours), or a dashed
 *  place for it. */
function agentLogo({ x, y, w, h, href, placeholder, font }: { x: number; y: number; w: number; h: number; href: string; placeholder: string; font: string }) {
  return href ? (
    <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMinYMid meet" />
  ) : (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#AEAEB2" strokeWidth={0.15} strokeDasharray="0.8 0.6" />
      <text x={x + w / 2} y={y + h / 2 + 0.7} textAnchor="middle" fill="#AEAEB2" style={{ fontFamily: font, fontSize: 5.5 * PT, fontWeight: 600, letterSpacing: 0.3 }}>{placeholder}</text>
    </g>
  );
}

/** Agent / dealer (ch. 128): "the agent's card is the agent's own, with its
 *  own logo and contacts. The Authorized badge sits at the foot" — never
 *  the agent's logo next to ours. */
function dealerFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k, lang } = r;
  const year = str(v, "badgeYear") || String(new Date().getFullYear());
  const role = str(v, "badgeRole") || "Distributor";
  const place = str(v, "badgePlace") || "—";
  const { width: badgeW, height: bh } = badgeSize(40, year, role, place, font);
  const web = r.rows.find((x) => /^www\.|^https?:/i.test(x.value))?.value ?? "";
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, WHITE)}
      {agentLogo({ x: rtl ? f.right - 38 : f.left, y: f.top, w: 38, h: 10, href: str(v, "dealerLogo"), placeholder: word(lang, "addLogo"), font })}
      {r.name ? <Line x={rtl ? f.right : f.left} y={f.b + f.h * 0.5} rtl={rtl} font={font} size={10 * PT * k} weight={700} fill={INK} max={f.inner}>{r.name}</Line> : null}
      {r.title ? <Line x={rtl ? f.right : f.left} y={f.b + f.h * 0.5 + 3.6 * k} rtl={rtl} font={font} size={7 * PT * k} fill={GREY_ON_WHITE} max={f.inner}>{r.title}</Line> : null}
      {web ? <Line x={rtl ? f.right : f.left} y={f.bottom} rtl={rtl} font={font} size={6 * PT * k} fill={GREY_ON_WHITE} max={f.inner - badgeW - 3}>{web}</Line> : null}
      <AuthorizedBadge x={rtl ? f.left : f.right - badgeW} y={f.bottom - bh} base={40} year={year} role={role} place={place} font={font} uid={`${r.uid}-b`} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={11}
        zone={{ ...corner.zone, y: f.bottom - bh - 3 - corner.zone.h }} />
    </>
  );
}

/** Centred: logo, name, title, a short rule and the lines, all on the
 *  centre line; the QR codes in a row at the foot. */
function centeredBack(v: TemplateValues, ctx: DrawContext, dark: boolean): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const fg = dark ? WHITE : INK;
  const sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
  const cx = f.b + f.w / 2;
  const n = r.back.length;
  const corner = cornerZone(r, n, 9.5, "center");
  const rowsSize = 6.2 * PT * k;
  const lw = 20;
  /* Top down: logo, name, title, rule; the lines fill what is left above
     the QR row (tighter when there are codes). */
  const mark = topMark(r, "back", { x: cx - (r.companyOn.back ? HORIZONTAL_W : lw) / 2, y: f.top, rtl: false, logoW: lw }, fg);
  const nameY = f.top + mark.height + (n ? 6.2 : 8.5);
  const ruleY = nameY + 3.4 * k + 2.6;
  const rowsTop = ruleY + 3.6;
  const floor = n ? corner.zone.y - 1.6 : f.bottom;
  const lead = r.rows.length > 1 ? Math.min(1.6, Math.max(1.2, (floor - rowsTop) / ((r.rows.length - 1) * rowsSize))) : 1.6;
  return (
    <>
      {fill(f, dark ? INK : WHITE)}
      {mark.node}
      {r.name ? <Line x={cx} y={nameY} rtl={rtl} anchor="middle" font={font} size={10 * PT * k} weight={600} fill={fg} max={f.inner}>{r.name}</Line> : null}
      {r.title ? <Line x={cx} y={nameY + 3.4 * k} rtl={rtl} anchor="middle" font={font} size={7 * PT * k} fill={sub} max={f.inner}>{r.title}</Line> : null}
      <rect x={cx - 4} y={ruleY} width={8} height={0.2} fill={sub} />
      <InlineRows rows={r.rows} x={cx} y={rowsTop} width={f.inner} rtl={rtl} size={rowsSize} fill={fg} font={font} lead={lead} anchor="middle" labelWeight={600} />
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={sub} max={9.5} zone={corner.zone} />
    </>
  );
}

/** Grid: white, hairlines, two columns — the name and title on the left,
 *  the lines on the right, the logo and the website on the top band. */
function gridBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const colGap = 4;
  const colW = (f.inner - colGap) / 2;
  const mark = topMark(r, "back", { x: rtl ? f.right : f.left, y: f.top, rtl, w: 34, logoW: 20 }, INK);
  const bandY = f.top + Math.max(7, mark.height + 3);
  const leftX = rtl ? f.right : f.left;
  const rightX = rtl ? f.left + colW : f.left + colW + colGap;
  const rowsSize = 6 * PT * k;
  const n = r.back.length;
  const webRow = r.rows.find((x) => /^www\.|^https?:/i.test(x.value));
  const web = webRow?.value ?? "";
  const qrSize = Math.min(12, colW / Math.max(1, n) - 2);
  const zone: Zone = { x: rtl ? f.right - colW : f.left, y: f.bottom - qrSize - 2.4, w: colW, h: qrSize + 2.4, dir: "row", align: rtl ? "end" : "start" };
  return (
    <>
      {fill(f, WHITE)}
      {mark.node}
      {web ? <Line x={rtl ? f.left : f.right} y={f.top + mark.height - 0.2} rtl={rtl} anchor="end" font={font} size={5.5 * PT} fill={GREY_ON_WHITE}>{web}</Line> : null}
      <rect x={f.left} y={bandY} width={f.inner} height={0.12} fill={HAIRLINE_ON_WHITE} />
      {r.name ? <Line x={leftX} y={bandY + 6} rtl={rtl} font={font} size={9 * PT * k} weight={600} fill={INK} max={colW}>{r.name}</Line> : null}
      {r.title ? wrapBalanced(r.title, 6.5 * PT * k, colW, 400, font).map((t, i) => (
        <Line key={i} x={leftX} y={bandY + 9.4 + i * 2.8 * k} rtl={rtl} font={font} size={6.5 * PT * k} fill={GREY_ON_WHITE} max={colW}>{t}</Line>
      )) : null}
      <rect x={f.left + colW + colGap / 2 - 0.06} y={bandY + 3} width={0.12} height={f.bottom - bandY - 3} fill={HAIRLINE_ON_WHITE} />
      <ColumnRows rows={r.rows.filter((x) => x !== webRow)} x={rightX} y={bandY + 6} align="top" width={colW} rtl={rtl}
        size={rowsSize} fill={INK} labelFill={GREY_ON_WHITE} font={font} maxWrap={3} />
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={qrSize} zone={zone} />
    </>
  );
}

/** Grid front: white, the logo centred inside a hairline frame at the safe line. */
function gridFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f } = r;
  return (
    <>
      {logoFace(v, ctx, false, 34)}
      <rect x={f.b + 4} y={f.b + 4} width={f.w - 8} height={f.h - 8} fill="none" stroke={HAIRLINE_ON_WHITE} strokeWidth={0.12} />
    </>
  );
}

/** Executive back: the book's horizontal lockup, centred; QR codes bottom-end. */
function executiveBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const lockW = Math.min(56, f.inner);
  const corner = cornerZone(r, r.back.length, 12, "end");
  return (
    <>
      {fill(f, INK)}
      <GroupLockup x={f.b + (f.w - lockW) / 2} y={f.b + (f.h - lockupHeight(lockW)) / 2 - (r.back.length ? 3 : 0)} width={lockW} fill={WHITE} font={font} />
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={12} zone={corner.zone} />
    </>
  );
}


/* ── round 4 (owner 29/09: "too many different, really professional
      designs", "dots as a pattern") ─────────────────────────────────────
   The dots are the book's (ch. 57): one even grid, every dot the same size,
   grey on black or on white; a logo never sits on them — it gets a clear
   panel, its clear space as tall as the logo (ch. 40). */

const DOT_ON_INK = "#48484A";
const DOT_ON_WHITE = "#C7C7CC";
const PITCH = 1.8;
/** Half a panel's size, snapped so its edges fall between two dot columns. */
const snapHalf = (half: number) => (Math.ceil(half / PITCH - 0.5) + 0.5) * PITCH;

/** Dots — field: the whole face one dot grid, the logo on its clear panel. */
function dotsFieldFront(v: TemplateValues, ctx: DrawContext, dark: boolean): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const lw = 40;
  const lh = logoHeight(lw);
  const room = stacked(r, "front", { x: 0, y: 0, w: lw }, WHITE).room;
  const cx = f.b + f.w / 2, cy = f.b + f.h / 2;
  const hw = snapHalf(lw / 2 + lh), hh = snapHalf((lh + room) / 2 + lh);
  const ground = dark ? INK : WHITE, ink = dark ? WHITE : INK;
  const logo = { x: cx - lw / 2, y: cy - (lh + room) / 2, w: lw };
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, ground)}
      <Dots area={{ x: 0, y: 0, w: f.W, h: f.H }} fill={dark ? DOT_ON_INK : DOT_ON_WHITE} origin={{ x: cx, y: cy }} uid={`${r.uid}-d`} pitch={PITCH} />
      <rect x={cx - hw} y={cy - hh} width={hw * 2} height={hh * 2} fill={ground} />
      <Logo x={logo.x} y={logo.y} width={lw} fill={ink} />
      {stacked(r, "front", logo, ink).node}
      {r.front.length ? <rect x={corner.zone.x - 1.5} y={corner.zone.y - 1.5} width={corner.zone.w + 3} height={corner.zone.h + 3} fill={ground} /> : null}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={dark ? GREY_ON_INK : GREY_ON_WHITE} max={11} zone={corner.zone} />
    </>
  );
}

/** Dots — field, the back: the details on the plain ground, a dotted panel
 *  down the end side that carries the QR codes on white plates. */
function dotsFieldBack(v: TemplateValues, ctx: DrawContext, dark: boolean): ReactNode {
  const r = read(v, ctx);
  const { f, rtl } = r;
  const panelW = f.w * 0.27 + f.b;
  const px = rtl ? 0 : f.W - panelW;
  const inner = panelW - f.b - 7;
  return (
    <>
      {infoSide(v, ctx, {
        side: "back", dark, qrs: [], reserve: panelW - f.b - INSET + 3,
        under: <Dots area={{ x: px, y: 0, w: panelW, h: f.H }} fill={dark ? DOT_ON_INK : DOT_ON_WHITE} origin={{ x: f.b + f.w / 2, y: f.b + f.h / 2 }} uid={`${r.uid}-d`} pitch={PITCH} />,
      })}
      <QrZone items={r.back} codes={r.codes} font={r.font} captionFill={dark ? GREY_ON_INK : GREY_ON_WHITE} max={Math.min(13, inner)} gap={3}
        zone={{ x: rtl ? f.b + 3.5 : px + 3.5, y: f.top, w: inner, h: f.bottom - f.top, dir: "column", align: "center" }} />
    </>
  );
}

/** Dots — wave: the book's wave of dots across the lower face, the logo
 *  clear above it. */
function dotsWaveFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const lw = 40;
  const room = stacked(r, "front", { x: 0, y: 0, w: lw }, WHITE).room;
  const logo = { x: f.b + (f.w - lw) / 2, y: f.b + f.h * 0.3 - (logoHeight(lw) + room) / 2, w: lw };
  const box = { x: 0, y: f.b + f.h * 0.24, w: f.W, h: f.H - (f.b + f.h * 0.24) };
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, INK)}
      <Dots area={box} shape={waveShape(box)} fill={DOT_ON_INK} origin={{ x: f.b + f.w / 2, y: f.b + f.h / 2 }} uid={`${r.uid}-d`} pitch={PITCH} />
      <Logo x={logo.x} y={logo.y} width={lw} fill={WHITE} />
      {stacked(r, "front", logo, WHITE).node}
      {r.front.length ? <rect x={corner.zone.x - 1.5} y={corner.zone.y - 1.5} width={corner.zone.w + 3} height={corner.zone.h + 3} fill={INK} /> : null}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={11} zone={corner.zone} />
    </>
  );
}

/** Dots — vertical: the lower half one dot field under a clean edge, the
 *  logo in the upper half. */
function dotsVerticalFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, font } = r;
  const lw = 40;
  const room = stacked(r, "front", { x: 0, y: 0, w: lw }, WHITE).room;
  const logo = { x: f.b + (f.w - lw) / 2, y: f.b + f.h * 0.3 - (logoHeight(lw) + room) / 2, w: lw };
  const edge = f.b + f.h * 0.55;
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, INK)}
      <Dots area={{ x: 0, y: edge, w: f.W, h: f.H - edge }} fill={DOT_ON_INK} origin={{ x: f.b + f.w / 2, y: edge + PITCH / 2 }} uid={`${r.uid}-d`} pitch={PITCH} />
      <Logo x={logo.x} y={logo.y} width={lw} fill={WHITE} />
      {stacked(r, "front", logo, WHITE).node}
      {r.front.length ? <rect x={corner.zone.x - 1.5} y={corner.zone.y - 1.5} width={corner.zone.w + 3} height={corner.zone.h + 3} fill={INK} /> : null}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={11} zone={corner.zone} />
    </>
  );
}

/** Split: a black panel with the logo, the person and the lines on white —
 *  everything on the front; the back is the logo. */
function splitFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const panel = f.b + f.w * 0.38;
  const px = rtl ? f.W - panel : 0;
  const lw = Math.min(26, f.w * 0.38 - 10);
  const colX = rtl ? f.W - panel - INSET : panel + INSET;
  const colW = f.b + f.w - INSET - (panel + INSET);
  const n = r.front.length;
  const corner = cornerZone(r, n, 11, "end");
  const rowsW = n ? colW - corner.used - 3 : colW;
  const sub = GREY_ON_WHITE;
  const lx = rtl ? f.W - (panel + f.b) / 2 - lw / 2 : (panel + f.b) / 2 - lw / 2;
  return (
    <>
      {fill(f, WHITE)}
      <rect x={px} y={0} width={panel} height={f.H} fill={INK} />
      <Logo x={lx} y={f.b + (f.h - logoHeight(lw)) / 2} width={lw} fill={WHITE} />
      {r.name ? <Line x={colX} y={f.top + 5} rtl={rtl} font={font} size={9.5 * PT * k} weight={600} fill={INK} max={colW}>{r.name}</Line> : null}
      {r.title ? <Line x={colX} y={f.top + 5 + 3.6 * k} rtl={rtl} font={font} size={7 * PT * k} fill={sub} max={colW}>{r.title}</Line> : null}
      <rect x={rtl ? colX - 8 : colX} y={f.top + 12 * k} width={8} height={0.25} fill={INK} />
      <ColumnRows rows={r.rows} x={colX} y={f.bottom} align="bottom" width={rowsW} rtl={rtl} size={6 * PT * k} fill={INK} labelFill={sub} font={font} maxWrap={3} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={sub} max={11} zone={corner.zone} />
    </>
  );
}

/** Band: white, the person above a black band that carries the lines. */
function bandFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const bandY = f.b + f.h * 0.62;
  const start = rtl ? f.right : f.left;
  const mark = topMark(r, "front", { x: start, y: f.top, rtl }, INK);
  const n = r.front.length;
  const qr = Math.min(12, f.b + f.h - bandY - 6);
  const zw = n * qr + Math.max(0, n - 1) * 2.5;
  const zone: Zone = { x: rtl ? f.left : f.right - zw, y: bandY + (f.b + f.h - bandY - qr) / 2, w: zw, h: qr, dir: "row", align: rtl ? "start" : "end" };
  const rowsW = f.inner - (n ? zw + 3 : 0);
  return (
    <>
      {fill(f, WHITE)}
      {mark.node}
      {r.name ? <Line x={start} y={bandY - 7.2} rtl={rtl} font={font} size={9.5 * PT * k} weight={600} fill={INK} max={f.inner}>{r.name}</Line> : null}
      {r.title ? <Line x={start} y={bandY - 3.6} rtl={rtl} font={font} size={7 * PT * k} fill={GREY_ON_WHITE} max={f.inner}>{r.title}</Line> : null}
      <rect x={0} y={bandY} width={f.W} height={f.H - bandY} fill={INK} />
      <ColumnRows rows={r.rows} x={start} y={bandY + (f.b + f.h - bandY - columnRowsSpan(r.rows, 6 * PT * k, rowsW, 1.36, 2, font)) / 2 + 6 * PT * k * 0.36} align="top" width={rowsW} rtl={rtl} size={6 * PT * k} fill={WHITE} labelFill={GREY_ON_INK} font={font} lead={1.36} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_INK} max={qr} zone={zone} />
    </>
  );
}

/** Name first: the person large on the front (white); the lines on the back. */
function nameFirstFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const start = rtl ? f.right : f.left;
  const size = 13 * PT * k;
  const lines = r.name ? wrapBalanced(r.name, size, f.inner, 600, font) : [];
  const base = f.b + f.h * 0.46 - (lines.length - 1) * size * 1.1;
  const last = base + Math.max(0, lines.length - 1) * size * 1.1;
  const lw = 22;
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, WHITE)}
      {lines.map((l, i) => <Line key={i} x={start} y={base + i * size * 1.1} rtl={rtl} font={font} size={size} weight={600} fill={INK} max={f.inner}>{l}</Line>)}
      {r.title ? <Line x={start} y={last + 4.4 * k} rtl={rtl} font={font} size={7.5 * PT * k} fill={GREY_ON_WHITE} max={f.inner}>{r.title}</Line> : null}
      <rect x={rtl ? f.right - 10 : f.left} y={last + 8 * k} width={10} height={0.3} fill={INK} />
      <Logo x={rtl ? f.left : f.right - lw} y={f.bottom - logoHeight(lw)} width={lw} fill={INK} />
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={11} zone={{ ...corner.zone, x: rtl ? f.right - corner.used : f.left, align: rtl ? "end" : "start" }} />
    </>
  );
}

/** Rules: white, Swiss — every line of details between hairlines. */
function rulesBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const start = rtl ? f.right : f.left;
  const mark = topMark(r, "back", { x: start, y: f.top, rtl, w: 34, logoW: 22 }, INK);
  const size = 6 * PT * k;
  const step = 4.1 * k;
  const rows = r.rows;
  const top = f.bottom - rows.length * step + step * 0.72;
  const n = r.back.length;
  const nameY = f.top + mark.height + 6.5;
  const zone: Zone = { x: rtl ? f.left : f.right - 12, y: f.top, w: 12, h: 12 + 2.4, dir: "column", align: "start" };
  return (
    <>
      {fill(f, WHITE)}
      {mark.node}
      {r.name ? <Line x={start} y={nameY} rtl={rtl} font={font} size={9 * PT * k} weight={600} fill={INK} max={f.inner - (n ? 15 : 0)}>{r.name}</Line> : null}
      {r.title ? <Line x={start} y={nameY + 3.4 * k} rtl={rtl} font={font} size={6.5 * PT * k} fill={GREY_ON_WHITE} max={f.inner - (n ? 15 : 0)}>{r.title}</Line> : null}
      {rows.map((row, i) => {
        const y = top + i * step;
        return (
          <g key={i}>
            <rect x={f.left} y={y - step * 0.72} width={f.inner} height={0.12} fill={HAIRLINE_ON_WHITE} />
            <InlineRows rows={[row]} x={start} y={y} width={f.inner} rtl={rtl} size={size} fill={INK} labelFill={GREY_ON_WHITE} font={font} labelWeight={600} />
          </g>
        );
      })}
      <QrZone items={r.back} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={12} zone={zone} />
    </>
  );
}

/** Light line on white: the book's line in black (ch. 57 "black on white"). */
function lightWhiteFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font } = r;
  const sx = (x: number) => (x / 640) * f.W;
  const sy = (y: number) => (y / 220) * (f.H * 0.72);
  const d = `M${sx(-10)} ${sy(180)} C ${sx(140)} ${sy(180)}, ${sx(170)} ${sy(70)}, ${sx(330)} ${sy(66)} S ${sx(540)} ${sy(130)}, ${sx(650)} ${sy(40)}`;
  const w = r.companyOn.front ? STACKED_MIN : 30;
  const room = stacked(r, "front", { x: 0, y: 0, w }, INK).room;
  const logo = { x: rtl ? f.right - w : f.left, y: f.bottom - logoHeight(w) - room, w };
  const corner = cornerZone(r, r.front.length, 11, "end");
  return (
    <>
      {fill(f, WHITE)}
      <path d={d} fill="none" stroke={INK} strokeOpacity={0.08} strokeWidth={1.6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={INK} strokeWidth={0.3} strokeLinecap="round" />
      <Logo x={logo.x} y={logo.y} width={w} fill={INK} />
      {stacked(r, "front", logo, INK).node}
      <QrZone items={r.front} codes={r.codes} font={font} captionFill={GREY_ON_WHITE} max={11} zone={corner.zone} />
    </>
  );
}

/** Vertical portrait: the portrait over the top of a standing card, the
 *  name under it, the logo at the foot (ch. 91's portrait card, standing). */
function verticalPortraitFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { f, rtl, font, k } = r;
  const photo = str(v, "photo");
  const box = { x: 0, y: 0, w: f.W, h: f.b + f.h * 0.6 };
  const start = rtl ? f.right : f.left;
  const nameY = box.h + 7.5;
  const lw = 24;
  return (
    <>
      {fill(f, INK)}
      {v.stroke !== false ? <Stroke x={f.b + f.w * 0.08} top={0} bottom={box.h * 0.55} width={f.w * 0.1} lean={0.55} /> : null}
      {photo
        ? <Photo href={photo} box={box} zoom={num(v, "photoZoom", 100) / 100} px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={v.soft !== false} uid={`${r.uid}-p`} />
        : <PhotoPlaceholder box={{ x: f.b + f.w * 0.2, y: f.b + 4, w: f.w * 0.6, h: box.h - f.b - 4 }} label={word(r.lang, "addPhoto")} font={font} />}
      <defs><linearGradient id={`${r.uid}-fadeup`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity="0" /><stop offset="1" stopColor={INK} /></linearGradient></defs>
      <rect x={0} y={box.h - 10} width={f.W} height={10} fill={`url(#${r.uid}-fadeup)`} />
      {r.name ? <Line x={start} y={nameY} rtl={rtl} font={font} size={10.5 * PT * k} weight={600} fill={WHITE} max={f.inner}>{r.name}</Line> : null}
      {r.title ? <Line x={start} y={nameY + 4 * k} rtl={rtl} font={font} size={7 * PT * k} weight={300} fill={LIGHT_ON_INK} max={f.inner}>{r.title}</Line> : null}
      <Logo x={rtl ? f.left : f.right - lw} y={f.bottom - logoHeight(lw)} width={lw} fill={WHITE} />
    </>
  );
}

/* ── the style table ───────────────────────────────────────────────────── */

export function drawFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isPremium(v)) return drawPremiumFront(v, ctx);
  if (isReference(v)) return drawReferenceFront(v, ctx);
  const r = read(v, ctx);
  switch (styleOf(v)) {
    case "classic": return classicFront(v, ctx);
    case "management": return portraitFront(v, ctx, true);
    case "executive": return portraitFront(v, ctx, false);
    case "team-white": return logoFace(v, ctx, false);
    case "vertical": return logoFace(v, ctx, true, 36);
    case "vertical-white": return logoFace(v, ctx, false, 36);
    case "grid": return gridFront(v, ctx);
    case "sales": return salesFront(v, ctx);
    case "dealer": return dealerFront(v, ctx);
    case "bilingual": return infoSide(v, ctx, { side: "front", dark: true, qrs: r.front, lang: "en", name: str(v, "name"), title: str(v, "title"), rows: printedRows(v) });
    case "vertical-portrait": return verticalPortraitFront(v, ctx);
    case "silver": return logoFace(v, ctx, true);
    case "name-first": return nameFirstFront(v, ctx);
    case "dots-field": return dotsFieldFront(v, ctx, true);
    case "dots-field-white": return dotsFieldFront(v, ctx, false);
    case "dots-wave": return dotsWaveFront(v, ctx);
    case "dots-vertical": return dotsVerticalFront(v, ctx);
    case "split": return splitFront(v, ctx);
    case "band": return bandFront(v, ctx);
    case "rules": return logoFace(v, ctx, false, 34);
    case "centered-white": return logoFace(v, ctx, false);
    case "light-white": return lightWhiteFront(v, ctx);
    default: return logoFace(v, ctx, true);
  }
}

export function drawBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isPremium(v)) return drawPremiumBack(v, ctx);
  if (isReference(v)) return drawReferenceBack(v, ctx);
  const r = read(v, ctx);
  switch (styleOf(v)) {
    case "classic": return classicBack(v, ctx);
    case "management": return lockupBack(v, ctx);
    case "executive": return executiveBack(v, ctx);
    case "team-white": case "vertical-white": return infoSide(v, ctx, { side: "back", dark: false, qrs: r.back });
    case "centered": return centeredBack(v, ctx, true);
    case "grid": return gridBack(v, ctx);
    case "technician": return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back, hotline: str(v, "hotline") });
    case "dealer": return infoSide(v, ctx, { side: "back", dark: false, qrs: r.back, top: "agent" });
    case "bilingual": {
      const lang2 = asLang(v.lang2 === "en" ? "zh" : v.lang2 ?? "zh");
      const rows2 = printedRows({ ...v, rows: relangRows(rowsOf(v).map((x) => ({ ...x })), lang2) }) as PrintRow[];
      return infoSide(v, ctx, { side: "back", dark: false, qrs: r.back, lang: lang2, name: str(v, "name2") || str(v, "name"), title: str(v, "title2") || str(v, "title"), rows: rows2 });
    }
    case "vertical-portrait": return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back });
    case "silver": return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back, silverName: true });
    case "name-first": return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back, name: "", title: "", rowsMiddle: true });
    case "dots-field": return dotsFieldBack(v, ctx, true);
    case "dots-field-white": return dotsFieldBack(v, ctx, false);
    case "dots-wave": case "dots-vertical": return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back });
    case "split": case "band": return logoFace(v, ctx, true, 40, "back");
    case "rules": return rulesBack(v, ctx);
    case "centered-white": return centeredBack(v, ctx, false);
    case "light-white": return infoSide(v, ctx, { side: "back", dark: false, qrs: r.back });
    default: return infoSide(v, ctx, { side: "back", dark: true, qrs: r.back });
  }
}

/** The words keys of the print notes for a style (studio "How it is printed"). */
export function specKeysFor(v: TemplateValues): string[] {
  if (isPremium(v)) return premiumSpecKeys(v);
  if (isReference(v)) return referenceSpecKeys(v);
  switch (styleOf(v)) {
    case "team-white": case "vertical-white": case "grid": case "rules": case "centered-white": case "light-white": case "name-first":
      return ["spec.whiteFront", "spec.blackPrint", "spec.whiteBoard", "spec.edges", "spec.never"];
    case "dots-field": case "dots-wave": case "dots-vertical": return ["spec.foilFront", "spec.dots", "spec.whitePrint", "spec.blackBoard", "spec.edges"];
    case "dots-field-white": return ["spec.whiteFront", "spec.dotsWhite", "spec.blackPrint", "spec.whiteBoard", "spec.edges"];
    case "split": case "band": return ["spec.twoTone", "spec.whiteBoard", "spec.edges"];
    case "silver": return ["spec.foilFront", "spec.silverName", "spec.whitePrint", "spec.blackBoard", "spec.edges"];
    case "vertical-portrait": return ["spec.photoFront", "spec.whitePrint", "spec.photoBoard", "spec.edges"];
    case "dealer": return ["spec.agentCard", "spec.agentBadge", "spec.blackPrint", "spec.whiteBoard"];
    case "bilingual": return ["spec.bilingual", "spec.whiteBoard", "spec.edges"];
    case "classic": case "management": return ["spec.photoFront", "spec.photoBack", "spec.photoBoard", "spec.edges"];
    case "executive": return ["spec.execFront", "spec.whitePrint", "spec.blackBoard", "spec.edges"];
    default: return ["spec.foilFront", "spec.whitePrint", "spec.blackBoard", "spec.edges", "spec.never"];
  }
}
