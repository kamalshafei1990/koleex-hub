/* ---------------------------------------------------------------------------
   Business card (brand book ch. 91; plan step C9 and the owner's rounds of
   28–29/09/2026): thirteen approved styles — his own card among them —
   three languages, labelled contact lines he can edit, add and hide, any
   number of QR codes on either side, a title library, a portrait he can
   zoom and move. The drawing lives in ./card; this file is the template:
   its slots, defaults, sizes, QR codes and print checks.
   --------------------------------------------------------------------------- */

import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import type { BcPerson } from "@/lib/brand-center/client";
import { formatMobile, nameIn, titleOf } from "./person";
import type { TemplateDef, TemplateItem, TemplateValues, QrRequest } from "./types";
import { CARD_ADDRESS, LANGS, asLang, defaultRows, qrsOf, relangRows, rowsOf, str, isPictureQr, list } from "./card/model";

const KOLEEX_WEB = "www.koleexgroup.com";
import { NO_COMPANY_BACK, NO_COMPANY_FRONT, PORTRAIT_STYLES, STYLES, VERTICAL_STYLES, drawBack, drawFront, specKeysFor, styleOf } from "./card/styles";
import { PATTERN_CARD_STYLES } from "./card/premium";
import { DESCRIPTOR, DESCRIPTOR_STYLES, LABELLED_REFS, REF_STYLES, isReference, referenceDie } from "./card/reference";
import { patternOptions } from "./patterns";

const SIZES: Record<string, { w: number; h: number }> = {
  "90x54": { w: 90, h: 54 },
  "85x55": { w: 85, h: 55 },
  "89x51": { w: 89, h: 51 },
};

const isStyle = (...styles: string[]) => (v: TemplateValues) => styles.includes(styleOf(v));
const QR = (id: string, kind: string, side: string, logo = false): TemplateItem => ({ id, kind, side, caption: "", link: "", image: "", logo });
/** The QR codes of the owner's card: his WeChat code over the KOLEEX code. */
const CLASSIC_QRS = [QR("wechat", "wechat", "back"), QR("contact", "contact", "back", true)];
const DEFAULT_QRS = [QR("contact", "contact", "back")];
const sameQrs = (a: TemplateItem[], b: TemplateItem[]) => JSON.stringify(a.map((q) => [q.kind, q.side, q.logo, q.caption, q.link, q.image])) === JSON.stringify(b.map((q) => [q.kind, q.side, q.logo, q.caption, q.link, q.image]));

/** vCard 3.0 from the card's own lines — what a phone saves from the
 *  contact QR. The company is the everyday name, or the dealer. */
function vcard(v: TemplateValues): string | null {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, " ");
  const name = str(v, "name");
  if (!name) return null;
  const parts = name.split(/\s+/);
  const n = parts.length > 1 ? `${esc(parts[parts.length - 1])};${esc(parts.slice(0, -1).join(" "))};;;` : `${esc(name)};;;;`;
  const org = styleOf(v) === "dealer" && str(v, "dealerName") ? str(v, "dealerName") : EVERYDAY_NAME_EN;
  const out = ["BEGIN:VCARD", "VERSION:3.0", `N:${n}`, `FN:${esc(name)}`, `ORG:${esc(org)}`];
  if (str(v, "title")) out.push(`TITLE:${esc(str(v, "title"))}`);
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  for (const r of rowsOf(v).filter((x) => x.on && x.value.trim())) {
    if (r.kind === "mobile" || r.kind === "whatsapp") out.push(`TEL;TYPE=CELL:${digits(r.value)}`);
    else if (r.kind === "tel") out.push(`TEL;TYPE=WORK:${digits(r.value)}`);
    else if (r.kind === "fax") out.push(`TEL;TYPE=FAX:${digits(r.value)}`);
    else if (r.kind === "email") out.push(`EMAIL;TYPE=WORK:${esc(r.value.trim())}`);
    else if (r.kind === "web") out.push(`URL:${esc(r.value.startsWith("http") ? r.value.trim() : `https://${r.value.trim()}`)}`);
    else if (r.kind === "address") out.push(`ADR;TYPE=WORK:;;${esc(r.value.trim())};;;;`);
    else if (r.kind === "wechat") out.push(`NOTE:WeChat ${esc(r.value.trim())}`);
  }
  if (styleOf(v) === "technician" && str(v, "hotline")) out.push(`TEL;TYPE=WORK:${digits(str(v, "hotline"))}`);
  out.push("END:VCARD");
  return out.join("\n");
}

/** What a person puts on the card: names and titles in the card's
 *  language(s), the mobile and email lines, the Hub photo. */
function cardFromPerson(p: BcPerson, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  const lang2 = asLang(v.lang2 === "ar" ? "ar" : "zh");
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

const firstRow = (v: TemplateValues, kind: string) => rowsOf(v).find((r) => r.kind === kind && r.on && r.value.trim())?.value.trim() ?? "";

function qrRequests(v: TemplateValues): QrRequest[] {
  const out: QrRequest[] = [];
  for (const q of qrsOf(v)) {
    if (isPictureQr(q)) continue;
    let text: string | null = null;
    if (q.kind === "contact") text = vcard(v);
    else if (q.kind === "whatsapp") {
      const d = (firstRow(v, "whatsapp") || firstRow(v, "mobile")).replace(/\D/g, "");
      text = d ? `https://wa.me/${d}` : null;
    } else if (q.kind === "web") {
      const w = firstRow(v, "web");
      text = w ? (w.startsWith("http") ? w : `https://${w}`) : null;
    } else if (q.kind === "link") text = q.link.trim() || null;
    if (text) out.push({ id: q.id, text, level: q.logo ? "H" : "M" });
  }
  return out;
}

/** Lines that belong to one person, emptied when a design is saved for anyone. */
const PERSONAL_ROWS = ["mobile", "email", "whatsapp", "wechat", "linkedin"];
const PERSONAL_KEYS = ["name", "name2", "title", "title2", "titleKey", "title2Key"];

export const businessCard: TemplateDef = {
  id: "business-card",
  itemKey: "business-card",
  nameKey: "tpl.card",
  size: (v) => {
    const s = SIZES[typeof v.size === "string" ? v.size : ""] ?? SIZES["90x54"];
    return VERTICAL_STYLES.includes(styleOf(v)) ? { w: s.h, h: s.w } : s;
  },
  bleed: 3,
  safe: 4,
  fields: [
    { key: "style", kind: "choice", labelKey: "tpl.f.style", group: "look", options: STYLES.map((s) => ({ value: s, labelKey: `tpl.style.${s}` })) },
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ], when: (v) => styleOf(v) !== "bilingual" },
    { key: "lang2", kind: "choice", labelKey: "tpl.f.lang2", group: "look", options: [
      { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ], when: isStyle("bilingual") },
    { key: "size", kind: "choice", labelKey: "tpl.f.size", group: "look", options: [
      { value: "90x54", labelKey: "tpl.size.90x54" }, { value: "85x55", labelKey: "tpl.size.85x55" }, { value: "89x51", labelKey: "tpl.size.89x51" },
    ] },
    { key: "font", kind: "choice", labelKey: "tpl.f.font", group: "look", options: [
      { value: "inter", labelKey: "tpl.font.inter" }, { value: "helvetica", labelKey: "tpl.font.helvetica" },
    ] },
    { key: "scale", kind: "range", labelKey: "tpl.f.scale", group: "look", min: 80, max: 140, step: 5, unit: "%" },
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(), when: (v) => PATTERN_CARD_STYLES.includes(String(v.style)) },

    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 40 },
    { key: "nameSep", kind: "choice", labelKey: "tpl.f.nameSep", group: "person", options: [
      { value: "dot", labelKey: "tpl.sep.dot" }, { value: "space", labelKey: "tpl.sep.space" },
    ], when: isStyle("classic") },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "name2", kind: "text", labelKey: "tpl.f.name2", group: "person", max: 40, when: isStyle("bilingual") },
    { key: "title2", kind: "title", labelKey: "tpl.f.title2", group: "person", langKey: "lang2", when: isStyle("bilingual") },
    { key: "hotline", kind: "text", labelKey: "tpl.f.hotline", group: "person", max: 24, when: isStyle("technician") },
    { key: "dealerName", kind: "text", labelKey: "tpl.f.dealerName", group: "person", max: 60, when: isStyle("dealer") },
    { key: "dealerLogo", kind: "image", labelKey: "tpl.f.dealerLogo", group: "person", hintKey: "tpl.f.dealerLogoHint", when: isStyle("dealer") },
    { key: "badgeRole", kind: "choice", labelKey: "tpl.f.badgeRole", group: "person", when: isStyle("dealer"), options: [
      { value: "Distributor", labelKey: "tpl.badge.distributor" }, { value: "Agent", labelKey: "tpl.badge.agent" }, { value: "Service Center", labelKey: "tpl.badge.service" },
    ] },
    { key: "badgePlace", kind: "text", labelKey: "tpl.f.badgePlace", group: "person", max: 40, hintKey: "tpl.f.badgePlaceHint", when: isStyle("dealer") },
    { key: "badgeYear", kind: "text", labelKey: "tpl.f.badgeYear", group: "person", max: 4, when: isStyle("dealer") },

    { key: "company", kind: "text", labelKey: "tpl.f.company", group: "company", max: 60, hintKey: "tpl.f.companyHint", when: (v) => !isReference(v) },
    { key: "descriptorOn", kind: "switch", labelKey: "tpl.f.descriptorOn", group: "company", when: (v) => DESCRIPTOR_STYLES.includes(styleOf(v)) },
    { key: "descriptor", kind: "text", labelKey: "tpl.f.descriptor", group: "company", max: 48, hintKey: "tpl.f.descriptorHint", when: (v) => DESCRIPTOR_STYLES.includes(styleOf(v)) && v.descriptorOn !== false },
    { key: "companyBack", kind: "switch", labelKey: "tpl.f.companyBack", group: "company", when: (v) => !NO_COMPANY_BACK.includes(styleOf(v)) },
    { key: "companyFront", kind: "switch", labelKey: "tpl.f.companyFront", group: "company", when: (v) => !NO_COMPANY_FRONT.includes(styleOf(v)) },

    { key: "rows", kind: "rows", labelKey: "tpl.f.rows", group: "contacts", langKey: "lang" },
    /* the references print their lines bare — all but one */
    { key: "labels", kind: "switch", labelKey: "tpl.f.labels", group: "contacts", when: (v) => !isReference(v) || LABELLED_REFS.includes(styleOf(v)) },
    { key: "whatsapp", kind: "switch", labelKey: "tpl.f.whatsapp", group: "contacts" },

    { key: "photo", kind: "image", labelKey: "tpl.f.photo", group: "photo", hintKey: "tpl.f.photoHint", fromPerson: "photo", when: isStyle(...PORTRAIT_STYLES) },
    { key: "photoZoom", kind: "range", labelKey: "tpl.f.photoZoom", group: "photo", min: 100, max: 300, step: 5, unit: "%", when: (v) => isStyle(...PORTRAIT_STYLES)(v) && !!str(v, "photo") },
    { key: "photoX", kind: "range", labelKey: "tpl.f.photoX", group: "photo", min: -100, max: 100, step: 2, when: (v) => isStyle(...PORTRAIT_STYLES)(v) && !!str(v, "photo") },
    { key: "photoY", kind: "range", labelKey: "tpl.f.photoY", group: "photo", min: -100, max: 100, step: 2, when: (v) => isStyle(...PORTRAIT_STYLES)(v) && !!str(v, "photo") },
    { key: "soft", kind: "switch", labelKey: "tpl.f.soft", group: "photo", when: isStyle(...PORTRAIT_STYLES) },

    { key: "stroke", kind: "switch", labelKey: "tpl.f.stroke", group: "details", when: isStyle(...PORTRAIT_STYLES) },
    { key: "bar", kind: "switch", labelKey: "tpl.f.bar", group: "details", when: isStyle("classic") },
    { key: "slash", kind: "switch", labelKey: "tpl.f.slash", group: "details", when: isStyle("classic") },
    { key: "italic", kind: "switch", labelKey: "tpl.f.italic", group: "details", when: isStyle("classic") },

    { key: "qrs", kind: "qrs", labelKey: "tpl.f.qrs", group: "qr", langKey: "lang" },
  ],
  defaults: {
    style: "team-black", lang: "en", lang2: "zh", size: "90x54", font: "inter", scale: 100, pattern: "scan-edge",
    name: "", nameSep: "dot", title: "", name2: "", title2: "", hotline: "", dealerName: "", dealerLogo: "", badgeRole: "Distributor", badgePlace: "", badgeYear: String(new Date().getFullYear()),
    company: "KOLEEX INTERNATIONAL GROUP", companyBack: true, companyFront: false, descriptor: DESCRIPTOR.en, descriptorOn: true,
    rows: defaultRows("en"), labels: true, whatsapp: true,
    photo: "", photoZoom: 100, photoX: 0, photoY: 0, soft: true,
    stroke: true, bar: true, slash: true, italic: true,
    qrs: DEFAULT_QRS,
  },
  pages: [
    { id: "front", draw: drawFront },
    { id: "back", draw: drawBack },
  ],
  die: referenceDie,
  draftStyles: REF_STYLES,
  qrRequests,
  fromPerson: cardFromPerson,
  specKeys: specKeysFor,
  fillName: (v, t) => t(`tpl.style.${styleOf(v)}`),
  /* The descriptor still at the book's words follows the language (ch. 21). */
  relang: (v, lang) => ({
    ...v, lang, rows: relangRows(list(v, "rows"), asLang(lang)),
    ...(LANGS.some((l) => DESCRIPTOR[l] === v.descriptor) ? { descriptor: DESCRIPTOR[asLang(lang)] } : {}),
  }),
  /* A style brings its own typeface; the owner's card also brings its two
     QR codes while the list is still the untouched default (and back). */
  restyle: (v, style) => {
    const qrs = list(v, "qrs");
    const next: TemplateValues = { ...v, style };
    /* The agent's card is the agent's own (ch. 128): our address and website
       leave it; they come back when another style is picked. */
    const lang = asLang(v.lang);
    const ours = (r: TemplateItem) => (r.kind === "address" && LANGS.some((l) => CARD_ADDRESS[l] === r.value)) || (r.kind === "web" && r.value === KOLEEX_WEB);
    if (style === "dealer") next.rows = list(v, "rows").map((r) => (ours(r) ? { ...r, value: "" } : r));
    else if (styleOf(v) === "dealer") {
      next.rows = list(v, "rows").map((r) => (r.kind === "address" && !r.value ? { ...r, value: CARD_ADDRESS[lang] } : r.kind === "web" && !r.value ? { ...r, value: KOLEEX_WEB } : r));
    }
    if (style === "classic") {
      next.font = "helvetica";
      if (sameQrs(qrs, DEFAULT_QRS)) next.qrs = CLASSIC_QRS;
    } else {
      if (styleOf(v) === "classic" && v.font === "helvetica") next.font = "inter";
      if (sameQrs(qrs, CLASSIC_QRS)) next.qrs = DEFAULT_QRS;
    }
    return next;
  },
  forSaving: (v, keepPerson) => {
    const out: TemplateValues = { ...v, photo: "", dealerLogo: "", qrs: list(v, "qrs").map((q) => ({ ...q, image: "" })) };
    if (!keepPerson) {
      for (const k of PERSONAL_KEYS) out[k] = "";
      out.rows = list(v, "rows").map((r) => (PERSONAL_ROWS.includes(String(r.kind)) ? { ...r, value: "" } : r));
    }
    return out;
  },
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (PORTRAIT_STYLES.includes(styleOf(v)) && !str(v, "photo")) return "studio.needPhoto";
    if (styleOf(v) === "dealer" && (!str(v, "dealerLogo") || !str(v, "dealerName"))) return "studio.needDealer";
    for (const q of qrsOf(v)) {
      if (q.kind === "link" && !q.link.trim()) return "studio.needQrLink";
      if (isPictureQr(q) && !q.image) return "studio.needQrImage";
    }
    return null;
  },
};
