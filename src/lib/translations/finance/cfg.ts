import type { Translations } from "@/lib/i18n";

/* Finance — the `cfg.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_CFG: Translations = {
  /* Config-array labels (pattern 8: `label: "Xxx"`, not `label="Xxx"`). */
  "cfg.sameDay": { en: "Same day", zh: "当天", ar: "نفس اليوم" },
  "cfg.inProduction": { en: "In production", zh: "生产中", ar: "قيد الإنتاج" },
  "cfg.moneyToCollect": { en: "Money to collect", zh: "应收款", ar: "مبالغ للتحصيل" },
  "cfg.moneyToPay": { en: "Money to pay", zh: "应付款", ar: "مبالغ للسداد" },
};
