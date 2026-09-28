/* ---------------------------------------------------------------------------
   A person on a template — shared by every template that fills from
   Employees (the business card, the staff ID badge …): the name as in the
   passport, the title in the template's language, the mobile in the book's
   international format.
   --------------------------------------------------------------------------- */

import type { BcPerson } from "@/lib/brand-center/client";
import { titleIn } from "./card/titles";
import type { Lang } from "./card/model";

const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u2E80-\u9FFF]/;

/** A mobile in the book's international format (ch. 91: "+86 130 7380
 *  0720") when it is a Chinese or Egyptian mobile; anything else as typed. */
export function formatMobile(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  let m = d.match(/^(?:\+|00)?86(1\d{2})(\d{4})(\d{4})$/);
  if (m) return `+86 ${m[1]} ${m[2]} ${m[3]}`;
  m = d.match(/^(?:\+|00)?20(1\d)(\d{4})(\d{4})$/);
  if (m) return `+20 ${m[1]} ${m[2]} ${m[3]}`;
  return raw.trim();
}

/** The name as in the passport (ch. 91) — no "Mr.", "Dr." or "Eng." before it. */
const HONORIFIC = /^(?:mr|mrs|ms|miss|dr|eng|prof)\.?\s+/i;
export const nameIn = (p: BcPerson, lang: Lang) => {
  const alt = p.nameAlt ?? "";
  return (lang === "zh" && CJK.test(alt)) || (lang === "ar" && ARABIC.test(alt)) ? alt : p.name.replace(HONORIFIC, "");
};
export const titleOf = (p: BcPerson, lang: Lang) =>
  (lang === "zh" ? p.titleZh || (p.title ? titleIn(p.title, "zh") : null) : lang === "ar" ? p.titleAr || (p.title ? titleIn(p.title, "ar") : null) : null) || p.title || "";
