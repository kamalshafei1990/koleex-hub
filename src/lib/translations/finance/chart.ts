import type { Translations } from "@/lib/i18n";

/* Finance — the `chart.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_CHART: Translations = {
  /* Generic chart empty-states */
  "chart.noActivity":       { en: "No activity",                  zh: "暂无活动",               ar: "لا يوجد نشاط" },
  "chart.noActivityHint":   { en: "Once orders and expenses flow in, the trend chart appears here.",
                              zh: "当订单与费用开始流入后，趋势图将在此显示。",
                              ar: "بمجرد تدفّق الطلبات والمصروفات، يظهر مخطط الاتجاه هنا." },
  "chart.noSpend":          { en: "No spend",                     zh: "暂无支出",               ar: "لا يوجد إنفاق" },
};
