/* ---------------------------------------------------------------------------
   Home — the greeting's "report due" sentence (Reports Phase 3C). Loaded
   only when something is owed (see report-due.ts), with its own words: the
   report's name carries "your" in Arabic, so each language builds the
   sentence its own way around {report}. Dates D/M, times on the viewer's
   own clock, 24-hour.
   --------------------------------------------------------------------------- */

import type { HomeDueItem, HomeDueLine } from "./report-due";

type Lang = "en" | "zh" | "ar";
export const REPORT_DUE_WORDS: Record<string, Record<Lang, string>> = {
  daily: { en: "daily report", zh: "日报", ar: "تقريرك اليومي" },
  weekly: { en: "weekly report", zh: "周报", ar: "تقريرك الأسبوعي" },
  monthly: { en: "monthly report", zh: "月报", ar: "تقريرك الشهري" },
  today: { en: "Your {report} is due today at {time}", zh: "你的{report}今天 {time} 截止", ar: "{report} مطلوب اليوم قبل {time}" },
  on: { en: "Your {report} is due {date} at {time}", zh: "你的{report}于 {date} {time} 截止", ar: "{report} مطلوب يوم {date} قبل {time}" },
  missing: { en: "Your {report} for {period} is missing", zh: "你的{report}（{period}）尚未提交", ar: "{report} عن {period} لم يُرسل بعد" },
  many: { en: "{n} reports are waiting for you", zh: "你有 {n} 份报告待提交", ar: "تقارير مطلوبة منك: {n}" },
  write: { en: "write it now", zh: "立即填写", ar: "اكتبه الآن" },
  finish: { en: "continue it", zh: "继续填写", ar: "أكمله" },
  open: { en: "open Reports", zh: "打开报告", ar: "افتح التقارير" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const addDay = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** The period a missing report was for, the way the Reports app writes it. */
function periodText(d: HomeDueItem): string {
  if (d.key === "daily") return dm(d.periodKey);
  if (d.key === "weekly") return `${dm(d.date)}–${dm(addDay(d.date, 6))}`;
  return `${d.periodKey.slice(5, 7)}/${d.periodKey.slice(0, 4)}`;
}

/** The line and where it leads, or null when nothing is owed. One report
 *  names itself and opens (its draft, or a new one for that period);
 *  several say how many and open Reports. A deadline that passed while the
 *  page stayed open reads missing. */
export function reportDueLine(items: HomeDueItem[], lang: string, now = Date.now()): HomeDueLine | null {
  if (!items.length) return null;
  const l: Lang = lang === "ar" || lang === "zh" ? lang : "en";
  const w = (k: string) => REPORT_DUE_WORDS[k][l];
  if (items.length > 1) return { text: `${w("many").replace("{n}", String(items.length))} — ${w("open")}`, href: "/reports" };
  const d = items[0];
  const at = new Date(d.dueAt);
  let lead: string;
  if (d.state === "missing" || at.getTime() <= now) {
    lead = w("missing").replace("{report}", w(d.key)).replace("{period}", periodText(d));
  } else {
    const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    lead = at.toDateString() === new Date(now).toDateString()
      ? w("today").replace("{report}", w(d.key)).replace("{time}", time)
      : w("on").replace("{report}", w(d.key)).replace("{date}", `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`).replace("{time}", time);
  }
  return {
    text: `${lead} — ${w(d.draftId ? "finish" : "write")}`,
    href: d.draftId ? `/reports/${d.draftId}` : `/reports?write=${d.key}&date=${d.date}`,
  };
}
