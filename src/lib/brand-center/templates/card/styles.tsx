/* ---------------------------------------------------------------------------
   Business card — the approved styles (brand book ch. 91; owner 28/09/2026:
   "more than one style, but matching the Koleex brand").

     team-black   the book's card: logo-only front, contacts on the back
     team-white   the book's second version: white both sides
     vertical     team-black standing (the workshop's portrait orientation)
     management   the portrait card: B&W photo, the X stroke (ch. 57 allows
                  it on this card only), horizontal lockup + QR strip
     sales        export & sales: the light line (ch. 57, "any piece")
     technician   after-sales: the service hotline leads the back
     dealer       co-branded (ch. 44): KOLEEX first, hairline, partner
                  logo at equal weight, on white so its colours stay true

   Every style is drawn from the same parts; Arabic mirrors the text, never
   the marks' shapes.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, TemplateValues } from "../types";
import {
  Contacts, FONT, GREY_ON_INK, GREY_ON_WHITE, GroupLockup, INK, LIGHT_ON_INK, Line, Logo, Qr, SIZE, WHITE,
  contactRows, fit, langOf, lockupHeight, logoHeight, str, textWidth, wrap,
} from "./parts";

export const STYLES = ["team-black", "team-white", "vertical", "management", "sales", "technician", "dealer"] as const;
export type CardStyle = (typeof STYLES)[number];
export const styleOf = (v: TemplateValues): CardStyle => (STYLES as readonly string[]).includes(String(v.style)) ? (v.style as CardStyle) : "team-black";

const INSET = 5; // text and marks stay 1 mm inside the 4 mm safe margin

function frame({ w, h, bleed: b }: DrawContext) {
  return { b, w, h, W: w + b * 2, H: h + b * 2, left: b + INSET, right: b + w - INSET, top: b + INSET, bottom: b + h - INSET, inner: w - INSET * 2 };
}

const WORDS: Record<string, Record<"en" | "zh" | "ar", string>> = {
  hotline: { en: "Service hotline", zh: "服务热线", ar: "خط الخدمة" },
  dealer: { en: "Authorized dealer", zh: "授权经销商", ar: "موزّع معتمد" },
  qrContact: { en: "Save contact", zh: "保存联系人", ar: "احفظ جهة الاتصال" },
  qrWhatsapp: { en: "WhatsApp", zh: "WhatsApp", ar: "واتساب" },
  qrWeb: { en: "Website", zh: "网站", ar: "الموقع" },
  wechat: { en: "WeChat", zh: "微信", ar: "ويتشات" },
  addPhoto: { en: "Photo", zh: "照片", ar: "الصورة" },
  addLogo: { en: "Dealer logo", zh: "经销商标志", ar: "لوجو الموزّع" },
};
const word = (v: TemplateValues, k: string) => WORDS[k][langOf(v)];
const qrWord = (v: TemplateValues) => word(v, v.qr === "whatsapp" ? "qrWhatsapp" : v.qr === "web" ? "qrWeb" : "qrContact");

/* ── fronts ────────────────────────────────────────────────────────────── */

function logoFront(ctx: DrawContext, dark: boolean, logoW = 40) {
  const f = frame(ctx);
  const lw = Math.min(logoW, f.inner - 6);
  return (
    <>
      <rect x={0} y={0} width={f.W} height={f.H} fill={dark ? INK : WHITE} />
      <Logo x={f.b + (f.w - lw) / 2} y={f.b + (f.h - logoHeight(lw)) / 2} width={lw} fill={dark ? WHITE : INK} />
    </>
  );
}

/** Sales: the logo bottom-start, one light line sweeping the space above it
 *  (the book's curve, never across the logo). */
function salesFront(v: TemplateValues, ctx: DrawContext) {
  const f = frame(ctx);
  const rtl = langOf(v) === "ar";
  const lw = 30;
  const sx = (x: number) => (x / 640) * f.W;
  const sy = (y: number) => (y / 220) * (f.H * 0.72);
  const d = `M${sx(-10)} ${sy(180)} C ${sx(140)} ${sy(180)}, ${sx(170)} ${sy(70)}, ${sx(330)} ${sy(66)} S ${sx(540)} ${sy(130)}, ${sx(650)} ${sy(40)}`;
  return (
    <>
      <rect x={0} y={0} width={f.W} height={f.H} fill={INK} />
      <path d={d} fill="none" stroke={WHITE} strokeOpacity={0.14} strokeWidth={1.6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={WHITE} strokeWidth={0.32} strokeLinecap="round" />
      <Logo x={rtl ? f.right - lw : f.left} y={f.bottom - logoHeight(lw)} width={lw} fill={WHITE} />
    </>
  );
}

/** Dealer (ch. 44): KOLEEX first — left, right in Arabic — a hairline with
 *  space on each side, the partner's logo optically as large as ours. */
function coBrand({ x, y, width, rtl, partner, placeholder }: { x: number; y: number; width: number; rtl: boolean; partner: string; placeholder: string }) {
  const gap = width * 0.07;
  const each = (width - gap * 2) / 2;
  const lh = logoHeight(each);
  const boxH = lh * 2.4;
  const ours = rtl ? x + each + gap * 2 : x;
  const theirs = rtl ? x : x + each + gap * 2;
  return (
    <g>
      <Logo x={ours} y={y - lh / 2} width={each} fill={INK} />
      <rect x={x + each + gap - 0.075} y={y - boxH / 2} width={0.15} height={boxH} fill={INK} />
      {partner ? (
        <image href={partner} x={theirs} y={y - boxH / 2} width={each} height={boxH} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <g>
          <rect x={theirs} y={y - boxH / 2} width={each} height={boxH} fill="none" stroke="#AAAAAA" strokeWidth={0.15} strokeDasharray="0.8 0.6" />
          <text x={theirs + each / 2} y={y + 0.7} textAnchor="middle" fill="#AAAAAA" style={{ fontFamily: FONT, fontSize: SIZE.small }}>{placeholder}</text>
        </g>
      )}
    </g>
  );
}

function dealerFront(v: TemplateValues, ctx: DrawContext) {
  const f = frame(ctx);
  const rtl = langOf(v) === "ar";
  const width = Math.min(60, f.inner);
  const cy = f.b + f.h * 0.42;
  const dealer = str(v, "dealerName");
  return (
    <>
      <rect x={0} y={0} width={f.W} height={f.H} fill={WHITE} />
      {coBrand({ x: f.b + (f.w - width) / 2, y: cy, width, rtl, partner: str(v, "dealerLogo"), placeholder: word(v, "addLogo") })}
      {dealer ? <Line x={f.b + f.w / 2} y={cy + 10} rtl={rtl} anchor="middle" size={SIZE.title} weight={600} fill={INK} max={f.inner}>{dealer}</Line> : null}
      <Line x={f.b + f.w / 2} y={cy + (dealer ? 13.2 : 10)} rtl={rtl} anchor="middle" size={SIZE.small} fill={GREY_ON_WHITE}>{word(v, "dealer")}</Line>
    </>
  );
}

/** Management (ch. 91): the portrait in black and white, the X stroke
 *  behind it, the logo top-right, contacts on the right, the name large at
 *  the bottom with the title in Light beside it. */
function managementFront(v: TemplateValues, ctx: DrawContext) {
  const f = frame(ctx);
  const { b, w, h, W, H } = f;
  const rtl = langOf(v) === "ar";
  const k = Math.tan((42 * Math.PI) / 180);
  const sx = b + 0.073 * w;
  const sw = 0.073 * w;
  const yEnd = b + 0.78 * h;
  const stroke = `${sx - k * b},0 ${sx - k * b + sw},0 ${sx + k * (yEnd - b) + sw},${yEnd} ${sx + k * (yEnd - b)},${yEnd}`;
  const px = b + 0.1 * w;
  const pw = 0.42 * w;
  const py = b + 0.1 * h;
  const photo = str(v, "photo");
  const id = ctx.uid;

  const lw = 0.233 * w;
  const colX = b + 0.573 * w;
  const colW = f.right - colX;
  const rows = contactRows(v);
  const size = 6 * 0.3528;

  const name = str(v, "name");
  const title = str(v, "title");
  const nameSize = 5.1;
  const titleSize = 2.45;
  const nameW = Math.min(textWidth(name, nameSize, 600), f.inner * 0.66);
  const room = f.inner - nameW - 2.6;
  const beside = room >= 22;
  const titleLines = title ? (beside ? wrap(title, titleSize, room, 2, 300) : [title]) : [];
  const nameX = rtl ? f.right : f.left;
  const titleX = beside ? (rtl ? f.right - nameW - 2.6 : f.left + nameW + 2.6) : nameX;

  return (
    <>
      <defs>
        <filter id={`${id}-bw`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncR type="linear" slope="1.12" intercept="-0.05" /><feFuncG type="linear" slope="1.12" intercept="-0.05" /><feFuncB type="linear" slope="1.12" intercept="-0.05" /></feComponentTransfer>
        </filter>
        {/* The photo melts into the black: a portrait on a light background
            keeps only a soft glow around the head (a cut-out loses nothing). */}
        <radialGradient id={`${id}-fade`} cx="0.5" cy="0.5" r="0.56" gradientTransform="translate(0.5 0.5) scale(1 1.3) translate(-0.5 -0.5)">
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="0.92" stopColor="#000000" />
        </radialGradient>
        <mask id={`${id}-mask`} maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill={`url(#${id}-fade)`} /></mask>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity="0" /><stop offset="1" stopColor={INK} stopOpacity="0.78" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={INK} />
      <polygon points={stroke} fill={WHITE} />
      {photo ? (
        <g mask={`url(#${id}-mask)`}>
          <image href={photo} x={px} y={py} width={pw} height={H - py} preserveAspectRatio="xMidYMin slice" filter={`url(#${id}-bw)`} />
        </g>
      ) : (
        <g>
          <rect x={px + pw * 0.16} y={b + h * 0.6} width={pw * 0.68} height={H - (b + h * 0.6)} rx={pw * 0.3} fill="#48484A" />
          <circle cx={px + pw / 2} cy={b + h * 0.42} r={pw * 0.19} fill="#8E8E93" />
          <text x={px + pw / 2} y={b + h * 0.43} textAnchor="middle" fill={INK} style={{ fontFamily: FONT, fontSize: SIZE.small, fontWeight: 600 }}>{word(v, "addPhoto")}</text>
        </g>
      )}
      <rect x={0} y={b + h - 17} width={W} height={H - (b + h - 17)} fill={`url(#${id}-shade)`} />
      <Logo x={f.right - lw} y={f.top} width={lw} fill={WHITE} />
      <Contacts rows={rows} x={rtl ? f.right : colX} y={b + 0.3 * h} align="top" width={colW} rtl={rtl} size={size} fill={WHITE} maxAddressLines={3} />
      {name ? <Line x={nameX} y={f.bottom} rtl={rtl} size={nameSize} weight={600} fill={WHITE} max={f.inner * 0.66}>{name}</Line> : null}
      {titleLines.map((line, i) => (
        <Line key={i} x={titleX} y={beside ? f.bottom - (titleLines.length - 1 - i) * titleSize * 1.28 : f.bottom - nameSize * 1.15}
          rtl={rtl} size={titleSize} weight={300} fill={LIGHT_ON_INK} max={beside ? room : f.inner}>{line}</Line>
      ))}
    </>
  );
}

/* ── backs ─────────────────────────────────────────────────────────────── */

/** The team back (book ch. 91): logo top-start, name and title, the
 *  contacts at the bottom, the QR bottom-end. Light = the white version. */
function teamBack(v: TemplateValues, ctx: DrawContext, opts: { dark: boolean; hotline?: boolean; dealer?: boolean }) {
  const f = frame(ctx);
  const rtl = langOf(v) === "ar";
  const start = rtl ? f.right : f.left;
  const fg = opts.dark ? WHITE : INK;
  const sub = opts.dark ? GREY_ON_INK : GREY_ON_WHITE;
  const vertical = ctx.h > ctx.w;
  const qrSize = 15;
  const qr = ctx.qr;

  const top = (() => {
    if (!opts.dealer) {
      const lw = 25;
      return { node: <Logo x={rtl ? f.right - lw : f.left} y={f.top} width={lw} fill={fg} />, bottom: f.top + logoHeight(lw) };
    }
    const width = Math.min(44, f.inner);
    const cy = f.top + 3.2;
    return { node: coBrand({ x: rtl ? f.right - width : f.left, y: cy, width, rtl, partner: str(v, "dealerLogo"), placeholder: word(v, "addLogo") }), bottom: cy + 3.2 };
  })();

  const nameY = vertical ? f.top + 27 : top.bottom + 11.5;
  const name = str(v, "name");
  const title = str(v, "title");
  const rows = contactRows(v);
  const beside = !vertical && qr;
  const width = beside ? f.inner - qrSize - 3 : f.inner;
  const contactsBottom = vertical && qr ? f.bottom - qrSize - 4 : f.bottom;
  const hotline = opts.hotline ? str(v, "hotline") : "";

  return (
    <>
      <rect x={0} y={0} width={f.W} height={f.H} fill={opts.dark ? INK : WHITE} />
      {top.node}
      {hotline ? (
        <g>
          <Line x={rtl ? f.left : f.right} y={f.top + 1.9} rtl={rtl} anchor="end" size={SIZE.small} fill={sub}>{word(v, "hotline")}</Line>
          <text x={rtl ? f.left : f.right} y={f.top + 6.4} textAnchor={rtl ? "start" : "end"} direction="ltr" fill={fg} {...fit(hotline, 10 * 0.3528, f.inner * 0.5, 600)}
            style={{ fontFamily: FONT, fontSize: 10 * 0.3528, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{hotline}</text>
        </g>
      ) : null}
      {name ? <Line x={start} y={nameY} rtl={rtl} size={SIZE.name} weight={600} fill={fg} max={f.inner}>{name}</Line> : null}
      {title ? <Line x={start} y={nameY + SIZE.title * 1.55} rtl={rtl} size={SIZE.title} fill={sub} max={f.inner}>{title}</Line> : null}
      <Contacts rows={rows} x={start} y={contactsBottom} align="bottom" width={width} rtl={rtl} size={SIZE.contact} fill={fg} />
      {qr ? <Qr modules={qr} x={rtl ? f.left : f.right - qrSize} y={f.bottom - qrSize} size={qrSize} /> : null}
    </>
  );
}

/** Management back (ch. 91): the horizontal lockup, and the QR codes on a
 *  white strip so every phone reads them — the contact code, and the
 *  person's own WeChat code when they add it. */
function managementBack(v: TemplateValues, ctx: DrawContext) {
  const f = frame(ctx);
  const { b, w, h, W, H } = f;
  const stripW = 21;
  const stripX = b + w - stripW;
  const lockW = Math.min(52, w - stripW - 16);
  const lockH = lockupHeight(lockW);
  const wechat = str(v, "wechatQr");
  const codes: Array<{ node: (x: number, y: number, s: number) => ReactNode; caption: string }> = [];
  if (wechat) codes.push({ node: (x, y, s) => <image href={wechat} x={x} y={y} width={s} height={s} preserveAspectRatio="xMidYMid meet" />, caption: word(v, "wechat") });
  if (ctx.qr) {
    const q = ctx.qr;
    codes.push({ node: (x, y, s) => <Qr modules={q} x={x} y={y} size={s} />, caption: qrWord(v) });
  }
  const s = 13;
  const qx = stripX + (stripW - s) / 2;
  const cap = 1.7;
  const block = codes.length * (s + cap + 1.2) + (codes.length - 1) * 3.2;
  let y = b + (h - block) / 2;
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={INK} />
      <GroupLockup x={b + (w - stripW - lockW) / 2} y={b + (h - lockH) / 2} width={lockW} fill={WHITE} />
      {codes.length ? <rect x={stripX} y={0} width={W - stripX} height={H} fill={WHITE} /> : null}
      {codes.map((c, i) => {
        const at = y;
        y += s + cap + 1.2 + 3.2;
        return (
          <g key={i}>
            {c.node(qx, at, s)}
            <text x={qx + s / 2} y={at + s + cap + 0.4} textAnchor="middle" fill={GREY_ON_WHITE} style={{ fontFamily: FONT, fontSize: 4.5 * 0.3528 }}>{c.caption}</text>
          </g>
        );
      })}
    </>
  );
}

/* ── the style table ───────────────────────────────────────────────────── */

export function drawFront(v: TemplateValues, ctx: DrawContext): ReactNode {
  switch (styleOf(v)) {
    case "team-white": return logoFront(ctx, false);
    case "vertical": return logoFront(ctx, true, 36);
    case "management": return managementFront(v, ctx);
    case "sales": return salesFront(v, ctx);
    case "dealer": return dealerFront(v, ctx);
    default: return logoFront(ctx, true);
  }
}

export function drawBack(v: TemplateValues, ctx: DrawContext): ReactNode {
  switch (styleOf(v)) {
    case "team-white": return teamBack(v, ctx, { dark: false });
    case "management": return managementBack(v, ctx);
    case "technician": return teamBack(v, ctx, { dark: true, hotline: true });
    case "dealer": return teamBack(v, ctx, { dark: false, dealer: true });
    default: return teamBack(v, ctx, { dark: true });
  }
}

/** The words keys of the print notes for a style (studio "How it is printed"). */
export function specKeysFor(v: TemplateValues): string[] {
  switch (styleOf(v)) {
    case "team-white": return ["spec.whiteFront", "spec.blackPrint", "spec.whiteBoard", "spec.edges", "spec.never"];
    case "dealer": return ["spec.dealerFront", "spec.blackPrint", "spec.whiteBoard", "spec.edges", "spec.partner"];
    case "management": return ["spec.photoFront", "spec.photoBack", "spec.photoBoard", "spec.edges"];
    default: return ["spec.foilFront", "spec.whitePrint", "spec.blackBoard", "spec.edges", "spec.never"];
  }
}
