/* ---------------------------------------------------------------------------
   Business card (brand book ch. 91; plan steps C9 + the owner's round of
   28/09/2026): seven approved styles, three languages, labelled contacts,
   filled from Employees. The drawing lives in ./card; this file is the
   template: its slots, defaults, sizes, QR and print checks.
   --------------------------------------------------------------------------- */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import type { TemplateDef, TemplateValues } from "./types";
import { str } from "./card/parts";
import { STYLES, drawBack, drawFront, specKeysFor, styleOf } from "./card/styles";

const SIZES: Record<string, { w: number; h: number }> = {
  "90x54": { w: 90, h: 54 },
  "85x55": { w: 85, h: 55 },
  "89x51": { w: 89, h: 51 },
};

/** The address as a card prints it — Room 206 (owner 28/09: the Hub's
 *  record is right, the old card's "No. 205" was not). Editable per card. */
export const CARD_ADDRESS: Record<string, string> = {
  en: "Room 206, Building 88, West Feiyue Park, Taizhou, Zhejiang, China",
  zh: "浙江省台州市椒江区飞跃科创园西区88幢206室",
  ar: "Room 206, Building 88, West Feiyue Park, Taizhou, Zhejiang, China",
};

const isStyle = (...styles: string[]) => (v: TemplateValues) => styles.includes(styleOf(v));

/** vCard 3.0 — what a phone saves when it reads the contact QR. The company
 *  is the everyday name (a card is not a formal document) or the dealer. */
function vcard(v: TemplateValues): string | null {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, " ");
  const name = str(v, "name");
  if (!name) return null;
  const parts = name.split(/\s+/);
  const n = parts.length > 1 ? `${esc(parts[parts.length - 1])};${esc(parts.slice(0, -1).join(" "))};;;` : `${esc(name)};;;;`;
  const org = styleOf(v) === "dealer" && str(v, "dealerName") ? str(v, "dealerName") : EVERYDAY_NAME_EN;
  const out = ["BEGIN:VCARD", "VERSION:3.0", `N:${n}`, `FN:${esc(name)}`, `ORG:${esc(org)}`];
  if (str(v, "title")) out.push(`TITLE:${esc(str(v, "title"))}`);
  if (str(v, "mobile")) out.push(`TEL;TYPE=CELL:${str(v, "mobile").replace(/[^\d+]/g, "")}`);
  if (styleOf(v) === "technician" && str(v, "hotline")) out.push(`TEL;TYPE=WORK:${str(v, "hotline").replace(/[^\d+]/g, "")}`);
  if (str(v, "email")) out.push(`EMAIL;TYPE=WORK:${esc(str(v, "email"))}`);
  if (str(v, "web")) out.push(`URL:${esc(str(v, "web").startsWith("http") ? str(v, "web") : `https://${str(v, "web")}`)}`);
  if (str(v, "address")) out.push(`ADR;TYPE=WORK:;;${esc(str(v, "address"))};;;;`);
  if (str(v, "wechat")) out.push(`NOTE:WeChat ${esc(str(v, "wechat"))}`);
  out.push("END:VCARD");
  return out.join("\n");
}

function qrText(v: TemplateValues): string | null {
  switch (v.qr) {
    case "none": return null;
    case "whatsapp": {
      const digits = str(v, "mobile").replace(/\D/g, "");
      return digits ? `https://wa.me/${digits}` : null;
    }
    case "web": {
      const web = str(v, "web");
      return web ? (web.startsWith("http") ? web : `https://${web}`) : null;
    }
    default: return vcard(v);
  }
}

export const businessCard: TemplateDef = {
  id: "business-card",
  itemKey: "business-card",
  nameKey: "tpl.card",
  size: (v) => {
    const s = SIZES[typeof v.size === "string" ? v.size : ""] ?? SIZES["90x54"];
    return styleOf(v) === "vertical" ? { w: s.h, h: s.w } : s;
  },
  bleed: 3,
  safe: 4,
  fields: [
    { key: "style", kind: "choice", labelKey: "tpl.f.style", options: STYLES.map((s) => ({ value: s, labelKey: `tpl.style.${s}` })) },
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "photo", kind: "image", labelKey: "tpl.f.photo", hintKey: "tpl.f.photoHint", fromPerson: "photo", when: isStyle("management") },
    { key: "dealerName", kind: "text", labelKey: "tpl.f.dealerName", max: 60, when: isStyle("dealer") },
    { key: "dealerLogo", kind: "image", labelKey: "tpl.f.dealerLogo", hintKey: "tpl.f.dealerLogoHint", when: isStyle("dealer") },
    { key: "name", kind: "text", labelKey: "tpl.f.name", max: 40 },
    { key: "title", kind: "text", labelKey: "tpl.f.title", max: 60 },
    { key: "hotline", kind: "text", labelKey: "tpl.f.hotline", max: 24, when: isStyle("technician") },
    { key: "mobile", kind: "text", labelKey: "tpl.f.mobile", max: 24 },
    { key: "whatsapp", kind: "switch", labelKey: "tpl.f.whatsapp" },
    { key: "wechat", kind: "text", labelKey: "tpl.f.wechat", max: 40 },
    { key: "email", kind: "text", labelKey: "tpl.f.email", max: 60 },
    { key: "web", kind: "text", labelKey: "tpl.f.web", max: 40 },
    { key: "address", kind: "text", labelKey: "tpl.f.address", max: 120 },
    { key: "qr", kind: "choice", labelKey: "tpl.f.qr", options: [
      { value: "contact", labelKey: "tpl.qr.contact" }, { value: "whatsapp", labelKey: "tpl.qr.whatsapp" },
      { value: "web", labelKey: "tpl.qr.web" }, { value: "none", labelKey: "tpl.qr.none" },
    ] },
    { key: "wechatQr", kind: "image", labelKey: "tpl.f.wechatQr", hintKey: "tpl.f.wechatQrHint", when: isStyle("management") },
    { key: "size", kind: "choice", labelKey: "tpl.f.size", options: [
      { value: "90x54", labelKey: "tpl.size.90x54" }, { value: "85x55", labelKey: "tpl.size.85x55" }, { value: "89x51", labelKey: "tpl.size.89x51" },
    ] },
  ],
  defaults: {
    style: "team-black", lang: "en", size: "90x54", qr: "contact", whatsapp: true,
    name: "", title: "", mobile: "", wechat: "", email: "", web: KOLEEX_COMPANY.web, address: CARD_ADDRESS.en,
    hotline: "", photo: "", wechatQr: "", dealerName: "", dealerLogo: "",
  },
  pages: [
    { id: "front", draw: drawFront },
    { id: "back", draw: drawBack },
  ],
  qrText,
  specKeys: specKeysFor,
  fillName: (v, t) => t(`tpl.style.${styleOf(v)}`),
  /* The address follows the language while it is still a default. */
  relang: (v, lang) => ({
    ...v,
    lang,
    ...(Object.values(CARD_ADDRESS).includes(str(v, "address")) ? { address: CARD_ADDRESS[lang] ?? CARD_ADDRESS.en } : {}),
  }),
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (styleOf(v) === "management" && !str(v, "photo")) return "studio.needPhoto";
    if (styleOf(v) === "dealer" && (!str(v, "dealerLogo") || !str(v, "dealerName"))) return "studio.needDealer";
    return null;
  },
};
