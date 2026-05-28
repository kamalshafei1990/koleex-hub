"use client";

/* ---------------------------------------------------------------------------
   i18n — self-contained translation module for the product-coding-system
   knowledge page. Three languages: en (English), zh (中文), ar (العربية).

   Two translation tables:
     · UI  — keyed by stable string ID, for chrome / section text / buttons
     · LBL — keyed by the canonical English label, for data labels coming
             out of data.ts (subcategory names, segment headers, value
             meanings, region labels, etc.).

   Codes (XSL, Q10, "0", "/", "560", etc.) are identifiers — they are
   never translated, even in Arabic. Same for numeric quantities and
   the KOLEEX brand mark.
   --------------------------------------------------------------------------- */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "zh" | "ar";
export type Dir = "ltr" | "rtl";

export const LANGS: Array<{ code: Lang; label: string; dir: Dir }> = [
  { code: "en", label: "EN", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

/* ── UI strings (keyed by stable ID) ───────────────────────────────── */
const UI: Record<string, Record<Lang, string>> = {
  // Navigation
  "nav.knowledge": {
    en: "Knowledge",
    zh: "知识库",
    ar: "المعرفة",
  },
  "nav.back": {
    en: "Back to Knowledge",
    zh: "返回知识库",
    ar: "العودة إلى المعرفة",
  },
  "doc.title_short": {
    en: "Product Coding System",
    zh: "产品编码系统",
    ar: "نظام ترميز المنتجات",
  },

  // Section 01 — Hero
  "01.eyebrow": {
    en: "01 — Enterprise Product Intelligence",
    zh: "01 — 企业产品智能",
    ar: "01 — ذكاء المنتجات المؤسسي",
  },
  "01.title": {
    en: "The KOLEEX universe.",
    zh: "KOLEEX 宇宙。",
    ar: "كون KOLEEX.",
  },
  "01.lead": {
    en: "Nine divisions share one identity grammar. Every product — from a sewing machine to a smart-home sensor — gets its code from the same system. This document covers the Garment Machinery division, the first one to ship full coding coverage.",
    zh: "九大事业部共享同一套身份语法。每一件产品 — 从一台缝纫机到一个智能家居传感器 — 都来自同一套系统的编码。本文档涵盖服装机械事业部，这是首个实现完整编码覆盖的事业部。",
    ar: "تتشارك تسعة أقسام نفس قواعد الهوية. كل منتج — من ماكينة خياطة إلى مستشعر منزل ذكي — يحصل على رمزه من النظام ذاته. تغطّي هذه الوثيقة قسم آلات الملابس، وهو أول قسم يطلق تغطية ترميز كاملة.",
  },
  "01.meta.document": {
    en: "Document",
    zh: "文档",
    ar: "الوثيقة",
  },
  "01.meta.document_value": {
    en: "Coding System Spec",
    zh: "编码系统规范",
    ar: "مواصفات نظام الترميز",
  },
  "01.meta.division": {
    en: "Division",
    zh: "事业部",
    ar: "القسم",
  },
  "01.meta.categories": {
    en: "Categories",
    zh: "类别",
    ar: "الفئات",
  },
  "01.meta.subcategories": {
    en: "Subcategories",
    zh: "子类别",
    ar: "الفئات الفرعية",
  },
  "division.youre_here": {
    en: "You are here",
    zh: "您在这里",
    ar: "أنت هنا",
  },
  "status.live": {
    en: "Live",
    zh: "已上线",
    ar: "مفعّل",
  },
  "status.planned": {
    en: "Planned",
    zh: "计划中",
    ar: "مخطط",
  },

  // Section 02 — Categories
  "02.number": { en: "02", zh: "02", ar: "02" },
  "02.eyebrow": {
    en: "Categories",
    zh: "类别",
    ar: "الفئات",
  },
  "02.title": {
    en: "Eleven categories of garment machinery.",
    zh: "服装机械的十一个类别。",
    ar: "إحدى عشرة فئة من آلات الملابس.",
  },
  "02.sub": {
    en: "Every product code begins with one of these prefixes. Each tile expands to show its subcategories — the full reference also lives in the index below.",
    zh: "每一个产品编码都以这些前缀之一开头。点击图块可展开其子类别 — 完整参考也可在下方索引中查看。",
    ar: "يبدأ كل رمز منتج بإحدى هذه البادئات. كل بطاقة تتوسع لإظهار فئاتها الفرعية — المرجع الكامل متوفر أيضاً في الفهرس أدناه.",
  },
  "02.count": {
    en: "{n} categories · {m} subs",
    zh: "{n} 个类别 · {m} 个子类",
    ar: "{n} فئة · {m} فئة فرعية",
  },
  "cat.subs_plural": {
    en: "subcategories",
    zh: "个子类别",
    ar: "فئات فرعية",
  },
  "cat.subs_singular": {
    en: "subcategory",
    zh: "个子类别",
    ar: "فئة فرعية",
  },
  "cat.subs_short_plural": {
    en: "subs",
    zh: "子类",
    ar: "فرعية",
  },
  "cat.subs_short_singular": {
    en: "sub",
    zh: "子类",
    ar: "فرعية",
  },
  "cat.open_subs": {
    en: "Open subcategories",
    zh: "展开子类别",
    ar: "فتح الفئات الفرعية",
  },
  "cat.close": {
    en: "Close",
    zh: "收起",
    ar: "إغلاق",
  },
  "cat.decoded_badge": {
    en: "Decoded",
    zh: "已解码",
    ar: "موثّق",
  },
  "cat.view_breakdown": {
    en: "View technical breakdown for XSL · XSO · XSI",
    zh: "查看 XSL · XSO · XSI 的技术分解",
    ar: "عرض التفصيل التقني لـ XSL · XSO · XSI",
  },
  "02.index.eyebrow": {
    en: "Subcategory index",
    zh: "子类别索引",
    ar: "فهرس الفئات الفرعية",
  },
  "02.index.title": {
    en: "KOLEEX Garment Machinery Subcategories Coding System",
    zh: "KOLEEX 服装机械子类别编码系统",
    ar: "نظام ترميز الفئات الفرعية لآلات الملابس KOLEEX",
  },
  "02.index.meta": {
    en: "{n} codes across 11 categories",
    zh: "11 个类别下共 {n} 个编码",
    ar: "{n} رمزاً عبر 11 فئة",
  },

  // Section 03 — Technical specifications
  "03.number": { en: "03", zh: "03", ar: "03" },
  "03.eyebrow": {
    en: "Technical specifications",
    zh: "技术规范",
    ar: "المواصفات التقنية",
  },
  "03.title": {
    en: "One card per machine type.",
    zh: "每种机型一张卡片。",
    ar: "بطاقة واحدة لكل نوع آلة.",
  },
  "03.sub": {
    en: "Three industrial sewing subcategories (under category XS) ship full technical decoding today. The rest are coded but await their reference card. Hover or click any axis on a card to highlight its allowed values.",
    zh: "三个工业缝纫子类别（XS 类别下）目前提供完整的技术解码。其余子类别已有编码但尚未发布参考卡。在卡片中悬停或点击任一轴即可高亮其允许值。",
    ar: "تتوفر اليوم تفصيلات تقنية كاملة لثلاث فئات فرعية من الخياطة الصناعية (ضمن الفئة XS). أما البقية فلها رموز لكنها تنتظر بطاقة المرجع الخاصة بها. مرّر أو انقر على أي محور في البطاقة لإبراز قيمه المسموح بها.",
  },
  "03.coverage": {
    en: "{decoded} of {total} subs decoded · {pct}% coverage",
    zh: "{decoded} / {total} 个子类已解码 · {pct}% 覆盖率",
    ar: "{decoded} من {total} موثّقة · تغطية {pct}%",
  },
  "03.xs_strip.eyebrow": {
    en: "Category XS — Industrial Sewing Machines",
    zh: "XS 类别 — 工业缝纫机",
    ar: "الفئة XS — آلات الخياطة الصناعية",
  },
  "03.xs_strip.sub": {
    en: "Subcategories under XS, in canonical order. Decoded ones link to their reference card below.",
    zh: "XS 下的子类别，按规范顺序排列。已解码的子类链接到下方的参考卡。",
    ar: "الفئات الفرعية ضمن XS بالترتيب القياسي. الموثّقة منها مرتبطة ببطاقة المرجع أدناه.",
  },
  "03.xs_strip.meta": {
    en: "{n} subs · 3 decoded",
    zh: "{n} 个子类 · 3 个已解码",
    ar: "{n} فرعية · 3 موثّقة",
  },

  // BreakdownCard
  "bd.eyebrow": {
    en: "{name} · Live reference",
    zh: "{name} · 实时参考",
    ar: "{name} · مرجع حيّ",
  },
  "bd.subtitle_lockstitch": {
    en: "Eight configuration axes. Empty boxes mean the segment is optional and may be omitted from a real SKU.",
    zh: "八个配置轴。空框表示该段为可选项，可在实际 SKU 中省略。",
    ar: "ثمانية محاور للتهيئة. الخانات الفارغة تعني أن المقطع اختياري ويمكن حذفه من رمز SKU فعلي.",
  },
  "bd.subtitle_overlock": {
    en: "Six configuration axes. Thread count and pneumatic features are the high-signal axes for buyers.",
    zh: "六个配置轴。线数和气动功能是买家最关注的关键轴。",
    ar: "ستة محاور للتهيئة. عدد الخيوط والميزات الهوائية هي المحاور الأهم للمشترين.",
  },
  "bd.subtitle_interlock": {
    en: "Five configuration axes. The stitch-type catalog is the widest of any subcategory in the system.",
    zh: "五个配置轴。线迹类型目录是系统中所有子类别中最广的。",
    ar: "خمسة محاور للتهيئة. فهرس نوع الغرزة هو الأوسع بين جميع الفئات الفرعية في النظام.",
  },
  "bd.compose_hint": {
    en: "Click any row in a table to compose a code — Reset returns to the canonical example.",
    zh: "点击表格中的任一行可组合一个编码 — 重置可恢复至规范示例。",
    ar: "انقر على أي صف في الجدول لتركيب رمز — إعادة التعيين تعيد المثال المرجعي.",
  },
  "bd.code_anatomy": {
    en: "Code anatomy",
    zh: "编码解析",
    ar: "تشريح الرمز",
  },
  "bd.allowed_values": {
    en: "Allowed values",
    zh: "允许值",
    ar: "القيم المسموح بها",
  },
  "bd.reset": {
    en: "Reset",
    zh: "重置",
    ar: "إعادة تعيين",
  },
  "bd.copy": {
    en: "Copy",
    zh: "复制",
    ar: "نسخ",
  },
  "bd.copied": {
    en: "Copied",
    zh: "已复制",
    ar: "تم النسخ",
  },

  // Section 04 — SKU builder
  "04.number": { en: "04", zh: "04", ar: "04" },
  "04.eyebrow": {
    en: "SKU builder",
    zh: "SKU 构建器",
    ar: "منشئ SKU",
  },
  "04.title": {
    en: "Compose a technical SKU.",
    zh: "组合一个技术 SKU。",
    ar: "ركّب رمز SKU تقني.",
  },
  "04.sub": {
    en: "Pick a value on each axis. The code assembles in real time and the silhouette highlights the part of the machine each axis controls.",
    zh: "在每个轴上选择一个值。编码将实时组装，机器图示会高亮显示每个轴所控制的部位。",
    ar: "اختر قيمة على كل محور. يتجمّع الرمز في الوقت الحقيقي ويُبرز الرسم القسم من الآلة الذي يتحكم به كل محور.",
  },
  "builder.live_builder": {
    en: "Live SKU builder",
    zh: "实时 SKU 构建器",
    ar: "منشئ SKU الحيّ",
  },
  "builder.copy_code": {
    en: "Copy code",
    zh: "复制编码",
    ar: "نسخ الرمز",
  },
  "builder.copied": {
    en: "Copied",
    zh: "已复制",
    ar: "تم النسخ",
  },
  "builder.machine_map": {
    en: "Machine map",
    zh: "机器图谱",
    ar: "خريطة الآلة",
  },
  "builder.hint": {
    en: "Each axis lights up the part of the machine it controls. Hover any axis on the left to map it onto the silhouette.",
    zh: "每个轴会点亮其控制的机器部位。在左侧悬停任一轴即可将其映射到图示上。",
    ar: "يُضيء كل محور القسم من الآلة الذي يتحكم به. مرّر على أي محور إلى اليسار لتعيينه على الرسم.",
  },
  "builder.caption_default": {
    en: "Hover an axis on the left to map it onto the machine",
    zh: "在左侧悬停任一轴可将其映射到机器上",
    ar: "مرّر على محور إلى اليسار لتعيينه على الآلة",
  },

  // Section 05 — Intelligence layer
  "05.number": { en: "05", zh: "05", ar: "05" },
  "05.eyebrow": {
    en: "Intelligence layer",
    zh: "智能层",
    ar: "طبقة الذكاء",
  },
  "05.title": {
    en: "What the code unlocks.",
    zh: "编码解锁了什么。",
    ar: "ما يفتحه الرمز.",
  },
  "05.sub": {
    en: "Every segment feeds a different system: ERP routing, BOM resolution, AI reasoning, quotation engine. Parsed once, reused by every consumer.",
    zh: "每个段都为不同的系统提供数据：ERP 路由、BOM 解析、AI 推理、报价引擎。一次解析，所有消费者复用。",
    ar: "كل مقطع يغذّي نظاماً مختلفاً: توجيه ERP، حلّ قائمة المواد BOM، استدلال الذكاء الاصطناعي، محرّك التسعير. يُحلّل مرة واحدة، ويُعاد استخدامه من قبل كل مستهلك.",
  },
  "05.erp_pipeline": {
    en: "ERP pipeline",
    zh: "ERP 流水线",
    ar: "خط ERP",
  },
  "05.segment_unlocks": {
    en: "What each segment unlocks",
    zh: "每个段解锁的内容",
    ar: "ما يفتحه كل مقطع",
  },

  // Section 05 — Segment unlocks (left-col labels)
  "unlock.model_code": {
    en: "Model code",
    zh: "型号代码",
    ar: "رمز الطراز",
  },
  "unlock.function": {
    en: "Function",
    zh: "功能",
    ar: "الوظيفة",
  },
  "unlock.motor_table": {
    en: "Motor / table",
    zh: "电机 / 工作台",
    ar: "المحرّك / الطاولة",
  },
  "unlock.op_length": {
    en: "Operation length",
    zh: "操作空间长度",
    ar: "طول التشغيل",
  },
  "unlock.fabric": {
    en: "Fabric",
    zh: "面料",
    ar: "القماش",
  },
  "unlock.hook_stitch": {
    en: "Hook / stitch",
    zh: "旋梭 / 线迹",
    ar: "الخطّاف / الغرزة",
  },
  "unlock.special": {
    en: "Special config",
    zh: "特殊配置",
    ar: "التهيئة الخاصة",
  },
  // Section 05 — Segment unlocks (right-col descriptions)
  "unlock.model_code.v": {
    en: "Catalog lineage · price-list anchor",
    zh: "目录沿革 · 价格表锚点",
    ar: "نسب الكتالوج · ربط قائمة الأسعار",
  },
  "unlock.function.v": {
    en: "Capability filter · brochure features",
    zh: "能力筛选 · 宣传册特性",
    ar: "تصفية القدرات · ميزات الكتيب",
  },
  "unlock.motor_table.v": {
    en: "Inventory variants · packing weight",
    zh: "库存变体 · 包装重量",
    ar: "متغيّرات المخزون · وزن التعبئة",
  },
  "unlock.op_length.v": {
    en: "Workbench compatibility",
    zh: "工作台兼容性",
    ar: "توافق منضدة العمل",
  },
  "unlock.fabric.v": {
    en: "Recommendation engine input",
    zh: "推荐引擎输入",
    ar: "مدخل محرّك التوصيات",
  },
  "unlock.hook_stitch.v": {
    en: "Spare-parts BOM resolution",
    zh: "备件 BOM 解析",
    ar: "حلّ قائمة مواد قطع الغيار",
  },
  "unlock.special.v": {
    en: "Quotation surcharges + add-ons",
    zh: "报价附加费 + 附加组件",
    ar: "رسوم إضافية على عرض السعر + إضافات",
  },

  // Footer
  "footer.architecture": {
    en: "KOLEEX Enterprise Product Intelligence Architecture",
    zh: "KOLEEX 企业产品智能架构",
    ar: "بنية ذكاء المنتجات المؤسسي من KOLEEX",
  },
  "footer.scope": {
    en: "v26 · Garment Machinery",
    zh: "v26 · 服装机械",
    ar: "v26 · آلات الملابس",
  },

  // Category decoded / planned meta
  "cat.coverage": {
    en: "{decoded}/{total} decoded",
    zh: "已解码 {decoded}/{total}",
    ar: "موثّقة {decoded}/{total}",
  },
  "cat.planned_badge": {
    en: "Planned",
    zh: "计划中",
    ar: "مخطّط",
  },

  // Compare two codes
  "compare.eyebrow": {
    en: "Compare",
    zh: "比较",
    ar: "مقارنة",
  },
  "compare.title": {
    en: "Compare two codes.",
    zh: "比较两个编码。",
    ar: "قارن بين رمزين.",
  },
  "compare.sub": {
    en: "Pick a machine type, build two codes, and the axes that differ light up.",
    zh: "选择一个机型，组合两个编码，差异轴会高亮显示。",
    ar: "اختر نوع آلة، اِبنِ رمزين، وستُضاء المحاور المختلفة.",
  },
  "compare.side_a": {
    en: "Code A",
    zh: "编码 A",
    ar: "الرمز A",
  },
  "compare.side_b": {
    en: "Code B",
    zh: "编码 B",
    ar: "الرمز B",
  },
  "compare.diff_axes": {
    en: "{n} axes differ",
    zh: "{n} 个轴存在差异",
    ar: "اختلاف في {n} من المحاور",
  },
  "compare.no_diff": {
    en: "Codes match exactly",
    zh: "两个编码完全相同",
    ar: "الرمزان متطابقان تماماً",
  },
  "compare.pick_type": {
    en: "Machine type:",
    zh: "机型：",
    ar: "نوع الآلة:",
  },

  // Permalink
  "bd.copy_link": {
    en: "Copy link",
    zh: "复制链接",
    ar: "نسخ الرابط",
  },
  "bd.link_copied": {
    en: "Link copied",
    zh: "已复制链接",
    ar: "تم نسخ الرابط",
  },

  // Search by code
  "search.placeholder": {
    en: "Search by code or label (e.g. XSEB, embroidery)…",
    zh: "按编码或标签搜索（例如 XSEB、刺绣）…",
    ar: "البحث بالرمز أو الاسم (مثال: XSEB، تطريز)…",
  },
  "search.clear": {
    en: "Clear",
    zh: "清除",
    ar: "مسح",
  },
  "search.no_results": {
    en: "No matches",
    zh: "无匹配",
    ar: "لا توجد نتائج",
  },
  "search.result_count": {
    en: "{n} matches",
    zh: "{n} 个匹配",
    ar: "{n} نتيجة",
  },

  // Language selector (removed locally — Hub header drives it)
  "lang.label": {
    en: "Language",
    zh: "语言",
    ar: "اللغة",
  },

  // ── v30 — Real products section ────────────────────────────
  "bd.products.title": {
    en: "Real products using this configuration",
    zh: "使用此配置的实际产品",
    ar: "المنتجات الحقيقية باستخدام هذا التكوين",
  },
  "bd.products.meta": {
    en: "{products} compatible products · {accessories} compatible accessories · {bom} compatible BOM variants",
    zh: "{products} 件兼容产品 · {accessories} 件兼容配件 · {bom} 种兼容 BOM 变体",
    ar: "{products} منتجات متوافقة · {accessories} ملحقات متوافقة · {bom} متغيرات BOM متوافقة",
  },
  "bd.products.none": {
    en: "No exact matches — adjust the configuration above.",
    zh: "暂无精确匹配 — 请调整上方配置。",
    ar: "لا توجد مطابقات دقيقة — عدّل التكوين أعلاه.",
  },
  "bd.products.partial_hint": {
    en: "Partial matches shown below — these products share some axes with your build.",
    zh: "以下为部分匹配的产品 — 它们与您构建的编码共享部分轴。",
    ar: "نتائج جزئية أدناه — تشترك هذه المنتجات في بعض المحاور مع رمزك.",
  },
  "bd.products.match_pct": {
    en: "{pct}% match",
    zh: "{pct}% 匹配",
    ar: "تطابق {pct}%",
  },
  "bd.products.view": { en: "View product", zh: "查看产品", ar: "عرض المنتج" },
  "bd.products.bom": { en: "Open BOM", zh: "打开 BOM", ar: "فتح BOM" },
  "bd.products.accessories": {
    en: "Compatible accessories",
    zh: "兼容配件",
    ar: "ملحقات متوافقة",
  },
  "bd.products.spare": { en: "Spare parts", zh: "备件", ar: "قطع الغيار" },
  "bd.products.datasheet": { en: "Datasheet", zh: "技术参数表", ar: "ورقة البيانات" },

  // ── v30 — Sticky page navigator ────────────────────────────
  "nav.section.universe": { en: "Universe", zh: "宇宙", ar: "الكون" },
  "nav.section.categories": { en: "Categories", zh: "类别", ar: "الفئات" },
  "nav.section.tech": {
    en: "Technical specs",
    zh: "技术规范",
    ar: "المواصفات التقنية",
  },
  "nav.section.compare": { en: "Compare", zh: "比较", ar: "مقارنة" },
  "nav.section.builder": { en: "SKU builder", zh: "SKU 构建器", ar: "منشئ SKU" },
  "nav.section.intelligence": {
    en: "Intelligence",
    zh: "智能层",
    ar: "الذكاء",
  },
  "nav.contents": { en: "Contents", zh: "目录", ar: "المحتويات" },

  // ── v30 — Compare diff + impact + score ─────────────────────
  "compare.summary.title": {
    en: "Difference summary",
    zh: "差异概要",
    ar: "ملخّص الاختلافات",
  },
  "compare.summary.row_differs": {
    en: "{axis} differs",
    zh: "{axis} 不同",
    ar: "{axis} مختلف",
  },
  "compare.score.label": {
    en: "Compatibility score",
    zh: "兼容性评分",
    ar: "درجة التوافق",
  },
  "compare.score.value": {
    en: "{pct}% compatible",
    zh: "兼容度 {pct}%",
    ar: "توافق {pct}%",
  },
  "compare.impact.title": {
    en: "Commercial impact",
    zh: "商业影响",
    ar: "الأثر التجاري",
  },
  "compare.impact.packing": {
    en: "Packing size changes",
    zh: "包装尺寸变化",
    ar: "تغيّرات حجم التعبئة",
  },
  "compare.impact.price": {
    en: "Price category changes",
    zh: "价格类别变化",
    ar: "تغيّرات فئة السعر",
  },
  "compare.impact.bom": {
    en: "BOM changes",
    zh: "BOM 变化",
    ar: "تغيّرات قائمة المواد",
  },
  "compare.impact.accessories": {
    en: "Accessory compatibility changes",
    zh: "配件兼容性变化",
    ar: "تغيّرات توافق الملحقات",
  },
  "compare.impact.none": {
    en: "No commercial impact — configurations match.",
    zh: "无商业影响 — 配置相同。",
    ar: "لا أثر تجاري — التكوينان متطابقان.",
  },

  // ── v30 — Ecosystem preview ─────────────────────────────────
  "eco.eyebrow": { en: "Ecosystem", zh: "生态系统", ar: "النظام البيئي" },
  "eco.title": {
    en: "Unified Product Intelligence Architecture",
    zh: "统一产品智能架构",
    ar: "بنية ذكاء المنتجات الموحّدة",
  },
  "eco.sub": {
    en: "Every division will inherit the same coding grammar. The codes below are illustrative previews of how the system scales beyond Garment Machinery.",
    zh: "每个事业部都将继承同一套编码语法。下方的编码是该系统在服装机械之外如何扩展的示意性预览。",
    ar: "سيرث كل قسم القواعد ذاتها للترميز. الرموز أدناه أمثلة توضيحية لكيفية اتساع النظام خارج آلات الملابس.",
  },
  "eco.status.live": { en: "Live", zh: "已上线", ar: "مفعّل" },
  "eco.status.in_design": {
    en: "In design",
    zh: "设计中",
    ar: "قيد التصميم",
  },
  "eco.status.planned": { en: "Planned", zh: "计划中", ar: "مخطّط" },
  "eco.capability.ai": { en: "AI-ready", zh: "AI 就绪", ar: "جاهز للذكاء الاصطناعي" },
  "eco.capability.erp": { en: "ERP-ready", zh: "ERP 就绪", ar: "جاهز لـ ERP" },
  "eco.capability.compat": {
    en: "Compatibility-ready",
    zh: "兼容性就绪",
    ar: "جاهز للتوافق",
  },
  "eco.preview_code": { en: "Preview code", zh: "示例编码", ar: "رمز توضيحي" },

  // AI Parse Flow
  "ai.input_eyebrow": {
    en: "AI input · technical identity",
    zh: "AI 输入 · 技术身份",
    ar: "مدخل الذكاء الاصطناعي · الهوية التقنية",
  },
  "ai.input_lead": {
    en: "The assistant treats the code as a feature vector. Each axis contributes one fact to the answer.",
    zh: "助手将编码视为一个特征向量。每个轴为答案贡献一个事实。",
    ar: "يعامل المساعد الرمز كمتجه ميزات. كل محور يساهم بحقيقة واحدة في الإجابة.",
  },
  "ai.output_label": {
    en: "Output:",
    zh: "输出：",
    ar: "المخرج:",
  },
  "ai.output.recommendation": {
    en: "recommendation",
    zh: "推荐",
    ar: "توصية",
  },
  "ai.output.bom": {
    en: "BOM resolution",
    zh: "BOM 解析",
    ar: "حلّ قائمة المواد",
  },
  "ai.output.spare": {
    en: "spare-parts match",
    zh: "备件匹配",
    ar: "مطابقة قطع الغيار",
  },
  "ai.output.acc": {
    en: "compatible accessories",
    zh: "兼容配件",
    ar: "ملحقات متوافقة",
  },
  "ai.output.surcharge": {
    en: "auto-quotation surcharges",
    zh: "自动报价附加费",
    ar: "رسوم عرض السعر التلقائية",
  },
  // AI facts — labels
  "ai.fact.cat.label": {
    en: "Machine category",
    zh: "机器类别",
    ar: "فئة الآلة",
  },
  "ai.fact.cat.detail": {
    en: "Single-needle lockstitch · new-model line",
    zh: "单针平缝 · 新款产品线",
    ar: "غرزة مقفلة بإبرة واحدة · خط طراز جديد",
  },
  "ai.fact.auto.label": {
    en: "Automation level",
    zh: "自动化级别",
    ar: "مستوى الأتمتة",
  },
  "ai.fact.auto.detail": {
    en: "Single stepper · auto thread-trim ready",
    zh: "单步进 · 自动剪线就绪",
    ar: "محرّك خطوي واحد · جاهز لقصّ الخيط الأوتوماتيكي",
  },
  "ai.fact.motor.label": {
    en: "Motor type",
    zh: "电机类型",
    ar: "نوع المحرّك",
  },
  "ai.fact.motor.detail": {
    en: "Direct-drive servo · 550 W class",
    zh: "直驱伺服 · 550 瓦级",
    ar: "سيرفو بتشغيل مباشر · فئة 550 واط",
  },
  "ai.fact.length.label": {
    en: "Operation length",
    zh: "操作长度",
    ar: "طول التشغيل",
  },
  "ai.fact.length.detail": {
    en: "Long-arm workspace · 560 mm bed",
    zh: "长臂工作空间 · 560 毫米缝台",
    ar: "مساحة عمل ذراع طويل · قاعدة 560 مم",
  },
  "ai.fact.fabric.label": {
    en: "Fabric tier",
    zh: "面料层级",
    ar: "فئة القماش",
  },
  "ai.fact.fabric.detail": {
    en: "Medium-weight woven · trousers / jackets",
    zh: "中等重量梭织 · 裤装 / 夹克",
    ar: "نسيج متوسط الوزن · بنطلونات / سترات",
  },
  "ai.fact.hook.label": {
    en: "Hook system",
    zh: "旋梭系统",
    ar: "نظام الخطّاف",
  },
  "ai.fact.hook.detail": {
    en: "DLC hook · low-friction · BOM bucket 7-HJ",
    zh: "DLC 旋梭 · 低摩擦 · BOM 区 7-HJ",
    ar: "خطّاف DLC · احتكاك منخفض · مجموعة BOM 7-HJ",
  },
};

/* ── Data labels (keyed by canonical English string) ──────────────── */
const LBL: Record<string, Record<Lang, string>> = {
  // ── Divisions ────────────────────────────────────────────────
  "Garment Machinery": {
    en: "Garment Machinery",
    zh: "服装机械",
    ar: "آلات الملابس",
  },
  "Digital Devices": {
    en: "Digital Devices",
    zh: "数字设备",
    ar: "الأجهزة الرقمية",
  },
  "Smart Living": {
    en: "Smart Living",
    zh: "智能生活",
    ar: "الحياة الذكية",
  },
  "Lifestyle": {
    en: "Lifestyle",
    zh: "生活方式",
    ar: "نمط الحياة",
  },
  "Mobility": {
    en: "Mobility",
    zh: "出行",
    ar: "التنقّل",
  },
  "Industrial Solutions": {
    en: "Industrial Solutions",
    zh: "工业解决方案",
    ar: "الحلول الصناعية",
  },
  "Fabrics": {
    en: "Fabrics",
    zh: "面料",
    ar: "الأقمشة",
  },
  "Energy": {
    en: "Energy",
    zh: "能源",
    ar: "الطاقة",
  },
  "Medical": {
    en: "Medical",
    zh: "医疗",
    ar: "الطبّية",
  },

  // ── Categories (label + blurb) ───────────────────────────────
  "Fabric Preparation": {
    en: "Fabric Preparation",
    zh: "面料准备",
    ar: "تجهيز القماش",
  },
  "Cutting Equipment": {
    en: "Cutting Equipment",
    zh: "裁剪设备",
    ar: "معدّات القصّ",
  },
  "Industrial Sewing Machines": {
    en: "Industrial Sewing Machines",
    zh: "工业缝纫机",
    ar: "آلات الخياطة الصناعية",
  },
  "Automatic Sewing Systems": {
    en: "Automatic Sewing Systems",
    zh: "自动缝纫系统",
    ar: "أنظمة الخياطة الأوتوماتيكية",
  },
  "Leather & Footwear Machinery": {
    en: "Leather & Footwear Machinery",
    zh: "皮革与鞋类机械",
    ar: "آلات الجلود والأحذية",
  },
  "Embroidery Equipment": {
    en: "Embroidery Equipment",
    zh: "刺绣设备",
    ar: "معدّات التطريز",
  },
  "Printing & Heat Press Equipment": {
    en: "Printing & Heat Press Equipment",
    zh: "印刷与热转印设备",
    ar: "معدّات الطباعة والكبس الحراري",
  },
  "Finishing Equipment": {
    en: "Finishing Equipment",
    zh: "整理设备",
    ar: "معدّات التشطيب",
  },
  "Packing & Inspection": {
    en: "Packing & Inspection",
    zh: "包装与检验",
    ar: "التعبئة والفحص",
  },
  "Domestic Sewing Machines": {
    en: "Domestic Sewing Machines",
    zh: "家用缝纫机",
    ar: "آلات الخياطة المنزلية",
  },
  "Spare Parts & Accessories": {
    en: "Spare Parts & Accessories",
    zh: "备件与配件",
    ar: "قطع الغيار والملحقات",
  },

  // ── Subcategories ────────────────────────────────────────────
  // XPR
  "Spreading Machines": { en: "Spreading Machines", zh: "铺布机", ar: "آلات النشر" },
  "Fabric Relaxing Machines": { en: "Fabric Relaxing Machines", zh: "面料松弛机", ar: "آلات استرخاء القماش" },
  "Fabric Inspection Machines": { en: "Fabric Inspection Machines", zh: "面料检验机", ar: "آلات فحص القماش" },
  "Fabric Rolling Machines": { en: "Fabric Rolling Machines", zh: "面料卷绕机", ar: "آلات لفّ القماش" },
  "Fabric Cutting Tables": { en: "Fabric Cutting Tables", zh: "裁布台", ar: "طاولات قصّ القماش" },
  "Fabric Handling Systems": { en: "Fabric Handling Systems", zh: "面料处理系统", ar: "أنظمة مناولة القماش" },
  // XC
  "Straight Knife Cutting Machines": { en: "Straight Knife Cutting Machines", zh: "直刀裁剪机", ar: "آلات قصّ بسكين مستقيم" },
  "Round Knife Cutting Machines": { en: "Round Knife Cutting Machines", zh: "圆刀裁剪机", ar: "آلات قصّ بسكين دائري" },
  "Band Knife Cutting Machines": { en: "Band Knife Cutting Machines", zh: "带刀裁剪机", ar: "آلات قصّ بسكين شريطي" },
  "End Cutters": { en: "End Cutters", zh: "端头切刀", ar: "قاطعات طرفية" },
  "Strip Cutting Machines": { en: "Strip Cutting Machines", zh: "条带切割机", ar: "آلات قصّ الشرائح" },
  "Tape Cutting Machines": { en: "Tape Cutting Machines", zh: "胶带切割机", ar: "آلات قصّ الأشرطة" },
  "CNC Cutting Machines": { en: "CNC Cutting Machines", zh: "CNC 裁剪机", ar: "آلات قصّ CNC" },
  "Laser Cutting Machines": { en: "Laser Cutting Machines", zh: "激光切割机", ar: "آلات القصّ بالليزر" },
  "Fabric Drilling Machines": { en: "Fabric Drilling Machines", zh: "面料钻孔机", ar: "آلات ثقب القماش" },
  // XS
  "Lockstitch Machines": { en: "Lockstitch Machines", zh: "平缝机", ar: "آلات الغرزة المقفلة" },
  "Overlock Machines": { en: "Overlock Machines", zh: "包缝机", ar: "آلات الحياكة المتشابكة" },
  "Interlock Machines": { en: "Interlock Machines", zh: "绷缝机", ar: "آلات الحياكة المتداخلة" },
  "Chainstitch Machines": { en: "Chainstitch Machines", zh: "链式线迹机", ar: "آلات غرزة السلسلة" },
  "Double Needle Machines": { en: "Double Needle Machines", zh: "双针机", ar: "آلات الإبرة المزدوجة" },
  "Multi-Needle Machines": { en: "Multi-Needle Machines", zh: "多针机", ar: "آلات الإبر المتعددة" },
  "Pattern Sewing Machines": { en: "Pattern Sewing Machines", zh: "花样缝纫机", ar: "آلات الخياطة بالنقش" },
  "Heavy Duty Machines": { en: "Heavy Duty Machines", zh: "重型机", ar: "آلات شاقة الاستخدام" },
  "Special Machines": { en: "Special Machines", zh: "特种机", ar: "آلات خاصة" },
  // XA
  "Pocket Setter Machines": { en: "Pocket Setter Machines", zh: "贴袋机", ar: "آلات تركيب الجيوب" },
  "Pocket Welting Machines": { en: "Pocket Welting Machines", zh: "开袋机", ar: "آلات حواف الجيوب" },
  "Placket Sewing Units": { en: "Placket Sewing Units", zh: "门襟缝制单元", ar: "وحدات خياطة فتحات الصدر" },
  "Side Seam Units": { en: "Side Seam Units", zh: "侧缝单元", ar: "وحدات الدرز الجانبي" },
  "Collar Machines": { en: "Collar Machines", zh: "领部机", ar: "آلات الياقات" },
  "Sleeve Setting Machines": { en: "Sleeve Setting Machines", zh: "袖口装配机", ar: "آلات تركيب الأكمام" },
  "Hemming Machines": { en: "Hemming Machines", zh: "卷边机", ar: "آلات الحاشية" },
  "Bartacking Machines": { en: "Bartacking Machines", zh: "套结机", ar: "آلات تثبيت الغرزات" },
  "Button Attaching Machines": { en: "Button Attaching Machines", zh: "钉扣机", ar: "آلات تركيب الأزرار" },
  "Buttonhole Machines": { en: "Buttonhole Machines", zh: "锁眼机", ar: "آلات عمل العراوي" },
  // XSE
  "Shoe Sewing Machines": { en: "Shoe Sewing Machines", zh: "制鞋缝纫机", ar: "آلات خياطة الأحذية" },
  "Bag Sewing Machines": { en: "Bag Sewing Machines", zh: "制袋缝纫机", ar: "آلات خياطة الحقائب" },
  "Leather Sewing Machines": { en: "Leather Sewing Machines", zh: "皮革缝纫机", ar: "آلات خياطة الجلود" },
  "Edge Binding Machines": { en: "Edge Binding Machines", zh: "包边机", ar: "آلات تجليد الحواف" },
  "Tape Attaching Machines": { en: "Tape Attaching Machines", zh: "贴胶带机", ar: "آلات تركيب الأشرطة" },
  // XE
  "Single Head Embroidery Machines": { en: "Single Head Embroidery Machines", zh: "单头刺绣机", ar: "آلات تطريز برأس واحد" },
  "Multi Head Embroidery Machines": { en: "Multi Head Embroidery Machines", zh: "多头刺绣机", ar: "آلات تطريز برؤوس متعددة" },
  "Computerized Embroidery Machines": { en: "Computerized Embroidery Machines", zh: "电脑刺绣机", ar: "آلات تطريز محوسبة" },
  "Sequin Embroidery Machines": { en: "Sequin Embroidery Machines", zh: "亮片刺绣机", ar: "آلات تطريز بالترتر" },
  "Cording / Beading Machines": { en: "Cording / Beading Machines", zh: "盘绳 / 串珠机", ar: "آلات الحبال والخرز" },
  // XP
  "Heat Press Machines": { en: "Heat Press Machines", zh: "热转印机", ar: "آلات الكبس الحراري" },
  "Rotary Heat Press Machines": { en: "Rotary Heat Press Machines", zh: "滚筒热转印机", ar: "آلات كبس حراري دوّارة" },
  "Pneumatic Heat Press Machines": { en: "Pneumatic Heat Press Machines", zh: "气动热转印机", ar: "آلات كبس حراري هوائية" },
  "Double Station Heat Press Machines": { en: "Double Station Heat Press Machines", zh: "双工位热转印机", ar: "آلات كبس حراري بمحطّتين" },
  "Screen Printing Machines": { en: "Screen Printing Machines", zh: "丝网印刷机", ar: "آلات طباعة الشاشة الحريرية" },
  "Digital Textile Printers (DTG)": { en: "Digital Textile Printers (DTG)", zh: "数码纺织印刷机 (DTG)", ar: "طابعات النسيج الرقمية (DTG)" },
  "Sublimation Printers": { en: "Sublimation Printers", zh: "热升华印刷机", ar: "طابعات التسامي" },
  // XF
  "Steam Irons": { en: "Steam Irons", zh: "蒸汽熨斗", ar: "مكاوي بخارية" },
  "Steam Boilers": { en: "Steam Boilers", zh: "蒸汽锅炉", ar: "غلّايات بخار" },
  "Ironing Tables": { en: "Ironing Tables", zh: "熨烫台", ar: "طاولات الكيّ" },
  "Vacuum Ironing Tables": { en: "Vacuum Ironing Tables", zh: "真空熨烫台", ar: "طاولات كيّ بالشفط" },
  "Form Finishing Machines": { en: "Form Finishing Machines", zh: "成型整理机", ar: "آلات تشطيب القوالب" },
  "Collar & Cuff Press Machines": { en: "Collar & Cuff Press Machines", zh: "领与袖口压烫机", ar: "آلات كبس الياقات والأساور" },
  "Thread Sucking Machines": { en: "Thread Sucking Machines", zh: "线头吸除机", ar: "آلات شفط الخيوط" },
  "Fusing Press Machines": { en: "Fusing Press Machines", zh: "粘合压烫机", ar: "آلات الكبس الانصهاري" },
  "Washing Machines": { en: "Washing Machines", zh: "洗水机", ar: "آلات الغسيل" },
  // XPC
  "Needle Detectors": { en: "Needle Detectors", zh: "断针检测器", ar: "كاشفات الإبر" },
  "Metal Detectors": { en: "Metal Detectors", zh: "金属检测器", ar: "كاشفات المعادن" },
  "Fabric Inspection Machines (Final)": { en: "Fabric Inspection Machines (Final)", zh: "面料检验机（终检）", ar: "آلات فحص القماش (نهائي)" },
  "X-Ray Inspection Machines": { en: "X-Ray Inspection Machines", zh: "X 射线检测机", ar: "آلات فحص بالأشعة السينية" },
  "Folding Machines": { en: "Folding Machines", zh: "折叠机", ar: "آلات الطيّ" },
  "Packing Tables": { en: "Packing Tables", zh: "包装台", ar: "طاولات التعبئة" },
  "Carton Sealing Machines": { en: "Carton Sealing Machines", zh: "封箱机", ar: "آلات إغلاق الكراتين" },
  // XD
  "Household Lockstitch Machines": { en: "Household Lockstitch Machines", zh: "家用平缝机", ar: "آلات غرزة مقفلة منزلية" },
  "Household Overlock Machines": { en: "Household Overlock Machines", zh: "家用包缝机", ar: "آلات حياكة متشابكة منزلية" },
  "Household Embroidery Machines": { en: "Household Embroidery Machines", zh: "家用刺绣机", ar: "آلات تطريز منزلية" },
  "Portable Sewing Machines": { en: "Portable Sewing Machines", zh: "便携式缝纫机", ar: "آلات خياطة محمولة" },
  // XSP
  "Servo Motors": { en: "Servo Motors", zh: "伺服电机", ar: "محرّكات سيرفو" },
  "Direct Drive Motors": { en: "Direct Drive Motors", zh: "直驱电机", ar: "محرّكات تشغيل مباشر" },
  "Control Panels": { en: "Control Panels", zh: "控制面板", ar: "لوحات تحكم" },
  "Touch Screens": { en: "Touch Screens", zh: "触摸屏", ar: "شاشات لمس" },
  "Machine Parts": { en: "Machine Parts", zh: "机器零件", ar: "قطع الآلات" },
  "Attachments & Folders": { en: "Attachments & Folders", zh: "附件与折页器", ar: "ملحقات وطيّاتات" },

  // ── BreakdownCard segment headers (English source from data.ts) ──
  "Model code": { en: "Model code", zh: "型号代码", ar: "رمز الطراز" },
  "Function": { en: "Function", zh: "功能", ar: "الوظيفة" },
  "Seam table": { en: "Seam table", zh: "缝台类型", ar: "نوع طاولة الدرز" },
  "Seam table type": { en: "Seam table type", zh: "缝台类型", ar: "نوع طاولة الدرز" },
  "Motor": { en: "Motor", zh: "电机", ar: "المحرّك" },
  "Motor type": { en: "Motor type", zh: "电机类型", ar: "نوع المحرّك" },
  "Length": { en: "Length", zh: "长度", ar: "الطول" },
  "Operation length": { en: "Operation length", zh: "操作长度", ar: "طول التشغيل" },
  // "Fabrics" is also a division name above — the same translation is reused for both.
  "Applicable fabrics": { en: "Applicable fabrics", zh: "适用面料", ar: "الأقمشة المناسبة" },
  "Hook": { en: "Hook", zh: "旋梭", ar: "الخطّاف" },
  "Hook type": { en: "Hook type", zh: "旋梭类型", ar: "نوع الخطّاف" },
  "Special": { en: "Special", zh: "特殊配置", ar: "خاصة" },
  "Special functions": { en: "Special functions", zh: "特殊功能", ar: "وظائف خاصة" },
  "Threads": { en: "Threads", zh: "线数", ar: "الخيوط" },
  "Thread quantity": { en: "Thread quantity", zh: "线数量", ar: "عدد الخيوط" },
  "Stitch type": { en: "Stitch type", zh: "线迹类型", ar: "نوع الغرزة" },
  "Needle position": { en: "Needle position", zh: "针位", ar: "موضع الإبرة" },

  // ── Value meanings ────────────────────────────────────────────
  // Lockstitch
  "New model single needle lockstitch": { en: "New model single needle lockstitch", zh: "新款单针平缝机", ar: "غرزة مقفلة جديدة بإبرة واحدة" },
  "Variant series A": { en: "Variant series A", zh: "A 系列变体", ar: "السلسلة A" },
  "Variant series B": { en: "Variant series B", zh: "B 系列变体", ar: "السلسلة B" },
  "Direct-drive": { en: "Direct-drive", zh: "直驱", ar: "تشغيل مباشر" },
  "Only trimmer": { en: "Only trimmer", zh: "仅剪线", ar: "قاطع خيط فقط" },
  "3 automatic functions": { en: "3 automatic functions", zh: "三自动功能", ar: "ثلاث وظائف أوتوماتيكية" },
  "4 automatic functions": { en: "4 automatic functions", zh: "四自动功能", ar: "أربع وظائف أوتوماتيكية" },
  "Single stepper": { en: "Single stepper", zh: "单步进", ar: "محرّك خطوي واحد" },
  "Double stepper": { en: "Double stepper", zh: "双步进", ar: "محرّك خطوي مزدوج" },
  "Triple stepper": { en: "Triple stepper", zh: "三步进", ar: "محرّك خطوي ثلاثي" },
  "Flat-bed": { en: "Flat-bed", zh: "平台型", ar: "قاعدة مسطحة" },
  "Cylinder-bed": { en: "Cylinder-bed", zh: "小嘴型", ar: "قاعدة أسطوانية" },
  "Simple motor": { en: "Simple motor", zh: "简易电机", ar: "محرّك بسيط" },
  "Servo motor": { en: "Servo motor", zh: "伺服电机", ar: "محرّك سيرفو" },
  "270 mm": { en: "270 mm", zh: "270 毫米", ar: "270 مم" },
  "360 mm": { en: "360 mm", zh: "360 毫米", ar: "360 مم" },
  "560 mm": { en: "560 mm", zh: "560 毫米", ar: "560 مم" },
  "Thin material": { en: "Thin material", zh: "薄料", ar: "مادة رقيقة" },
  "Medium material": { en: "Medium material", zh: "中厚料", ar: "مادة متوسطة" },
  "Heavy material": { en: "Heavy material", zh: "厚料", ar: "مادة سميكة" },
  "Domestic hook": { en: "Domestic hook", zh: "国产旋梭", ar: "خطّاف محلي" },
  "DLC hook": { en: "DLC hook", zh: "黑金刚旋梭", ar: "خطّاف DLC" },
  "Japanese hook": { en: "Japanese hook", zh: "日本旋梭", ar: "خطّاف ياباني" },
  "Huge hook": { en: "Huge hook", zh: "巨型旋梭", ar: "خطّاف ضخم" },
  "Differential": { en: "Differential", zh: "差动", ar: "تفاضلي" },
  "Needle feeding": { en: "Needle feeding", zh: "针送料", ar: "تغذية بالإبرة" },
  "Puller": { en: "Puller", zh: "拖轮", ar: "ساحب" },
  "Folder": { en: "Folder", zh: "拉筒 / 卷边", ar: "طيّاتة" },
  "Double-knife": { en: "Double-knife", zh: "双刀", ar: "سكينة مزدوجة" },
  "Sealed oil pan": { en: "Sealed oil pan", zh: "密封油盘", ar: "حوض زيت مغلق" },

  // Overlock
  "Mix type / M700": { en: "Mix type / M700", zh: "融合款 / 飞马 M700", ar: "نوع مدمج / M700" },
  "747F type": { en: "747F type", zh: "747F 款", ar: "نوع 747F" },
  "Normal automatic": { en: "Normal automatic", zh: "普通自动", ar: "أوتوماتيكي عادي" },
  "Stepping automatic": { en: "Stepping automatic", zh: "布进自动", ar: "أوتوماتيكي بالخطوة" },
  "Top and bottom feed": { en: "Top and bottom feed", zh: "上下送料", ar: "تغذية علوية وسفلية" },
  "2-thread": { en: "2-thread", zh: "2 线", ar: "خيطان" },
  "3-thread": { en: "3-thread", zh: "3 线", ar: "ثلاثة خيوط" },
  "4-thread": { en: "4-thread", zh: "4 线", ar: "أربعة خيوط" },
  "5-thread": { en: "5-thread", zh: "5 线", ar: "خمسة خيوط" },
  "6-thread": { en: "6-thread", zh: "6 线", ar: "ستة خيوط" },
  "Pneumatic type": { en: "Pneumatic type", zh: "气动式", ar: "نوع هوائي" },
  "Reverse seaming": { en: "Reverse seaming", zh: "倒回缝", ar: "خياطة عكسية" },
  "Pleating": { en: "Pleating", zh: "打褶", ar: "تجعيد" },
  "Lacework": { en: "Lacework", zh: "花边", ar: "أعمال الدانتيل" },
  "Side suction trimmer": { en: "Side suction trimmer", zh: "侧吸剪线器", ar: "قاطع جانبي بالشفط" },
  "Pocket / double-chain cloth bound": { en: "Pocket / double-chain cloth bound", zh: "包兜 / 口袋机", ar: "ربط جيب / سلسلة مزدوجة" },
  "Narrow bound": { en: "Narrow bound", zh: "密拷", ar: "حدّ ضيّق" },

  // Interlock
  "Basic type": { en: "Basic type", zh: "基本型", ar: "النوع الأساسي" },
  "Sewing rolled-edge type": { en: "Sewing rolled-edge type", zh: "缝滚条型", ar: "نوع خياطة الحافة الملفوفة" },
  "Cover seam type": { en: "Cover seam type", zh: "盖缝型", ar: "نوع غرزة التغطية" },
  "4-needle 6-thread type": { en: "4-needle 6-thread type", zh: "四针六线型", ar: "نوع 4 إبر و6 خيوط" },
  "Elastic lace cord type": { en: "Elastic lace cord type", zh: "花边松紧带型", ar: "نوع شريط دانتيل مطّاطي" },
  "Double chain-stitch in 2-looper": { en: "Double chain-stitch in 2-looper", zh: "双钩针环缝", ar: "غرزة سلسلة مزدوجة بحلقتين" },
  "Trouser seam type": { en: "Trouser seam type", zh: "裤耳车缝", ar: "نوع درز البنطلون" },
  "Bottom folding seam type": { en: "Bottom folding seam type", zh: "下摆折边缝型", ar: "نوع طيّ القاع" },
  "All-in-one (01 + 02 + 03)": { en: "All-in-one (01 + 02 + 03)", zh: "三合一 (01 + 02 + 03)", ar: "الكل في واحد (01 + 02 + 03)" },
  "Upper trimmer": { en: "Upper trimmer", zh: "上剪线", ar: "قاطع علوي" },
  "Wiper": { en: "Wiper", zh: "拨线器", ar: "ماسحة" },
  "Left cutter": { en: "Left cutter", zh: "左切刀", ar: "قاطعة يسرى" },
  "Right cutter": { en: "Right cutter", zh: "右切刀", ar: "قاطعة يمنى" },
  "Rolled-edge trimmer": { en: "Rolled-edge trimmer", zh: "切滚条", ar: "قاطعة حافة ملفوفة" },

  // ── Pipeline labels + details ─────────────────────────────────
  "Commercial identity": { en: "Commercial identity", zh: "商业身份", ar: "الهوية التجارية" },
  "The short code on the label, the brochure, and the quotation header.": {
    en: "The short code on the label, the brochure, and the quotation header.",
    zh: "标签、宣传册和报价单标题上的简短编码。",
    ar: "الرمز القصير الموجود على الملصق والكتيب وعنوان عرض السعر.",
  },
  "Technical identity": { en: "Technical identity", zh: "技术身份", ar: "الهوية التقنية" },
  "The long code parsed segment-by-segment into a feature vector.": {
    en: "The long code parsed segment-by-segment into a feature vector.",
    zh: "长编码逐段解析为特征向量。",
    ar: "الرمز الطويل يُحلّل مقطعاً مقطعاً إلى متجه ميزات.",
  },
  "ERP intelligence": { en: "ERP intelligence", zh: "ERP 智能", ar: "ذكاء ERP" },
  "Inventory, pricing, BOM, and packaging derive directly from the segments.": {
    en: "Inventory, pricing, BOM, and packaging derive directly from the segments.",
    zh: "库存、定价、BOM 与包装均直接源自这些段。",
    ar: "المخزون والتسعير وقائمة المواد والتعبئة تُشتقّ مباشرة من المقاطع.",
  },
  "AI understanding": { en: "AI understanding", zh: "AI 理解", ar: "فهم الذكاء الاصطناعي" },
  "The assistant reasons over the vector for recommendations and Q&A.": {
    en: "The assistant reasons over the vector for recommendations and Q&A.",
    zh: "助手基于该向量进行推理，用于推荐与问答。",
    ar: "يستدلّ المساعد عبر المتجه للتوصيات والأسئلة والأجوبة.",
  },
  "Spare-parts matching": { en: "Spare-parts matching", zh: "备件匹配", ar: "مطابقة قطع الغيار" },
  "Hook type + needle system + bed type resolve to the correct parts BOM.": {
    en: "Hook type + needle system + bed type resolve to the correct parts BOM.",
    zh: "旋梭类型 + 针系统 + 缝台类型可解析为正确的备件 BOM。",
    ar: "نوع الخطّاف + نظام الإبرة + نوع القاعدة تُحدّد قائمة مواد قطع الغيار الصحيحة.",
  },
  "Technical compatibility": { en: "Technical compatibility", zh: "技术兼容性", ar: "التوافق التقني" },
  "Side-by-side comparison and quotation upsells use the same axes.": {
    en: "Side-by-side comparison and quotation upsells use the same axes.",
    zh: "并排比较与报价加购使用相同的轴。",
    ar: "تستخدم المقارنة جنباً إلى جنب والمبيعات الإضافية للعرض المحاور ذاتها.",
  },

  // ── AI capability cards ───────────────────────────────────────
  "Recommendation": { en: "Recommendation", zh: "推荐", ar: "التوصية" },
  "Match fabric weight + production level + automation tier to a SKU.": {
    en: "Match fabric weight + production level + automation tier to a SKU.",
    zh: "将面料重量 + 生产水平 + 自动化层级匹配到 SKU。",
    ar: "مطابقة وزن القماش + مستوى الإنتاج + درجة الأتمتة برمز SKU.",
  },
  "Resolve a service request to the exact parts BOM via hook + bed.": {
    en: "Resolve a service request to the exact parts BOM via hook + bed.",
    zh: "通过旋梭 + 缝台将服务请求解析到精确的备件 BOM。",
    ar: "حلّ طلب خدمة إلى قائمة مواد قطع غيار دقيقة عبر الخطّاف والقاعدة.",
  },
  "Technical filtering": { en: "Technical filtering", zh: "技术筛选", ar: "تصفية تقنية" },
  "Catalog filter by any axis: motor type, thread count, hook, etc.": {
    en: "Catalog filter by any axis: motor type, thread count, hook, etc.",
    zh: "按任意轴对目录进行筛选：电机类型、线数、旋梭等。",
    ar: "تصفية الكتالوج بأي محور: نوع المحرّك، عدد الخيوط، الخطّاف، إلخ.",
  },
  "Product comparison": { en: "Product comparison", zh: "产品比较", ar: "مقارنة المنتجات" },
  "Side-by-side diff because every product speaks the same grammar.": {
    en: "Side-by-side diff because every product speaks the same grammar.",
    zh: "并排差异比较，因为所有产品共用同一种语法。",
    ar: "فروق جنباً إلى جنب لأن كل منتج يتحدّث نفس القواعد.",
  },
  "Smart quotation": { en: "Smart quotation", zh: "智能报价", ar: "عرض سعر ذكي" },
  "Special-function codes drive automatic line-item surcharges.": {
    en: "Special-function codes drive automatic line-item surcharges.",
    zh: "特殊功能编码驱动自动按条目附加收费。",
    ar: "رموز الوظائف الخاصة تحرّك رسوماً إضافية تلقائية لكل بند.",
  },
  "Machine compatibility": { en: "Machine compatibility", zh: "机器兼容性", ar: "توافق الآلات" },
  "Same bed + same hook ⇒ shared accessories without manual lookup.": {
    en: "Same bed + same hook ⇒ shared accessories without manual lookup.",
    zh: "相同的缝台 + 相同的旋梭 ⇒ 共享配件，无需手动查询。",
    ar: "نفس القاعدة + نفس الخطّاف ⇒ ملحقات مشتركة دون بحث يدوي.",
  },

  // ── Region labels (machine map captions) ───────────────────────
  "MACHINE HEAD": { en: "MACHINE HEAD", zh: "机头", ar: "رأس الآلة" },
  "MOTOR": { en: "MOTOR", zh: "电机", ar: "المحرّك" },
  "BED / TABLE": { en: "BED / TABLE", zh: "缝台 / 工作台", ar: "القاعدة / الطاولة" },
  "OPERATION LENGTH": { en: "OPERATION LENGTH", zh: "操作长度", ar: "طول التشغيل" },
  "FABRIC PAD": { en: "FABRIC PAD", zh: "面料垫", ar: "وسادة القماش" },
  "HOOK / BOBBIN": { en: "HOOK / BOBBIN", zh: "旋梭 / 梭芯", ar: "الخطّاف / البكرة" },
  "CONTROL PANEL": { en: "CONTROL PANEL", zh: "控制面板", ar: "لوحة التحكم" },

  // ── Category blurbs (used in CategoryGrid tiles) ─────────────
  "Spreading, relaxing, inspecting, and rolling fabric before cutting.": {
    en: "Spreading, relaxing, inspecting, and rolling fabric before cutting.",
    zh: "裁剪前的铺布、松弛、检验与卷绕。",
    ar: "نشر القماش وإرخاؤه وفحصه ولفّه قبل القصّ.",
  },
  "Manual, mechanical, and CNC cutting across knife, laser, and drilling.": {
    en: "Manual, mechanical, and CNC cutting across knife, laser, and drilling.",
    zh: "手动、机械与 CNC 切割：刀具、激光与钻孔。",
    ar: "قصّ يدوي وميكانيكي وCNC يشمل السكاكين والليزر والثقب.",
  },
  "The core of the garment line — lockstitch, overlock, interlock, and specialty stitch.": {
    en: "The core of the garment line — lockstitch, overlock, interlock, and specialty stitch.",
    zh: "服装生产线的核心 — 平缝、包缝、绷缝与特种线迹。",
    ar: "قلب خط الملابس — غرزة مقفلة، حياكة متشابكة، حياكة متداخلة، وغرز خاصة.",
  },
  "Single-purpose automation for pockets, plackets, collars, hems, and buttons.": {
    en: "Single-purpose automation for pockets, plackets, collars, hems, and buttons.",
    zh: "单一用途自动化：口袋、门襟、领部、卷边与纽扣。",
    ar: "أتمتة لغرض واحد للجيوب والفتحات والياقات والحاشية والأزرار.",
  },
  "Shoe, bag, and leather goods — including edge binding and tape attaching.": {
    en: "Shoe, bag, and leather goods — including edge binding and tape attaching.",
    zh: "鞋类、包类与皮革制品 — 含包边与贴胶带。",
    ar: "الأحذية والحقائب والمنتجات الجلدية — تشمل تجليد الحواف وتركيب الأشرطة.",
  },
  "Single-head, multi-head, computerized, sequin, and cording machines.": {
    en: "Single-head, multi-head, computerized, sequin, and cording machines.",
    zh: "单头、多头、电脑、亮片与盘绳机。",
    ar: "آلات برأس واحد ورؤوس متعددة ومحوسبة وترتر وحبال.",
  },
  "Heat presses, screen, DTG, sublimation, and pneumatic stations.": {
    en: "Heat presses, screen, DTG, sublimation, and pneumatic stations.",
    zh: "热转印、丝网、DTG、热升华与气动工位。",
    ar: "كبس حراري وطباعة شاشة وDTG وتسامي ومحطّات هوائية.",
  },
  "Irons, boilers, finishing forms, fusing presses, and washing lines.": {
    en: "Irons, boilers, finishing forms, fusing presses, and washing lines.",
    zh: "熨斗、锅炉、整理成型、粘合压烫与洗水线。",
    ar: "مكاوي وغلّايات وقوالب تشطيب ومكابس انصهار وخطوط غسيل.",
  },
  "Quality and packout — needle/metal/X-ray detectors, folders, sealers.": {
    en: "Quality and packout — needle/metal/X-ray detectors, folders, sealers.",
    zh: "质检与打包 — 针 / 金属 / X 射线检测器、折叠机与封口机。",
    ar: "الجودة والتعبئة — كاشفات الإبر والمعادن والأشعة السينية وآلات الطيّ والإغلاق.",
  },
  "Household lockstitch, overlock, embroidery, and portable units.": {
    en: "Household lockstitch, overlock, embroidery, and portable units.",
    zh: "家用平缝、包缝、刺绣与便携式机。",
    ar: "غرزة مقفلة منزلية وحياكة متشابكة وتطريز ووحدات محمولة.",
  },
  "Motors, drives, control panels, attachments, and replaceable machine parts.": {
    en: "Motors, drives, control panels, attachments, and replaceable machine parts.",
    zh: "电机、驱动、控制面板、附件与可更换的机器零件。",
    ar: "محرّكات ومحرّكات تشغيل ولوحات تحكم وملحقات وقطع آلات قابلة للاستبدال.",
  },
};

/* ── Context + hooks ──────────────────────────────────────────────── */

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; dir: Dir };
const LangContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {
    /* default */
  },
  dir: "ltr",
});

/* Reads from the Hub-wide language signal:
     · localStorage["koleex-lang"]   ← initial value, written by MainHeader
     · window "langchange" event     ← live updates when the user picks a
       new language from the main system header.

   Setting a language locally (rare) also writes back to localStorage and
   dispatches "langchange" so the rest of the page tree stays in sync. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const dir: Dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("koleex-lang") as Lang | null;
      if (saved === "en" || saved === "zh" || saved === "ar") {
        setLangState(saved);
      }
    } catch {
      /* localStorage may be unavailable (SSR, sandbox) — fall back to en */
    }
    const handler = ((e: CustomEvent<Lang>) => {
      if (e.detail === "en" || e.detail === "zh" || e.detail === "ar") {
        setLangState(e.detail);
      }
    }) as EventListener;
    window.addEventListener("langchange", handler);
    return () => window.removeEventListener("langchange", handler);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      window.localStorage.setItem("koleex-lang", l);
      window.dispatchEvent(new CustomEvent("langchange", { detail: l }));
    } catch {
      /* ignore */
    }
  }

  return (
    <LangContext.Provider value={{ lang, setLang, dir }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/* Returns a `t(key, params?)` helper bound to the current language. */
export function useT() {
  const { lang } = useLang();
  return function t(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    let s = UI[key]?.[lang] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };
}

/* Returns a `tl(englishLabel)` helper for data labels coming out of data.ts. */
export function useTL() {
  const { lang } = useLang();
  return function tl(englishLabel: string): string {
    return LBL[englishLabel]?.[lang] ?? englishLabel;
  };
}
