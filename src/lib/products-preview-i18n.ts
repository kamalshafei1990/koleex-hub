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
  "preview.yes": { en: "Yes", zh: "是", ar: "نعم" },
  "preview.no": { en: "No", zh: "否", ar: "لا" },
  "preview.suitableMaterials": { en: "Suitable Materials", zh: "适用材料", ar: "المواد المناسبة" },
  "preview.applications": { en: "Applications", zh: "应用", ar: "التطبيقات" },
  "preview.automationWorkflow": { en: "Automation workflow", zh: "自动化流程", ar: "سير العمل الآلي" },
  "preview.technicalSpecifications": { en: "Technical Specifications", zh: "技术规格", ar: "المواصفات التقنية" },
  "preview.features": { en: "Features", zh: "功能特性", ar: "الميزات" },
  "preview.media": { en: "Media", zh: "媒体", ar: "الوسائط" },
  "preview.viewIn3dAr": { en: "View in 3D / AR", zh: "查看 3D / AR", ar: "العرض ثلاثي الأبعاد / الواقع المعزز" },
  "preview.download": { en: "Download", zh: "下载", ar: "تنزيل" },
  "preview.compliance": { en: "Compliance", zh: "合规", ar: "الامتثال" },
  "preview.countPhotos": { en: "{n} photos", zh: "{n} 张照片", ar: "{n} صورة" },
  "preview.countVideos": { en: "{n} videos", zh: "{n} 个视频", ar: "{n} فيديو" },
  "preview.countDocuments": { en: "{n} documents", zh: "{n} 个文档", ar: "{n} مستند" },

  /* ── 2026-08-29 sweep: the customer product page's own chrome. These 16
     keys were called with an English default but never defined, so the
     sticky pill, the section eyebrows and the model/compare copy stayed
     English in zh/ar while the product's name and tagline switched. ── */
  "preview.eyebrowCompare": { en: "Compare", zh: "对比", ar: "مقارنة" },
  "preview.compareTitle": { en: "How it stacks up", zh: "对比一览", ar: "كيف يقارَن" },
  "preview.compareWith": { en: "Compare with", zh: "对比", ar: "مقارنة مع" },
  "preview.viewProduct": { en: "View", zh: "查看", ar: "عرض" },

  /* ── 2026-07-30 full-translation sweep: keys that were falling back ── */
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
  /* ── phase 2: highlights ── */
  "preview.highlightsEyebrow": { en: "Highlights", zh: "亮点", ar: "أبرز المزايا" },
  "preview.highlightsTitle": { en: "What stands out", zh: "突出之处", ar: "ما يميّزه" },
  /* ── phase 3: options · packing · compliance · price ── */
  "preview.optionsEyebrow": { en: "Configure", zh: "可选配置", ar: "التهيئة" },
  "preview.optionsTitle": { en: "Options", zh: "选项", ar: "الخيارات" },
  "preview.optionRequired": { en: "Required", zh: "必选", ar: "إلزامي" },
  "preview.optionDefault": { en: "Standard", zh: "标准配置", ar: "قياسي" },
  "preview.packingEyebrow": { en: "Shipping", zh: "运输", ar: "الشحن" },
  "preview.packingTitle": { en: "Packing & Logistics", zh: "包装与物流", ar: "التعبئة واللوجستيات" },
  "preview.packingType": { en: "Packing", zh: "包装方式", ar: "التعبئة" },
  "preview.woodTreatment": { en: "Wood treatment", zh: "木材处理", ar: "معالجة الخشب" },
  "preview.netWeight": { en: "Net weight", zh: "净重", ar: "الوزن الصافي" },
  "preview.grossWeight": { en: "Gross weight", zh: "毛重", ar: "الوزن الإجمالي" },
  "preview.cbm": { en: "Volume", zh: "体积", ar: "الحجم" },
  "preview.stackable": { en: "Stackable", zh: "可堆叠", ar: "قابل للتكديس" },
  "preview.portOfLoading": { en: "Port of loading", zh: "装货港", ar: "ميناء الشحن" },
  "preview.unitsPerContainer": { en: "units", zh: "台", ar: "وحدة" },
  "preview.package": { en: "Package", zh: "包装件", ar: "الطرد" },
  "preview.qty": { en: "Qty", zh: "数量", ar: "الكمية" },
  "preview.dangerousGoods": { en: "Dangerous goods", zh: "危险品", ar: "بضائع خطرة" },
  "preview.complianceEyebrow": { en: "Declared", zh: "合规声明", ar: "المُصرَّح به" },
  "preview.ipRating": { en: "IP rating", zh: "防护等级", ar: "درجة الحماية IP" },
  "preview.hsCode": { en: "HS code", zh: "海关编码", ar: "الرمز الجمركي HS" },
  "preview.months": { en: "months", zh: "个月", ar: "شهر" },
  "preview.priceEyebrow": { en: "Internal", zh: "内部", ar: "داخلي" },
  "preview.priceTitle": { en: "Price sheet", zh: "价格表", ar: "جدول الأسعار" },
  "preview.pricingMode": { en: "Mode", zh: "定价方式", ar: "النمط" },
  "preview.globalPrice": { en: "Global price", zh: "全球价", ar: "السعر العالمي" },
  "preview.headOnly": { en: "Head only", zh: "仅机头", ar: "الرأس فقط" },
  "preview.completeSet": { en: "Complete set", zh: "整套", ar: "طقم كامل" },
  "preview.priceNote": { en: "Note", zh: "备注", ar: "ملاحظة" },
  /* ── legacy facts (products without a spec template) ── */
  "preview.fact.voltage": { en: "Voltage", zh: "电压", ar: "الجهد" },
  "preview.fact.power": { en: "Power", zh: "功率", ar: "القدرة" },
  "preview.fact.weight": { en: "Weight", zh: "重量", ar: "الوزن" },
  "preview.fact.dimensions": { en: "Dimensions", zh: "尺寸", ar: "الأبعاد" },
  /* ── redesign 19/09/2026: the section index and the knowledge blocks ── */
  "preview.navOverview": { en: "Key figures", zh: "关键数据", ar: "الأرقام الرئيسية" },
  "preview.navHighlights": { en: "Highlights", zh: "亮点", ar: "أبرز المزايا" },
  "preview.navSpecs": { en: "Specifications", zh: "技术参数", ar: "المواصفات" },
  "preview.navModels": { en: "Models compared", zh: "型号对比", ar: "مقارنة الموديلات" },
  "preview.navOptions": { en: "Options", zh: "选项", ar: "الخيارات" },
  "preview.navPacking": { en: "Packing", zh: "包装物流", ar: "التعبئة" },
  "preview.navCompliance": { en: "Compliance", zh: "合规", ar: "الامتثال" },
  "preview.navKnowledge": { en: "Knowledge", zh: "产品知识", ar: "المعرفة" },
  "preview.navMedia": { en: "Media & Files", zh: "媒体与文件", ar: "الوسائط والملفات" },
  "preview.navCompare": { en: "Compare", zh: "对比", ar: "مقارنة" },
  "preview.navPrice": { en: "Price sheet", zh: "价格表", ar: "جدول الأسعار" },
  "preview.thisProduct": { en: "This product", zh: "本产品", ar: "هذا المنتج" },
  "preview.knowledgeTitle": { en: "About this machine", zh: "关于这台机器", ar: "عن هذه الماكينة" },
  "preview.kb.overview": { en: "Overview", zh: "概述", ar: "نظرة عامة" },
  "preview.kb.key_features": { en: "Key features", zh: "主要特点", ar: "الميزات الرئيسية" },
  "preview.kb.selling_points": { en: "Why it wins", zh: "核心优势", ar: "لماذا يتفوّق" },
  "preview.kb.technical_advantages": { en: "Technical advantages", zh: "技术优势", ar: "المزايا الفنية" },
  "preview.kb.applications": { en: "Applications", zh: "应用", ar: "الاستخدامات" },
  "preview.kb.suitable_materials": { en: "Suitable materials", zh: "适用面料", ar: "الخامات المناسبة" },
  "preview.kb.recommended_use_cases": { en: "Recommended use", zh: "推荐用途", ar: "الاستخدام الموصى به" },
  "preview.kb.operation_notes": { en: "Operation notes", zh: "操作说明", ar: "ملاحظات التشغيل" },
  "preview.kb.maintenance_notes": { en: "Maintenance", zh: "维护保养", ar: "الصيانة" },
  "preview.kb.limitations": { en: "Limitations", zh: "局限", ar: "القيود" },
  "preview.kb.warnings": { en: "Warnings & safety", zh: "警告与安全", ar: "التحذيرات والسلامة" },
  "preview.kb.package_contents": { en: "What's included", zh: "包装内容", ar: "محتويات العبوة" },
  "preview.kb.warranty_notes": { en: "Warranty notes", zh: "保修说明", ar: "ملاحظات الضمان" },
  "preview.kb.buyer_questions": { en: "Buyer questions", zh: "买家常见问题", ar: "أسئلة المشتري" },
};
