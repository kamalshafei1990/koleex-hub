/* Certificates — the pieces both sets of designs share (plan step C13):
   the labels under the date and the number, the name shown while the slot
   is empty, the silver of the seal and the foil, and the issue date. */

import type { TemplateValues } from "./types";
import { str, type Lang } from "./card/model";

export const LABELS: Record<Lang, { date: string; number: string }> = {
  en: { date: "Date", number: "Certificate no." },
  zh: { date: "日期", number: "证书编号" },
  ar: { date: "التاريخ", number: "رقم الشهادة" },
};
export const PLACEHOLDER: Record<Lang, string> = { en: "Full Name", zh: "姓名", ar: "الاسم" };
export const SILVER = ["#E5E5EA", "#FFFFFF", "#C7C7CC", "#8E8E93"];

export /** The issue date (D/M/Y) as a date — the legal name is the one of that day. */
function issued(v: TemplateValues): Date | null {
  const m = str(v, "date").match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12) : null;
}
