import type { Translations } from "@/lib/i18n";

/* Contacts — the `tier.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_TIER: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     CUSTOMER TIERS
     ═══════════════════════════════════════════════════════════════════════════ */
  "tier.end_user":        { en: "Standard",              zh: "标准",                  ar: "قياسي" },
  "tier.silver":          { en: "Silver",                zh: "银牌",                 ar: "فضي" },
  "tier.gold":            { en: "Gold",                  zh: "金牌",                 ar: "ذهبي" },
  "tier.platinum":        { en: "Platinum",              zh: "白金",                 ar: "بلاتيني" },
  "tier.diamond":         { en: "Diamond",               zh: "钻石",                 ar: "ماسي" },
};
