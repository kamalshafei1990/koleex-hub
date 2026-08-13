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
