/* ---------------------------------------------------------------------------
   Business card — Team tier (brand book ch. 91, plan step C9).

   Front: black, the logo 40 mm wide in the centre, nothing else.
   Back: black; logo 25 mm top-start; name 9 pt SemiBold; title 7 pt grey;
   contacts 6.5 pt monospace; the contact QR 15 mm bottom-end on a white
   square so every phone reads it (ch. 91: "QR codes on a white strip").
   Sizes and back languages are the owner's workshop picks. Everything is in
   mm from the top-left of the bleed; the trim starts at (bleed, bleed).
   --------------------------------------------------------------------------- */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { PT, type DrawContext, type TemplateDef, type TemplateValues } from "./types";

const INK = "#000000";
const GREY = "#98989D";
const WHITE = "#FFFFFF";
/** The logo's own drawing box (KoleexLogoPaths). */
const LOGO_W = 719.83;
const LOGO_H = 107.57;

const SANS = "var(--font-inter), Inter, 'Helvetica Neue', Arial, 'PingFang SC', 'Noto Sans SC', 'Geeza Pro', 'Noto Sans Arabic', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const SIZES: Record<string, { w: number; h: number }> = {
  "90x54": { w: 90, h: 54 },
  "85x55": { w: 85, h: 55 },
  "89x51": { w: 89, h: 51 },
};

function Logo({ x, y, width }: { x: number; y: number; width: number }) {
  const s = width / LOGO_W;
  return <g transform={`translate(${x} ${y}) scale(${s})`} fill={WHITE}><KoleexLogoPaths /></g>;
}

function str(v: TemplateValues, k: string): string {
  const x = v[k];
  return typeof x === "string" ? x : "";
}

function Qr({ modules, x, y, size }: { modules: boolean[][]; x: number; y: number; size: number }) {
  const pad = 1.2;
  const cell = (size - pad * 2) / modules.length;
  let d = "";
  modules.forEach((row, r) => row.forEach((on, c) => {
    if (on) d += `M${(x + pad + c * cell).toFixed(3)} ${(y + pad + r * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
  }));
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={0.8} fill={WHITE} />
      <path d={d} fill={INK} shapeRendering="crispEdges" />
    </g>
  );
}

function front(_v: TemplateValues, { w, h, bleed }: DrawContext) {
  const lw = 40;
  const lh = (lw * LOGO_H) / LOGO_W;
  return (
    <>
      <rect x={0} y={0} width={w + bleed * 2} height={h + bleed * 2} fill={INK} />
      <Logo x={bleed + (w - lw) / 2} y={bleed + (h - lh) / 2} width={lw} />
    </>
  );
}

function back(v: TemplateValues, { w, h, bleed, qr }: DrawContext) {
  const rtl = v.lang === "ar";
  const inset = 5; // inside the 4 mm safe margin
  const left = bleed + inset;
  const right = bleed + w - inset;
  const top = bleed + inset;
  const bottom = bleed + h - inset;
  const start = rtl ? right : left;
  const anchor = rtl ? "end" : "start";
  const lw = 25;
  const qrSize = 15;

  const name = str(v, "name");
  const title = str(v, "title");
  const mobile = str(v, "mobile");
  /* One contact per line, so no line runs under the QR. */
  const lines = [mobile ? `M ${mobile}${v.whatsapp ? " · WhatsApp" : ""}` : "", str(v, "email"), str(v, "web")].filter(Boolean);

  const nameSize = 9 * PT;
  const titleSize = 7 * PT;
  const monoSize = 6.5 * PT;
  const lineGap = monoSize * 1.45;
  const nameY = bleed + h * 0.5;
  const fullW = right - left;
  const besideQr = fullW - (qr ? qrSize + 3 : 0);

  return (
    <>
      <rect x={0} y={0} width={w + bleed * 2} height={h + bleed * 2} fill={INK} />
      <Logo x={rtl ? right - lw : left} y={top} width={lw} />
      {name ? (
        <text x={start} y={nameY} textAnchor={anchor} fill={WHITE} {...fit(name, nameSize, 0.56, fullW)}
          style={{ fontFamily: SANS, fontSize: nameSize, fontWeight: 600 }}>{name}</text>
      ) : null}
      {title ? (
        <text x={start} y={nameY + titleSize * 1.55} textAnchor={anchor} fill={GREY} {...fit(title, titleSize, 0.52, fullW)}
          style={{ fontFamily: SANS, fontSize: titleSize, fontWeight: 400 }}>{title}</text>
      ) : null}
      {lines.map((line, i) => (
        <text key={i} x={start} y={bottom - (lines.length - 1 - i) * lineGap} textAnchor={anchor} fill={WHITE} {...fit(line, monoSize, 0.6, besideQr)}
          style={{ fontFamily: MONO, fontSize: monoSize }}>{line}</text>
      ))}
      {qr ? <Qr modules={qr} x={rtl ? left : right - qrSize} y={bottom - qrSize} size={qrSize} /> : null}
    </>
  );
}

/** A line that would run past `max` mm is condensed to fit it exactly
 *  (per = the face's average advance in em; generous, so it rarely fires). */
function fit(text: string, size: number, per: number, max: number) {
  const wide = /[\u2E80-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(text) ? 1 : per; // CJK is square
  return text.length * size * wide > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

/** vCard 3.0 — what a phone saves when it reads the card's QR. */
function vcard(v: TemplateValues): string | null {
  if (!v.qr) return null;
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, " ");
  const name = str(v, "name");
  if (!name) return null;
  /* N is required by vCard 3.0 — family name last, as it is written in English. */
  const parts = name.split(/\s+/);
  const n = parts.length > 1 ? `${esc(parts[parts.length - 1])};${esc(parts.slice(0, -1).join(" "))};;;` : `${esc(name)};;;;`;
  const out = ["BEGIN:VCARD", "VERSION:3.0", `N:${n}`, `FN:${esc(name)}`, `ORG:${esc(KOLEEX_COMPANY.en)}`];
  if (str(v, "title")) out.push(`TITLE:${esc(str(v, "title"))}`);
  if (str(v, "mobile")) out.push(`TEL;TYPE=CELL:${str(v, "mobile").replace(/[^\d+]/g, "")}`);
  if (str(v, "email")) out.push(`EMAIL;TYPE=WORK:${esc(str(v, "email"))}`);
  if (str(v, "web")) out.push(`URL:${esc(str(v, "web").startsWith("http") ? str(v, "web") : `https://${str(v, "web")}`)}`);
  out.push("END:VCARD");
  return out.join("\n");
}

export const businessCardTeam: TemplateDef = {
  id: "business-card-team",
  itemKey: "business-card",
  nameKey: "tpl.businessCardTeam",
  size: (v) => SIZES[typeof v.size === "string" ? v.size : ""] ?? SIZES["90x54"],
  bleed: 3,
  safe: 4,
  fields: [
    { key: "name", kind: "text", labelKey: "tpl.f.name", max: 40 },
    { key: "title", kind: "text", labelKey: "tpl.f.title", max: 48 },
    { key: "mobile", kind: "text", labelKey: "tpl.f.mobile", max: 24 },
    { key: "whatsapp", kind: "switch", labelKey: "tpl.f.whatsapp" },
    { key: "email", kind: "text", labelKey: "tpl.f.email", max: 60 },
    { key: "web", kind: "text", labelKey: "tpl.f.web", max: 40 },
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "size", kind: "choice", labelKey: "tpl.f.size", options: [
      { value: "90x54", labelKey: "tpl.size.90x54" }, { value: "85x55", labelKey: "tpl.size.85x55" }, { value: "89x51", labelKey: "tpl.size.89x51" },
    ] },
    { key: "qr", kind: "switch", labelKey: "tpl.f.qr" },
  ],
  defaults: {
    name: "", title: "", mobile: "", whatsapp: true, email: "", web: KOLEEX_COMPANY.web,
    lang: "en", size: "90x54", qr: true,
  },
  pages: [
    { id: "front", draw: front },
    { id: "back", draw: back },
  ],
  qrText: vcard,
};
