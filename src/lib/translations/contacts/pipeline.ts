import type { Translations } from "@/lib/i18n";

/* Contacts — the `pipeline.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_PIPELINE: Translations = {
  "pipeline.empty":             { en: "No deals yet",              zh: "暂无交易",              ar: "لا توجد صفقات بعد" },
  "pipeline.loading":           { en: "Loading…",                  zh: "加载中…",               ar: "جارٍ التحميل…" },
  "pipeline.lost":              { en: "Lost",                      zh: "已流失",                ar: "خاسرة" },
  "pipeline.lostLabel":         { en: "Lost",                      zh: "已流失",                ar: "خاسرة" },
  "pipeline.newDeal":           { en: "New deal",                  zh: "新建交易",              ar: "صفقة جديدة" },
  "pipeline.open":              { en: "Open",                      zh: "进行中",                ar: "مفتوحة" },
  "pipeline.openInCrm":         { en: "Open in CRM",               zh: "在 CRM 中打开",          ar: "فتح في CRM" },
  "pipeline.pipelineValue":     { en: "Pipeline",                  zh: "销售管道",              ar: "مسار الصفقات" },
  "pipeline.recent":            { en: "Recent",                    zh: "最近",                 ar: "الأحدث" },
  "pipeline.today":             { en: "today",                     zh: "今天",                 ar: "اليوم" },
  "pipeline.weighted":          { en: "weighted",                  zh: "加权",                 ar: "مرجّح" },
  "pipeline.won":               { en: "Won",                       zh: "已赢单",                ar: "رابحة" },
  "pipeline.wonLabel":          { en: "Won",                       zh: "已赢单",                ar: "رابحة" },
};
