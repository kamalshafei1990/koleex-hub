import type { Translations } from "@/lib/i18n";

/* Issue reports (QA) — lib/qa/notify.ts and every notifyIssue caller:
   api/qa/reports (new issue), api/qa/reports/[id] (workflow PATCH),
   …/[id]/comments, …/[id]/evidence, api/qa/my-issues/[id] (reporter reply /
   edit) and …/my-issues/[id]/action (reporter verify / reopen). Watchers get
   the same sentence unless it says "you" — then a `.watcher` key. */
export const qaTpl: Translations = {
  /* ── New issue (api/qa/reports POST) ── */
  "qa_issue_assigned.new_issue.s": { en: "New issue: {title:free}", zh: "新问题：{title:free}", ar: "مشكلة جديدة: {title:free}" },
  "qa_issue_assigned.new_issue.b": {
    en: "{actor} filed \"{title:free}\" on {module}[[ ({route})]].",
    zh: "{actor} 在 {module}[[（{route}）]]提交了“{title:free}”。",
    ar: "قدّم {actor} المشكلة \"{title:free}\" في {module}[[ ({route})]].",
  },
  "qa_issue_assigned.on_create.s": { en: "Assigned to you: {title:free}", zh: "分配给你：{title:free}", ar: "أُسندت إليك: {title:free}" },
  "qa_issue_assigned.on_create.b": {
    en: "{actor} assigned you \"{title:free}\" on {module}.",
    zh: "{actor} 在 {module} 将“{title:free}”分配给了你。",
    ar: "أسند إليك {actor} المشكلة \"{title:free}\" في {module}.",
  },

  /* ── Assignment ── */
  "qa_issue_assigned.s": { en: "Issue assigned to you", zh: "问题已分配给你", ar: "أُسندت إليك مشكلة" },
  "qa_issue_assigned.b": { en: "{actor} assigned you \"{title:free}\"", zh: "{actor} 将“{title:free}”分配给了你", ar: "أسند إليك {actor} المشكلة \"{title:free}\"" },
  "qa_issue_assigned.watcher.s": { en: "Issue assigned", zh: "问题已分配", ar: "تم إسناد مشكلة" },
  "qa_issue_assigned.watcher.b": { en: "{actor} assigned \"{title:free}\"", zh: "{actor} 分配了“{title:free}”", ar: "أسند {actor} المشكلة \"{title:free}\"" },
  "qa_issue_reassigned.s": { en: "Issue reassigned to you", zh: "问题已重新分配给你", ar: "أُعيد إسناد مشكلة إليك" },
  "qa_issue_reassigned.b": { en: "{actor} assigned you \"{title:free}\"", zh: "{actor} 将“{title:free}”分配给了你", ar: "أسند إليك {actor} المشكلة \"{title:free}\"" },
  "qa_issue_reassigned.watcher.s": { en: "Issue reassigned", zh: "问题已重新分配", ar: "أُعيد إسناد مشكلة" },
  "qa_issue_reassigned.watcher.b": { en: "{actor} reassigned \"{title:free}\"", zh: "{actor} 重新分配了“{title:free}”", ar: "أعاد {actor} إسناد المشكلة \"{title:free}\"" },

  /* ── Status (one sentence; a settling status has its own type) ── */
  "qa_status_changed.s": { en: "Status: {status:qaStatus}", zh: "状态：{status:qaStatus}", ar: "الحالة: {status:qaStatus}" },
  "qa_status_changed.b": {
    en: "{actor} moved \"{title:free}\" to {status:qaStatus}",
    zh: "{actor} 将“{title:free}”的状态改为{status:qaStatus}",
    ar: "غيّر {actor} حالة \"{title:free}\" إلى {status:qaStatus}",
  },
  "qa_issue_verified.status.s": { en: "Status: {status:qaStatus}", zh: "状态：{status:qaStatus}", ar: "الحالة: {status:qaStatus}" },
  "qa_issue_verified.status.b": {
    en: "{actor} moved \"{title:free}\" to {status:qaStatus}",
    zh: "{actor} 将“{title:free}”的状态改为{status:qaStatus}",
    ar: "غيّر {actor} حالة \"{title:free}\" إلى {status:qaStatus}",
  },
  "qa_issue_closed.s": { en: "Status: {status:qaStatus}", zh: "状态：{status:qaStatus}", ar: "الحالة: {status:qaStatus}" },
  "qa_issue_closed.b": {
    en: "{actor} moved \"{title:free}\" to {status:qaStatus}",
    zh: "{actor} 将“{title:free}”的状态改为{status:qaStatus}",
    ar: "غيّر {actor} حالة \"{title:free}\" إلى {status:qaStatus}",
  },
  "qa_issue_duplicate_marked.status.s": { en: "Status: {status:qaStatus}", zh: "状态：{status:qaStatus}", ar: "الحالة: {status:qaStatus}" },
  "qa_issue_duplicate_marked.status.b": {
    en: "{actor} moved \"{title:free}\" to {status:qaStatus}",
    zh: "{actor} 将“{title:free}”的状态改为{status:qaStatus}",
    ar: "غيّر {actor} حالة \"{title:free}\" إلى {status:qaStatus}",
  },
  "qa_status_changed.evidence.s": { en: "Fix evidence added (cycle {cycle})", zh: "已添加修复证据（第 {cycle} 轮）", ar: "أُضيف دليل الإصلاح (الدورة {cycle})" },
  "qa_status_changed.evidence.b": {
    en: "{actor} attached fix evidence for \"{title:free}\". Open to compare BEFORE / AFTER.",
    zh: "{actor} 为“{title:free}”附上了修复证据。打开即可对比修复前 / 修复后。",
    ar: "أرفق {actor} دليل الإصلاح لـ \"{title:free}\". افتحها للمقارنة بين قبل / بعد.",
  },

  /* ── Reopen / verify ── */
  "qa_issue_reopened.s": { en: "Issue reopened", zh: "问题已重新打开", ar: "أُعيد فتح مشكلة" },
  "qa_issue_reopened.b": {
    en: "{actor} reopened \"{title:free}\"[[: {reason:free}]]",
    zh: "{actor} 重新打开了“{title:free}”[[：{reason:free}]]",
    ar: "أعاد {actor} فتح \"{title:free}\"[[: {reason:free}]]",
  },
  "qa_issue_reopened.by_reporter.s": { en: "Reporter reopened the issue", zh: "报告人重新打开了问题", ar: "أعاد المُبلِّغ فتح المشكلة" },
  "qa_issue_reopened.by_reporter.b": {
    en: "{actor} reopened \"{title:free}\". Reason: {reason:free}",
    zh: "{actor} 重新打开了“{title:free}”。原因：{reason:free}",
    ar: "أعاد {actor} فتح \"{title:free}\". السبب: {reason:free}",
  },
  "qa_issue_verified.by_reporter.s": { en: "Reporter verified the fix", zh: "报告人已验证修复", ar: "أكّد المُبلِّغ الإصلاح" },
  "qa_issue_verified.by_reporter.b": {
    en: "{actor} confirmed the fix worked on \"{title:free}\".",
    zh: "{actor} 确认“{title:free}”的修复有效。",
    ar: "أكّد {actor} أن إصلاح \"{title:free}\" قد نجح.",
  },

  /* ── Priority ── */
  "qa_priority_changed.s": { en: "Priority: {priority:qaPriority}", zh: "优先级：{priority:qaPriority}", ar: "الأولوية: {priority:qaPriority}" },
  "qa_priority_changed.b": {
    en: "{actor} set \"{title:free}\" priority to {priority:qaPriority}",
    zh: "{actor} 将“{title:free}”的优先级设为{priority:qaPriority}",
    ar: "غيّر {actor} أولوية \"{title:free}\" إلى {priority:qaPriority}",
  },

  /* ── Duplicate ── */
  "qa_issue_duplicate_marked.s": { en: "Marked as duplicate", zh: "已标记为重复", ar: "تم وضع علامة مكررة" },
  "qa_issue_duplicate_marked.b": {
    en: "{actor} marked \"{title:free}\" as a duplicate",
    zh: "{actor} 将“{title:free}”标记为重复",
    ar: "وضع {actor} علامة مكررة على \"{title:free}\"",
  },

  /* ── Comments & mentions (with / without an image) ── */
  "qa_issue_mentioned.s": { en: "You were mentioned", zh: "有人提到了你", ar: "تمت الإشارة إليك" },
  "qa_issue_mentioned.b": { en: "{actor} mentioned you on \"{title:free}\"", zh: "{actor} 在“{title:free}”中提到了你", ar: "أشار إليك {actor} في \"{title:free}\"" },
  "qa_issue_mentioned.image.s": { en: "You were mentioned", zh: "有人提到了你", ar: "تمت الإشارة إليك" },
  "qa_issue_mentioned.image.b": {
    en: "{actor} mentioned you on \"{title:free}\" (with image)",
    zh: "{actor} 在“{title:free}”中提到了你（附图片）",
    ar: "أشار إليك {actor} في \"{title:free}\" (مع صورة)",
  },
  "qa_comment_added.s": { en: "New comment", zh: "新评论", ar: "تعليق جديد" },
  "qa_comment_added.b": { en: "{actor} commented on \"{title:free}\"", zh: "{actor} 评论了“{title:free}”", ar: "علّق {actor} على \"{title:free}\"" },
  "qa_comment_added.image.s": { en: "New comment", zh: "新评论", ar: "تعليق جديد" },
  "qa_comment_added.image.b": {
    en: "{actor} commented on \"{title:free}\" (with image)",
    zh: "{actor} 评论了“{title:free}”（附图片）",
    ar: "علّق {actor} على \"{title:free}\" (مع صورة)",
  },
  "qa_comment_added.reply.s": { en: "Reporter replied", zh: "报告人已回复", ar: "ردّ المُبلِّغ" },
  "qa_comment_added.reply.b": { en: "{actor} replied on \"{title:free}\"", zh: "{actor} 回复了“{title:free}”", ar: "ردّ {actor} على \"{title:free}\"" },
  "qa_comment_added.reply.image.s": { en: "Reporter replied", zh: "报告人已回复", ar: "ردّ المُبلِّغ" },
  "qa_comment_added.reply.image.b": {
    en: "{actor} replied on \"{title:free}\" (with image)",
    zh: "{actor} 回复了“{title:free}”（附图片）",
    ar: "ردّ {actor} على \"{title:free}\" (مع صورة)",
  },

  /* ── Reporter edited their report (1–3 fields, in this order) ── */
  "qa_comment_added.edited.s": { en: "Reporter edited their report", zh: "报告人编辑了报告", ar: "عدّل المُبلِّغ بلاغه" },
  "qa_comment_added.edited.b": {
    en: "{actor} updated \"{title:free}\" ({f1:qaField}[[, {f2:qaField}]][[, {f3:qaField}]])",
    zh: "{actor} 更新了“{title:free}”（{f1:qaField}[[、{f2:qaField}]][[、{f3:qaField}]]）",
    ar: "حدّث {actor} \"{title:free}\" ({f1:qaField}[[، {f2:qaField}]][[، {f3:qaField}]])",
  },
  "qa_comment_added.edited.watcher.s": { en: "Reporter edited their report", zh: "报告人编辑了报告", ar: "عدّل المُبلِّغ بلاغه" },
  "qa_comment_added.edited.watcher.b": {
    en: "{actor} updated their report ({f1:qaField}[[, {f2:qaField}]][[, {f3:qaField}]])",
    zh: "{actor} 更新了报告（{f1:qaField}[[、{f2:qaField}]][[、{f3:qaField}]]）",
    ar: "حدّث {actor} بلاغه ({f1:qaField}[[، {f2:qaField}]][[، {f3:qaField}]])",
  },

  /* ── Enums — every IssueStatus / Priority in lib/qa/types.ts; en = STATUS_LABEL / PRIORITY_LABEL ── */
  "enum.qaStatus.new": { en: "New", zh: "新建", ar: "جديدة" },
  "enum.qaStatus.triaged": { en: "Triaged", zh: "已分类", ar: "تم الفرز" },
  "enum.qaStatus.in_progress": { en: "In Progress", zh: "处理中", ar: "قيد التنفيذ" },
  "enum.qaStatus.fixed": { en: "Fixed", zh: "已修复", ar: "تم الإصلاح" },
  "enum.qaStatus.verified": { en: "Verified", zh: "已验证", ar: "تم التحقق" },
  "enum.qaStatus.rejected": { en: "Rejected", zh: "已拒绝", ar: "مرفوضة" },
  "enum.qaStatus.duplicate": { en: "Duplicate", zh: "重复", ar: "مكررة" },
  "enum.qaStatus.needs_more_info": { en: "Needs More Info", zh: "需更多信息", ar: "تحتاج مزيدًا من المعلومات" },
  "enum.qaStatus.closed": { en: "Closed", zh: "已关闭", ar: "مغلقة" },
  "enum.qaStatus.reopened": { en: "Reopened", zh: "已重新打开", ar: "أُعيد فتحها" },

  "enum.qaPriority.low": { en: "Low", zh: "低", ar: "منخفضة" },
  "enum.qaPriority.normal": { en: "Normal", zh: "普通", ar: "عادية" },
  "enum.qaPriority.high": { en: "High", zh: "高", ar: "عالية" },
  "enum.qaPriority.urgent": { en: "Urgent", zh: "紧急", ar: "عاجلة" },

  /* The report fields a reporter can edit (api/qa/my-issues/[id] PATCH `changed`). */
  "enum.qaField.title": { en: "title", zh: "标题", ar: "العنوان" },
  "enum.qaField.description": { en: "description", zh: "描述", ar: "الوصف" },
  "enum.qaField.screenshots": { en: "screenshots", zh: "截图", ar: "لقطات الشاشة" },
};
