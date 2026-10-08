import type { Translations } from "@/lib/i18n";

/* Contacts — the `error.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_ERROR: Translations = {
  /* ── Error Messages ── */
  "error.saveFailed":     { en: "Save Failed",           zh: "保存失败",              ar: "فشل الحفظ" },
  /* An attachment never reached Storage. Titled separately from "Save Failed"
     because the record itself is untouched — see the upload banner. */
  "error.uploadFailed":   { en: "Upload failed",         zh: "上传失败",              ar: "فشل الرفع" },
  "error.fileNotUploaded": { en: "\"{name}\" was never uploaded to storage. Remove it and attach it again.", zh: "「{name}」未上传到存储。请移除后重新添加。", ar: "«{name}» مارفعش على التخزين. شيله وارفعه تاني." },
  "error.updateFailed":   { en: "Failed to update contact. Check your database RLS policies.", zh: "更新联系人失败。请检查数据库RLS策略。", ar: "فشل تحديث جهة الاتصال. تحقق من سياسات RLS في قاعدة البيانات." },
  "error.createFailed":   { en: "Failed to create contact. Check your database RLS policies.", zh: "创建联系人失败。请检查数据库RLS策略。", ar: "فشل إنشاء جهة الاتصال. تحقق من سياسات RLS في قاعدة البيانات." },
  "error.unexpected":     { en: "An unexpected error occurred.", zh: "发生意外错误。", ar: "حدث خطأ غير متوقع." },
  "error.rlsHint":        { en: "This is usually caused by missing RLS policies. Copy the fix SQL and run it in Supabase Dashboard → SQL Editor.", zh: "这通常是因为缺少RLS策略。请复制修复SQL并在Supabase仪表板 → SQL编辑器中运行。", ar: "يحدث هذا عادةً بسبب سياسات RLS المفقودة. انسخ SQL للإصلاح وقم بتشغيله في لوحة تحكم Supabase → محرر SQL." },
};
