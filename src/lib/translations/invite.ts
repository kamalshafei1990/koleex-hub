/* ---------------------------------------------------------------------------
   invite/translations — the PUBLIC invitation page (en / zh / ar).

   This is a guest-facing surface, not an app screen: English first, Arabic
   for the owner's circle, Chinese for local partners. Short sentences —
   it is read on a phone, often inside WeChat's browser.
   --------------------------------------------------------------------------- */

import type { Translations } from "@/lib/i18n";

export const inviteT = {
  "brand.tag": {
    en: "Enterprise Platform",
    zh: "企业平台",
    ar: "منصة الأعمال",
  },
  "state.loading": { en: "Loading your invitation…", zh: "正在加载您的邀请…", ar: "جاري تحميل دعوتك…" },
  "state.invalid": {
    en: "This invitation link is invalid or has been removed.",
    zh: "此邀请链接无效或已被移除。",
    ar: "رابط الدعوة ده غير صالح أو اتشال.",
  },
  "state.error": {
    en: "Something went wrong. Please try again.",
    zh: "出了点问题，请重试。",
    ar: "حصلت مشكلة، حاول تاني.",
  },
  "label.type": { en: "invites you to", zh: "诚邀您出席", ar: "يدعوك لحضور" },
  "label.guest": { en: "Invitation for", zh: "邀请对象", ar: "الدعوة موجهة لـ" },
  "label.date": { en: "When", zh: "时间", ar: "متى" },
  "label.place": { en: "Where", zh: "地点", ar: "أين" },
  "date.tba": { en: "Dates to be announced", zh: "日期待定", ar: "الموعد هيتعلن قريباً" },
  "cta.accepted": { en: "Accept", zh: "接受", ar: "أوافق" },
  "cta.maybe": { en: "Maybe", zh: "待定", ar: "ربما" },
  "cta.declined": { en: "Decline", zh: "婉拒", ar: "معتذر" },
  "cta.retry": { en: "Try again", zh: "重试", ar: "حاول تاني" },
  "ans.title": { en: "Your answer is in", zh: "已收到您的回复", ar: "وصلنا ردّك" },
  "ans.accepted": {
    en: "Thank you — we look forward to seeing you.",
    zh: "感谢您的回复，期待与您相见。",
    ar: "شكراً لك — مستنيينك.",
  },
  "ans.maybe": {
    en: "Thank you — we saved your seat while you decide.",
    zh: "感谢您的回复，我们为您保留席位。",
    ar: "شكراً — حجزنالك مكان لحد ما تقرر.",
  },
  "ans.declined": {
    en: "Thank you for letting us know — you will be missed.",
    zh: "感谢您的回复，期待下次再聚。",
    ar: "شكراً إنك أخبرتنا — هيفتقدوك.",
  },
  "ans.change": { en: "Change answer", zh: "修改回复", ar: "غيّر الرد" },
  "ans.viewed": { en: "Invitation opened", zh: "邀请已打开", ar: "الدعوة اتفتحت" },
  "qr.title": { en: "Your entry code", zh: "您的入场码", ar: "كود الدخول بتاعك" },
  "qr.hint": {
    en: "Show this code at the door — we'll scan you in.",
    zh: "入场时请出示此码，我们将为您扫码签到。",
    ar: "ورّي الكود ده عند الباب — هنسجّلك بالاسكانر.",
  },
  "foot.powered": { en: "KOLEEX · Events", zh: "KOLEEX · 活动", ar: "KOLEEX · الفعاليات" },
} satisfies Translations;
