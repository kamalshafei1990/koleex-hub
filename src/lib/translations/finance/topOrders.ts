import type { Translations } from "@/lib/i18n";

/* Finance — the `topOrders.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_TOPORDERS: Translations = {
  "topOrders.title":        { en: "Top profitable orders",        zh: "最具盈利能力的订单",       ar: "أكثر الطلبات ربحية" },
  "topOrders.subtitle":     { en: "Ranked by net profit this period.",
                              zh: "按本期净利润排名。",
                              ar: "مرتّبة حسب صافي الربح في هذه الفترة." },
  "topOrders.empty":        { en: "No orders yet for this period.",
                              zh: "本期暂无订单。",
                              ar: "لا توجد طلبات في هذه الفترة بعد." },
};
