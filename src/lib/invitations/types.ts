/* ---------------------------------------------------------------------------
   Invitation letters — shared types and vocabulary.

   Client-safe (no "server-only"): the form, the print page and the API all
   read the same option lists, so a purpose or a city can never mean one thing
   in the editor and another in the printed letter.
   --------------------------------------------------------------------------- */

/** Why the visitor is coming. Drives which paragraph the letter uses. */
export type InvitationPurpose = "exhibition" | "meeting" | "factory" | "training";

/** Chinese business visas: single entry, or multiple (M) — the usual one. */
export type VisaType = "single" | "multi";

export type InvitationStatus = "draft" | "issued";

export type Gender = "male" | "female";

/* ── the visitor, exactly as the letter will print them ──────────────────── */
export type InvitationVisitor = {
  /** As written in the passport, in capitals. */
  name: string;
  gender: Gender | null;
  dob: string | null;              // ISO yyyy-mm-dd
  nationality: string | null;
  nationalityCode: string | null;  // ISO-3166 alpha-2/3, drives the consulate line
  passportNo: string | null;
  passportIssue: string | null;
  passportExpiry: string | null;
  company: string | null;
  /** NULL is meaningful — the letter then reads "Mr. X is our customer". */
  position: string | null;
  /** Where the visitor's COMPANY is — distinct from nationality, which is
   *  what decides the addressee. contacts stores both. */
  country: string | null;
  countryCode: string | null;
};

/* ── the visit ───────────────────────────────────────────────────────────── */
export type InvitationVisit = {
  purpose: InvitationPurpose;
  /** Only when purpose === "exhibition". */
  exhibitionName: string | null;
  extraNote: string | null;
  arrivalCity: string | null;
  arrivalDate: string;             // ISO
  departureDate: string;           // ISO
  cities: string[];
  visaType: VisaType;
};

/* ── the Chinese company doing the inviting (per-tenant settings) ────────── */
export type InvitationSettings = {
  companyNameEn: string | null;
  companyNameCn: string | null;
  /** Unified Social Credit Code — ties the letter to the licence on page 3. */
  creditCode: string | null;
  /** Must match the business licence verbatim — a consulate compares them. */
  addressEn: string | null;
  addressCn: string | null;
  inviterName: string | null;
  inviterPositionEn: string | null;
  inviterPositionCn: string | null;
  inviterPhone: string | null;
  licenceDocUrl: string | null;
};

export type InvitationLetter = {
  id: string;
  reference: string;
  contactId: string | null;
  visitor: InvitationVisitor;
  visit: InvitationVisit;
  letterDate: string;
  status: InvitationStatus;
  issuedAt: string | null;
  pdfUrl: string | null;
  durationDays: number;
  createdAt: string;
  updatedAt: string;
};

/* ── vocabulary ──────────────────────────────────────────────────────────── */

export const PURPOSES: { value: InvitationPurpose; en: string; cn: string; ar: string }[] = [
  { value: "exhibition", en: "Visit our booth at an exhibition", cn: "参观我司展位", ar: "زيارة جناحنا في معرض" },
  { value: "meeting",    en: "Business meeting and cooperation discussion", cn: "商务洽谈与合作交流", ar: "اجتماع تجاري ومناقشة تعاون" },
  { value: "factory",    en: "Factory visit and machine inspection",        cn: "工厂考察与设备验收", ar: "زيارة مصنع ومعاينة ماكينات" },
  { value: "training",   en: "Technical training and machine collection",   cn: "技术培训与设备提货", ar: "تدريب فني واستلام ماكينات" },
];

/** Cities Koleex hosts visitors in — the chips on the form. en is what the
 *  letter prints (via cityCn for the Chinese page); cn/ar are display only. */
export const COMMON_CITIES: { en: string; cn: string; ar: string }[] = [
  { en: "Taizhou",   cn: "台州", ar: "تايتشو" },
  { en: "Wenzhou",   cn: "温州", ar: "ونتشو" },
  { en: "Hangzhou",  cn: "杭州", ar: "هانغتشو" },
  { en: "Ningbo",    cn: "宁波", ar: "نينغبو" },
  { en: "Shanghai",  cn: "上海", ar: "شنغهاي" },
  { en: "Yiwu",      cn: "义乌", ar: "ييوو" },
  { en: "Guangzhou", cn: "广州", ar: "قوانغتشو" },
  { en: "Shenzhen",  cn: "深圳", ar: "شينزين" },
  { en: "Beijing",   cn: "北京", ar: "بكين" },
  { en: "Qingdao",   cn: "青岛", ar: "تشينغداو" },
  { en: "Suzhou",    cn: "苏州", ar: "سوتشو" },
  { en: "Nanjing",   cn: "南京", ar: "نانجينغ" },
  { en: "Xiamen",    cn: "厦门", ar: "شيامن" },
  { en: "Foshan",    cn: "佛山", ar: "فوشان" },
  { en: "Dongguan",  cn: "东莞", ar: "دونغقوان" },
  { en: "Zhongshan", cn: "中山", ar: "تشونغشان" },
  { en: "Shaoxing",  cn: "绍兴", ar: "شاوشينغ" },
  { en: "Jiaxing",   cn: "嘉兴", ar: "جياشينغ" },
  { en: "Tianjin",   cn: "天津", ar: "تيانجين" },
  { en: "Chengdu",   cn: "成都", ar: "تشنغدو" },
  { en: "Dalian",    cn: "大连", ar: "داليان" },
  { en: "Hong Kong", cn: "香港", ar: "هونغ كونغ" },
];

/** Chinese name for a city, falling back to the English one when unknown —
 *  a city we don't have a translation for must still appear in the letter. */
export function cityCn(en: string): string {
  return CITY_CN.get(en.trim().toLowerCase()) ?? en;
}

/* ── country names in Chinese ────────────────────────────────────────────
   The Chinese page addresses "中华人民共和国驻<country>大使馆" — printing
   "Egypt" there in the middle of a Chinese sentence is exactly the kind of
   half-translated letter that gets queried at the counter.

   Keyed by ISO-3166 alpha-2, which contacts already stores in
   nationality_code / country_code. Covers Koleex's actual customer countries;
   anything unmapped falls back to the English name, which is wrong-looking
   but never blank — and the form warns when it happens. */
const COUNTRY_CN: Record<string, string> = {
  EG: "埃及",   IN: "印度",   BD: "孟加拉国", PK: "巴基斯坦", LK: "斯里兰卡",
  TR: "土耳其", ID: "印度尼西亚", VN: "越南",  TH: "泰国",   MY: "马来西亚",
  PH: "菲律宾", MM: "缅甸",   KH: "柬埔寨", UZ: "乌兹别克斯坦", KZ: "哈萨克斯坦",
  NG: "尼日利亚", MA: "摩洛哥", DZ: "阿尔及利亚", TN: "突尼斯", LY: "利比亚",
  SD: "苏丹",   ET: "埃塞俄比亚", KE: "肯尼亚", TZ: "坦桑尼亚", UG: "乌干达",
  GH: "加纳",   ZA: "南非",   SN: "塞内加尔", CI: "科特迪瓦",
  SA: "沙特阿拉伯", AE: "阿拉伯联合酋长国", JO: "约旦", SY: "叙利亚",
  IQ: "伊拉克", LB: "黎巴嫩", YE: "也门",   OM: "阿曼",   KW: "科威特",
  QA: "卡塔尔", BH: "巴林",   IR: "伊朗",
  RU: "俄罗斯", UA: "乌克兰", BY: "白俄罗斯", PL: "波兰",   RO: "罗马尼亚",
  BR: "巴西",   MX: "墨西哥", PE: "秘鲁",   CO: "哥伦比亚", AR: "阿根廷",
  CL: "智利",   EC: "厄瓜多尔",
  US: "美国",   GB: "英国",   DE: "德国",   FR: "法国",   IT: "意大利",
  ES: "西班牙", NL: "荷兰",   PT: "葡萄牙",
};

/** Chinese name of a country, by ISO code. Falls back to the English name. */
export function countryCn(code: string | null | undefined, en: string | null | undefined): string {
  const key = (code ?? "").trim().toUpperCase().slice(0, 2);
  return COUNTRY_CN[key] ?? (en ?? "");
}

/* The nationality / country dropdowns — the owner's ask: pick from a list,
   never type. Names are what prints on the letter; codes drive the Chinese
   wording. Sorted here once so every dropdown shows the same order. */
export const COUNTRIES: { name: string; code: string }[] = [
  { name: "Afghanistan", code: "AF" }, { name: "Albania", code: "AL" },
  { name: "Algeria", code: "DZ" }, { name: "Angola", code: "AO" },
  { name: "Argentina", code: "AR" }, { name: "Armenia", code: "AM" },
  { name: "Australia", code: "AU" }, { name: "Austria", code: "AT" },
  { name: "Azerbaijan", code: "AZ" }, { name: "Bahrain", code: "BH" },
  { name: "Bangladesh", code: "BD" }, { name: "Belarus", code: "BY" },
  { name: "Belgium", code: "BE" }, { name: "Benin", code: "BJ" },
  { name: "Bolivia", code: "BO" }, { name: "Bosnia and Herzegovina", code: "BA" },
  { name: "Botswana", code: "BW" }, { name: "Brazil", code: "BR" },
  { name: "Bulgaria", code: "BG" }, { name: "Burkina Faso", code: "BF" },
  { name: "Cambodia", code: "KH" }, { name: "Cameroon", code: "CM" },
  { name: "Canada", code: "CA" }, { name: "Chad", code: "TD" },
  { name: "Chile", code: "CL" }, { name: "China", code: "CN" },
  { name: "Colombia", code: "CO" }, { name: "Congo (DR)", code: "CD" },
  { name: "Costa Rica", code: "CR" }, { name: "Croatia", code: "HR" },
  { name: "Cuba", code: "CU" }, { name: "Cyprus", code: "CY" },
  { name: "Czech Republic", code: "CZ" }, { name: "Denmark", code: "DK" },
  { name: "Djibouti", code: "DJ" }, { name: "Dominican Republic", code: "DO" },
  { name: "Ecuador", code: "EC" }, { name: "Egypt", code: "EG" },
  { name: "El Salvador", code: "SV" }, { name: "Eritrea", code: "ER" },
  { name: "Estonia", code: "EE" }, { name: "Ethiopia", code: "ET" },
  { name: "Finland", code: "FI" }, { name: "France", code: "FR" },
  { name: "Gabon", code: "GA" }, { name: "Gambia", code: "GM" },
  { name: "Georgia", code: "GE" }, { name: "Germany", code: "DE" },
  { name: "Ghana", code: "GH" }, { name: "Greece", code: "GR" },
  { name: "Guatemala", code: "GT" }, { name: "Guinea", code: "GN" },
  { name: "Honduras", code: "HN" }, { name: "Hungary", code: "HU" },
  { name: "Iceland", code: "IS" }, { name: "India", code: "IN" },
  { name: "Indonesia", code: "ID" }, { name: "Iran", code: "IR" },
  { name: "Iraq", code: "IQ" }, { name: "Ireland", code: "IE" },
  { name: "Israel", code: "IL" }, { name: "Italy", code: "IT" },
  { name: "Ivory Coast", code: "CI" }, { name: "Jamaica", code: "JM" },
  { name: "Japan", code: "JP" }, { name: "Jordan", code: "JO" },
  { name: "Kazakhstan", code: "KZ" }, { name: "Kenya", code: "KE" },
  { name: "Kuwait", code: "KW" }, { name: "Kyrgyzstan", code: "KG" },
  { name: "Laos", code: "LA" }, { name: "Latvia", code: "LV" },
  { name: "Lebanon", code: "LB" }, { name: "Liberia", code: "LR" },
  { name: "Libya", code: "LY" }, { name: "Lithuania", code: "LT" },
  { name: "Luxembourg", code: "LU" }, { name: "Madagascar", code: "MG" },
  { name: "Malawi", code: "MW" }, { name: "Malaysia", code: "MY" },
  { name: "Maldives", code: "MV" }, { name: "Mali", code: "ML" },
  { name: "Malta", code: "MT" }, { name: "Mauritania", code: "MR" },
  { name: "Mauritius", code: "MU" }, { name: "Mexico", code: "MX" },
  { name: "Moldova", code: "MD" }, { name: "Mongolia", code: "MN" },
  { name: "Morocco", code: "MA" }, { name: "Mozambique", code: "MZ" },
  { name: "Myanmar", code: "MM" }, { name: "Namibia", code: "NA" },
  { name: "Nepal", code: "NP" }, { name: "Netherlands", code: "NL" },
  { name: "New Zealand", code: "NZ" }, { name: "Nicaragua", code: "NI" },
  { name: "Niger", code: "NE" }, { name: "Nigeria", code: "NG" },
  { name: "North Macedonia", code: "MK" }, { name: "Norway", code: "NO" },
  { name: "Oman", code: "OM" }, { name: "Pakistan", code: "PK" },
  { name: "Palestine", code: "PS" }, { name: "Panama", code: "PA" },
  { name: "Paraguay", code: "PY" }, { name: "Peru", code: "PE" },
  { name: "Philippines", code: "PH" }, { name: "Poland", code: "PL" },
  { name: "Portugal", code: "PT" }, { name: "Qatar", code: "QA" },
  { name: "Romania", code: "RO" }, { name: "Russia", code: "RU" },
  { name: "Rwanda", code: "RW" }, { name: "Saudi Arabia", code: "SA" },
  { name: "Senegal", code: "SN" }, { name: "Serbia", code: "RS" },
  { name: "Sierra Leone", code: "SL" }, { name: "Singapore", code: "SG" },
  { name: "Slovakia", code: "SK" }, { name: "Slovenia", code: "SI" },
  { name: "Somalia", code: "SO" }, { name: "South Africa", code: "ZA" },
  { name: "South Korea", code: "KR" }, { name: "South Sudan", code: "SS" },
  { name: "Spain", code: "ES" }, { name: "Sri Lanka", code: "LK" },
  { name: "Sudan", code: "SD" }, { name: "Sweden", code: "SE" },
  { name: "Switzerland", code: "CH" }, { name: "Syria", code: "SY" },
  { name: "Taiwan", code: "TW" }, { name: "Tajikistan", code: "TJ" },
  { name: "Tanzania", code: "TZ" }, { name: "Thailand", code: "TH" },
  { name: "Togo", code: "TG" }, { name: "Tunisia", code: "TN" },
  { name: "Turkey", code: "TR" }, { name: "Turkmenistan", code: "TM" },
  { name: "Uganda", code: "UG" }, { name: "Ukraine", code: "UA" },
  { name: "United Arab Emirates", code: "AE" }, { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" }, { name: "Uruguay", code: "UY" },
  { name: "Uzbekistan", code: "UZ" }, { name: "Venezuela", code: "VE" },
  { name: "Vietnam", code: "VN" }, { name: "Yemen", code: "YE" },
  { name: "Zambia", code: "ZM" }, { name: "Zimbabwe", code: "ZW" },
];

/* Arrival cities — mainland cities with INTERNATIONAL airports, the owner's
   list plus the majors. Each carries its Chinese name because the letter
   prints 由上海入境; a city without one would leave English mid-sentence. */
export const ARRIVAL_CITIES: { en: string; cn: string; ar: string }[] = [
  { en: "Shanghai", cn: "上海", ar: "شنغهاي" }, { en: "Beijing", cn: "北京", ar: "بكين" },
  { en: "Guangzhou", cn: "广州", ar: "قوانغتشو" }, { en: "Shenzhen", cn: "深圳", ar: "شينزين" },
  { en: "Hangzhou", cn: "杭州", ar: "هانغتشو" }, { en: "Ningbo", cn: "宁波", ar: "نينغبو" },
  { en: "Wenzhou", cn: "温州", ar: "ونتشو" }, { en: "Nanjing", cn: "南京", ar: "نانجينغ" },
  { en: "Xiamen", cn: "厦门", ar: "شيامن" }, { en: "Fuzhou", cn: "福州", ar: "فوتشو" },
  { en: "Qingdao", cn: "青岛", ar: "تشينغداو" }, { en: "Tianjin", cn: "天津", ar: "تيانجين" },
  { en: "Chengdu", cn: "成都", ar: "تشنغدو" }, { en: "Chongqing", cn: "重庆", ar: "تشونغتشينغ" },
  { en: "Wuhan", cn: "武汉", ar: "ووهان" }, { en: "Changsha", cn: "长沙", ar: "تشانغشا" },
  { en: "Zhengzhou", cn: "郑州", ar: "تشنغتشو" }, { en: "Xi'an", cn: "西安", ar: "شيان" },
  { en: "Kunming", cn: "昆明", ar: "كونمينغ" }, { en: "Guilin", cn: "桂林", ar: "قويلين" },
  { en: "Haikou", cn: "海口", ar: "هايكو" }, { en: "Sanya", cn: "三亚", ar: "سانيا" },
  { en: "Harbin", cn: "哈尔滨", ar: "هاربين" }, { en: "Shenyang", cn: "沈阳", ar: "شنيانغ" },
  { en: "Dalian", cn: "大连", ar: "داليان" }, { en: "Jinan", cn: "济南", ar: "جينان" },
  { en: "Hong Kong", cn: "香港", ar: "هونغ كونغ" }, { en: "Macau", cn: "澳门", ar: "ماكاو" },
];

const CITY_CN = new Map(
  [...COMMON_CITIES, ...ARRIVAL_CITIES].map((c) => [c.en.toLowerCase(), c.cn]),
);

/* STANDING RULE (owner): every country/nationality dropdown carries the
   country FLAG. <option> cannot render images, so the flag is the emoji
   derived from the ISO code — two regional-indicator symbols. */
export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/* STANDING RULE (owner): dropdown CONTENTS are translated, not just their
   labels. For countries the browser already knows every name in every
   language — Intl.DisplayNames — so there is no 150×3 table to maintain. */
export function countryDisplayName(code: string, fallback: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

/** City label in the active language. The VALUE stays the English name —
 *  that is what the letter prints and the DB stores. */
export function cityDisplayName(
  city: { en: string; cn: string; ar: string },
  lang: string,
): string {
  return lang === "zh" ? city.cn : lang === "ar" ? city.ar : city.en;
}

/* English country names → ISO code, for the form: the operator types (or
   autofill supplies) "Egypt" and the code that drives the Chinese wording
   fills itself — nobody should have to know what an ISO code is. Keys are
   lowercase; the aliases cover the spellings that appear in the contacts
   directory. Mirrors the countries COUNTRY_CN knows. */
const NAME_TO_CODE: Record<string, string> = {
  egypt: "EG", india: "IN", bangladesh: "BD", pakistan: "PK", "sri lanka": "LK",
  turkey: "TR", "turkiye": "TR", indonesia: "ID", vietnam: "VN", "viet nam": "VN",
  thailand: "TH", malaysia: "MY", philippines: "PH", myanmar: "MM", cambodia: "KH",
  uzbekistan: "UZ", kazakhstan: "KZ", nigeria: "NG", morocco: "MA", algeria: "DZ",
  tunisia: "TN", libya: "LY", sudan: "SD", ethiopia: "ET", kenya: "KE",
  tanzania: "TZ", uganda: "UG", ghana: "GH", "south africa": "ZA", senegal: "SN",
  "ivory coast": "CI", "cote d'ivoire": "CI", "saudi arabia": "SA", ksa: "SA",
  uae: "AE", "united arab emirates": "AE", jordan: "JO", syria: "SY", iraq: "IQ",
  lebanon: "LB", yemen: "YE", oman: "OM", kuwait: "KW", qatar: "QA",
  bahrain: "BH", iran: "IR", russia: "RU", ukraine: "UA", belarus: "BY",
  poland: "PL", romania: "RO", brazil: "BR", mexico: "MX", peru: "PE",
  colombia: "CO", argentina: "AR", chile: "CL", ecuador: "EC", usa: "US",
  "united states": "US", uk: "GB", "united kingdom": "GB", germany: "DE",
  france: "FR", italy: "IT", spain: "ES", netherlands: "NL", portugal: "PT",
  china: "CN", egyptian: "EG", indian: "IN", turkish: "TR",
};

/** Country name (or nationality adjective) → ISO code; null when unknown. */
export function codeForCountryName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_CODE[name.trim().toLowerCase()] ?? null;
}

/** True when the Chinese page would print an untranslated country name.
 *  The form surfaces this so the owner isn't surprised at the consulate. */
export function countryNeedsChinese(code: string | null | undefined): boolean {
  const key = (code ?? "").trim().toUpperCase().slice(0, 2);
  return !COUNTRY_CN[key];
}

/* ── job titles in Chinese ───────────────────────────────────────────────
   A position printed in English inside a Chinese sentence reads as an
   untranslated letter. These are the titles that actually appear on Koleex
   customers' cards; anything else falls back to the English text (spaced,
   see latinInCn) and the form warns so the operator can decide. */
const POSITION_CN: Record<string, string> = {
  "general manager": "总经理",
  "deputy general manager": "副总经理",
  "manager": "经理",
  "sales manager": "销售经理",
  "purchasing manager": "采购经理",
  "production manager": "生产经理",
  "factory manager": "厂长",
  "technical manager": "技术经理",
  "director": "总监",
  "managing director": "董事总经理",
  "chairman": "董事长",
  "president": "总裁",
  "vice president": "副总裁",
  "ceo": "首席执行官",
  "chief executive officer": "首席执行官",
  "owner": "企业主",
  "founder": "创始人",
  "co-founder": "联合创始人",
  "partner": "合伙人",
  "engineer": "工程师",
  "chief engineer": "总工程师",
  "buyer": "采购员",
  "supervisor": "主管",
};

/** Chinese name of a job title, or null when there is no mapping. */
export function positionCn(en: string | null | undefined): string | null {
  const key = (en ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return key ? (POSITION_CN[key] ?? null) : null;
}

/** True when a position would be printed in English on the Chinese page. */
export function positionNeedsChinese(en: string | null | undefined): boolean {
  return !!(en ?? "").trim() && positionCn(en) === null;
}

/** Wrap Latin text so it does not collide with the CJK around it.
 *
 *  Chinese has no inter-word space, so concatenating a Latin name straight
 *  onto a Chinese noun produces "埃及Nour TextilesGeneral Manager…" — one
 *  unreadable run. Chinese typographic convention is a thin space either
 *  side of embedded Latin; a normal space is the portable equivalent and
 *  survives PDF rendering everywhere. */
export function latinInCn(s: string | null | undefined): string {
  const v = (s ?? "").trim();
  return v ? ` ${v} ` : "";
}

/** Collapse the double spaces that latinInCn leaves when segments meet. */
export function tidyCn(s: string): string {
  return s.replace(/ {2,}/g, " ").replace(/ ([，。、；：）])/g, "$1").replace(/（ /g, "（").trim();
}

/* ── dates ───────────────────────────────────────────────────────────────── */

const MONTHS_EN = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"];

/** Parse an ISO date as a plain calendar date — no timezone shifting.
 *  `new Date("2026-03-14")` is UTC midnight, which is the 13th in any
 *  negative offset; a letter must never print the day before. */
function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return { y: +m[1]!, m: +m[2]!, d: +m[3]! };
}

/** "14 March 2026" — the form consulates read most easily. */
export function formatDateEn(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parts(iso);
  if (!p) return iso;
  return `${p.d} ${MONTHS_EN[p.m - 1]} ${p.y}`;
}

/** "2026年3月14日" */
export function formatDateCn(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parts(iso);
  if (!p) return iso;
  return `${p.y}年${p.m}月${p.d}日`;
}

/** Inclusive stay length — arrival and departure days both count.
 *  Mirrors the GENERATED column in the database exactly, so the preview and
 *  the stored row can never disagree. */
export function durationDays(arrival: string, departure: string): number {
  const a = parts(arrival);
  const d = parts(departure);
  if (!a || !d) return 0;
  const ms = Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.floor(ms / 86_400_000) + 1;
}

/** Honorific from gender. Unknown gender falls back to the neutral form
 *  rather than guessing from the name. */
export function honorificEn(gender: Gender | null): string {
  if (gender === "male") return "Mr.";
  if (gender === "female") return "Ms.";
  return "";
}

export function genderEn(gender: Gender | null): string {
  return gender === "male" ? "Male" : gender === "female" ? "Female" : "";
}

export function genderCn(gender: Gender | null): string {
  return gender === "male" ? "男" : gender === "female" ? "女" : "";
}
