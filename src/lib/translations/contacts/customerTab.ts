import type { Translations } from "@/lib/i18n";

/* Contacts — the `customerTab.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_CUSTOMERTAB: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     PREMIUM CUSTOMER UI — TABS, SECTIONS, FIELDS (Phase 1)
     ═══════════════════════════════════════════════════════════════════════════ */

  /* ── Customer Tabs ── */
  "customerTab.overview":   { en: "Overview",        zh: "概览",       ar: "نظرة عامة" },
  "customerTab.commercial": { en: "Commercial",      zh: "商务",       ar: "تجاري" },
  "customerTab.financial":  { en: "Financial",       zh: "财务",       ar: "مالي" },
  "customerTab.compliance": { en: "Compliance",      zh: "合规",       ar: "الامتثال" },
  "customerTab.trade":      { en: "Trade",           zh: "贸易",       ar: "التجارة" },
  "customerTab.activity":   { en: "Activity",        zh: "活动",       ar: "النشاط" },
};
