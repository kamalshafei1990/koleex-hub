import type { Translations } from "@/lib/i18n";

/* Contacts — the `setup.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_SETUP: Translations = {
  /* ── Setup Screen ── */
  "setup.title":          { en: "Database Setup Required", zh: "需要设置数据库", ar: "يلزم إعداد قاعدة البيانات" },
  "setup.desc":           { en: "The contacts table needs additional columns. Copy the SQL below and run it in your", zh: "联系人表需要额外的列。请复制下面的SQL并在您的", ar: "يحتاج جدول جهات الاتصال إلى أعمدة إضافية. انسخ SQL أدناه وقم بتشغيله في" },
  "setup.sqlMigration":   { en: "SQL Migration",         zh: "SQL迁移",              ar: "ترحيل SQL" },
};
