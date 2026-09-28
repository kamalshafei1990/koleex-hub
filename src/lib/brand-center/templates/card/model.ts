/* ---------------------------------------------------------------------------
   Business card — the fill's data: contact lines, QR codes, languages,
   typefaces. Pure data and helpers; the drawing is in parts / styles.
   --------------------------------------------------------------------------- */

import type { TemplateItem, TemplateValues } from "../types";

export type Lang = "en" | "zh" | "ar";
export const LANGS: Lang[] = ["en", "zh", "ar"];
export const asLang = (x: unknown): Lang => (x === "zh" || x === "ar" ? x : "en");
export const langOf = (v: TemplateValues): Lang => asLang(v.lang);

export const str = (v: TemplateValues | TemplateItem, k: string): string => (typeof v[k] === "string" ? (v[k] as string).trim() : "");
export const num = (v: TemplateValues | TemplateItem, k: string, d: number): number => (typeof v[k] === "number" && Number.isFinite(v[k]) ? (v[k] as number) : d);
export const list = (v: TemplateValues, k: string): TemplateItem[] => (Array.isArray(v[k]) ? (v[k] as TemplateItem[]) : []);

/* ── typefaces ─────────────────────────────────────────────────────────── */

/** Inter is the book's face; Helvetica Neue the face of the owner's own card
 *  (and of the first brand guidelines). Arabic and Chinese follow the book. */
const ARABIC_AND_CHINESE = "var(--font-bc-ar), 'Noto Sans Arabic', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', 'Microsoft YaHei'";
export const FONTS = {
  inter: `var(--font-inter), Inter, ${ARABIC_AND_CHINESE}, Arial, sans-serif`,
  helvetica: `'Helvetica Neue', Helvetica, Arial, ${ARABIC_AND_CHINESE}, sans-serif`,
} as const;
export const fontOf = (v: TemplateValues): string => (v.font === "helvetica" ? FONTS.helvetica : FONTS.inter);

/* ── the address ───────────────────────────────────────────────────────── */

/** Room 206 (owner 28/09: the Hub's record is right). Editable per card. */
export const CARD_ADDRESS: Record<Lang, string> = {
  en: "Room 206, Building 88, West Feiyue Park, Taizhou, Zhejiang, China",
  zh: "浙江省台州市椒江区飞跃科创园西区88幢206室",
  ar: "Room 206, Building 88, West Feiyue Park, Taizhou, Zhejiang, China",
};

/* ── contact lines ─────────────────────────────────────────────────────── */

export const ROW_KINDS = ["address", "mobile", "tel", "fax", "email", "web", "wechat", "whatsapp", "linkedin", "custom"] as const;
export type RowKind = (typeof ROW_KINDS)[number];

/** The owner's card labels ("Add:", "Mob:") and their Chinese and Arabic. */
export const ROW_LABELS: Record<Lang, Record<RowKind, string>> = {
  en: { address: "Add:", mobile: "Mob:", tel: "Tel:", fax: "Fax:", email: "Email:", web: "Web:", wechat: "WeChat:", whatsapp: "WhatsApp:", linkedin: "LinkedIn:", custom: "" },
  zh: { address: "地址：", mobile: "手机：", tel: "电话：", fax: "传真：", email: "邮箱：", web: "网址：", wechat: "微信：", whatsapp: "WhatsApp：", linkedin: "领英：", custom: "" },
  ar: { address: "العنوان:", mobile: "الجوال:", tel: "الهاتف:", fax: "الفاكس:", email: "البريد:", web: "الموقع:", wechat: "ويتشات:", whatsapp: "واتساب:", linkedin: "لينكدإن:", custom: "" },
};

export interface Row { id: string; kind: RowKind; label: string; value: string; on: boolean }

export const rowKind = (x: unknown): RowKind => ((ROW_KINDS as readonly string[]).includes(String(x)) ? (x as RowKind) : "custom");
export function rowsOf(v: TemplateValues, key = "rows"): Row[] {
  return list(v, key).map((r, i) => ({
    id: typeof r.id === "string" ? r.id : `r${i}`,
    kind: rowKind(r.kind),
    label: typeof r.label === "string" ? r.label : "",
    value: typeof r.value === "string" ? r.value : "",
    on: r.on !== false,
  }));
}

let seq = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function defaultRows(lang: Lang): TemplateItem[] {
  return (["address", "mobile", "email", "web"] as RowKind[]).map((kind) => ({
    id: kind, kind, label: ROW_LABELS[lang][kind], on: true,
    value: kind === "address" ? CARD_ADDRESS[lang] : kind === "web" ? "www.koleexgroup.com" : "",
  }));
}

/** Contact lines in another language: a label still at its default moves
 *  to the new language's, and so does an address still at its default. */
export function relangRows(rows: TemplateItem[], lang: Lang): TemplateItem[] {
  return rows.map((r) => {
    const kind = rowKind(r.kind);
    const isDefaultLabel = LANGS.some((l) => ROW_LABELS[l][kind] === r.label);
    const isDefaultAddress = kind === "address" && LANGS.some((l) => CARD_ADDRESS[l] === r.value);
    return {
      ...r,
      ...(isDefaultLabel && kind !== "custom" ? { label: ROW_LABELS[lang][kind] } : {}),
      ...(isDefaultAddress ? { value: CARD_ADDRESS[lang] } : {}),
    };
  });
}

/** The lines a card prints, in order: shown, with a value; the mobile gets
 *  " · WhatsApp" when that is ticked. Labels drop when labels are off. */
export function printedRows(v: TemplateValues, key = "rows"): Array<{ label: string; value: string; kind: RowKind; rtlValue: boolean }> {
  const labels = v.labels !== false;
  return rowsOf(v, key)
    .filter((r) => r.on && r.value.trim())
    .map((r) => ({
      kind: r.kind,
      label: labels ? r.label : "",
      value: r.kind === "mobile" && v.whatsapp && !/whatsapp/i.test(r.value) ? `${r.value.trim()} · WhatsApp` : r.value.trim(),
      rtlValue: /[\u0600-\u06FF]/.test(r.value),
    }));
}

/* ── QR codes ──────────────────────────────────────────────────────────── */

export const QR_KINDS = ["contact", "whatsapp", "web", "link", "staff", "wechat", "image"] as const;
export type QrKind = (typeof QR_KINDS)[number];
export interface QrItem { id: string; kind: QrKind; side: "front" | "back"; caption: string; link: string; image: string; logo: boolean }

export function qrsOf(v: TemplateValues): QrItem[] {
  return list(v, "qrs").map((q, i) => ({
    id: typeof q.id === "string" ? q.id : `q${i}`,
    kind: (QR_KINDS as readonly string[]).includes(String(q.kind)) ? (q.kind as QrKind) : "contact",
    side: q.side === "front" ? "front" : "back",
    caption: typeof q.caption === "string" ? q.caption : "",
    link: typeof q.link === "string" ? q.link : "",
    image: typeof q.image === "string" ? q.image : "",
    logo: q.logo === true,
  }));
}
export const isPictureQr = (q: QrItem) => q.kind === "wechat" || q.kind === "image";

/** Suggested captions (the studio shows them as placeholders). */
export const QR_CAPTIONS: Record<QrKind, Record<Lang, string>> = {
  contact: { en: "Save contact", zh: "保存联系人", ar: "احفظ جهة الاتصال" },
  whatsapp: { en: "WhatsApp", zh: "WhatsApp", ar: "واتساب" },
  web: { en: "Website", zh: "网站", ar: "الموقع" },
  link: { en: "Scan me", zh: "扫一扫", ar: "امسح الكود" },
  staff: { en: "Staff number", zh: "员工编号", ar: "رقم الموظف" },
  wechat: { en: "WeChat", zh: "微信", ar: "ويتشات" },
  image: { en: "", zh: "", ar: "" },
};
