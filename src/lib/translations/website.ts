import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Website — the page-builder / live-preview shell for the public site.

   Had ZERO t() calls, so the whole screen rendered in English under Arabic and
   Chinese.

   Note on scope: the strings here are the BUILDER's own chrome (viewport
   toggles, preview actions, the section list). The public site's page names
   — Home, Products, Divisions, Solutions, Stories, Careers, About, Contact —
   are also listed, because in this screen they are the builder's navigation
   labels, not content pulled from the CMS.
   --------------------------------------------------------------------------- */

export const websiteT: Translations = {
  "title":         { en: "Website",        zh: "网站",       ar: "الموقع" },
  "pageBuilder":   { en: "Page Builder",   zh: "页面构建器", ar: "منشئ الصفحات" },
  "livePreview":   { en: "Live Preview",   zh: "实时预览",   ar: "معاينة حيّة" },
  "preview":       { en: "Preview",        zh: "预览",       ar: "معاينة" },
  "refresh":       { en: "Refresh",        zh: "刷新",       ar: "تحديث" },
  "visitWebsite":  { en: "Visit Website",  zh: "访问网站",   ar: "زيارة الموقع" },
  "openInNewTab":  { en: "Open in New Tab", zh: "在新标签页打开", ar: "فتح في تبويب جديد" },
  "loadingPreview": { en: "Loading preview…", zh: "正在加载预览…", ar: "جارٍ تحميل المعاينة…" },

  /* Page Builder tab — the site's pages, until the builder moves into the Hub */
  "builder.pages":      { en: "Pages",                zh: "页面",       ar: "الصفحات" },
  "builder.sections":   { en: "sections",             zh: "个版块",     ar: "أقسام" },
  "builder.builtIn":    { en: "Built-in content",     zh: "内置内容",   ar: "محتوى مدمج" },
  "builder.updated":    { en: "Updated",              zh: "更新于",     ar: "آخر تحديث" },
  "builder.loadFailed": { en: "The pages could not be loaded.", zh: "无法加载页面。", ar: "تعذّر تحميل الصفحات." },
  "builder.retry":      { en: "Try again",            zh: "重试",       ar: "حاول مرة أخرى" },
  "builder.empty":      { en: "No pages yet.",        zh: "暂无页面。", ar: "لا توجد صفحات بعد." },

  /* Viewport toggles */
  "desktop":       { en: "Desktop",        zh: "桌面",       ar: "سطح المكتب" },
  "tablet":        { en: "Tablet",         zh: "平板",       ar: "لوحي" },
  "mobile":        { en: "Mobile",         zh: "手机",       ar: "الجوال" },
  "fullWidth":     { en: "Full Width",     zh: "全宽",       ar: "عرض كامل" },

  /* Public-site page names, used here as builder navigation labels */
  "page.home":          { en: "Home",          zh: "首页",     ar: "الرئيسية" },
  "page.products":      { en: "Products",      zh: "产品",     ar: "المنتجات" },
  "page.categories":    { en: "Categories",    zh: "类别",     ar: "الفئات" },
  "page.subcategories": { en: "Subcategories", zh: "子类别",   ar: "الفئات الفرعية" },
  "page.divisions":     { en: "Divisions",     zh: "事业部",   ar: "القطاعات" },
  "page.solutions":     { en: "Solutions",     zh: "解决方案", ar: "الحلول" },
  "page.stories":       { en: "Stories",       zh: "案例",     ar: "القصص" },
  "page.careers":       { en: "Careers",       zh: "招聘",     ar: "الوظائف" },
  "page.about":         { en: "About",         zh: "关于",     ar: "عن الشركة" },
  "page.contact":       { en: "Contact",       zh: "联系",     ar: "تواصل" },
  "hub":                { en: "Hub",           zh: "Hub",      ar: "الهَب" },
};
