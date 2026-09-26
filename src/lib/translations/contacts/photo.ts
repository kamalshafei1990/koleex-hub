import type { Translations } from "@/lib/i18n";

/* Contacts — the `photo.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_PHOTO: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     PHOTO / LOGO LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "photo.addPhoto":        { en: "Add Photo",             zh: "添加照片",              ar: "إضافة صورة" },
  "photo.addLogo":         { en: "Add Logo",              zh: "添加Logo",             ar: "إضافة شعار" },
  "photo.changePhoto":     { en: "Change Photo",          zh: "更换照片",              ar: "تغيير الصورة" },
  "photo.changeLogo":      { en: "Change Logo",           zh: "更换Logo",             ar: "تغيير الشعار" },
  "photo.uploadFront":     { en: "Upload Front",          zh: "上传正面",              ar: "رفع الأمام" },
  "photo.uploadBack":      { en: "Upload Back",           zh: "上传背面",              ar: "رفع الخلف" },
  "photo.uploadQr":        { en: "Upload QR",             zh: "上传二维码",            ar: "رفع رمز QR" },
  "photo.uploadCatalogue": { en: "Upload catalogue (PDF or image)", zh: "上传目录（PDF或图片）", ar: "رفع الكتالوج (PDF أو صورة)" },
  "photo.uploadDocument":  { en: "Upload document (contract, license, ID...)", zh: "上传文件（合同、许可证、身份证...）", ar: "رفع مستند (عقد، رخصة، هوية...)" },
  "photo.uploadDoc":       { en: "Upload document",        zh: "上传文件",              ar: "رفع مستند" },
};
