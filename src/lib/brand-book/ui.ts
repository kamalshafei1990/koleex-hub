/* ---------------------------------------------------------------------------
   brand-book/ui — the reader's own words (menus, labels, buttons) in all
   three languages.

   A typed record, like trade-terms/ui: every language is required, so a
   missing string is a build error rather than a raw key on screen. The
   chapter BODIES are not here — they are English first (owner, 27/09/2026)
   and say so in the other two languages through `bodyInEnglish`.
   --------------------------------------------------------------------------- */

import type { Lang } from "@/lib/i18n";

export interface BrandBookUI {
  bookTitle: string;
  bookSubtitle: string;
  version: string;          // "{v}" and "{date}"
  readyCount: string;       // "{ready}" and "{total}"
  startReading: string;
  contents: string;
  hideContents: string;
  part: string;             // "{n}"
  chapter: string;          // "{n}"
  soon: string;
  onThisPage: string;
  previous: string;
  next: string;
  backToKnowledge: string;
  backToBook: string;
  bodyInEnglish: string;
  doLabel: string;
  dontLabel: string;
  why: string;
  specs: string;
  download: string;
  copy: string;
  copied: string;
  notFoundTitle: string;
  notFoundBody: string;
  allChapters: string;
}

export const BRAND_BOOK_UI: Record<Lang, BrandBookUI> = {
  en: {
    bookTitle: "Brand Guidelines",
    bookSubtitle: "The rules, the files and the real examples for anyone who uses the KOLEEX brand — for any job, in any language.",
    version: "Version {v} · {date}",
    readyCount: "{ready} of {total} chapters ready",
    startReading: "Start reading",
    contents: "Contents",
    hideContents: "Hide contents",
    part: "Part {n}",
    chapter: "Chapter {n}",
    soon: "Soon",
    onThisPage: "On this page",
    previous: "Previous",
    next: "Next",
    backToKnowledge: "Knowledge",
    backToBook: "Brand Guidelines",
    bodyInEnglish: "",
    doLabel: "Do",
    dontLabel: "Don't",
    why: "Why",
    specs: "Specs",
    download: "Download",
    copy: "Copy",
    copied: "Copied",
    notFoundTitle: "This chapter is not written yet",
    notFoundBody: "It is on the list and will arrive in a later phase. The chapters marked in the contents are ready now.",
    allChapters: "All chapters",
  },
  zh: {
    bookTitle: "品牌手册",
    bookSubtitle: "为所有使用 KOLEEX 品牌的人提供规范、文件和真实示例——适用于任何工作、任何语言。",
    version: "版本 {v} · {date}",
    readyCount: "已完成 {ready} / {total} 章",
    startReading: "开始阅读",
    contents: "目录",
    hideContents: "收起目录",
    part: "第 {n} 部分",
    chapter: "第 {n} 章",
    soon: "即将推出",
    onThisPage: "本页内容",
    previous: "上一章",
    next: "下一章",
    backToKnowledge: "知识库",
    backToBook: "品牌手册",
    bodyInEnglish: "本章正文目前为英文，中文版本将在后续阶段提供。",
    doLabel: "正确",
    dontLabel: "错误",
    why: "原因",
    specs: "规格",
    download: "下载",
    copy: "复制",
    copied: "已复制",
    notFoundTitle: "本章尚未完成",
    notFoundBody: "本章已列入计划，将在后续阶段完成。目录中已标记的章节现在即可阅读。",
    allChapters: "全部章节",
  },
  ar: {
    bookTitle: "دليل الهوية",
    bookSubtitle: "القواعد والملفات والأمثلة الحقيقية لكل من يستخدم علامة KOLEEX — لأي عمل وبأي لغة.",
    version: "الإصدار {v} · {date}",
    readyCount: "{ready} من {total} فصلًا جاهز",
    startReading: "ابدأ القراءة",
    contents: "المحتويات",
    hideContents: "إخفاء المحتويات",
    part: "الجزء {n}",
    chapter: "الفصل {n}",
    soon: "قريبًا",
    onThisPage: "في هذه الصفحة",
    previous: "السابق",
    next: "التالي",
    backToKnowledge: "المعرفة",
    backToBook: "دليل الهوية",
    bodyInEnglish: "نص هذا الفصل بالإنجليزية حاليًا، والنسخة العربية ستصدر في مرحلة لاحقة.",
    doLabel: "صح",
    dontLabel: "خطأ",
    why: "السبب",
    specs: "المواصفات",
    download: "تحميل",
    copy: "نسخ",
    copied: "تم النسخ",
    notFoundTitle: "هذا الفصل لم يُكتب بعد",
    notFoundBody: "الفصل موجود في الخطة وسيصدر في مرحلة لاحقة. الفصول المعلَّمة في المحتويات جاهزة الآن.",
    allChapters: "كل الفصول",
  },
};

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
