import type { Translations } from "@/lib/i18n";

/* Finance — the `sev.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_SEV: Translations = {
  "sev.sameDay": { en: "Same day", zh: "当天", ar: "نفس اليوم" },
  "sev.normal":   { en: "Normal",   zh: "\u666e\u901a", ar: "\u0639\u0627\u062f\u064a" },
  "sev.warning":  { en: "Warning",  zh: "\u8b66\u544a", ar: "\u062a\u062d\u0630\u064a\u0631" },
  "sev.urgent":   { en: "Urgent",   zh: "\u7d27\u6025", ar: "\u0639\u0627\u062c\u0644" },
  "sev.critical": { en: "Critical", zh: "\u4e25\u91cd", ar: "\u062d\u0631\u062c" },
};
