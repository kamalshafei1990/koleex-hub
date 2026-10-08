import type { Translations } from "@/lib/i18n";

/* Finance — the `imp.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_IMP: Translations = {
  "imp.uploaded": { en: "Uploaded", zh: "已上传", ar: "تم الرفع" },
  "imp.parsed": { en: "Parsed", zh: "已解析", ar: "تم التحليل" },
  "imp.confirmed": { en: "Confirmed", zh: "已确认", ar: "مؤكّد" },
  "imp.failed": { en: "Failed", zh: "失败", ar: "فشل" },
  "imp.cancelled": { en: "Cancelled", zh: "已取消", ar: "ملغي" },
};
