/* ---------------------------------------------------------------------------
   Email signature (brand book ch. 93; plan step C11). Not paper: the studio
   shows it inside a mail and copies it as HTML that Gmail, Outlook, Apple
   Mail and Foxmail keep — tables and inline styles only, the fonts every
   computer has (ch. 92: Arial / Helvetica, Tahoma for Arabic, PingFang /
   Microsoft YaHei for Chinese), pictures from our own domain.

   The content is the book's: name, title, logo, one phone, one email, the
   website. It comes in seven approved layouts (owner 29/09/2026: "more
   styles, everything editable"), three languages and an optional second
   one, with the reply version the book asks for. The event banner is shown
   only while there is an event. The logo is a picture on its own white
   (or black) tile: a mail app in dark mode flips colours but not pictures,
   so the logo is never drawn black on black.
   --------------------------------------------------------------------------- */

import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import type { BcPerson } from "@/lib/brand-center/client";
import { formatMobile, nameIn, titleOf } from "./person";
import type { TemplateDef, TemplateItem, TemplateValues } from "./types";
import { LANGS, asLang, list, num, rowKind, rowsOf, str, type Lang, type RowKind } from "./card/model";

/** Where the pictures load from in a real mail — our own domain, reachable
 *  from mainland China (ch. 93). */
export const SIGNATURE_HOST = "https://hub.koleexgroup.com";
const ASSETS = "/brand/email";

export const SIG_STYLES = ["standard", "logo-first", "divider", "logo-right", "outline", "black", "compact"] as const;
type Style = (typeof SIG_STYLES)[number];
const styleOf = (v: TemplateValues): Style => ((SIG_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as Style) : "standard");

/** Where the company's name goes: after the title (the book), on its own
 *  line, under the logo as the group lockup (ch. 43), or nowhere. */
const COMPANY_AT = ["title", "line", "logo", "off"] as const;
type CompanyAt = (typeof COMPANY_AT)[number];
const companyAt = (v: TemplateValues): CompanyAt => ((COMPANY_AT as readonly string[]).includes(String(v.companyAt)) ? (v.companyAt as CompanyAt) : "title");

/** How the contact lines sit: the book (each phone on its line, email and
 *  website together), one per line, or all on one line. */
const LAYOUTS = ["book", "lines", "one"] as const;
type Layout = (typeof LAYOUTS)[number];
const layoutOf = (v: TemplateValues): Layout => ((LAYOUTS as readonly string[]).includes(String(v.contactLayout)) ? (v.contactLayout as Layout) : "book");

/** What each style brings when it is picked. */
const STYLE_DEFAULTS: Record<Style, { companyAt: CompanyAt; contactLayout: Layout }> = {
  standard: { companyAt: "title", contactLayout: "book" },
  "logo-first": { companyAt: "line", contactLayout: "one" },
  divider: { companyAt: "line", contactLayout: "lines" },
  "logo-right": { companyAt: "line", contactLayout: "lines" },
  outline: { companyAt: "line", contactLayout: "lines" },
  black: { companyAt: "line", contactLayout: "lines" },
  compact: { companyAt: "title", contactLayout: "one" },
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
/** The book's email fonts, chosen by the script of the words. */
const fontFor = (s: string) =>
  ARABIC.test(s) ? "Tahoma, Arial, sans-serif" : CJK.test(s) ? "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', Arial, sans-serif" : LATIN;

const INK = "#000000";
const GREY = "#6E6E73";
const RULE = "#D2D2D7";

interface Ctx {
  lang: Lang; rtl: boolean; size: number; base: string; preview: boolean;
  fg: string; soft: string; link: string;
  /** Logo width in px (the letters, not the tile). */
  logoW: number;
}
const S = (c: Ctx) => (c.rtl ? "right" : "left");
const E = (c: Ctx) => (c.rtl ? "left" : "right");
/** The white margin inside a logo tile, in px on screen (5 % of the logo). */
const tilePad = (w: number) => Math.round(w * 0.05);
/** x of the book: the logo's height (logo width ÷ 6.69). */
const xOf = (w: number) => Math.round((w * 107.57) / 719.83);

/** Words in their own font; a Latin value inside an Arabic line keeps its
 *  left-to-right order. */
function words(text: string, c: Ctx, style = ""): string {
  const ltrInRtl = c.rtl && !ARABIC.test(text);
  return `<span${ltrInRtl ? ' dir="ltr"' : ""} style="font-family:${fontFor(text)};${style}">${esc(text)}</span>`;
}

function logoImg(c: Ctx, onBlack: boolean, group: boolean): string {
  const w = group ? Math.max(c.logoW, 160) : c.logoW;
  const tw = Math.round(w * 1.1);
  const th = Math.round((tw * (group ? 156 : 120)) / 528);
  const file = `${group ? "koleex-group" : "koleex-logo"}-${onBlack ? "white-on-black" : "black-on-white"}.png`;
  const alt = group ? "KOLEEX INTERNATIONAL GROUP" : "KOLEEX";
  return `<img src="${c.base}${ASSETS}/${file}" width="${tw}" height="${th}" alt="${alt}" style="display:block;width:${tw}px;height:${th}px;max-width:none;border:0;outline:none;text-decoration:none">`;
}

/** `mark`: "(WhatsApp)" after the mobile — kept apart from the number, so
 *  an Arabic mark never turns the number's groups around. */
interface Contact { kind: RowKind; label: string; value: string; mark: string; href: string | null }
function contactsOf(v: TemplateValues, lang: Lang): Contact[] {
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  return rowsOf(v)
    .filter((r) => r.on && r.value.trim())
    .map((r) => {
      const value = r.value.trim();
      const mark = r.kind === "mobile" && v.whatsapp !== false && !/whatsapp|واتساب/i.test(value) ? WHATSAPP[lang] : "";
      let href: string | null = null;
      if (r.kind === "mobile" || r.kind === "tel") href = `tel:${digits(value)}`;
      else if (r.kind === "whatsapp") href = `https://wa.me/${digits(value).replace(/^\+/, "")}`;
      else if (r.kind === "email" && /@/.test(value)) href = `mailto:${value}`;
      else if (r.kind === "web") href = /^https?:\/\//.test(value) ? value : `https://${value}`;
      else if (r.kind === "linkedin" && /linkedin\.com/i.test(value)) href = /^https?:\/\//.test(value) ? value : `https://${value}`;
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
function contactHtml(x: Contact, c: Ctx): string {
  const label = x.label ? `${words(x.label, c, `color:${c.fg}`)}&nbsp;` : "";
  const value = words(x.value, c, `color:${c.link}`);
  const body = x.href ? `<a href="${esc(x.href)}" style="color:${c.link};text-decoration:none">${value}</a>` : value;
  /* the Chinese mark brings its own full-width space */
  const mark = x.mark ? `${c.lang === "zh" ? "" : "&nbsp;"}${words(x.mark, c, `color:${c.link}`)}` : "";
  return `${label}${body}${mark}`;
}
const DOT = (c: Ctx) => `<span style="color:${c.soft}">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`;
function lineHtml(line: Contact[], c: Ctx): string {
  return line.map((x) => contactHtml(x, c)).join(DOT(c));
}

/** One text line as a table row — the only spacing every mail app keeps. */
function row(inner: string, c: Ctx, style = "", padSide = 0): string {
  const pad = padSide ? `padding-${S(c)}:${padSide}px;` : "";
  return `<tr><td style="${pad}text-align:${S(c)};${style}">${inner}</td></tr>`;
}
const table = (c: Ctx, inner: string, style = "") =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${c.rtl ? ' dir="rtl"' : ""} style="border-collapse:collapse;${style}">${inner}</table>`;

/** The name, the second-language name, the title (with the company after
 *  it, as in the book), the second title, the company line. `reply`: the
 *  short version — the name, the title and the company on one line. */
function whoRows(v: TemplateValues, c: Ctx, o: { nameSize: number; pad?: number; inline?: boolean; reply?: boolean }): string {
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
  const titleLine = [title ? words(title, c, soft) : "", at === "title" && company ? words(company, c, soft) : ""].filter(Boolean).join(DOT(c));
  const nameHtml = name ? words(name, c, `font-size:${o.nameSize}px;font-weight:700;color:${c.fg}`) : "";
  const out: string[] = [];
  if (o.inline) {
    /* compact: the name and the title on one line */
    out.push(row([nameHtml, titleLine].filter(Boolean).join(DOT(c)), c, "", o.pad));
    if (o.reply) return out.join("");
    if (name2 || title2) out.push(row([name2 ? words(name2, c, `color:${c.fg}`) : "", title2 ? words(title2, c, soft) : ""].filter(Boolean).join(DOT(c)), c, "", o.pad));
  } else {
    if (nameHtml) out.push(row(nameHtml, c, "line-height:1.35", o.pad));
    if (name2 && name2 !== name) out.push(row(words(name2, c, `color:${c.fg}`), c, "", o.pad));
    if (titleLine) out.push(row(titleLine, c, "", o.pad));
    if (title2 && title2 !== title) out.push(row(words(title2, c, soft), c, "", o.pad));
  }
  if (at === "line" && company) out.push(row(words(company, c, soft), c, "", o.pad));
  return out.join("");
}

function contactRows(v: TemplateValues, c: Ctx, o: { pad?: number; top: number; layout?: Layout }): string {
  const lines = contactLines(contactsOf(v, c.lang), o.layout ?? layoutOf(v));
  if (!lines.length) return "";
  const small = Math.max(11, c.size - 1);
  return lines.map((l, i) => row(lineHtml(l, c), c, `font-size:${small}px;color:${c.soft};${i === 0 ? `padding-top:${o.top}px;` : ""}`, o.pad)).join("");
}
function noteRow(v: TemplateValues, c: Ctx, pad = 0): string {
  const note = str(v, "note");
  return note ? row(words(note, c, "color:#98989D"), c, "font-size:11px;padding-top:12px", pad) : "";
}
/** A 1 px line the full height of its row (ch. 43: the hairline). */
const hairline = (color: string) =>
  `<td width="1" bgcolor="${color}" style="width:1px;min-width:1px;background:${color};font-size:0;line-height:0">&nbsp;</td>`;

/* ── the seven layouts ─────────────────────────────────────────────────── */

function drawStyle(v: TemplateValues, c: Ctx): string {
  const style = styleOf(v);
  const group = companyAt(v) === "logo";
  const w = group ? Math.max(c.logoW, 160) : c.logoW;
  const pad = tilePad(w);
  const x = xOf(w);
  const base = `font-family:${LATIN};font-size:${c.size}px;line-height:1.5;color:${c.fg};`;

  if (style === "standard") {
    /* The book (ch. 93): name, title · company, the logo, the contacts. */
    return table(c, [
      whoRows(v, c, { nameSize: c.size, pad }),
      `<tr><td style="padding-top:${Math.max(0, 8 - pad)}px;text-align:${S(c)}" align="${S(c)}">${logoImg(c, false, group)}</td></tr>`,
      contactRows(v, c, { pad, top: Math.max(0, 8 - pad) }),
      noteRow(v, c, pad),
    ].join(""), base);
  }
  if (style === "logo-first") {
    /* Letterhead: the logo, clear space x, the name; a rule; the contacts. */
    const rule = `<tr><td style="padding:10px 0 2px;padding-${S(c)}:${pad}px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse"><tr><td height="1" bgcolor="${RULE}" style="height:1px;background:${RULE};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
    return table(c, [
      `<tr><td style="padding-bottom:${Math.max(0, x - pad)}px;text-align:${S(c)}" align="${S(c)}">${logoImg(c, false, group)}</td></tr>`,
      whoRows(v, c, { nameSize: c.size + 3, pad }),
      rule,
      contactRows(v, c, { pad, top: 6 }),
      noteRow(v, c, pad),
    ].join(""), base);
  }
  if (style === "divider" || style === "logo-right" || style === "compact") {
    /* The logo, a hairline, the words (ch. 43's horizontal lockup, grown
       into a signature); mirrored with the logo after the words; compact
       keeps two lines and a light rule. */
    const compact = style === "compact";
    const text = table(c, [
      whoRows(v, c, { nameSize: compact ? c.size : c.size + 2, inline: compact }),
      contactRows(v, c, { top: compact ? 0 : 6 }),
      noteRow(v, c),
    ].join(""));
    const logoCell = (side: "start" | "end") =>
      `<td valign="middle" style="vertical-align:middle;padding-${side === "start" ? E(c) : S(c)}:${Math.max(0, x - pad)}px">${logoImg(c, false, group)}</td>`;
    const textCell = (side: "start" | "end") =>
      `<td valign="middle" style="vertical-align:middle;padding-${side === "end" ? S(c) : E(c)}:${x}px">${text}</td>`;
    const line = hairline(compact ? RULE : c.fg);
    const cells = style === "logo-right" ? `${textCell("start")}${line}${logoCell("end")}` : `${logoCell("start")}${line}${textCell("end")}`;
    return table(c, `<tr>${cells}</tr>`, base);
  }
  if (style === "outline") {
    /* A thin frame: the words, and the logo in the top corner. */
    const text = table(c, [whoRows(v, c, { nameSize: c.size + 2 }), contactRows(v, c, { top: 8 }), noteRow(v, c)].join(""));
    const inner = `<tr><td valign="top" style="vertical-align:top;padding-${E(c)}:32px">${text}</td><td valign="top" align="${E(c)}" style="vertical-align:top;text-align:${E(c)}">${logoImg(c, false, group)}</td></tr>`;
    return table(c, `<tr><td style="padding:18px 22px;border:1px solid ${RULE};border-radius:8px">${table(c, inner)}</td></tr>`, `${base}border-collapse:separate`);
  }
  /* black: the team card's colours — the white logo on black, white name. */
  const text = [whoRows(v, c, { nameSize: c.size + 2, pad }), contactRows(v, c, { pad, top: 8 }), noteRow(v, c, pad)].join("");
  const inner = table(c, `<tr><td style="padding-bottom:${Math.max(0, x - pad)}px;text-align:${S(c)}" align="${S(c)}">${logoImg(c, true, group)}</td></tr>${text}`);
  return table(c, `<tr><td bgcolor="#000000" style="background:#000000;padding:${22 - pad}px ${26 - pad}px 22px;border-radius:8px">${inner}</td></tr>`, base);
}

/** The event banner (ch. 93): black, 600 wide, the context header — logo |
 *  event — and one line: the booth in bold, the dates in light. */
function drawBanner(v: TemplateValues, c: Ctx): string {
  const event = str(v, "bannerEvent");
  const main = str(v, "bannerMain");
  const sub = str(v, "bannerSub");
  const link = str(v, "bannerLink");
  if (!event && !main && !sub) return "";
  const bc: Ctx = { ...c, fg: "#FFFFFF", soft: "#D2D2D7", link: "#FFFFFF", logoW: 100 };
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
  const black = styleOf(v) === "black";
  return {
    lang, rtl: lang === "ar", base, preview,
    size: Math.min(15, Math.max(12, num(v, "size", 13))),
    fg: black ? "#FFFFFF" : INK, soft: black ? "#A1A1A6" : GREY, link: black ? "#D2D2D7" : GREY,
    logoW: Math.min(160, Math.max(100, num(v, "logoW", 120))),
  };
}

/** The whole signature, or its reply version (ch. 93: name, title, phone). */
export function signatureHtml(v: TemplateValues, o: { variant: string; base: string; preview?: boolean }): string {
  const c = ctxOf(v, o.base, o.preview === true);
  if (o.variant === "reply") {
    const plain: Ctx = { ...c, fg: INK, soft: GREY, link: GREY };
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
const PERSONAL_KEYS = ["name", "name2", "title", "title2", "titleKey", "title2Key"];

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
    { key: "style", kind: "choice", labelKey: "tpl.f.style", group: "look", options: SIG_STYLES.map((s) => ({ value: s, labelKey: `sig.style.${s}` })) },
    { key: "lang", kind: "choice", labelKey: "sig.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "logoW", kind: "range", labelKey: "sig.f.logoW", group: "look", min: 100, max: 160, step: 10 },
    { key: "size", kind: "range", labelKey: "sig.f.size", group: "look", min: 12, max: 15, step: 1 },
    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 60 },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "second", kind: "switch", labelKey: "sig.f.second", group: "person" },
    { key: "lang2", kind: "choice", labelKey: "sig.f.lang2", group: "person", when: (v) => v.second === true, options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "name2", kind: "text", labelKey: "sig.f.name2", group: "person", max: 60, when: (v) => v.second === true },
    { key: "title2", kind: "title", labelKey: "sig.f.title2", group: "person", langKey: "lang2", when: (v) => v.second === true },
    { key: "companyAt", kind: "choice", labelKey: "sig.f.companyAt", group: "brand", options: COMPANY_AT.map((a) => ({ value: a, labelKey: `sig.at.${a}` })) },
    { key: "company", kind: "text", labelKey: "tpl.f.company", group: "brand", max: 60, hintKey: "sig.f.companyHint", when: (v) => companyAt(v) === "title" || companyAt(v) === "line" },
    { key: "rows", kind: "rows", labelKey: "tpl.f.rows", group: "contacts", langKey: "lang", labels: SIG_LABELS },
    { key: "whatsapp", kind: "switch", labelKey: "tpl.f.whatsapp", group: "contacts" },
    { key: "contactLayout", kind: "choice", labelKey: "sig.f.contactLayout", group: "contacts", options: LAYOUTS.map((l) => ({ value: l, labelKey: `sig.layout.${l}` })) },
    { key: "note", kind: "text", labelKey: "sig.f.note", group: "details", max: 160, hintKey: "sig.f.noteHint" },
    { key: "bannerOn", kind: "switch", labelKey: "sig.f.bannerOn", group: "banner" },
    { key: "bannerEvent", kind: "text", labelKey: "sig.f.bannerEvent", group: "banner", max: 40, placeholder: "CISMA 2025", when: (v) => v.bannerOn === true },
    { key: "bannerMain", kind: "text", labelKey: "sig.f.bannerMain", group: "banner", max: 60, placeholder: "Booth W5-C42", when: (v) => v.bannerOn === true },
    { key: "bannerSub", kind: "text", labelKey: "sig.f.bannerSub", group: "banner", max: 60, placeholder: "24–27 September 2025", when: (v) => v.bannerOn === true },
    { key: "bannerLink", kind: "text", labelKey: "sig.f.bannerLink", group: "banner", max: 200, hintKey: "sig.f.bannerLinkHint", when: (v) => v.bannerOn === true },
  ],
  defaults: {
    style: "standard", lang: "en", logoW: 120, size: 13,
    name: "", title: "", titleKey: "", second: false, lang2: "zh", name2: "", title2: "", title2Key: "",
    companyAt: "title", company: EVERYDAY_NAME_EN,
    rows: sigRows("en"), whatsapp: true, contactLayout: "book",
    note: "",
    bannerOn: false, bannerEvent: "", bannerMain: "", bannerSub: "", bannerLink: "",
  },
  fromPerson: sigFromPerson,
  fillName: (v, t) => t(`sig.style.${styleOf(v)}`),
  relang: (v, lang) => ({ ...v, lang, rows: relangSigRows(list(v, "rows"), asLang(lang)) }),
  /* A style brings its own contact layout and company place; the group
     lockup under the logo, or no company, stays as chosen. */
  restyle: (v, style) => {
    const d = STYLE_DEFAULTS[(SIG_STYLES as readonly string[]).includes(style) ? (style as Style) : "standard"];
    const keep = companyAt(v) === "logo" || companyAt(v) === "off";
    return { ...v, style, contactLayout: d.contactLayout, companyAt: keep ? companyAt(v) : d.companyAt };
  },
  specKeys: (v) => [
    "sig.spec.content",
    "sig.spec.fonts",
    "sig.spec.logo",
    ...(companyAt(v) === "logo" ? ["sig.spec.group"] : []),
    ...(isStyle("black")(v) ? ["sig.spec.black"] : []),
    ...(v.bannerOn === true ? ["sig.spec.banner"] : []),
    "sig.spec.reply",
  ],
  forSaving: (v, keepPerson) => {
    if (keepPerson) return { ...v };
    const out: TemplateValues = { ...v };
    for (const k of PERSONAL_KEYS) out[k] = "";
    out.rows = list(v, "rows").map((r) => (PERSONAL_ROWS.includes(String(r.kind)) ? { ...r, value: "" } : r));
    return out;
  },
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (v.bannerOn === true && !str(v, "bannerEvent") && !str(v, "bannerMain")) return "sig.needBanner";
    return null;
  },
};
