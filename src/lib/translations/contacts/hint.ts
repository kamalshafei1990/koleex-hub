import type { Translations } from "@/lib/i18n";

/* Contacts — the `hint.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_HINT: Translations = {
  "hint.brandAlreadyAdded":{ en: "Already added — pick a different name", zh: "已添加 — 请选择不同的名称", ar: "تمت الإضافة بالفعل — اختر اسمًا مختلفًا" },
  "hint.classifications":  { en: "Pick everything that describes this supplier. Star one as the primary type.", zh: "选择所有描述此供应商的项。星标一项作为主要类型。", ar: "اختر كل ما يصف هذا المورد. ضع نجمة على واحد كنوع رئيسي." },
  "hint.noClassifications":{ en: "Tip: at least one classification helps the team route this supplier correctly.", zh: "提示：至少一个分类有助于团队正确分流此供应商。", ar: "نصيحة: تساعد فئة واحدة على الأقل الفريق في توجيه هذا المورد بشكل صحيح." },
  "hint.contactIdUpload":       { en: "Drop the ID card, badge, or QR — PNG / JPG", zh: "拖入证件、工牌或二维码 — PNG / JPG", ar: "أفلت بطاقة الهوية أو الشارة أو رمز QR — PNG / JPG" },

  "hint.atLeastOneContact":     { en: "At least one of phone / mobile / email is required", zh: "电话 / 手机 / 邮箱 至少填写一项", ar: "مطلوب واحد على الأقل من الهاتف / الجوال / البريد" },
  "hint.atLeastOneMessaging":   { en: "Messaging channel (optional)", zh: "即时通讯渠道（可选）", ar: "قناة مراسلة (اختياري)" },
  "hint.atLeastOnePerson":      { en: "Contact persons (optional)", zh: "联系人（可选）", ar: "جهات الاتصال (اختياري)" },
  "hint.bankInfoPhoto":         { en: "Company sent bank details as an image? Drop it here — PNG / JPG", zh: "公司以图片形式发送了银行信息?拖放到此处 — PNG / JPG", ar: "أرسلت الشركة بيانات البنك كصورة؟ أفلتها هنا — PNG / JPG" },
  "hint.businessLicense":       { en: "Drop the company license photo — PNG / JPG", zh: "拖放公司营业执照照片 — PNG / JPG", ar: "أفلت صورة رخصة الشركة — PNG / JPG" },
  "hint.socialMedia":           { en: "Add the factory's social pages — paste a link, page, or @account.", zh: "添加工厂的社交主页 — 粘贴链接、主页或 @账号。", ar: "أضف صفحات المصنع الاجتماعية — الصق رابطًا أو صفحة أو @حساب." },
  "hint.messagingApps":         { en: "Add other apps the factory uses — pick the app, then enter the ID / handle / number.", zh: "添加工厂使用的其他应用 — 选择应用，然后输入 ID / 账号 / 号码。", ar: "أضف التطبيقات الأخرى التي يستخدمها المصنع — اختر التطبيق ثم أدخل المعرّف / الحساب / الرقم." },
};
