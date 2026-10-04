import type { Translations } from "@/lib/i18n";

/* The words of the bell's rarely opened parts (components/layout/
   NotificationMore): the pause menu, the ⋯ panel under a row (Later, Mute)
   and the card's Later. They load with that chunk, when first opened —
   never with the bell (validate:budgets §L). */
export const notifMoreT: Translations = {
  "later.again":    { en: "Remind me",      zh: "提醒我",     ar: "ذكّرني" },
  "later.1h":       { en: "In 1 hour",      zh: "1 小时后",   ar: "بعد ساعة" },
  "later.3h":       { en: "In 3 hours",     zh: "3 小时后",   ar: "بعد 3 ساعات" },
  "later.tomorrow": { en: "Tomorrow 9 AM",  zh: "明天上午 9 点", ar: "غدًا 9 صباحًا" },
  "later.done":     { en: "Back {time}",    zh: "{time} 再提醒", ar: "يعود {time}" },
  "later.now":      { en: "Bring back now", zh: "现在恢复",   ar: "أعِده الآن" },
  "pause.hint":     { en: "No sounds, pop-ups or phone alerts. The bell still collects everything.", zh: "不响铃、不弹出、手机不推送。铃铛仍会收集所有通知。", ar: "بلا أصوات ولا نوافذ منبثقة ولا تنبيهات على الهاتف. الجرس يجمع كل شيء كالمعتاد." },
  "pause.hour":     { en: "For 1 hour",     zh: "1 小时",     ar: "لمدة ساعة" },
  "pause.morning":  { en: "Until tomorrow morning", zh: "到明天早上", ar: "حتى صباح الغد" },
  "pause.meeting":  { en: "While I'm in a meeting", zh: "开会期间", ar: "أثناء الاجتماع" },
  "pause.meetingNote": { en: "until it ends", zh: "到会议结束", ar: "حتى ينتهي" },

  /* Mute one topic (lib/notification-mute). */
  "mute.this":      { en: "Stop notifications about this", zh: "不再接收此事项的通知", ar: "أوقف الإشعارات عن هذا" },
  "mute.done":      { en: "Muted. Undo it in Settings → Notifications.", zh: "已静音。可在 设置 → 通知 中恢复。", ar: "تم الكتم. يمكنك التراجع من الإعدادات ← الإشعارات." },
  "mute.failed":    { en: "Couldn't mute. Try again.", zh: "静音失败，请重试。", ar: "تعذّر الكتم. حاول مرة أخرى." },
};
