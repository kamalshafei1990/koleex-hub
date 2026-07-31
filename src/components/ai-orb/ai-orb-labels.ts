/* Localized status labels (en/zh/ar) for the orb's aria-label and the
   optional visible caption. Concise on purpose. */

import type { AIOrbActivity, AIOrbState } from "./ai-orb-types";

type Lang = "en" | "zh" | "ar";

const STATE_LABELS: Record<Lang, Partial<Record<AIOrbState, string>>> = {
  en: {
    idle: "Koleex AI",
    awakening: "Starting…",
    listening: "Listening…",
    transcribing: "Transcribing…",
    thinking: "Thinking…",
    processing: "Working…",
    speaking: "Speaking…",
    success: "Done",
    warning: "Needs attention",
    error: "Something went wrong",
    sleeping: "Asleep",
  },
  zh: {
    idle: "Koleex AI",
    awakening: "正在启动…",
    listening: "正在聆听…",
    transcribing: "正在转写…",
    thinking: "思考中…",
    processing: "处理中…",
    speaking: "正在回复…",
    success: "完成",
    warning: "需要注意",
    error: "出错了",
    sleeping: "休眠中",
  },
  ar: {
    idle: "Koleex AI",
    awakening: "جارٍ التشغيل…",
    listening: "يستمع…",
    transcribing: "يحوّل الصوت إلى نص…",
    thinking: "يفكر…",
    processing: "يعمل…",
    speaking: "يتحدث…",
    success: "تم",
    warning: "يحتاج انتباهك",
    error: "حدث خطأ",
    sleeping: "في وضع السكون",
  },
};

const ACTIVITY_LABELS: Record<Lang, Partial<Record<AIOrbActivity, string>>> = {
  en: {
    searching: "Searching…",
    browsing: "Browsing…",
    reading: "Reading…",
    analyzing: "Analyzing…",
    reasoning: "Reasoning…",
    translating: "Translating…",
    generating: "Writing…",
    "retrieving-data": "Fetching data…",
    "executing-action": "Executing…",
    "creating-record": "Creating…",
    "updating-record": "Updating…",
    "deleting-record": "Deleting…",
    uploading: "Uploading…",
    downloading: "Downloading…",
    connecting: "Connecting…",
    "waiting-for-user": "Waiting for you",
    "requesting-permission": "Needs your approval",
  },
  zh: {
    searching: "搜索中…",
    browsing: "浏览中…",
    reading: "阅读中…",
    analyzing: "分析中…",
    reasoning: "推理中…",
    translating: "翻译中…",
    generating: "生成中…",
    "retrieving-data": "获取数据中…",
    "executing-action": "执行中…",
    "creating-record": "创建中…",
    "updating-record": "更新中…",
    "deleting-record": "删除中…",
    uploading: "上传中…",
    downloading: "下载中…",
    connecting: "连接中…",
    "waiting-for-user": "等待您的回复",
    "requesting-permission": "需要您的授权",
  },
  ar: {
    searching: "يبحث…",
    browsing: "يتصفح…",
    reading: "يقرأ…",
    analyzing: "يحلل…",
    reasoning: "يستنتج…",
    translating: "يترجم…",
    generating: "يكتب…",
    "retrieving-data": "يجلب البيانات…",
    "executing-action": "ينفذ…",
    "creating-record": "ينشئ…",
    "updating-record": "يحدّث…",
    "deleting-record": "يحذف…",
    uploading: "يرفع…",
    downloading: "ينزّل…",
    connecting: "يتصل…",
    "waiting-for-user": "بانتظارك",
    "requesting-permission": "يحتاج موافقتك",
  },
};

export function orbStatusLabel(
  state: AIOrbState,
  activity: AIOrbActivity,
  lang: string,
): string {
  const l: Lang = lang === "zh" || lang === "ar" ? lang : "en";
  if ((state === "processing" || state === "thinking") && activity !== "none") {
    const a = ACTIVITY_LABELS[l][activity];
    if (a) return a;
  }
  return STATE_LABELS[l][state] ?? STATE_LABELS.en[state] ?? "Koleex AI";
}
