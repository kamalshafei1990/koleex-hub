import type { Translations } from "@/lib/i18n";

/* Finance — the `treasuryForecast.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_TREASURYFORECAST: Translations = {
  "treasuryForecast.subtitle.long":{en:"Forward view of expected inflows and outflows. Catch a cash gap before it bites.",
                              zh: "对未来现金流入与流出的前瞻视图。在资金缺口出现前提前发现。",
                              ar: "نظرة استشرافية للتدفقات المتوقعة. اكتشف فجوة النقد قبل أن تضرّ." },
  "treasuryForecast.title": { en: "Cash Forecast",                zh: "现金预测",               ar: "توقعات النقد" },
  "treasuryForecast.subtitle":{ en: "Forward view of expected inflows and outflows. Catch a cash gap before it bites.",
                              zh: "未来现金流入与流出的预测。在资金缺口出现前提前发现。",
                              ar: "نظرة مستقبلية على التدفقات المتوقعة داخلًا وخارجًا. اكتشف فجوة النقد قبل أن تضر." },
};
