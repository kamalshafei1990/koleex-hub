/* ---------------------------------------------------------------------------
   components/ai/activity-copy — what Koleex AI is doing, in words.

   The owner, looking at Grok: "in the text conversation or voice it always
   has a small title with a simple motion showing what the AI is doing —
   searching, thinking…". The orb already knew (its activity is derived from
   the latest tool-call step); nothing wrote it down. This is the one place
   an activity becomes a sentence, so the chat line, the voice caption and
   any future surface say the same thing for the same state.

   THE WORDS NAME THE WORK, NEVER THE TOOL. "Searching the web" rather than
   "search_web", "Checking the records" rather than "getProductFullDetails":
   a tool name is an implementation detail and, for some tools, a vendor's
   vocabulary. Short, present-tense, and the same shape in three languages
   so a shimmering line stays one line.
   --------------------------------------------------------------------------- */

import type { AIOrbActivity } from "@/components/ai-orb/ai-orb-types";
import type { Lang } from "@/lib/i18n";

export const ACTIVITY_COPY: Record<Lang, Record<AIOrbActivity, string>> = {
  en: {
    none: "Thinking",
    searching: "Searching",
    browsing: "Searching the web",
    reading: "Reading the details",
    analyzing: "Working it out",
    reasoning: "Thinking it through",
    translating: "Translating",
    generating: "Creating",
    "retrieving-data": "Checking the records",
    "executing-action": "Working on it",
    "creating-record": "Saving",
    "updating-record": "Updating",
    "deleting-record": "Removing",
    uploading: "Uploading",
    downloading: "Fetching the file",
    connecting: "Connecting",
    "waiting-for-user": "Waiting for you",
    "requesting-permission": "Checking permission",
  },
  zh: {
    none: "思考中",
    searching: "搜索中",
    browsing: "正在搜索网页",
    reading: "正在查看详情",
    analyzing: "正在分析",
    reasoning: "正在思考",
    translating: "翻译中",
    generating: "生成中",
    "retrieving-data": "正在查询记录",
    "executing-action": "处理中",
    "creating-record": "保存中",
    "updating-record": "更新中",
    "deleting-record": "删除中",
    uploading: "上传中",
    downloading: "正在获取文件",
    connecting: "连接中",
    "waiting-for-user": "等待您的回复",
    "requesting-permission": "正在检查权限",
  },
  ar: {
    none: "بفكّر",
    searching: "ببحث",
    browsing: "ببحث على النت",
    reading: "بقرأ التفاصيل",
    analyzing: "بحسبها",
    reasoning: "بفكّر فيها",
    translating: "بترجم",
    generating: "بجهّزها",
    "retrieving-data": "بشوف السجلات",
    "executing-action": "شغّال عليها",
    "creating-record": "بحفظ",
    "updating-record": "بحدّث",
    "deleting-record": "بشيل",
    uploading: "برفع الملف",
    downloading: "بجيب الملف",
    connecting: "بوصّل",
    "waiting-for-user": "مستنيك",
    "requesting-permission": "بتأكد من الصلاحية",
  },
};

/** The sentence for an activity, in the UI language. Unknown → the
 *  language's "Thinking", never an empty line. */
export function activityLabel(activity: AIOrbActivity | null | undefined, lang: Lang): string {
  const table = ACTIVITY_COPY[lang] ?? ACTIVITY_COPY.en;
  return table[activity ?? "none"] ?? table.none;
}
