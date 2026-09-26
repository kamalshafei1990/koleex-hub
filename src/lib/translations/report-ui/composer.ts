import type { Translations } from "@/lib/i18n";

/* Reports words — Writing a report — the page's composer; the template
   builder uses a few of these too. One file per place that reads them (26
   Sep 2026): each screen imports only its own, and ../reports.ts spreads
   them all for the server. validate:reports §26 fails when a screen reads a
   word it did not import. */
export const reportComposerT: Translations = {
  "composer.new":        { en: "New report", zh: "新建报告", ar: "تقرير جديد" },
  "composer.edit":       { en: "Edit draft", zh: "编辑草稿", ar: "تعديل المسودة" },
  "composer.titleLabel": { en: "Title", zh: "标题", ar: "العنوان" },
  "composer.to":         { en: "To", zh: "收件人", ar: "إلى" },
  "composer.cc":         { en: "Copy", zh: "抄送", ar: "نسخة" },
  "composer.addPeople":  { en: "Add people", zh: "添加人员", ar: "ضيف أشخاص" },
  "composer.searchPeople": { en: "Search people…", zh: "搜索人员…", ar: "دوّر على شخص…" },
  "composer.noPeople":   { en: "No one matches.", zh: "没有匹配的人员。", ar: "مفيش حد بالاسم ده." },
  "composer.defaultTo":  { en: "Filled from the report type. Change it if you need to.", zh: "按报告类型自动填写，需要时可修改。", ar: "اتملت من نوع التقرير، وتقدر تغيرها." },
  "composer.confidential": { en: "Confidential", zh: "保密", ar: "سري" },
  "composer.confidentialHint": { en: "Only you and the people you send it to can read it.", zh: "只有你和收件人可以阅读。", ar: "محدش يقراه غيرك وغير اللي هتبعتلهم." },
  "composer.reviewHint": { en: "This type needs a review: the first recipient approves it or returns it with a comment.", zh: "此类型需要审阅：收件人批准或附意见退回。", ar: "النوع ده محتاج مراجعة: المستلم يوافق أو يرجعه بتعليق." },
  "composer.listHint":   { en: "One item per line", zh: "每行一项", ar: "كل بند في سطر" },
  "composer.required":   { en: "Required", zh: "必填", ar: "مطلوب" },
  "composer.saveDraft":  { en: "Save draft", zh: "保存草稿", ar: "احفظ المسودة" },
  "composer.saving":     { en: "Saving…", zh: "正在保存…", ar: "بيتحفظ…" },
  "composer.saved":      { en: "Draft saved", zh: "草稿已保存", ar: "المسودة اتحفظت" },
  "composer.send":       { en: "Send report", zh: "发送报告", ar: "ابعت التقرير" },
  "composer.sending":    { en: "Sending…", zh: "正在发送…", ar: "بيتبعت…" },
  "composer.missing":    { en: "Fill in the required sections first:", zh: "请先填写必填部分：", ar: "املا الأجزاء المطلوبة الأول:" },
  "composer.noRecipients": { en: "Add at least one person to send it to.", zh: "请至少添加一位收件人。", ar: "ضيف شخص واحد على الأقل تبعتله." },
  "composer.delete":     { en: "Delete draft", zh: "删除草稿", ar: "امسح المسودة" },
  "composer.deleteConfirm": { en: "Delete this draft? This cannot be undone.", zh: "删除此草稿？此操作无法撤销。", ar: "تمسح المسودة دي؟ مش هتقدر ترجعها." },
  "composer.cancel":     { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "composer.newVersionNote": { en: "You are editing a new version. The one already sent stays as it is until you send this.", zh: "你正在编辑新版本。已发送的版本在你发送前保持不变。", ar: "إنت بتعدل نسخة جديدة. النسخة اللي اتبعتت هتفضل زي ما هي لحد ما تبعت دي." },
};
