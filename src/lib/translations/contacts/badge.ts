import type { Translations } from "@/lib/i18n";

/* Contacts — the `badge.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_BADGE: Translations = {
  /* ── Supplier 360 — hero intelligence badges ── */
  "badge.risk.low": { en: "LOW RISK", zh: "低风险", ar: "مخاطر منخفضة" },
  "badge.risk.medium": { en: "MEDIUM RISK", zh: "中等风险", ar: "مخاطر متوسطة" },
  "badge.risk.high": { en: "HIGH RISK", zh: "高风险", ar: "مخاطر عالية" },
  "badge.trusted": { en: "TRUSTED", zh: "可信赖", ar: "موثوق" },
  "badge.trust.medium": { en: "MEDIUM TRUST", zh: "中等信任", ar: "ثقة متوسطة" },
  "badge.trust.low": { en: "LOW TRUST", zh: "低信任", ar: "ثقة منخفضة" },
  "badge.negStrong": { en: "STRONG NEGOTIATION", zh: "议价能力强", ar: "تفاوض قوي" },
  "badge.negModerate": { en: "MODERATE NEGOTIATION", zh: "议价能力中等", ar: "تفاوض متوسط" },
  "badge.negWeak": { en: "WEAK NEGOTIATION", zh: "议价能力弱", ar: "تفاوض ضعيف" },
  "badge.ready": { en: "READY {n}%", zh: "就绪 {n}%", ar: "جاهز {n}%" },
  "badge.tier1": { en: "TIER-1 SOURCE", zh: "一级货源", ar: "مصدر من الفئة الأولى" },
  "badge.preferred": { en: "PREFERRED", zh: "优选", ar: "مُفضّل" },
  "badge.priority": { en: "PRIORITY {n}", zh: "优先级 {n}", ar: "أولوية {n}" },
  "badge.soleSource": { en: "SOLE SOURCE", zh: "唯一货源", ar: "مصدر وحيد" },
};
