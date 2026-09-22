import type { Translations } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS — THE LIST'S OWN DICTIONARY
   ───────────────────────────────────────────────────────────────────
   ⚠️ WHY THIS FILE EXISTS, AND WHY IT MUST STAY SMALL.

   `products-ui-i18n.ts` had grown to 1,165 keys × 3 languages — 173 KB
   of source — and the products LIST imported the whole thing to read
   **84 of them**. The other 92% are the editor's: packing, supplier,
   hero, variants, review, media. Every one of those keys was downloaded
   by anyone who merely opened /products or /product-data, and the file
   was edited six times in the week before this split, so the list's
   payload grew every time someone touched a form tab it never renders.

   The split is by NAMESPACE, which is the boundary that already existed
   in the key names: this file owns
       list · filter · card · search · state · status · action · nav
   and the editor owns everything else.

   PRODUCTS_UI_I18N spreads this object, so the editor still resolves
   every key from one import and no key is defined twice. Adding a list
   string here makes it available to both; adding an editor string there
   keeps it out of the list's bundle.

   `npm run validate:products-i18n` fails the build when the list calls a
   key this file does not define — including through a template literal.
   ═══════════════════════════════════════════════════════════════════ */

export const PRODUCTS_LIST_I18N: Translations = {
  /* ── Save / publish / draft actions ─────────────────────────────── */
  "action.save": { en: "Save", zh: "保存", ar: "حفظ" },
  "action.saveProduct": { en: "Save Product", zh: "保存产品", ar: "حفظ المنتج" },
  "action.saving": { en: "Saving…", zh: "保存中…", ar: "جارٍ الحفظ…" },
  "action.cancel": { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "action.retry": { en: "Retry", zh: "重试", ar: "إعادة المحاولة" },
  "action.next": { en: "Next", zh: "下一步", ar: "التالي" },
  "action.back": { en: "Back", zh: "上一步", ar: "السابق" },
  "action.newProduct": { en: "New Product", zh: "新建产品", ar: "منتج جديد" },
  "status.draft": { en: "Draft", zh: "草稿", ar: "مسودة" },
  "status.active": { en: "Active", zh: "已上架", ar: "نشط" },
  "status.archived": { en: "Archived", zh: "已归档", ar: "مؤرشف" },

  /* ── Product list / cards (Products + Product Data list) ────────── */
  "list.products": { en: "Products", zh: "产品", ar: "المنتجات" },
  "list.productData": { en: "Product Data", zh: "产品数据", ar: "بيانات المنتجات" },
  "list.search": { en: "Search products…", zh: "搜索产品…", ar: "ابحث عن المنتجات…" },
  "list.allDivisions": { en: "All divisions", zh: "全部事业部", ar: "كل الأقسام" },
  "list.filters": { en: "Filters", zh: "筛选", ar: "التصفية" },
  "list.featured": { en: "Featured", zh: "精选", ar: "مميّز" },
  /* Freshness badges — 14 days each, see products-freshness.ts. */
  "list.badgeNew": { en: "New", zh: "新品", ar: "جديد" },
  "list.badgeUpdated": { en: "Updated", zh: "已更新", ar: "محدَّث" },
  "list.badgePriceUpdated": { en: "Price updated", zh: "价格更新", ar: "سعر محدَّث" },
  "list.modelOne": { en: "model", zh: "个型号", ar: "موديل" },
  "list.modelMany": { en: "models", zh: "个型号", ar: "موديلات" },
  "list.allCategories": { en: "All categories", zh: "全部类别", ar: "كل الفئات" },
  "list.allProducts": { en: "All products", zh: "全部产品", ar: "كل المنتجات" },
  "list.categories": { en: "Categories", zh: "类别", ar: "الفئات" },
  "list.subcategories": { en: "Subcategories", zh: "子类别", ar: "الفئات الفرعية" },
  "list.allIn": { en: "All {name}", zh: "全部{name}", ar: "كل {name}" },
  "list.resultsCount": { en: "{n} product(s)", zh: "{n} 个产品", ar: "{n} منتج" },

  /* ── List surface: header, search, filters, results (P0 #5a) ────── */
  "list.controlPanel": { en: "Control Panel", zh: "控制面板", ar: "لوحة التحكم" },
  "list.countInCatalog": { en: "products in catalog", zh: "个产品（共计）", ar: "منتج في الكتالوج" },
  "list.backToTop": { en: "Back to top", zh: "回到顶部", ar: "العودة إلى الأعلى" },
  /* Kept short enough to READ. Measured at 375px: the full sentence needed
     329px of a 263px text area, so the phone showed "Search by name, model
     code, bra…" — the list of what you can search by, cut off mid-list, which
     is the one thing a placeholder exists to say. The long form now lives in
     the aria-label and the title, where nothing truncates it. */
  "list.searchPlaceholder": {
    en: "Search name, code, brand, tags…",
    zh: "搜索名称、编码、品牌、标签…",
    ar: "ابحث بالاسم أو الرمز أو العلامة أو الوسوم…",
  },
  "list.searchAria": {
    en: "Search products by name, model code, brand, category or tags",
    zh: "按名称、型号编码、品牌、类别或标签搜索产品",
    ar: "ابحث عن المنتجات بالاسم أو رمز الموديل أو العلامة التجارية أو الفئة أو الوسوم",
  },
  "list.clearSearch": { en: "Clear search", zh: "清除搜索", ar: "مسح البحث" },
  "list.allOption": { en: "All", zh: "全部", ar: "الكل" },
  "list.divisions": { en: "Divisions", zh: "部门", ar: "الأقسام" },
  "list.activeFilters": { en: "Active:", zh: "已筛选：", ar: "مفعّلة:" },
  "list.removeFilter": { en: "Remove filter {label}", zh: "移除筛选 {label}", ar: "إزالة عامل التصفية {label}" },
  "list.noMatchesFor": { en: "No matches for", zh: "未找到匹配项：", ar: "لا توجد نتائج مطابقة لـ" },
  "list.showing": { en: "Showing", zh: "显示", ar: "عرض" },
  "list.ofProducts": { en: "of {total} products", zh: "／共 {total} 个产品", ar: "من أصل {total} منتج" },
  "list.matching": { en: "matching", zh: "匹配", ar: "مطابقة لـ" },
  "list.noProductsYetHint": {
    en: "Add your first product to get started.",
    zh: "添加您的第一个产品以开始。",
    ar: "أضف منتجك الأول للبدء.",
  },
  "list.noResultsHint": {
    en: "Try adjusting your search or filters.",
    zh: "请尝试调整搜索或筛选条件。",
    ar: "حاول تعديل البحث أو عوامل التصفية.",
  },

  /* ── Filter labels + options (P0 #5a) ───────────────────────────── */
  "filter.division": { en: "Division", zh: "事业部", ar: "القسم" },
  "filter.category": { en: "Category", zh: "类别", ar: "الفئة" },
  "filter.subcategory": { en: "Subcategory", zh: "子类别", ar: "الفئة الفرعية" },
  "filter.supplier": { en: "Supplier", zh: "供应商", ar: "المورّد" },
  "filter.brand": { en: "Brand", zh: "品牌", ar: "العلامة التجارية" },
  "filter.level": { en: "Level", zh: "等级", ar: "المستوى" },
  "filter.visibility": { en: "Visibility", zh: "可见性", ar: "إمكانية الظهور" },
  "filter.status": { en: "Status", zh: "状态", ar: "الحالة" },
  "filter.featured": { en: "Featured", zh: "精选", ar: "مميّز" },
  "filter.visible": { en: "Visible", zh: "可见", ar: "ظاهر" },
  "filter.hidden": { en: "Hidden", zh: "隐藏", ar: "مخفي" },
  "filter.isFeatured": { en: "Featured", zh: "精选", ar: "مميّز" },
  "filter.notFeatured": { en: "Not Featured", zh: "非精选", ar: "غير مميّز" },

  /* ── List/grid column headers + actions (P0 #5a) ────────────────── */
  "list.colProduct": { en: "Product", zh: "产品", ar: "المنتج" },
  "list.colCategory": { en: "Category", zh: "类别", ar: "الفئة" },
  "list.colBrand": { en: "Brand", zh: "品牌", ar: "العلامة التجارية" },
  "list.colModels": { en: "Models", zh: "型号", ar: "الموديلات" },
  "list.colStatus": { en: "Status", zh: "状态", ar: "الحالة" },
  "action.addProduct": { en: "Add Product", zh: "添加产品", ar: "إضافة منتج" },
  "card.editProduct": { en: "Edit product", zh: "编辑产品", ar: "تعديل المنتج" },
  "card.deleteProduct": { en: "Delete product", zh: "删除产品", ar: "حذف المنتج" },

  /* ── Search suggestions dropdown (P0 #5a) ───────────────────────── */
  "search.groupCategories": { en: "Categories", zh: "类别", ar: "الفئات" },
  "search.groupSubcategories": { en: "Subcategories", zh: "子类别", ar: "الفئات الفرعية" },
  "search.groupBrands": { en: "Brands", zh: "品牌", ar: "العلامات التجارية" },
  "search.groupSuppliers": { en: "Suppliers", zh: "供应商", ar: "المورّدون" },
  "search.groupProducts": { en: "Products", zh: "产品", ar: "المنتجات" },
  "search.inCategory": { en: "in", zh: "属于", ar: "في" },
  "search.open": { en: "Open →", zh: "打开 →", ar: "فتح ←" },

  /* ── Generic empty / error / loading states ─────────────────────── */
  "state.loading": { en: "Loading…", zh: "加载中…", ar: "جارٍ التحميل…" },
  "state.empty": { en: "Nothing here yet", zh: "暂无内容", ar: "لا يوجد شيء هنا بعد" },
  "state.noProducts": { en: "No products yet", zh: "暂无产品", ar: "لا توجد منتجات بعد" },
  "state.noResults": { en: "No products match your filters", zh: "没有符合筛选条件的产品", ar: "لا توجد منتجات مطابقة لعوامل التصفية" },
  "state.loadFailedTitle": { en: "Couldn't load products", zh: "无法加载产品", ar: "تعذّر تحميل المنتجات" },
  /* Shown INSTEAD of the failure panel when the warm-start cache already put
     the catalogue on screen — the products are there, only the refresh
     failed, so the message is about freshness rather than availability. */
  "state.showingCached": {
    en: "Showing your last loaded catalog — couldn't reach the server just now.",
    zh: "显示上次加载的产品目录 — 暂时无法连接服务器。",
    ar: "بنعرضلك آخر نسخة اتحمّلت — الاتصال بالسيرفر مانفعش دلوقتي.",
  },
  "state.serverTimeout": { en: "The server took too long to respond. Please retry.", zh: "服务器响应超时，请重试。", ar: "استغرق الخادم وقتًا طويلًا للرد. يرجى إعادة المحاولة." },
  /* Smart save labels */
  "action.savePublish": { en: "Save & Publish", zh: "保存并发布", ar: "حفظ ونشر" },
  "action.saveChanges": { en: "Save Changes", zh: "保存更改", ar: "حفظ التغييرات" },
  "action.saveAsDraft": { en: "Save as Draft", zh: "保存为草稿", ar: "حفظ كمسودة" },

  /* ── Internal card strings that were falling back to English ── */
  "card.hidden": { en: "Hidden from customers", zh: "对客户隐藏", ar: "مخفي عن العملاء" },
  "card.hiddenShort": { en: "Hidden", zh: "已隐藏", ar: "مخفي" },
  "card.noCostYet": { en: "Cost not set", zh: "未设置成本", ar: "التكلفة غير محددة" },
  "card.noSupplier": { en: "No supplier linked", zh: "未关联供应商", ar: "لا يوجد مورّد مرتبط" },
  "card.priceFrom": { en: "From", zh: "起", ar: "ابتداءً من" },

  /* ── Catalogue card · commercial half (2026-08-29) ── */
  "card.globalFob": { en: "Global FOB", zh: "全球 FOB 价", ar: "سعر FOB العالمي" },
  "card.priceOnRequest": { en: "Price on request", zh: "价格面议", ar: "السعر عند الطلب" },
  "card.askAi": { en: "Ask AI", zh: "问 AI", ar: "اسأل AI" },
  "card.compare": { en: "Compare", zh: "对比", ar: "مقارنة" },
  "card.addToQuotation": { en: "Quote", zh: "加入报价", ar: "عرض سعر" },
  "action.edit":     { en: "Edit", zh: "编辑", ar: "تعديل" },
  "list.uncategorized": { en: "Uncategorized", zh: "未分类", ar: "غير مصنّف" },
  "list.other": { en: "Other", zh: "其他", ar: "أخرى" },
  "list.productOne": { en: "product", zh: "件产品", ar: "منتج" },
  "list.productMany": { en: "products", zh: "件产品", ar: "منتجات" },
  /* Used by the category heading once the catalogue outgrows one page:
     "12 of 214 products", and the placeholder for a category the current
     page has not reached yet. */
  "list.ofWord": { en: "of", zh: "共", ar: "من" },
  "list.scrollToLoad": { en: "scroll to load", zh: "滚动加载", ar: "مرِّر للتحميل" },
  "list.needsName": { en: "Needs name", zh: "缺名称", ar: "يحتاج اسماً" },
  /* Accessible names for the icon-only grid/list toggle. */
  "list.viewGrid": { en: "Grid view", zh: "网格视图", ar: "عرض شبكي" },
  "list.viewList": { en: "List view", zh: "列表视图", ar: "عرض قائمة" },

  /* ── Keys the list CALLED but nobody had defined ───────────────────────────
     Found 17/09/2026 while splitting this file. Each of these was reached
     through `t(key, "English fallback")`, so nothing ever looked broken —
     the screen simply showed ENGLISH to every Chinese and Arabic operator,
     with no error, no log and no missing-key warning. That is the standing
     trap with this i18n layer: a key that does not exist is indistinguishable
     from a key that does, as long as someone passed a fallback.
     `validate:products-i18n` now fails the build on a key that is called and
     never defined, so this cannot recur silently. */
  "action.signInAgain":        { en: "Sign in again",   zh: "重新登录",   ar: "سجّل الدخول مرة أخرى" },
  "state.sessionExpiredTitle": { en: "Session expired", zh: "会话已过期", ar: "انتهت الجلسة" },
  "state.sessionExpiredHint":  { en: "Please sign in again to load the catalog.",
                                 zh: "请重新登录以加载产品目录。",
                                 ar: "سجّل الدخول مرة أخرى لتحميل الكتالوج." },
  "list.colCost":    { en: "Cost",        zh: "成本",   ar: "التكلفة" },
  "list.colReady":   { en: "Ready",       zh: "就绪",   ar: "جاهز" },
  "list.fxOffline":  { en: "(offline)",   zh: "（离线）", ar: "(غير متصل)" },
  "list.noTemplate": { en: "No template", zh: "无模板", ar: "لا يوجد قالب" },

  /* The gap chips on a product card. Rendered as t(`card.missing.${k}`), so
     the whole family has to exist or the chip silently falls back. */
  "card.missing.photo":       { en: "No photo",         zh: "无图片",     ar: "لا توجد صورة" },
  "card.missing.specs":       { en: "No specs",         zh: "无规格",     ar: "لا مواصفات" },
  "card.missing.cost":        { en: "No cost",          zh: "无成本",     ar: "لا توجد تكلفة" },
  "card.missing.code":        { en: "No code",          zh: "无编码",     ar: "لا يوجد كود" },
  "card.missing.description": { en: "No description",   zh: "无描述",     ar: "لا يوجد وصف" },
  "card.missing.template":    { en: "No spec template", zh: "无规格模板", ar: "لا يوجد قالب مواصفات" },
  /* The DOM ceiling (MOUNTED_MAX in ProductList). Phrased as a fact about
     this view, never as an error — the catalogue is complete, the GRID is
     full, and the filters are the way through. */
  "list.mountCapTitle": { en: "Showing {n} of {total} products",
                          zh: "已显示 {total} 个产品中的 {n} 个",
                          ar: "معروض {n} من {total} منتج" },
  "list.mountCapHint":  { en: "The grid holds this many at once. Search, or pick a division or category, to reach the rest — filtering runs on the server, so you get a complete result, not a shorter one.",
                          zh: "网格一次最多显示这么多。请使用搜索，或选择事业部或类别，以查看其余产品——筛选在服务器端执行，因此结果是完整的，而不是被截断的。",
                          ar: "تعرض الشبكة هذا العدد في المرة الواحدة. ابحث أو اختر قسمًا أو فئة للوصول إلى الباقي — التصفية تتم على الخادم، فتحصل على نتيجة كاملة لا مقتطعة." },
};
