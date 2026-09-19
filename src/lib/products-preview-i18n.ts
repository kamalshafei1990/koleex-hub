import type { Translations } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   PRODUCT PREVIEW — THE CUSTOMER-FACING PAGE'S OWN DICTIONARY
   ───────────────────────────────────────────────────────────────────
   ⚠️ SAME LEAK AS THE LIST HAD, ON THE PAGE CUSTOMERS ACTUALLY OPEN.

   ProductPreview imported PRODUCTS_UI_I18N — 1,070 keys of packing,
   supplier, variant and review strings written for the EDITOR — to read
   fifty-two, all of them `preview.*`. /products/[id] is the heaviest
   screen in the Hub at 1,410 KB, and this was part of why.

   Split by namespace, exactly as products-list-i18n.ts was:
   this file owns `preview` and `view`, PRODUCTS_UI_I18N spreads it so the
   editor still resolves every key from one import and nothing is defined
   twice. `npm run validate:products-i18n` fails the build if this page
   reaches for the big dictionary again.
   ═══════════════════════════════════════════════════════════════════ */

export const PRODUCTS_PREVIEW_I18N: Translations = {
  /* ── Models step (P0 #5b) ── */
    "list.codesLess": { en: "Less", zh: "收起", ar: "أقل" },
  "preview.primary": { en: "Primary", zh: "主型号", ar: "أساسي" },

  /* ── TemplateView: read-mode renderer chrome (P0 #5d) ───────────────
     Only UI furniture is translated here. Section titles, field labels,
     highlight titles/blurbs, descriptions and spec values come from the
     template/schema or product data and are intentionally left as-is. */
  "view.loadingProduct": { en: "Loading product…", zh: "正在加载产品…", ar: "جارٍ تحميل المنتج…" },
  "view.gallery": { en: "Gallery", zh: "图库", ar: "معرض الصور" },
  "view.detailViews": { en: "Detail views", zh: "细节视图", ar: "اللقطات التفصيلية" },

  /* ── ProductPreview: schema-driven product page chrome (P0 #5d) ─────
     Hardcoded section eyebrows/titles, generic labels, empty/placeholder
     states, and buttons only. Per-product section/group/field titles,
     option labels, knowledge headlines, taglines and spec values are
     schema/content-driven and stay untranslated (deferred multilingual
     content layer). */
  "preview.emptyState": {
    en: "No schema for this classification. The public preview will appear once a schema is registered for this subcategory.",
    zh: "此分类暂无模式。为该子类别注册模式后，公开预览将会出现。",
    ar: "لا يوجد مخطط لهذا التصنيف. ستظهر المعاينة العامة بمجرد تسجيل مخطط لهذه الفئة الفرعية.",
  },
  "preview.untitledProduct": { en: "Untitled product", zh: "未命名产品", ar: "منتج بلا عنوان" },
  "preview.warranty": { en: "Warranty", zh: "保修", ar: "الضمان" },
  "preview.origin": { en: "Origin", zh: "原产地", ar: "المنشأ" },
  "preview.noMainImage": { en: "No main image", zh: "暂无主图", ar: "لا توجد صورة رئيسية" },
  "preview.learnMore": { en: "Learn more", zh: "了解更多", ar: "اعرف المزيد" },
  "preview.yes": { en: "Yes", zh: "是", ar: "نعم" },
  "preview.no": { en: "No", zh: "否", ar: "لا" },
  "preview.eyebrowCapability": { en: "Capability", zh: "能力", ar: "القدرات" },
  "preview.suitableMaterials": { en: "Suitable Materials", zh: "适用材料", ar: "المواد المناسبة" },
  "preview.eyebrowBuiltFor": { en: "Built for", zh: "适用于", ar: "مصمَّم لـ" },
  "preview.applications": { en: "Applications", zh: "应用", ar: "التطبيقات" },
  "preview.eyebrowHandsOff": { en: "Hands-off", zh: "免手动", ar: "تشغيل آلي" },
  "preview.automationWorkflow": { en: "Automation workflow", zh: "自动化流程", ar: "سير العمل الآلي" },
  "preview.eyebrowWhyItWins": { en: "Why it wins", zh: "优势所在", ar: "لماذا يتفوّق" },
  "preview.advantages": { en: "Advantages", zh: "优势", ar: "المزايا" },
  "preview.eyebrowWhatItMeans": { en: "What it means for you", zh: "对您的意义", ar: "ماذا يعني لك" },
  "preview.productIntelligence": { en: "Product Intelligence", zh: "产品智能", ar: "ذكاء المنتج" },
  "preview.eyebrowLayer3": { en: "Layer 3", zh: "第三层", ar: "الطبقة 3" },
  "preview.technicalSpecifications": { en: "Technical Specifications", zh: "技术规格", ar: "المواصفات التقنية" },
  "preview.eyebrowCore": { en: "Core", zh: "核心", ar: "أساسي" },
  "preview.features": { en: "Features", zh: "功能特性", ar: "الميزات" },
  "preview.eyebrowGoodToKnow": { en: "Good to know", zh: "须知", ar: "معلومات مفيدة" },
  "preview.buyerQuestions": { en: "Buyer Questions", zh: "买家问题", ar: "أسئلة المشترين" },
  "preview.whatsIncluded": { en: "What's Included", zh: "包装清单", ar: "محتويات العبوة" },
  "preview.media": { en: "Media", zh: "媒体", ar: "الوسائط" },
  "preview.viewIn3dAr": { en: "View in 3D / AR", zh: "查看 3D / AR", ar: "العرض ثلاثي الأبعاد / الواقع المعزز" },
  "preview.documents": { en: "Documents", zh: "文档", ar: "المستندات" },
  "preview.download": { en: "Download", zh: "下载", ar: "تنزيل" },
  "preview.compliance": { en: "Compliance", zh: "合规", ar: "الامتثال" },
  "preview.countPhotos": { en: "{n} photos", zh: "{n} 张照片", ar: "{n} صورة" },
  "preview.countVideos": { en: "{n} videos", zh: "{n} 个视频", ar: "{n} فيديو" },
  "preview.countDocuments": { en: "{n} documents", zh: "{n} 个文档", ar: "{n} مستند" },

  /* ── 2026-08-29 sweep: the customer product page's own chrome. These 16
     keys were called with an English default but never defined, so the
     sticky pill, the section eyebrows and the model/compare copy stayed
     English in zh/ar while the product's name and tagline switched. ── */
  "preview.stickyOverview": { en: "Overview", zh: "概览", ar: "نظرة عامة" },
  "preview.stickySpecs": { en: "Specs", zh: "参数", ar: "المواصفات" },
  "preview.stickyGallery": { en: "Gallery", zh: "图库", ar: "الصور" },
  "preview.getHighlights": { en: "Get the highlights.", zh: "核心亮点。", ar: "أبرز المميزات." },
  "preview.eyebrowPerformance": { en: "Performance", zh: "性能", ar: "الأداء" },
  "preview.eyebrowUpClose": { en: "Up close", zh: "细节", ar: "عن قرب" },
  "preview.eyebrowLineup": { en: "Lineup", zh: "系列型号", ar: "الطُرز" },
  "preview.eyebrowCompare": { en: "Compare", zh: "对比", ar: "مقارنة" },
  "preview.takeCloserLook": { en: "Take a closer look.", zh: "细看每个细节。", ar: "شاهدها عن قرب." },
  "preview.chooseModel": { en: "Choose your model.", zh: "选择您的型号。", ar: "اختر الطراز المناسب." },
  "preview.compareTitle": { en: "How it stacks up.", zh: "同类对比。", ar: "كيف تتفوّق." },
  "preview.compareWith": { en: "Compare with", zh: "对比", ar: "مقارنة مع" },
  "preview.model": { en: "Model", zh: "型号", ar: "الطراز" },
  "preview.viewProduct": { en: "View", zh: "查看", ar: "عرض" },
  "preview.photo": { en: "Photo", zh: "图片", ar: "صورة" },
  "preview.noImage": { en: "No image", zh: "暂无图片", ar: "لا توجد صورة" },

  /* ── 2026-07-30 full-translation sweep: keys that were falling back ── */
  "preview.eyebrowSafety": { en: "Before you run it", zh: "运行之前", ar: "قبل التشغيل" },
  "preview.warnings": { en: "Warnings & Safety", zh: "警告与安全", ar: "التحذيرات والسلامة" },
  /* ── Product page rebuild, phase 1 (19/09/2026): the hero ── */
  "preview.heroGlobalFob": { en: "Global FOB", zh: "全球离岸价", ar: "سعر FOB العالمي" },
  "preview.heroPriceOnRequest": { en: "Price on request", zh: "价格面议", ar: "السعر عند الطلب" },
  "preview.heroFxNote": { en: "at today's rate", zh: "按今日汇率", ar: "بسعر صرف اليوم" },
  "preview.heroAskAi": { en: "Ask AI", zh: "问 AI", ar: "اسأل الذكاء الاصطناعي" },
  "preview.heroCompare": { en: "Compare", zh: "对比", ar: "قارن" },
  "preview.heroQuote": { en: "Quote", zh: "报价", ar: "عرض سعر" },
  "preview.heroFamilyEyebrow": { en: "Family", zh: "系列", ar: "العائلة" },
  "preview.heroFamilyTitle": { en: "Every model in this family", zh: "本系列全部型号", ar: "كل موديلات هذه العائلة" },
  "preview.heroFamilyModel": { en: "Model", zh: "型号", ar: "الموديل" },
  "preview.heroFamilyPhoto": { en: "Photo", zh: "图片", ar: "الصورة" },
  "preview.heroFamilySelected": { en: "Showing", zh: "当前显示", ar: "المعروض" },
  "preview.heroAiDraft": { en: "Tell me about", zh: "请介绍", ar: "عرّفني على" },
};
