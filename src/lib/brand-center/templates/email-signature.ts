/* ---------------------------------------------------------------------------
   Email signature (brand book ch. 93; plan step C11). Not paper: the studio
   shows it inside a mail and copies it as HTML that Gmail, Outlook, Apple
   Mail and Foxmail keep — tables and inline styles only, the fonts every
   computer has (ch. 92: Arial / Helvetica, Tahoma for Arabic, PingFang /
   Microsoft YaHei for Chinese), pictures from our own domain.

   Owner, 29/09/2026: "same as the business cards and the ID badge — be a
   professional designer; perfect, professional and editable designs come
   first, a small break of the book is fine". So: sixteen layouts — the
   book's own first — with a portrait, the dots pattern, an accent colour,
   rules as hairlines or dots, and the type, spacing and links adjustable.
   Three languages and an optional second one, the reply version the book
   asks for, and the event banner while there is an event. The logo is a
   picture on its own white (or black) tile: a mail app in dark mode flips
   colours but not pictures, so the logo is never drawn black on black.
   --------------------------------------------------------------------------- */

import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import type { BcPerson } from "@/lib/brand-center/client";
import { formatMobile, nameIn, titleOf } from "./person";
import { patternOf, patternOptions } from "./patterns";
import type { TemplateDef, TemplateItem, TemplateValues } from "./types";
import { LANGS, asLang, list, num, rowKind, rowsOf, str, type Lang, type RowKind } from "./card/model";

/** Where the pictures load from in a real mail — our own domain, reachable
 *  from mainland China (ch. 93). */
export const SIGNATURE_HOST = "https://hub.koleexgroup.com";
const ASSETS = "/brand/email";
const KOLEEX_SITE = "https://www.koleexgroup.com";

export const SIG_STYLES = [
  "standard", "logo-first", "divider", "logo-right", "portrait", "portrait-top", "accent-bar", "editorial",
  "columns", "dots-black", "dots-white", "band", "outline", "black", "centered", "compact",
  /* the premium set (owner 30/09/2026), beside the first sixteen */
  "p-medallion", "p-knockout", "p-underprint", "p-monolith", "p-guilloche",
] as const;
type Style = (typeof SIG_STYLES)[number];
const styleOf = (v: TemplateValues): Style => ((SIG_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as Style) : "standard");
const PHOTO_STYLES: Style[] = ["portrait", "portrait-top"];
const DOTS_STYLES: Style[] = ["dots-black", "dots-white"];

const oneOf = <T extends string>(list: readonly T[], x: unknown, d: T): T => ((list as readonly string[]).includes(String(x)) ? (x as T) : d);

/** Where the company's name goes: after the title (the book), on its own
 *  line, under the logo as the group lockup (ch. 43), or nowhere. */
const COMPANY_AT = ["title", "line", "logo", "off"] as const;
type CompanyAt = (typeof COMPANY_AT)[number];
const companyAt = (v: TemplateValues): CompanyAt => oneOf(COMPANY_AT, v.companyAt, "title");

/** How the contact lines sit: the book (each phone on its line, email and
 *  website together), one per line, or all on one line. */
const LAYOUTS = ["book", "lines", "one"] as const;
type Layout = (typeof LAYOUTS)[number];
const layoutOf = (v: TemplateValues): Layout => oneOf(LAYOUTS, v.contactLayout, "book");

/** The one colour a signature may add: black (the book), a quiet grey, or
 *  Hub Blue (the brand's third colour) — for hairlines, bars and rules. */
const ACCENTS = ["black", "grey", "blue"] as const;
type Accent = (typeof ACCENTS)[number];
const HUB_BLUE = "#567FB2";
const WEIGHTS = ["bold", "regular", "light"] as const;
const SPACINGS = ["tight", "normal", "airy"] as const;
const RULES = ["solid", "dots"] as const;
const LINK_COLOURS = ["grey", "ink", "accent"] as const;
const SHAPES = ["circle", "rounded", "square"] as const;

/** What each style brings when it is picked — its designer's settings. */
const STYLE_DEFAULTS: Record<Style, { companyAt: CompanyAt; contactLayout: Layout; accent: Accent; nameSize: number; nameWeight: (typeof WEIGHTS)[number]; titleCaps: boolean }> = {
  standard:       { companyAt: "title", contactLayout: "book",  accent: "black", nameSize: 13, nameWeight: "bold",  titleCaps: false },
  "logo-first":   { companyAt: "line",  contactLayout: "one",   accent: "grey",  nameSize: 16, nameWeight: "bold",  titleCaps: false },
  divider:        { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 15, nameWeight: "bold",  titleCaps: false },
  "logo-right":   { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 15, nameWeight: "bold",  titleCaps: false },
  portrait:       { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 16, nameWeight: "bold",  titleCaps: false },
  "portrait-top": { companyAt: "title", contactLayout: "one",   accent: "grey",  nameSize: 16, nameWeight: "bold",  titleCaps: false },
  "accent-bar":   { companyAt: "line",  contactLayout: "lines", accent: "blue",  nameSize: 16, nameWeight: "bold",  titleCaps: false },
  editorial:      { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 22, nameWeight: "light", titleCaps: true },
  columns:        { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 15, nameWeight: "bold",  titleCaps: false },
  "dots-black":   { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 15, nameWeight: "bold",  titleCaps: false },
  "dots-white":   { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 15, nameWeight: "bold",  titleCaps: false },
  band:           { companyAt: "line",  contactLayout: "book",   accent: "black", nameSize: 15, nameWeight: "bold",  titleCaps: false },
  outline:        { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 15, nameWeight: "bold",  titleCaps: false },
  black:          { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 15, nameWeight: "bold",  titleCaps: false },
  centered:       { companyAt: "line",  contactLayout: "one",   accent: "grey",  nameSize: 16, nameWeight: "bold",  titleCaps: false },
  compact:        { companyAt: "title", contactLayout: "one",   accent: "grey",  nameSize: 13, nameWeight: "bold",  titleCaps: false },
  "p-medallion":  { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 20, nameWeight: "light", titleCaps: true },
  "p-knockout":   { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 20, nameWeight: "light", titleCaps: true },
  "p-underprint": { companyAt: "line",  contactLayout: "lines", accent: "grey",  nameSize: 20, nameWeight: "light", titleCaps: true },
  "p-monolith":   { companyAt: "line",  contactLayout: "lines", accent: "black", nameSize: 20, nameWeight: "light", titleCaps: true },
  "p-guilloche":  { companyAt: "line",  contactLayout: "one",   accent: "grey",  nameSize: 22, nameWeight: "light", titleCaps: true },
};

/* ── words that are part of the signature ──────────────────────────────── */

/** The book's signature labels: "M" before the mobile; the email and the
 *  website need none. */
export const SIG_LABELS: Record<Lang, Record<RowKind, string>> = {
  en: { address: "", mobile: "M", tel: "T", fax: "F", email: "", web: "", wechat: "WeChat", whatsapp: "WhatsApp", linkedin: "LinkedIn", custom: "" },
  zh: { address: "", mobile: "手机", tel: "电话", fax: "传真", email: "", web: "", wechat: "微信", whatsapp: "WhatsApp", linkedin: "领英", custom: "" },
  ar: { address: "", mobile: "جوال", tel: "هاتف", fax: "فاكس", email: "", web: "", wechat: "ويتشات", whatsapp: "واتساب", linkedin: "لينكدإن", custom: "" },
};
const WHATSAPP: Record<Lang, string> = { en: "(WhatsApp)", zh: "（WhatsApp）", ar: "(واتساب)" };
/** Shown in the studio while a slot is empty — never copied. */
const PLACEHOLDER: Record<Lang, { name: string; title: string }> = {
  en: { name: "Full Name", title: "Job Title" },
  zh: { name: "姓名", title: "职位" },
  ar: { name: "الاسم", title: "المسمى الوظيفي" },
};

const KOLEEX_WEB = "www.koleexgroup.com";
function sigRows(lang: Lang): TemplateItem[] {
  return (["mobile", "email", "web"] as RowKind[]).map((kind) => ({
    id: kind, kind, label: SIG_LABELS[lang][kind], on: true, value: kind === "web" ? KOLEEX_WEB : "",
  }));
}
/** Labels still at a default follow the language. */
function relangSigRows(rows: TemplateItem[], lang: Lang): TemplateItem[] {
  return rows.map((r) => {
    const kind = rowKind(r.kind);
    return kind !== "custom" && LANGS.some((l) => SIG_LABELS[l][kind] === r.label) ? { ...r, label: SIG_LABELS[lang][kind] } : r;
  });
}

/* ── HTML pieces ───────────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u2E80-\u9FFF\uFF00-\uFFEF]/;
const LATIN = "Arial, Helvetica, sans-serif";
/** A light name needs a face that has a light weight (Mac mail apps). */
const LATIN_LIGHT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
/** The book's email fonts, chosen by the script of the words. */
const fontFor = (s: string, light = false) =>
  ARABIC.test(s) ? "Tahoma, Arial, sans-serif" : CJK.test(s) ? "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', Arial, sans-serif" : light ? LATIN_LIGHT : LATIN;

const INK = "#000000";
const GREY = "#6E6E73";
const RULE = "#D2D2D7";

interface Ctx {
  lang: Lang; rtl: boolean; size: number; base: string; preview: boolean;
  fg: string; soft: string; link: string;
  /** The accent: hairlines, bars, rules; `frame` for a frame's border. */
  line: string; frame: string; dots: boolean;
  /** Logo width in px (the letters, not the tile). */
  logoW: number;
  /** Spacing factor (tight, normal, airy). */
  k: number;
  nameSize: number; nameWeight: number; titleCaps: boolean;
  /** Where a tap on the logo goes, or null. */
  logoHref: string | null;
}
const S = (c: Ctx) => (c.rtl ? "right" : "left");
const E = (c: Ctx) => (c.rtl ? "left" : "right");
/** A gap in px, by the spacing chosen. */
const g = (c: Ctx, px: number) => Math.max(0, Math.round(px * c.k));
/** The white margin inside a logo tile, in px on screen (5 % of the logo). */
const tilePad = (w: number) => Math.round(w * 0.05);
/** x of the book: the logo's height (logo width ÷ 6.69). */
const xOf = (w: number) => Math.round((w * 107.57) / 719.83);

/** Words in their own font; a Latin value inside an Arabic line keeps its
 *  left-to-right order. */
function words(text: string, c: Ctx, style = "", light = false): string {
  const ltrInRtl = c.rtl && !ARABIC.test(text);
  return `<span${ltrInRtl ? ' dir="ltr"' : ""} style="font-family:${fontFor(text, light)};${style}">${esc(text)}</span>`;
}

const linked = (c: Ctx, html: string) =>
  c.logoHref ? `<a href="${esc(c.logoHref)}" style="text-decoration:none;border:0;outline:none">${html}</a>` : html;

function logoImg(c: Ctx, onBlack: boolean, group: boolean): string {
  const w = group ? Math.max(c.logoW, 160) : c.logoW;
  const tw = Math.round(w * 1.1);
  const th = Math.round((tw * (group ? 156 : 120)) / 528);
  const file = `${group ? "koleex-group" : "koleex-logo"}-${onBlack ? "white-on-black" : "black-on-white"}.png`;
  const alt = group ? "KOLEEX INTERNATIONAL GROUP" : "KOLEEX";
  return linked(c, `<img src="${c.base}${ASSETS}/${file}" width="${tw}" height="${th}" alt="${alt}" style="display:block;width:${tw}px;height:${th}px;max-width:none;border:0;outline:none;text-decoration:none">`);
}
/** The dots field (ch. 57): an even grey grid, the logo on a clear panel. */
function dotsImg(c: Ctx, black: boolean): string {
  const w = Math.round(c.logoW * 1.92);
  const h = Math.round(w * 0.625);
  return linked(c, `<img src="${c.base}${ASSETS}/koleex-dots-${black ? "black" : "white"}.png" width="${w}" height="${h}" alt="KOLEEX" style="display:block;width:${w}px;height:${h}px;max-width:none;border:0;outline:none;border-radius:6px">`);
}
/** The pattern of the two pattern styles: a picture per pattern and side
 *  (`koleex-sig-up|mono-<pattern>-l|r.png`) — a signature always has one. */
const sigPattern = (v: TemplateValues) => {
  const p = patternOf(v.pattern, "scan-edge");
  return p === "none" ? "scan-edge" : p;
};
/** A premium ornament (rendered from the shared ornaments into a PNG on our
 *  domain — email apps cannot draw SVG). */
function ornament(c: Ctx, name: string, w: number, h: number, radius = 0, link = true): string {
  const img = `<img src="${c.base}${ASSETS}/koleex-sig-${name}.png" width="${w}" height="${h}" alt="KOLEEX" style="display:block;width:${w}px;height:${h}px;max-width:none;border:0;outline:none${radius ? `;border-radius:${radius}px` : ""}">`;
  return link ? linked(c, img) : img;
}
/** The portrait: the Hub photo (square), cut as a circle, a rounded square
 *  or square. Empty in the studio: the initials on grey. */
function photoHtml(v: TemplateValues, c: Ctx): string {
  const size = Math.min(120, Math.max(56, num(v, "photoSize", 84)));
  const shape = oneOf(SHAPES, v.photoShape, "circle");
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? `${Math.round(size * 0.16)}px` : "0";
  const src = str(v, "photo");
  if (src) {
    return `<img src="${esc(src)}" width="${size}" height="${size}" alt="${esc(str(v, "name"))}" style="display:block;width:${size}px;height:${size}px;max-width:none;border:0;border-radius:${radius};object-fit:cover">`;
  }
  const initials = (str(v, "name") || PLACEHOLDER[c.lang].name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td width="${size}" height="${size}" bgcolor="#E5E5EA" style="width:${size}px;height:${size}px;background:#E5E5EA;border-radius:${radius};text-align:center;vertical-align:middle;font-family:${LATIN};font-size:${Math.round(size * 0.32)}px;color:#8E8E93">${esc(initials)}</td></tr></table>`;
}

/** `mark`: "(WhatsApp)" after the mobile — kept apart from the number, so
 *  an Arabic mark never turns the number's groups around. */
interface Contact { kind: RowKind; label: string; value: string; mark: string; href: string | null }
function contactsOf(v: TemplateValues, lang: Lang): Contact[] {
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  const url = (s: string) => (/^https?:\/\//.test(s) ? s : `https://${s}`);
  return rowsOf(v)
    .filter((r) => r.on && r.value.trim())
    .map((r) => {
      const value = r.value.trim();
      const mark = r.kind === "mobile" && v.whatsapp !== false && !/whatsapp|واتساب/i.test(value) ? WHATSAPP[lang] : "";
      let href: string | null = null;
      if (r.kind === "mobile" || r.kind === "tel") href = `tel:${digits(value)}`;
      else if (r.kind === "whatsapp") href = `https://wa.me/${digits(value).replace(/^\+/, "")}`;
      else if (r.kind === "email" && /@/.test(value)) href = `mailto:${value}`;
      else if (r.kind === "web") href = url(value);
      else if ((r.kind === "linkedin" || r.kind === "custom") && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) href = url(value);
      return { kind: r.kind, label: r.label.trim(), value, mark, href };
    });
}
/** The contacts grouped into lines, as the layout says. */
function contactLines(cs: Contact[], layout: Layout): Contact[][] {
  if (layout === "one") return cs.length ? [cs] : [];
  if (layout === "lines") return cs.map((x) => [x]);
  const out: Contact[][] = [];
  let joined: Contact[] | null = null;
  for (const x of cs) {
    if (x.kind === "email" || x.kind === "web") {
      if (!joined) { joined = []; out.push(joined); }
      joined.push(x);
    } else out.push([x]);
  }
  return out;
}
/** A link row may show its label only ("LinkedIn") when "links as words"
 *  is on — the label becomes the link. */
function contactHtml(x: Contact, c: Ctx, asWords = false): string {
  if (asWords && x.href && x.label.length > 1 && (x.kind === "linkedin" || x.kind === "custom" || x.kind === "whatsapp" || x.kind === "wechat")) {
    return `<a href="${esc(x.href)}" style="color:${c.link};text-decoration:none">${words(x.label, c, `color:${c.link}`)}</a>`;
  }
  const label = x.label ? `${words(x.label, c, `color:${c.fg}`)}&nbsp;` : "";
  /* a number never breaks between its groups */
  const phone = x.kind === "mobile" || x.kind === "tel" || x.kind === "fax" || x.kind === "whatsapp";
  const value = words(x.value, c, `color:${c.link}`).replace(/ (?=[^<>]*<\/span>$)/g, phone ? "&nbsp;" : " ");
  const body = x.href ? `<a href="${esc(x.href)}" style="color:${c.link};text-decoration:none">${value}</a>` : value;
  /* the Chinese mark brings its own full-width space */
  const mark = x.mark ? `${c.lang === "zh" ? "" : "&nbsp;"}${words(x.mark, c, `color:${c.link}`)}` : "";
  return `<span style="white-space:nowrap">${label}${body}${mark}</span>`;
}
const DOT = (c: Ctx) => `<span style="color:${c.soft}">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`;

/** One text line as a table row — the only spacing every mail app keeps. */
function row(inner: string, c: Ctx, style = "", padSide = 0, align?: string): string {
  const pad = padSide ? `padding-${S(c)}:${padSide}px;` : "";
  return `<tr><td style="${pad}text-align:${align ?? S(c)};${style}">${inner}</td></tr>`;
}
const table = (c: Ctx, inner: string, style = "", attrs = "") =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${c.rtl ? ' dir="rtl"' : ""}${attrs} style="border-collapse:collapse;${style}">${inner}</table>`;

/** The name, the second-language name, the title (with the company after
 *  it, as in the book), the second title, the company line. `reply`: the
 *  short version — the name, the title and the company on one line. */
function whoRows(v: TemplateValues, c: Ctx, o: { pad?: number; inline?: boolean; reply?: boolean; align?: string; nameSize?: number } = {}): string {
  const ph = PLACEHOLDER[c.lang];
  const name = str(v, "name") || (c.preview ? ph.name : "");
  const title = str(v, "title") || (c.preview ? ph.title : "");
  const second = v.second === true;
  const name2 = second ? str(v, "name2") : "";
  const title2 = second ? str(v, "title2") : "";
  const at0 = companyAt(v);
  const at = o.reply && at0 !== "off" ? "title" : at0;
  const company = str(v, "company");
  const soft = `color:${c.soft}`;
  const caps = c.titleCaps && !o.reply ? `text-transform:uppercase;letter-spacing:0.08em;font-size:${Math.max(10, c.size - 2)}px;` : "";
  const titleLine = [title ? words(title, c, caps + soft) : "", at === "title" && company ? words(company, c, caps + soft) : ""].filter(Boolean).join(DOT(c));
  const nameSize = o.nameSize ?? c.nameSize;
  const light = c.nameWeight < 400;
  const nameHtml = name ? words(name, c, `font-size:${nameSize}px;font-weight:${c.nameWeight};color:${c.fg};${nameSize >= 20 ? "letter-spacing:-0.01em;" : ""}`, light) : "";
  const out: string[] = [];
  if (o.inline) {
    /* compact and the reply: the name and the title on one line */
    out.push(row([nameHtml, titleLine].filter(Boolean).join(DOT(c)), c, "", o.pad, o.align));
    if (o.reply) return out.join("");
    if (name2 || title2) out.push(row([name2 ? words(name2, c, `color:${c.fg}`) : "", title2 ? words(title2, c, soft) : ""].filter(Boolean).join(DOT(c)), c, "", o.pad, o.align));
  } else {
    if (nameHtml) out.push(row(nameHtml, c, `line-height:1.3;${c.titleCaps ? `padding-bottom:${g(c, 3)}px;` : ""}`, o.pad, o.align));
    if (name2 && name2 !== name) out.push(row(words(name2, c, `color:${c.fg}`), c, "", o.pad, o.align));
    if (titleLine) out.push(row(titleLine, c, "", o.pad, o.align));
    if (title2 && title2 !== title) out.push(row(words(title2, c, soft), c, "", o.pad, o.align));
  }
  if (at === "line" && company) out.push(row(words(company, c, caps + soft), c, "", o.pad, o.align));
  return out.join("");
}

function contactRows(v: TemplateValues, c: Ctx, o: { pad?: number; top: number; layout?: Layout; align?: string }): string {
  const lines = contactLines(contactsOf(v, c.lang), o.layout ?? layoutOf(v));
  if (!lines.length) return "";
  const small = Math.max(11, c.size - 1);
  const asWords = v.linkWords === true;
  return lines.map((l, i) => row(l.map((x) => contactHtml(x, c, asWords)).join(DOT(c)), c,
    `font-size:${small}px;color:${c.soft};${i === 0 ? `padding-top:${o.top}px;` : ""}`, o.pad, o.align)).join("");
}
function noteRow(v: TemplateValues, c: Ctx, pad = 0, align?: string): string {
  const note = str(v, "note");
  return note ? row(words(note, c, "color:#98989D"), c, `font-size:11px;padding-top:${g(c, 12)}px`, pad, align) : "";
}
/** A line the full height of its row (ch. 43's hairline) — or a column of
 *  dots, the brand's pattern. */
function hairline(c: Ctx, color = c.line, width = 1): string {
  return c.dots
    ? `<td style="width:0;padding:0;border-${S(c)}:2px dotted ${color};font-size:0;line-height:0">&nbsp;</td>`
    : `<td width="${width}" bgcolor="${color}" style="width:${width}px;min-width:${width}px;background:${color};font-size:0;line-height:0">&nbsp;</td>`;
}
/** A horizontal rule, full width of its table, or `width` px. */
function rule(c: Ctx, o: { top: number; bottom: number; pad?: number; width?: number; weight?: number; color?: string; center?: boolean }): string {
  const color = o.color ?? c.line;
  const w = o.width ? ` width="${o.width}"` : ' width="100%"';
  const weight = o.weight ?? 1;
  const cell = c.dots
    ? `<td style="border-top:2px dotted ${color};font-size:0;line-height:0;height:0">&nbsp;</td>`
    : `<td height="${weight}" bgcolor="${color}" style="height:${weight}px;background:${color};font-size:0;line-height:0">&nbsp;</td>`;
  const mid = o.center ? ' align="center"' : "";
  return `<tr><td${mid} style="${o.center ? "text-align:center;" : ""}padding-top:${o.top}px;padding-bottom:${o.bottom}px;${o.pad ? `padding-${S(c)}:${o.pad}px;` : ""}"><table role="presentation" cellpadding="0" cellspacing="0" border="0"${w}${mid} style="border-collapse:collapse${o.width ? `;width:${o.width}px` : ""}${o.center ? ";margin:0 auto" : ""}"><tr>${cell}</tr></table></td></tr>`;
}
const cell = (c: Ctx, inner: string, style = "", attrs = "") => `<td valign="middle"${attrs} style="vertical-align:middle;${style}">${inner}</td>`;

/* ── the sixteen layouts ───────────────────────────────────────────────── */

function drawStyle(v: TemplateValues, c: Ctx): string {
  const style = styleOf(v);
  const group = companyAt(v) === "logo";
  const w = group ? Math.max(c.logoW, 160) : c.logoW;
  const pad = tilePad(w);
  const x = xOf(w);
  const base = `font-family:${LATIN};font-size:${c.size}px;line-height:1.5;color:${c.fg};`;
  const logoRow = (top: number, bottom = 0, dark = false) =>
    `<tr><td style="padding-top:${top}px;padding-bottom:${bottom}px;text-align:${S(c)}" align="${S(c)}">${logoImg(c, dark, group)}</td></tr>`;
  /* the words beside a picture: who, the contacts, the note */
  const textBlock = (o: { top?: number; logoAfter?: boolean; nameSize?: number } = {}) => table(c, [
    whoRows(v, c, { nameSize: o.nameSize }),
    contactRows(v, c, { top: o.top ?? g(c, 6) }),
    noteRow(v, c),
    o.logoAfter ? `<tr><td style="padding-top:${Math.max(0, g(c, 12) - pad)}px;text-align:${S(c)}" align="${S(c)}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-${S(c)}:-${pad}px"><tr><td>${logoImg(c, false, group)}</td></tr></table></td></tr>` : "",
  ].join(""));

  switch (style) {
    case "standard":
      /* The book (ch. 93): name, title · company, the logo, the contacts. */
      return table(c, [
        whoRows(v, c, { pad }),
        logoRow(Math.max(0, g(c, 8) - pad)),
        contactRows(v, c, { pad, top: Math.max(0, g(c, 8) - pad) }),
        noteRow(v, c, pad),
      ].join(""), base);

    case "logo-first":
      /* Letterhead: the logo, clear space x, the name; a rule; the contacts. */
      return table(c, [
        logoRow(0, Math.max(0, g(c, x) - pad)),
        whoRows(v, c, { pad }),
        rule(c, { top: g(c, 10), bottom: g(c, 2), pad }),
        contactRows(v, c, { pad, top: g(c, 6) }),
        noteRow(v, c, pad),
      ].join(""), base);

    case "divider":
    case "logo-right":
    case "compact": {
      /* The logo, a hairline, the words (ch. 43's horizontal lockup, grown
         into a signature); mirrored with the logo after the words; compact
         keeps two lines. */
      const compact = style === "compact";
      const text = table(c, [
        whoRows(v, c, { inline: compact }),
        contactRows(v, c, { top: compact ? 0 : g(c, 6) }),
        noteRow(v, c),
      ].join(""));
      const logoCell = (start: boolean) => cell(c, logoImg(c, false, group), `padding-${start ? E(c) : S(c)}:${Math.max(0, g(c, x) - pad)}px`);
      const textCell = (start: boolean) => cell(c, text, `padding-${start ? E(c) : S(c)}:${g(c, x)}px`);
      const cells = style === "logo-right" ? `${textCell(true)}${hairline(c)}${logoCell(false)}` : `${logoCell(true)}${hairline(c)}${textCell(false)}`;
      return table(c, `<tr>${cells}</tr>`, base);
    }

    case "portrait":
      /* The portrait, a hairline, the words, the logo under them. */
      return table(c, `<tr>${cell(c, photoHtml(v, c), `padding-${E(c)}:${g(c, 18)}px`)}${hairline(c)}${cell(c, textBlock({ logoAfter: true }), `padding-${S(c)}:${g(c, 18)}px`)}</tr>`, base);

    case "portrait-top": {
      /* A profile: the portrait beside the name, a rule, the contacts and the
         logo under it. */
      const head = table(c, `<tr>${cell(c, photoHtml(v, c), `padding-${E(c)}:${g(c, 14)}px`)}${cell(c, table(c, whoRows(v, c)))}</tr>`);
      return table(c, [
        `<tr><td>${head}</td></tr>`,
        rule(c, { top: g(c, 12), bottom: 0 }),
        contactRows(v, c, { top: g(c, 8) }),
        noteRow(v, c),
        `<tr><td style="padding-top:${Math.max(0, g(c, 10) - pad)}px;text-align:${S(c)}" align="${S(c)}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-${S(c)}:-${pad}px"><tr><td>${logoImg(c, false, group)}</td></tr></table></td></tr>`,
      ].join(""), base);
    }

    case "accent-bar":
      /* A bar of the accent colour beside the words; the logo at the foot. */
      return table(c, `<tr>${hairline(c, c.line, 3)}${cell(c, textBlock({ logoAfter: true }), `padding-${S(c)}:${g(c, 16)}px`)}</tr>`, base);

    case "editorial": {
      /* A large light name, the title in spaced capitals, a short rule, the
         contacts, the logo. */
      return table(c, [
        whoRows(v, c, { pad }),
        rule(c, { top: g(c, 12), bottom: g(c, 10), pad, width: 32, weight: 2 }),
        contactRows(v, c, { pad, top: 0 }),
        noteRow(v, c, pad),
        logoRow(Math.max(0, g(c, 14) - pad)),
      ].join(""), base);
    }

    case "columns": {
      /* The logo on top; the person on one side of a hairline, the contacts
         on the other. */
      const who = table(c, whoRows(v, c));
      const contacts = table(c, contactRows(v, c, { top: 0, layout: v.contactLayout === "one" ? "lines" : layoutOf(v) }) + noteRow(v, c));
      const cols = table(c, `<tr>${cell(c, who, `padding-${E(c)}:${g(c, 18)}px;vertical-align:top`)}${hairline(c)}${cell(c, contacts, `padding-${S(c)}:${g(c, 18)}px;vertical-align:top`)}</tr>`);
      return table(c, [logoRow(0, Math.max(0, g(c, 12) - pad)), `<tr><td style="padding-${S(c)}:${pad}px">${cols}</td></tr>`].join(""), base);
    }

    case "dots-black":
    case "dots-white": {
      /* The dots field with the logo on its clear panel, then the words. */
      const black = style === "dots-black";
      return table(c, `<tr>${cell(c, dotsImg(c, black), `padding-${E(c)}:${g(c, 20)}px`)}${cell(c, textBlock())}</tr>`, base);
    }

    /* ── the premium set: the certificates' ornaments as pictures ── */
    case "p-medallion":
      /* the foil medallion, a hairline, the words and the logo */
      return table(c, `<tr>${cell(c, ornament(c, "medallion", 72, 72), `padding-${E(c)}:${g(c, 18)}px`)}${hairline(c)}${cell(c, textBlock({ logoAfter: true }), `padding-${S(c)}:${g(c, 18)}px`)}</tr>`, base);
    case "p-knockout":
      /* the dots field, the full logo in a framed clear window */
      return table(c, `<tr>${cell(c, ornament(c, "knockout", 192, 120, 6), `padding-${E(c)}:${g(c, 20)}px`)}${cell(c, textBlock())}</tr>`, base);
    case "p-underprint":
      /* the KOLEEX pattern as tall as the words, its edge to the outside; the words and the logo */
      return table(c, `<tr>${cell(c, ornament(c, `up-${sigPattern(v)}-${c.rtl ? "r" : "l"}`, 100, 150), `padding-${E(c)}:${g(c, 20)}px`)}${cell(c, textBlock({ logoAfter: true }))}</tr>`, base);
    case "p-monolith":
      /* a black column: the logo on clean ground over the KOLEEX pattern */
      return table(c, `<tr>${cell(c, ornament(c, `mono-${sigPattern(v)}-${c.rtl ? "r" : "l"}`, 120, 150, 6), `padding-${E(c)}:${g(c, 20)}px`)}${cell(c, textBlock())}</tr>`, base);
    case "p-guilloche":
      /* the logo, the name, a guilloche band, the contacts */
      return table(c, [
        logoRow(0, Math.max(0, g(c, 12) - pad)),
        whoRows(v, c, { pad }),
        `<tr><td style="padding-top:${g(c, 12)}px;padding-bottom:${g(c, 8)}px;padding-${S(c)}:${pad}px">${ornament(c, "guilloche", 360, 14, 0, false)}</td></tr>`,
        contactRows(v, c, { pad, top: 0 }),
        noteRow(v, c, pad),
      ].join(""), base);

    case "band": {
      /* A black band — the white logo and the website — over the words, in
         a light frame: the business card on screen. */
      const web = contactsOf(v, c.lang).find((y) => y.kind === "web");
      const bandRow = table(c, `<tr>${cell(c, logoImg(c, true, group))}${web ? cell(c, `<a href="${esc(web.href ?? KOLEEX_SITE)}" style="color:#D2D2D7;text-decoration:none">${words(web.value, c, "color:#D2D2D7")}</a>`, `text-align:${E(c)};font-size:${Math.max(11, c.size - 2)}px`, ` align="${E(c)}"`) : ""}</tr>`, "", ' width="100%"');
      const body = table(c, [whoRows(v, c), contactRows(v, c, { top: g(c, 8) }), noteRow(v, c)].join(""));
      return table(c, [
        `<tr><td bgcolor="#000000" style="background:#000000;padding:${g(c, 16) - pad}px ${20 - pad}px;border-radius:8px 8px 0 0">${bandRow}</td></tr>`,
        `<tr><td style="padding:${g(c, 16)}px 20px ${g(c, 18)}px;border:1px solid ${RULE};border-top:0;border-radius:0 0 8px 8px">${body}</td></tr>`,
      ].join(""), `${base}border-collapse:separate;width:100%;max-width:440px`, ' width="440"');
    }

    case "outline": {
      /* A thin frame: the words, and the logo in the top corner. */
      const text = table(c, [whoRows(v, c), contactRows(v, c, { top: g(c, 8) }), noteRow(v, c)].join(""));
      const inner = `<tr><td valign="top" style="vertical-align:top;padding-${E(c)}:32px">${text}</td><td valign="top" align="${E(c)}" style="vertical-align:top;text-align:${E(c)}">${logoImg(c, false, group)}</td></tr>`;
      return table(c, `<tr><td style="padding:${g(c, 18)}px 22px;border:1px solid ${c.frame};border-radius:8px">${table(c, inner)}</td></tr>`, `${base}border-collapse:separate`);
    }

    case "centered":
      /* Everything on the centre line — reads well on a phone. */
      return table(c, [
        `<tr><td align="center" style="text-align:center;padding-bottom:${Math.max(0, g(c, 12) - pad)}px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto"><tr><td>${logoImg(c, false, group)}</td></tr></table></td></tr>`,
        whoRows(v, c, { align: "center" }),
        rule(c, { top: g(c, 10), bottom: g(c, 8), width: 40, center: true }),
        contactRows(v, c, { top: 0, align: "center" }),
        noteRow(v, c, 0, "center"),
      ].join(""), base);

    default: {
      /* black: the team card's colours — the white logo on black, white name. */
      const text = [whoRows(v, c, { pad }), contactRows(v, c, { pad, top: g(c, 8) }), noteRow(v, c, pad)].join("");
      const inner = table(c, `${logoRow(0, Math.max(0, g(c, x) - pad), true)}${text}`);
      return table(c, `<tr><td bgcolor="#000000" style="background:#000000;padding:${g(c, 22) - pad}px ${26 - pad}px ${g(c, 22)}px;border-radius:8px">${inner}</td></tr>`, base);
    }
  }
}

/** The event banner (ch. 93): black, 600 wide, the context header — logo |
 *  event — and one line: the booth in bold, the dates in light. */
function drawBanner(v: TemplateValues, c: Ctx): string {
  const event = str(v, "bannerEvent");
  const main = str(v, "bannerMain");
  const sub = str(v, "bannerSub");
  const link = str(v, "bannerLink");
  if (!event && !main && !sub) return "";
  const bc: Ctx = { ...c, fg: "#FFFFFF", soft: "#D2D2D7", link: "#FFFFFF", logoW: 100, logoHref: null };
  const pad = tilePad(100), x = xOf(100);
  const header = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${c.rtl ? ' dir="rtl"' : ""} style="border-collapse:collapse"><tr>`
    + `<td valign="middle" style="vertical-align:middle">${logoImg(bc, true, false)}</td>`
    + (event ? `<td valign="middle" style="vertical-align:middle;padding-${S(c)}:${x - pad}px;padding-${E(c)}:${x}px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="1" height="${x}" bgcolor="#FFFFFF" style="width:1px;height:${x}px;background:#FFFFFF;font-size:0;line-height:0">&nbsp;</td></tr></table></td>`
      + `<td valign="middle" style="vertical-align:middle;font-size:13px;line-height:1.2;color:#FFFFFF">${words(event, bc, "color:#FFFFFF")}</td>` : "")
    + `</tr></table>`;
  const mainHtml = main ? words(main, bc, "font-weight:700;color:#FFFFFF") : "";
  const subHtml = sub ? words(sub, bc, "color:#D2D2D7") : "";
  let second = [mainHtml, subHtml].filter(Boolean).join("&nbsp;&nbsp;&nbsp;");
  if (second && link) second = `<a href="${esc(/^https?:\/\//.test(link) ? link : `https://${link}`)}" style="color:#FFFFFF;text-decoration:none">${second}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"${c.rtl ? ' dir="rtl"' : ""} bgcolor="#000000" style="width:100%;max-width:600px;background:#000000;border-collapse:separate;border-radius:4px;font-family:${LATIN}">`
    + `<tr><td style="padding:${26 - pad}px ${28 - pad}px ${second ? 0 : 26}px;text-align:${S(c)}">${header}</td></tr>`
    + (second ? `<tr><td style="padding:16px 28px 28px;font-size:16px;line-height:1.3;text-align:${S(c)}">${second}</td></tr>` : "")
    + `</table>`;
}

function ctxOf(v: TemplateValues, base: string, preview: boolean): Ctx {
  const lang = asLang(v.lang);
  const style = styleOf(v);
  const black = style === "black";
  const accent = oneOf(ACCENTS, v.accent, STYLE_DEFAULTS[style].accent);
  const fg = black ? "#FFFFFF" : INK;
  const soft = black ? "#A1A1A6" : GREY;
  const line = accent === "blue" ? HUB_BLUE : accent === "grey" ? (black ? "#48484A" : "#C7C7CC") : fg;
  const linkColour = oneOf(LINK_COLOURS, v.linkColor, "grey");
  const link = linkColour === "ink" ? fg : linkColour === "accent" && accent !== "grey" ? line : black ? "#D2D2D7" : GREY;
  const web = contactsOf(v, lang).find((x) => x.kind === "web");
  return {
    lang, rtl: lang === "ar", base, preview,
    size: Math.min(15, Math.max(12, num(v, "size", 13))),
    fg, soft, link, line,
    frame: accent === "blue" ? HUB_BLUE : accent === "black" ? INK : RULE,
    dots: v.ruleStyle === "dots",
    logoW: Math.min(160, Math.max(100, num(v, "logoW", 120))),
    k: v.spacing === "tight" ? 0.7 : v.spacing === "airy" ? 1.4 : 1,
    nameSize: Math.min(26, Math.max(12, num(v, "nameSize", STYLE_DEFAULTS[style].nameSize))),
    nameWeight: v.nameWeight === "light" ? 300 : v.nameWeight === "regular" ? 400 : 700,
    titleCaps: v.titleCaps === true,
    logoHref: v.logoLink === false ? null : web?.href ?? KOLEEX_SITE,
  };
}

/** The whole signature, or its reply version (ch. 93: name, title, phone). */
export function signatureHtml(v: TemplateValues, o: { variant: string; base: string; preview?: boolean }): string {
  const c = ctxOf(v, o.base, o.preview === true);
  if (o.variant === "reply") {
    const plain: Ctx = { ...c, fg: INK, soft: GREY, link: GREY, nameWeight: 700 };
    const phone = contactsOf(v, c.lang).find((x) => x.kind === "mobile" || x.kind === "tel" || x.kind === "whatsapp");
    return table(plain, [
      whoRows(v, plain, { nameSize: c.size, inline: true, reply: true }),
      phone ? row(contactHtml(phone, plain), plain, `font-size:${Math.max(11, c.size - 1)}px;color:${GREY}`) : "",
    ].join(""), `font-family:${LATIN};font-size:${c.size}px;line-height:1.5;color:${INK};`);
  }
  const sig = drawStyle(v, c);
  const banner = v.bannerOn === true ? drawBanner(v, c) : "";
  if (!banner) return sig;
  /* Beside the signature, not inside it: 600 px of the mail, or all of a
     phone's width. */
  const gap = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td height="16" style="height:16px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
  return `${sig}${gap}${banner}`;
}

const plainValue = (x: Contact, lang: Lang) => (x.mark ? `${x.value}${lang === "zh" ? "" : " "}${x.mark}` : x.value);

/** The same as plain text — the clipboard's second format. */
export function signatureText(v: TemplateValues, variant: string): string {
  const lang = asLang(v.lang);
  const at = companyAt(v);
  const company = str(v, "company");
  const second = v.second === true;
  const title = [str(v, "title"), at === "title" ? company : ""].filter(Boolean).join(" · ");
  const cs = contactsOf(v, lang);
  if (variant === "reply") {
    const phone = cs.find((x) => x.kind === "mobile" || x.kind === "tel" || x.kind === "whatsapp");
    const short = [str(v, "title"), at !== "off" ? company : ""].filter(Boolean).join(" · ");
    return [[str(v, "name"), short].filter(Boolean).join(" · "), phone ? [phone.label, plainValue(phone, lang)].filter(Boolean).join(" ") : ""].filter(Boolean).join("\n");
  }
  const lines = [
    str(v, "name"), second ? str(v, "name2") : "", title, second ? str(v, "title2") : "",
    at === "line" || at === "logo" ? company || EVERYDAY_NAME_EN : "",
    ...contactLines(cs, layoutOf(v)).map((l) => l.map((x) => [x.label, plainValue(x, lang)].filter(Boolean).join(" ")).join(" · ")),
    str(v, "note"),
  ];
  const out = lines.filter(Boolean);
  const banner = [str(v, "bannerEvent"), str(v, "bannerMain"), str(v, "bannerSub")].filter(Boolean).join(" — ");
  if (v.bannerOn === true && banner) out.push("", banner);
  return out.join("\n");
}

/* ── the template ──────────────────────────────────────────────────────── */

const isStyle = (...styles: Style[]) => (v: TemplateValues) => styles.includes(styleOf(v));
const PERSONAL_ROWS = ["mobile", "email", "whatsapp", "wechat", "linkedin"];
const PERSONAL_KEYS = ["name", "name2", "title", "title2", "titleKey", "title2Key", "photo"];
const choice = <T extends string>(key: string, labelKey: string, group: string, values: readonly T[], words: string, when?: (v: TemplateValues) => boolean) =>
  ({ key, kind: "choice" as const, labelKey, group, options: values.map((value) => ({ value, labelKey: `${words}.${value}` })), ...(when ? { when } : {}) });

function sigFromPerson(p: BcPerson, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  const lang2 = asLang(v.lang2);
  const rows = list(v, "rows").map((r) => ({ ...r }));
  const setRow = (kind: string, value: string) => {
    if (!value) return;
    const i = rows.findIndex((r) => r.kind === kind);
    if (i >= 0) rows[i] = { ...rows[i], value };
  };
  setRow("mobile", p.mobile ? formatMobile(p.mobile) : "");
  setRow("email", p.email ?? "");
  return {
    name: nameIn(p, lang), title: titleOf(p, lang), titleKey: p.title ?? "",
    name2: nameIn(p, lang2), title2: titleOf(p, lang2), title2Key: p.title ?? "",
    rows: rows as TemplateItem[],
    ...(typeof v.photo === "string" && v.photo.startsWith("data:") ? {} : { photo: p.photo ?? "" }),
  };
}

export const emailSignature: TemplateDef = {
  id: "email-signature",
  itemKey: "email",
  nameKey: "sig.name",
  size: () => ({ w: 0, h: 0 }),
  bleed: 0,
  safe: 0,
  pages: [],
  html: {
    render: (v, o) => signatureHtml(v, o),
    text: signatureText,
    variants: ["full", "reply"],
    host: SIGNATURE_HOST,
  },
  fields: [
    choice("style", "tpl.f.style", "look", SIG_STYLES, "sig.style"),
    { key: "lang", kind: "choice", labelKey: "sig.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(false), when: isStyle("p-underprint", "p-monolith") },
    choice("accent", "sig.f.accent", "look", ACCENTS, "sig.accent"),
    choice("ruleStyle", "sig.f.ruleStyle", "look", RULES, "sig.rule", (v) => !isStyle("standard", "black", "band", "dots-black", "dots-white")(v) || v.ruleStyle === "dots"),
    { key: "logoW", kind: "range", labelKey: "sig.f.logoW", group: "look", min: 100, max: 160, step: 10 },
    { key: "logoLink", kind: "switch", labelKey: "sig.f.logoLink", group: "look" },
    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 60 },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "second", kind: "switch", labelKey: "sig.f.second", group: "person" },
    { key: "lang2", kind: "choice", labelKey: "sig.f.lang2", group: "person", when: (v) => v.second === true, options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "name2", kind: "text", labelKey: "sig.f.name2", group: "person", max: 60, when: (v) => v.second === true },
    { key: "title2", kind: "title", labelKey: "sig.f.title2", group: "person", langKey: "lang2", when: (v) => v.second === true },
    { key: "photo", kind: "image", labelKey: "tpl.f.photo", group: "photo", hintKey: "sig.f.photoHint", fromPerson: "photo", when: isStyle(...PHOTO_STYLES) },
    choice("photoShape", "sig.f.photoShape", "photo", SHAPES, "sig.shape", isStyle(...PHOTO_STYLES)),
    { key: "photoSize", kind: "range", labelKey: "sig.f.photoSize", group: "photo", min: 56, max: 120, step: 4, when: isStyle(...PHOTO_STYLES) },
    { key: "nameSize", kind: "range", labelKey: "sig.f.nameSize", group: "type", min: 12, max: 26, step: 1 },
    choice("nameWeight", "sig.f.nameWeight", "type", WEIGHTS, "sig.weight"),
    { key: "size", kind: "range", labelKey: "sig.f.size", group: "type", min: 12, max: 15, step: 1 },
    { key: "titleCaps", kind: "switch", labelKey: "sig.f.titleCaps", group: "type" },
    choice("spacing", "sig.f.spacing", "type", SPACINGS, "sig.spacing"),
    choice("companyAt", "sig.f.companyAt", "brand", COMPANY_AT, "sig.at"),
    { key: "company", kind: "text", labelKey: "tpl.f.company", group: "brand", max: 60, hintKey: "sig.f.companyHint", when: (v) => companyAt(v) === "title" || companyAt(v) === "line" },
    { key: "rows", kind: "rows", labelKey: "tpl.f.rows", group: "contacts", langKey: "lang", labels: SIG_LABELS },
    { key: "whatsapp", kind: "switch", labelKey: "tpl.f.whatsapp", group: "contacts" },
    choice("contactLayout", "sig.f.contactLayout", "contacts", LAYOUTS, "sig.layout"),
    choice("linkColor", "sig.f.linkColor", "contacts", LINK_COLOURS, "sig.link"),
    { key: "linkWords", kind: "switch", labelKey: "sig.f.linkWords", group: "contacts" },
    { key: "note", kind: "text", labelKey: "sig.f.note", group: "details", max: 160, hintKey: "sig.f.noteHint" },
    { key: "bannerOn", kind: "switch", labelKey: "sig.f.bannerOn", group: "banner" },
    { key: "bannerEvent", kind: "text", labelKey: "sig.f.bannerEvent", group: "banner", max: 40, placeholder: "CISMA 2025", when: (v) => v.bannerOn === true },
    { key: "bannerMain", kind: "text", labelKey: "sig.f.bannerMain", group: "banner", max: 60, placeholder: "Booth W5-C42", when: (v) => v.bannerOn === true },
    { key: "bannerSub", kind: "text", labelKey: "sig.f.bannerSub", group: "banner", max: 60, placeholder: "24–27 September 2025", when: (v) => v.bannerOn === true },
    { key: "bannerLink", kind: "text", labelKey: "sig.f.bannerLink", group: "banner", max: 200, hintKey: "sig.f.bannerLinkHint", when: (v) => v.bannerOn === true },
  ],
  defaults: {
    style: "standard", lang: "en", pattern: "scan-edge", accent: "black", ruleStyle: "solid", logoW: 120, logoLink: true,
    name: "", title: "", titleKey: "", second: false, lang2: "zh", name2: "", title2: "", title2Key: "",
    photo: "", photoShape: "circle", photoSize: 84,
    nameSize: 13, nameWeight: "bold", size: 13, titleCaps: false, spacing: "normal",
    companyAt: "title", company: EVERYDAY_NAME_EN,
    rows: sigRows("en"), whatsapp: true, contactLayout: "book", linkColor: "grey", linkWords: false,
    note: "",
    bannerOn: false, bannerEvent: "", bannerMain: "", bannerSub: "", bannerLink: "",
  },
  fromPerson: sigFromPerson,
  fillName: (v, t) => t(`sig.style.${styleOf(v)}`),
  relang: (v, lang) => ({ ...v, lang, rows: relangSigRows(list(v, "rows"), asLang(lang)) }),
  /* A style brings its designer's settings (contact layout, company place,
     accent, the name's size and weight, title capitals); the group lockup
     under the logo, or no company, stays as chosen. */
  restyle: (v, style) => {
    const d = STYLE_DEFAULTS[oneOf(SIG_STYLES, style, "standard")];
    const keep = companyAt(v) === "logo" || companyAt(v) === "off";
    return {
      ...v, style, contactLayout: d.contactLayout, companyAt: keep ? companyAt(v) : d.companyAt,
      accent: d.accent, nameSize: d.nameSize, nameWeight: d.nameWeight, titleCaps: d.titleCaps,
    };
  },
  specKeys: (v) => [
    "sig.spec.content",
    "sig.spec.fonts",
    "sig.spec.logo",
    ...(companyAt(v) === "logo" ? ["sig.spec.group"] : []),
    ...(isStyle(...PHOTO_STYLES)(v) ? ["sig.spec.photo"] : []),
    ...(isStyle(...DOTS_STYLES)(v) || v.ruleStyle === "dots" ? ["sig.spec.dots"] : []),
    ...(isStyle("black", "band")(v) ? ["sig.spec.black"] : []),
    ...(String(v.style).startsWith("p-") ? ["sig.spec.premium"] : []),
    ...(v.bannerOn === true ? ["sig.spec.banner"] : []),
    "sig.spec.reply",
  ],
  forSaving: (v, keepPerson) => {
    const out: TemplateValues = { ...v };
    if (typeof out.photo === "string" && out.photo.startsWith("data:")) out.photo = "";
    if (keepPerson) return out;
    for (const k of PERSONAL_KEYS) out[k] = "";
    out.rows = list(v, "rows").map((r) => (PERSONAL_ROWS.includes(String(r.kind)) ? { ...r, value: "" } : r));
    return out;
  },
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (isStyle(...PHOTO_STYLES)(v)) {
      if (!str(v, "photo")) return "sig.needPhoto";
      if (str(v, "photo").startsWith("data:")) return "sig.needHostedPhoto";
    }
    if (v.bannerOn === true && !str(v, "bannerEvent") && !str(v, "bannerMain")) return "sig.needBanner";
    return null;
  },
};
