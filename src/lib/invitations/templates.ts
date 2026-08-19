/* ---------------------------------------------------------------------------
   Invitation letter text — English and Chinese.

   ONE function builds both languages from ONE set of facts. That is the point:
   the owner's manual letters drifted between the two versions (one said the
   visitor was from India where the English said Egypt), and the only durable
   fix is that no fact is typed twice.

   The Chinese wording follows the phrasing from the owner's own letters that
   consulates have already accepted — 邀请函, 多次往返商务签证（M签证）,
   此致敬礼, 费用将由其所在公司承担 — rather than a fresh translation.

   Client-safe: the form previews the exact strings the print page will use.
   --------------------------------------------------------------------------- */

import {
  cityCn,
  countryCn,
  durationDays,
  latinInCn,
  positionCn,
  tidyCn,
  formatDateCn,
  formatDateEn,
  genderCn,
  genderEn,
  honorificEn,
  type InvitationSettings,
  type InvitationVisit,
  type InvitationVisitor,
} from "./types";

export type LetterInput = {
  visitor: InvitationVisitor;
  visit: InvitationVisit;
  settings: InvitationSettings;
  letterDate: string;
  reference: string;
};

/** One labelled row of the passport block. */
export type LetterRow = { label: string; value: string };

export type LetterText = {
  title: string;
  /** "The Visa Section, Embassy of the People's Republic of China in Egypt" */
  addressee: string;
  dateLine: string;
  refLine: string;
  salutation: string;
  /** Paragraphs before the passport block. */
  intro: string[];
  passportBlock: LetterRow[];
  /** Paragraphs after the passport block. */
  body: string[];
  closing: string;
  signOff: { name: string; position: string; company: string; address: string; phone: string };
};

/* ── shared helpers ──────────────────────────────────────────────────────── */

function joinEn(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** How the visitor is referred to throughout the narrative.
 *
 *  This is the fix for the defect in the owner's Mr. Nour letter, where the
 *  passport block named one person and the paragraph below it named another:
 *  the narrative name is DERIVED from the same field the block prints. */
function subjectEn(v: InvitationVisitor): string {
  const h = honorificEn(v.gender);
  return h ? `${h} ${v.name}` : v.name;
}

/** The clause introducing who the visitor is.
 *
 *  When no position is recorded the letter must NOT invent one — the owner's
 *  rule is that it then simply says the person is our customer. Claiming a job
 *  title the passport does not support is exactly what gets a letter refused. */
function whoIsHeEn(v: InvitationVisitor): string {
  const subject = subjectEn(v);
  if (v.position && v.company) {
    return `${subject}, ${v.position} of ${v.company}${v.country ? `, ${v.country}` : ""},`;
  }
  if (v.company) {
    return `${subject}, from ${v.company}${v.country ? `, ${v.country}` : ""},`;
  }
  /* No company and no country: the plain name, with NO trailing comma —
     an apposition needs something to set off. */
  return v.country ? `${subject}, from ${v.country},` : subject;
}

/** Subject pronoun for the narrative. Unknown gender uses the name again
 *  rather than "they", which reads oddly in a consular document. */
function pronounEn(v: InvitationVisitor): string {
  if (v.gender === "male") return "he";
  if (v.gender === "female") return "she";
  return subjectEn(v);
}

function whoIsHeCn(v: InvitationVisitor): string {
  const country = countryCn(v.countryCode, v.country);
  const honor = v.gender === "female" ? "女士" : "先生";
  /* Company names and personal names stay in their original script — that is
     what the passport and the business card say — but they are SPACED, or
     they weld onto the Chinese around them into one unreadable run. */
  const company = latinInCn(v.company);
  const name = latinInCn(v.name);
  /* A job title, in Chinese where we have it. An unmapped title is spaced
     Latin rather than glued Latin, and the form warns about it. */
  const post = v.position ? (positionCn(v.position) ?? latinInCn(v.position)) : "";

  if (v.position && v.company) {
    return tidyCn(`${country}${company}公司${post}${name}${honor}`);
  }
  if (v.company) {
    return tidyCn(`${country}${company}公司的${name}${honor}`);
  }
  return tidyCn(country ? `来自${country}的${name}${honor}` : `${name}${honor}`);
}

/* ── purpose wording, per language ───────────────────────────────────────── */

function purposeEn(visit: InvitationVisit): string {
  switch (visit.purpose) {
    case "exhibition":
      return visit.exhibitionName
        ? `to visit our booth at ${visit.exhibitionName}`
        : "to visit our booth at an exhibition";
    case "factory":
      return "to visit the factories of our partner manufacturers and inspect the machines ordered";
    case "training":
      return "to receive technical training on the machines purchased and to arrange their collection";
    case "meeting":
    default:
      return "to hold business meetings with our team and discuss future cooperation";
  }
}

function purposeCn(visit: InvitationVisit): string {
  switch (visit.purpose) {
    case "exhibition":
      return visit.exhibitionName
        ? `参观我司在${visit.exhibitionName}的展位`
        : "参观我司展位";
    case "factory":
      return "考察我司合作工厂并验收所订购的设备";
    case "training":
      return "接受所购设备的技术培训并安排提货事宜";
    case "meeting":
    default:
      return "与我司团队进行商务洽谈并商讨今后的合作事宜";
  }
}

/* ── ENGLISH ─────────────────────────────────────────────────────────────── */

export function buildEnglish(input: LetterInput): LetterText {
  const { visitor: v, visit, settings: s } = input;
  const days = durationDays(visit.arrivalDate, visit.departureDate);
  const cities = joinEn(visit.cities);
  const subject = subjectEn(v);

  const company = s.companyNameEn ?? "";
  const visaWord =
    visit.visaType === "multi"
      ? "a multiple-entry business (M) visa"
      : "a single-entry business (M) visa";

  const intro: string[] = [
    `We, ${company}, a company duly registered in Taizhou, Zhejiang Province, ` +
      `the People's Republic of China${s.creditCode ? ` (Unified Social Credit Code: ${s.creditCode})` : ""}, ` +
      `hereby respectfully invite the following person to visit China on business:`,
  ];

  /* Row 1 is the NAME, full width — long passport names (four and five
     words are normal) were wrapping inside a half-width cell and threw the
     whole grid off. After it, pairs grouped by MEANING, not by entry order:
     who they are, then the passport's numbers and dates together, then the
     job. The owner asked for the table organised; this is the organisation. */
  const passportBlock: LetterRow[] = [
    { label: "Name",             value: v.name },
    { label: "Gender",           value: genderEn(v.gender) },
    { label: "Nationality",      value: v.nationality ?? "" },
    { label: "Date of Birth",    value: formatDateEn(v.dob) },
    { label: "Passport Number",  value: v.passportNo ?? "" },
    { label: "Date of Issue",    value: formatDateEn(v.passportIssue) },
    { label: "Date of Expiry",   value: formatDateEn(v.passportExpiry) },
  ];
  if (v.company) passportBlock.push({ label: "Company", value: v.company });
  /* Only printed when we actually have one — see whoIsHeEn. */
  if (v.position) passportBlock.push({ label: "Position", value: v.position });

  const body: string[] = [
    `${whoIsHeEn(v)} is our valued customer, invited ${purposeEn(visit)}.`,

    `${subject} plans to arrive in China on ${formatDateEn(visit.arrivalDate)}` +
      `${visit.arrivalCity ? ` through ${visit.arrivalCity}` : ""} and to depart on ` +
      `${formatDateEn(visit.departureDate)}, a stay of ${days} day${days === 1 ? "" : "s"}` +
      `${cities ? `, during which ${pronounEn(v)} will visit ${cities}` : ""}.`,

    `All expenses relating to this visit, including international travel, ` +
      `accommodation, local transport and medical insurance, will be borne by ` +
      `the visitor's own company. Our company will assist with the arrangements ` +
      `during the stay in China.`,

    `We hereby guarantee that ${subject} will comply with the laws and ` +
      `regulations of the People's Republic of China and will leave the country ` +
      `before the expiry of the authorised period of stay.`,

    `We would therefore be grateful if you would kindly grant ${subject} ` +
      `${visaWord}. A copy of our business licence is attached for your reference.`,
  ];

  if (visit.extraNote) body.push(visit.extraNote);

  return {
    title: "INVITATION LETTER",
    /* Addressed by NATIONALITY, not by the company's country — the visitor
       applies at the mission accredited to the country of their passport. */
    addressee:
      "The Visa Section\nEmbassy / Consulate-General of the People's Republic of China" +
      (v.nationality ? ` in ${v.nationality}` : ""),
    dateLine: formatDateEn(input.letterDate),
    refLine: input.reference,
    salutation: "Dear Sir or Madam,",
    intro,
    passportBlock,
    body,
    closing: "Yours faithfully,",
    signOff: {
      name: s.inviterName ?? "",
      position: s.inviterPositionEn ?? "",
      company,
      address: s.addressEn ?? "",
      phone: s.inviterPhone ?? "",
    },
  };
}

/* ── CHINESE ─────────────────────────────────────────────────────────────── */

export function buildChinese(input: LetterInput): LetterText {
  const { visitor: v, visit, settings: s } = input;
  const days = durationDays(visit.arrivalDate, visit.departureDate);
  const citiesCn = visit.cities.map(cityCn).join("、");
  const honor = v.gender === "female" ? "女士" : "先生";
  const company = s.companyNameCn ?? "";

  const visaWord =
    visit.visaType === "multi"
      ? "多次往返商务签证（M签证）"
      : "一次入境商务签证（M签证）";

  const intro: string[] = [
    tidyCn(
      `我司${company}系在中华人民共和国浙江省台州市依法注册成立的企业` +
        `${s.creditCode ? `（统一社会信用代码：${latinInCn(s.creditCode)}）` : ""}，` +
        `现诚挚邀请下列人员来华进行商务访问：`,
    ),
  ];

  /* Same order as the English page — they are one document. */
  const passportBlock: LetterRow[] = [
    { label: "姓名",     value: v.name },
    { label: "性别",     value: genderCn(v.gender) },
    { label: "国籍",     value: countryCn(v.nationalityCode, v.nationality) },
    { label: "出生日期", value: formatDateCn(v.dob) },
    { label: "护照号码", value: v.passportNo ?? "" },
    { label: "签发日期", value: formatDateCn(v.passportIssue) },
    { label: "有效期至", value: formatDateCn(v.passportExpiry) },
  ];
  if (v.company) passportBlock.push({ label: "公司名称", value: v.company });
  if (v.position) {
    passportBlock.push({ label: "职务", value: positionCn(v.position) ?? v.position });
  }

  /* Spaced once here and reused: the visitor is named in three of the five
     paragraphs, and each one would otherwise weld to the Chinese beside it.
     Kept spaced on BOTH sides — tidyCn trims the leading one when the name
     opens a sentence, and keeps it when the name follows a Chinese word. */
  const nameCn = latinInCn(v.name);

  const body: string[] = [
    tidyCn(`${whoIsHeCn(v)}系我司重要客户，此次来华的目的为${purposeCn(visit)}。`),

    tidyCn(
      `${nameCn}${honor}计划于${formatDateCn(visit.arrivalDate)}` +
        `${visit.arrivalCity ? `由${cityCn(visit.arrivalCity)}` : ""}入境，` +
        `并于${formatDateCn(visit.departureDate)}离境，在华停留共计${days}天` +
        `${citiesCn ? `，期间将前往${citiesCn}等地` : ""}。`,
    ),

    `此次访问的全部费用，包括国际旅费、在华食宿、交通及医疗保险等，` +
      `将由其所在公司承担。我司将协助安排其在华期间的相关事宜。`,

    tidyCn(
      `我司在此保证，${nameCn}${honor}在华期间将遵守中华人民共和国的法律法规，` +
        `并将在准许停留期限届满前离境。`,
    ),

    tidyCn(`恳请贵处为${nameCn}${honor}签发${visaWord}。随函附上我司营业执照副本复印件，敬请查收。`),
  ];

  if (visit.extraNote) body.push(visit.extraNote);

  return {
    title: "邀 请 函",
    /* By nationality, matching the English page. */
    addressee: `中华人民共和国驻${countryCn(v.nationalityCode, v.nationality)}大使馆／总领事馆　签证处`,
    dateLine: formatDateCn(input.letterDate),
    refLine: input.reference,
    salutation: "尊敬的签证官：",
    intro,
    passportBlock,
    body,
    closing: "此致\n敬礼！",
    signOff: {
      name: s.inviterName ?? "",
      position: s.inviterPositionCn ?? "",
      company,
      address: s.addressCn ?? "",
      phone: s.inviterPhone ?? "",
    },
  };
}
