import type { Translations } from "@/lib/i18n";

/* Finance — the `app.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_APP: Translations = {
  /* ── App-level ──────────────────────────────────────────────────── */
  "app.title":            { en: "Finance",                                zh: "财务",                                ar: "المالية" },
  "app.subtitle":         { en: "Add data, read data, run the books — every path one click away.",
                            zh: "录入数据、查阅数据、记账核算 — 每条路径一键可达。",
                            ar: "أدخِل البيانات، طالعها، وأدِر الدفاتر — كل مسار على بُعد نقرة." },
};
