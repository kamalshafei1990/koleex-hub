import type { Translations } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS + PRODUCT DATA — OPERATOR UI DICTIONARY  (P0 #5 · i18n)
   ───────────────────────────────────────────────────────────────────
   Operator-facing strings for the Products app and the Product Data
   wizard, in the three operator languages: English (source) ·
   Chinese (simple professional UI Chinese) · Arabic (formal, no
   slang). Architect scope (ChatGPT): operator UI ONLY — NOT product
   content, NOT product names, NOT marketing/SEO copy. Those stay in
   the data layer and are deferred to a later multilingual-naming phase.

   Consumed via `useTranslation(PRODUCTS_UI_I18N)` from "@/lib/i18n".
   Keys are namespaced (`step.*`, `validation.*`, `media.*`, `list.*`,
   `action.*`, `state.*`, `model.*`) so each surface pulls only what it
   needs and we never collide. Add surface-specific keys here as each
   component is wired, keeping ONE source of truth for the operator
   vocabulary across all five surfaces.
   ═══════════════════════════════════════════════════════════════════ */

export const PRODUCTS_UI_I18N: Translations = {
  /* ── Wizard step labels ─────────────────────────────────────────── */
  "step.classify": { en: "Classify", zh: "分类", ar: "التصنيف" },
  "step.classification": { en: "Classification", zh: "分类", ar: "التصنيف" },
  "step.hero": { en: "Hero", zh: "主图", ar: "الواجهة" },
  "step.identity": { en: "Hero & Identity", zh: "主图与标识", ar: "الواجهة والهوية" },
  "step.description": { en: "Description", zh: "描述", ar: "الوصف" },
  "step.specs": { en: "Specs", zh: "规格", ar: "المواصفات" },
  "step.machineSpecs": { en: "Machine Specs", zh: "机器规格", ar: "مواصفات الماكينة" },
  "step.models": { en: "Models", zh: "型号", ar: "الموديلات" },
  "step.modelsVariants": { en: "Models & Variants", zh: "型号与变体", ar: "الموديلات والمتغيرات" },
  "step.technical": { en: "Technical", zh: "技术参数", ar: "التفاصيل التقنية" },
  "step.media": { en: "Media & Files", zh: "媒体与文件", ar: "الوسائط والملفات" },
  "step.review": { en: "Review", zh: "审核", ar: "المراجعة" },
  "step.reviewPublish": { en: "Review & Publish", zh: "审核与发布", ar: "المراجعة والنشر" },

  /* ── Required-field validation (P0 #3) ──────────────────────────── */
  "validation.required": { en: "Required", zh: "必填", ar: "مطلوب" },
  "field.productName": { en: "Product name", zh: "产品名称", ar: "اسم المنتج" },
  "field.division": { en: "Division", zh: "事业部", ar: "القسم" },
  "field.category": { en: "Category", zh: "类别", ar: "الفئة" },
  "field.subcategory": { en: "Subcategory", zh: "子类别", ar: "الفئة الفرعية" },
  "field.machineKind": { en: "Machine kind", zh: "机器种类", ar: "نوع الماكينة" },
  "field.primaryModel": { en: "Primary model", zh: "主型号", ar: "الموديل الأساسي" },
  "validation.fieldRequiredToContinue": {
    en: "{field} is required before continuing",
    zh: "继续之前必须填写{field}",
    ar: "{field} مطلوب قبل المتابعة",
  },
  "validation.completeRequiredToContinue": {
    en: "Complete required fields before continuing",
    zh: "请在继续之前填写必填字段",
    ar: "أكمل الحقول المطلوبة قبل المتابعة",
  },
  "validation.missingCount": {
    en: "{n} required field(s) missing",
    zh: "缺少 {n} 个必填字段",
    ar: "ينقص {n} من الحقول المطلوبة",
  },

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
  "save.success": { en: "Product saved successfully!", zh: "产品保存成功！", ar: "تم حفظ المنتج بنجاح!" },
  "save.cantPublish": {
    en: "Can't publish yet — fill the required fields. Switch status to Draft to save your work for now.",
    zh: "暂时无法发布 — 请填写必填字段。可先将状态切换为草稿以保存当前进度。",
    ar: "لا يمكن النشر بعد — يرجى إكمال الحقول المطلوبة. يمكنك تغيير الحالة إلى مسودة لحفظ عملك الآن.",
  },

  /* ── Draft autosave / recovery (P0 #3) ──────────────────────────── */
  "draft.recovered": { en: "Unsaved draft recovered", zh: "已恢复未保存的草稿", ar: "تم استرجاع مسودة غير محفوظة" },
  "draft.recoveredBody": {
    en: "We kept work you didn't save. Restore it, or discard to keep what's loaded now.",
    zh: "我们保留了您尚未保存的内容。可恢复该草稿，或放弃以保留当前加载的数据。",
    ar: "احتفظنا بعمل لم تقم بحفظه. يمكنك استرجاعه، أو تجاهله للإبقاء على ما هو محمَّل الآن.",
  },
  "draft.restore": { en: "Restore draft", zh: "恢复草稿", ar: "استرجاع المسودة" },
  "draft.discard": { en: "Discard", zh: "放弃", ar: "تجاهل" },
  "draft.restored": {
    en: "Draft restored — review the fields, then Save when you're ready.",
    zh: "草稿已恢复 — 请检查各字段，准备好后点击保存。",
    ar: "تم استرجاع المسودة — راجع الحقول ثم احفظ عندما تكون جاهزًا.",
  },

  /* ── Media upload feedback (P0 #3) ──────────────────────────────── */
  "media.mainPhoto": { en: "Main Product Photo", zh: "产品主图", ar: "الصورة الرئيسية للمنتج" },
  "media.upload": { en: "Upload Product Photo", zh: "上传产品图片", ar: "رفع صورة المنتج" },
  "media.dropHint": { en: "Click to browse or drag & drop", zh: "点击浏览或拖放上传", ar: "انقر للاختيار أو اسحب وأفلت" },
  "media.maxSize": { en: "max {n} MB", zh: "最大 {n} MB", ar: "بحد أقصى {n} ميجابايت" },
  "media.tooBig": {
    en: "\"{name}\" is {size} MB — the limit is {max} MB. Please choose a smaller file.",
    zh: "“{name}” 为 {size} MB — 上限为 {max} MB。请选择更小的文件。",
    ar: "‏«{name}» حجمه {size} ميجابايت — الحد الأقصى {max} ميجابايت. يرجى اختيار ملف أصغر.",
  },
  "media.wrongType": {
    en: "\"{name}\" isn't a supported file type here.",
    zh: "“{name}” 不是此处支持的文件类型。",
    ar: "‏«{name}» ليس نوع ملف مدعوم هنا.",
  },
  "media.uploadFailed": {
    en: "Couldn't upload \"{name}\" — please try again, or use a smaller file.",
    zh: "无法上传“{name}” — 请重试，或使用更小的文件。",
    ar: "تعذّر رفع «{name}» — يرجى إعادة المحاولة أو استخدام ملف أصغر.",
  },

  /* ── Primary-model uniqueness states (P0 #4) ────────────────────── */
  "model.checking": { en: "Checking if this code is available…", zh: "正在检查该编码是否可用…", ar: "جارٍ التحقق من توفّر هذا الرمز…" },
  "model.available": { en: "Available — no other product uses this code.", zh: "可用 — 没有其他产品使用该编码。", ar: "متاح — لا يوجد منتج آخر يستخدم هذا الرمز." },
  "model.codeInUse": { en: "Code already in use.", zh: "该编码已被占用。", ar: "هذا الرمز مستخدم بالفعل." },
  "model.unableToVerify": {
    en: "Couldn't verify this code right now — we'll re-check it when you save.",
    zh: "目前无法验证该编码 — 保存时将重新检查。",
    ar: "تعذّر التحقق من هذا الرمز الآن — سنعيد التحقق عند الحفظ.",
  },

  /* ── Product list / cards (Products + Product Data list) ────────── */
  "list.products": { en: "Products", zh: "产品", ar: "المنتجات" },
  "list.productData": { en: "Product Data", zh: "产品数据", ar: "بيانات المنتجات" },
  "list.search": { en: "Search products…", zh: "搜索产品…", ar: "ابحث عن المنتجات…" },
  "list.allDivisions": { en: "All divisions", zh: "全部事业部", ar: "كل الأقسام" },
  "list.allCategories": { en: "All categories", zh: "全部类别", ar: "كل الفئات" },
  "list.resultsCount": { en: "{n} product(s)", zh: "{n} 个产品", ar: "{n} منتج" },

  /* ── List surface: header, search, filters, results (P0 #5a) ────── */
  "list.controlPanel": { en: "Control Panel", zh: "控制面板", ar: "لوحة التحكم" },
  "list.countInCatalog": { en: "products in catalog", zh: "个产品（共计）", ar: "منتج في الكتالوج" },
  "list.searchPlaceholder": {
    en: "Search by name, model code, brand, category, tags…",
    zh: "按名称、型号编码、品牌、类别、标签搜索…",
    ar: "ابحث بالاسم أو رمز الموديل أو العلامة التجارية أو الفئة أو الوسوم…",
  },
  "list.searchAria": { en: "Search products", zh: "搜索产品", ar: "ابحث عن المنتجات" },
  "list.clearSearch": { en: "Clear search", zh: "清除搜索", ar: "مسح البحث" },
  "list.allOption": { en: "All", zh: "全部", ar: "الكل" },
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
  "search.groupProducts": { en: "Products", zh: "产品", ar: "المنتجات" },
  "search.inCategory": { en: "in", zh: "属于", ar: "في" },
  "search.open": { en: "Open →", zh: "打开 →", ar: "فتح ←" },

  /* ── Generic empty / error / loading states ─────────────────────── */
  "state.loading": { en: "Loading…", zh: "加载中…", ar: "جارٍ التحميل…" },
  "state.empty": { en: "Nothing here yet", zh: "暂无内容", ar: "لا يوجد شيء هنا بعد" },
  "state.noProducts": { en: "No products yet", zh: "暂无产品", ar: "لا توجد منتجات بعد" },
  "state.noResults": { en: "No products match your filters", zh: "没有符合筛选条件的产品", ar: "لا توجد منتجات مطابقة لعوامل التصفية" },
  "state.loadFailedTitle": { en: "Couldn't load products", zh: "无法加载产品", ar: "تعذّر تحميل المنتجات" },
  "state.serverTimeout": { en: "The server took too long to respond. Please retry.", zh: "服务器响应超时，请重试。", ar: "استغرق الخادم وقتًا طويلًا للرد. يرجى إعادة المحاولة." },
};
