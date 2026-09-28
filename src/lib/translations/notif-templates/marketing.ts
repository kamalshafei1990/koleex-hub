import type { Translations } from "@/lib/i18n";

/* Social Marketing — lib/server/marketing/notify.ts: a post sent for
   approval, the decision on it, and what publishing it came to. {accounts}
   is "Facebook · Instagram" (platform names read the same in every
   language); {when} is Shanghai time, D/M/Y, like every marketing screen. */
export const marketingTpl: Translations = {
  "marketing_approval_request.s": { en: "Post to approve — {who}", zh: "待审批的帖子 — {who}", ar: "منشور بانتظار موافقتك — {who}" },
  "marketing_approval_request.b": { en: "{accounts}[[ · {text:free}]]", zh: "{accounts}[[ · {text:free}]]", ar: "{accounts}[[ · {text:free}]]" },

  "marketing_post_decided.s": { en: "Your post was approved", zh: "你的帖子已通过审批", ar: "تمت الموافقة على منشورك" },
  "marketing_post_decided.b": { en: "Going out now on {accounts}.", zh: "正在发布到 {accounts}。", ar: "يُنشر الآن على {accounts}." },
  "marketing_post_decided.scheduled.s": { en: "Your post is scheduled for {when}", zh: "你的帖子已定时于 {when} 发布", ar: "جُدول منشورك في {when}" },
  "marketing_post_decided.scheduled.b": { en: "Shanghai time · {accounts}", zh: "上海时间 · {accounts}", ar: "بتوقيت شنغهاي · {accounts}" },
  "marketing_post_decided.rejected.s": { en: "Your post was sent back", zh: "你的帖子被退回修改", ar: "أُعيد منشورك للتعديل" },
  "marketing_post_decided.rejected.b": { en: "{note:free}", zh: "{note:free}", ar: "{note:free}" },
  "marketing_post_decided.unscheduled.s": { en: "Your post was taken off the schedule", zh: "你的帖子已被取消定时", ar: "أُلغيت جدولة منشورك" },
  "marketing_post_decided.unscheduled.b": {
    en: "It is a draft again — send it for approval to publish it.",
    zh: "它已退回草稿——重新提交审批后才会发布。",
    ar: "عاد مسودة — أرسله للموافقة من جديد لنشره.",
  },

  "marketing_publish_failed.s": { en: "A post could not be published", zh: "有帖子发布失败", ar: "تعذّر نشر منشور" },
  "marketing_publish_failed.b": { en: "{accounts}[[ — {reason:free}]]", zh: "{accounts}[[ — {reason:free}]]", ar: "{accounts}[[ — {reason:free}]]" },
  "marketing_publish_failed.partly.s": { en: "A post went out on only some accounts", zh: "有帖子只发布到了部分账号", ar: "نُشر منشور على بعض الحسابات فقط" },
  "marketing_publish_failed.partly.b": { en: "Not published on {accounts}[[ — {reason:free}]]", zh: "未发布到 {accounts}[[ — {reason:free}]]", ar: "لم يُنشر على {accounts}[[ — {reason:free}]]" },

  "marketing_post_published.s": { en: "Your post is live", zh: "你的帖子已发布", ar: "نُشر منشورك" },
  "marketing_post_published.b": { en: "Published on {accounts}.", zh: "已发布到 {accounts}。", ar: "نُشر على {accounts}." },
};
