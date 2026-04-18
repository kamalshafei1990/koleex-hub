import type { Translations } from "@/lib/i18n";

export const notesT: Translations = {
  /* App + smart folders */
  "app.title":         { en: "Notes",                zh: "笔记",               ar: "الملاحظات" },
  "app.subtitle":      { en: "Capture, organise, and find your notes",
                         zh: "记录、整理并查找您的笔记",
                         ar: "التقاط وتنظيم وإيجاد ملاحظاتك" },

  "smart.allNotes":    { en: "All Notes",            zh: "所有笔记",           ar: "كل الملاحظات" },
  "smart.pinned":      { en: "Pinned",               zh: "固定",               ar: "مثبّتة" },
  "smart.none":        { en: "Unfiled",              zh: "未分类",             ar: "غير مصنفة" },
  "smart.trash":       { en: "Recently Deleted",     zh: "最近删除",           ar: "المحذوفة مؤخرًا" },

  "folders":           { en: "Folders",              zh: "文件夹",             ar: "المجلدات" },
  "newFolder":         { en: "New Folder",           zh: "新建文件夹",         ar: "مجلد جديد" },
  "newSubfolder":      { en: "New Subfolder",        zh: "新建子文件夹",       ar: "مجلد فرعي جديد" },
  "folderName":        { en: "Folder name",          zh: "文件夹名称",         ar: "اسم المجلد" },
  "noteName":          { en: "Note name",            zh: "笔记名称",           ar: "اسم الملاحظة" },
  "rename":            { en: "Rename",               zh: "重命名",             ar: "إعادة تسمية" },
  "delete":            { en: "Delete",               zh: "删除",               ar: "حذف" },
  "deleteFolder":      { en: "Delete Folder",        zh: "删除文件夹",         ar: "حذف المجلد" },
  "deleteFolderConfirm":
    { en: "Delete this folder? Notes inside will move to \"Unfiled\".",
      zh: "删除此文件夹？里面的笔记将移至\"未分类\"。",
      ar: "هل تريد حذف هذا المجلد؟ ستنتقل الملاحظات بداخله إلى «غير مصنفة»." },

  "newNote":           { en: "New Note",             zh: "新建笔记",           ar: "ملاحظة جديدة" },
  "untitled":          { en: "New Note",             zh: "新建笔记",           ar: "ملاحظة جديدة" },
  "search":            { en: "Search notes",         zh: "搜索笔记",           ar: "بحث في الملاحظات" },
  "nothing":           { en: "No notes yet.",        zh: "还没有笔记。",       ar: "لا توجد ملاحظات بعد." },
  "noMatch":           { en: "No notes match your search.",
                         zh: "没有匹配的笔记。",
                         ar: "لا توجد ملاحظات مطابقة." },
  "selectOne":         { en: "Select a note to view it.",
                         zh: "选择一条笔记查看内容。",
                         ar: "اختر ملاحظة لعرض محتواها." },

  "pin":               { en: "Pin",                  zh: "置顶",               ar: "تثبيت" },
  "unpin":             { en: "Unpin",                zh: "取消置顶",           ar: "إلغاء التثبيت" },
  "pinned":            { en: "Pinned",               zh: "已置顶",             ar: "مثبّتة" },

  "moveTo":            { en: "Move to…",             zh: "移动到...",          ar: "نقل إلى..." },
  "moveToTrash":       { en: "Move to Trash",        zh: "移至废纸篓",         ar: "نقل إلى المهملات" },
  "restore":           { en: "Restore",              zh: "恢复",               ar: "استعادة" },
  "deleteForever":     { en: "Delete Forever",       zh: "永久删除",           ar: "حذف نهائي" },
  "emptyTrash":        { en: "Empty Trash",          zh: "清空废纸篓",         ar: "إفراغ المهملات" },
  "emptyTrashConfirm": { en: "Permanently delete every note in Trash? This cannot be undone.",
                         zh: "永久删除废纸篓中的所有笔记？此操作无法撤销。",
                         ar: "حذف جميع الملاحظات في المهملات نهائيًا؟ لا يمكن التراجع." },

  "saved":             { en: "Saved",                zh: "已保存",             ar: "تم الحفظ" },
  "saving":            { en: "Saving…",              zh: "正在保存…",          ar: "جارٍ الحفظ…" },

  /* Sections */
  "section.today":            { en: "Today",               zh: "今天",          ar: "اليوم" },
  "section.yesterday":        { en: "Yesterday",           zh: "昨天",          ar: "أمس" },
  "section.previous7Days":    { en: "Previous 7 Days",     zh: "过去 7 天",     ar: "آخر 7 أيام" },
  "section.previous30Days":   { en: "Previous 30 Days",    zh: "过去 30 天",    ar: "آخر 30 يومًا" },

  /* Toolbar */
  "fmt.title":         { en: "Title",                zh: "标题",               ar: "عنوان" },
  "fmt.heading":       { en: "Heading",              zh: "标题",               ar: "عنوان" },
  "fmt.subheading":    { en: "Subheading",           zh: "副标题",             ar: "عنوان فرعي" },
  "fmt.body":          { en: "Body",                 zh: "正文",               ar: "نص عادي" },
  "fmt.bold":          { en: "Bold",                 zh: "粗体",               ar: "غامق" },
  "fmt.italic":        { en: "Italic",               zh: "斜体",               ar: "مائل" },
  "fmt.underline":     { en: "Underline",            zh: "下划线",             ar: "تسطير" },
  "fmt.strike":        { en: "Strikethrough",        zh: "删除线",             ar: "يتوسطه خط" },
  "fmt.highlight":     { en: "Highlight",            zh: "高亮",               ar: "تمييز" },
  "fmt.bulletList":    { en: "Bullet List",          zh: "项目符号",           ar: "قائمة نقطية" },
  "fmt.numberedList":  { en: "Numbered List",        zh: "编号列表",           ar: "قائمة مرقمة" },
  "fmt.checklist":     { en: "Checklist",            zh: "待办清单",           ar: "قائمة مهام" },
  "fmt.quote":         { en: "Quote",                zh: "引用",               ar: "اقتباس" },
  "fmt.code":          { en: "Code",                 zh: "代码",               ar: "شفرة" },
  "fmt.codeBlock":     { en: "Code Block",           zh: "代码块",             ar: "كتلة شفرة" },
  "fmt.link":          { en: "Link",                 zh: "链接",               ar: "رابط" },
  "fmt.unlink":        { en: "Unlink",               zh: "取消链接",           ar: "إزالة الرابط" },
  "fmt.undo":          { en: "Undo",                 zh: "撤销",               ar: "تراجع" },
  "fmt.redo":          { en: "Redo",                 zh: "重做",               ar: "إعادة" },

  "linkPrompt":        { en: "Link URL (leave blank to remove):",
                         zh: "链接地址（留空以移除）：",
                         ar: "رابط URL (اتركه فارغًا للإزالة):" },
};
