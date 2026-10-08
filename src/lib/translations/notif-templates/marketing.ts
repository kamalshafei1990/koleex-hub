import type { Translations } from "@/lib/i18n";

/* Social Marketing and CEO Brand — lib/server/marketing/notify.ts: a post
   sent for approval, the decision on it, what publishing it came to (each
   also for CEO Brand, marketing_ceo_*), a customer's private message waiting
   for an answer, and the weekly plan waiting on an approver. {accounts}
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

  "marketing_message_waiting.s": { en: "{who} sent a message on {platform}", zh: "{who} 在 {platform} 发来消息", ar: "رسالة من {who} على {platform}" },
  "marketing_message_waiting.b": { en: "[[{text:free}]]", zh: "[[{text:free}]]", ar: "[[{text:free}]]" },

  "marketing_comment_waiting.s": { en: "{who} commented on {platform}", zh: "{who} 在 {platform} 评论了", ar: "تعليق من {who} على {platform}" },
  "marketing_comment_waiting.b": { en: "[[{text:free}]]", zh: "[[{text:free}]]", ar: "[[{text:free}]]" },

  "marketing_plan_approval_request.s": { en: "This week's social media plan is ready to approve", zh: "本周社交媒体计划待审批", ar: "خطة السوشيال ميديا لهذا الأسبوع جاهزة لموافقتك" },
  "marketing_plan_approval_request.b": {
    en: "Koleex AI drafted it from the accounts' numbers — review it, edit it if needed, and approve it.",
    zh: "Koleex AI 根据各账号的数据起草了这份计划——请查看，必要时修改，然后批准。",
    ar: "أعدّها Koleex AI من أرقام الحسابات — راجعها وعدّلها لو لزم ثم وافق عليها.",
  },

  "marketing_ceo_approval_request.s": { en: "CEO Brand post to approve — {who}", zh: "待审批的 CEO 个人品牌帖子 — {who}", ar: "منشور لبراند المدير التنفيذي بانتظار موافقتك — {who}" },
  "marketing_ceo_approval_request.b": { en: "{accounts}[[ · {text:free}]]", zh: "{accounts}[[ · {text:free}]]", ar: "{accounts}[[ · {text:free}]]" },

  "marketing_ceo_post_decided.s": { en: "The CEO approved your post", zh: "CEO 已批准你的帖子", ar: "وافق المدير التنفيذي على منشورك" },
  "marketing_ceo_post_decided.b": { en: "Going out now on {accounts}.", zh: "正在发布到 {accounts}。", ar: "يُنشر الآن على {accounts}." },
  "marketing_ceo_post_decided.scheduled.s": { en: "The CEO scheduled your post for {when}", zh: "CEO 已将你的帖子定时于 {when} 发布", ar: "جدول المدير التنفيذي منشورك في {when}" },
  "marketing_ceo_post_decided.scheduled.b": { en: "Shanghai time · {accounts}", zh: "上海时间 · {accounts}", ar: "بتوقيت شنغهاي · {accounts}" },
  "marketing_ceo_post_decided.rejected.s": { en: "The CEO sent your post back", zh: "CEO 退回了你的帖子", ar: "أعاد المدير التنفيذي منشورك للتعديل" },
  "marketing_ceo_post_decided.rejected.b": { en: "{note:free}", zh: "{note:free}", ar: "{note:free}" },
  "marketing_ceo_post_decided.unscheduled.s": { en: "Your CEO Brand post was taken off the schedule", zh: "你的 CEO 个人品牌帖子已被取消定时", ar: "أُلغيت جدولة منشورك في براند المدير التنفيذي" },
  "marketing_ceo_post_decided.unscheduled.b": {
    en: "It is a draft again — send it to the CEO to publish it.",
    zh: "它已退回草稿——重新提交给 CEO 后才会发布。",
    ar: "عاد مسودة — أرسله للمدير التنفيذي من جديد لنشره.",
  },

  "marketing_ceo_publish_failed.s": { en: "A CEO Brand post could not be published", zh: "有 CEO 个人品牌帖子发布失败", ar: "تعذّر نشر منشور في براند المدير التنفيذي" },
  "marketing_ceo_publish_failed.b": { en: "{accounts}[[ — {reason:free}]]", zh: "{accounts}[[ — {reason:free}]]", ar: "{accounts}[[ — {reason:free}]]" },
  "marketing_ceo_publish_failed.partly.s": { en: "A CEO Brand post went out on only some accounts", zh: "有 CEO 个人品牌帖子只发布到了部分账号", ar: "نُشر منشور براند المدير التنفيذي على بعض الحسابات فقط" },
  "marketing_ceo_publish_failed.partly.b": { en: "Not published on {accounts}[[ — {reason:free}]]", zh: "未发布到 {accounts}[[ — {reason:free}]]", ar: "لم يُنشر على {accounts}[[ — {reason:free}]]" },

  "marketing_ceo_post_published.s": { en: "Your CEO Brand post is live", zh: "你的 CEO 个人品牌帖子已发布", ar: "نُشر منشورك في براند المدير التنفيذي" },
  "marketing_ceo_post_published.b": { en: "Published on {accounts}.", zh: "已发布到 {accounts}。", ar: "نُشر على {accounts}." },

  "marketing_ceo_capture_ready.s": { en: "{who} recorded a post — the draft is ready", zh: "{who} 录制了一条帖子——草稿已就绪", ar: "سجّل {who} منشورًا — المسودة جاهزة" },
  "marketing_ceo_capture_ready.b": { en: "[[{text:free}]]", zh: "[[{text:free}]]", ar: "[[{text:free}]]" },
};
