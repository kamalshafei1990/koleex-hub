"use client";

/* ---------------------------------------------------------------------------
   ProductProfile — the INTERNAL product record (/product-data/[id]).

   Product Data and the Products app answer different questions, so they must
   not share a page. The Products app is the showroom: it hides what is empty,
   because a customer must never see a gap. Product Data is the record: an
   operator opens a product precisely to find what is MISSING, so an empty
   field has to be visible and labelled.

   Shape follows the Suppliers 360 page — identity header, then grouped
   sections — and the field grouping follows the editor's own tab order, so
   "where do I fix this?" has an obvious answer. Every group header carries a
   jump straight into that step of the editor.

   All data arrives from GET /api/products/[id]/profile in one round trip.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTopRampOwner } from "@/lib/useTopRampOwner";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IMG } from "@/lib/cdn";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { fetchClassificationIcons, updateProduct } from "@/lib/products-admin";
import { usePermissions } from "@/lib/permissions";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
/* INLINE EDIT — the form's own section components, hosted inside the sheet's
   cards. Same inputs, same units, same rules; only the card around them is
   the profile's. */
import { PackingPhoto, ContentsEditor, UnitSwitch, useImagePicker, portOptions, loadExplain, packingTypeOptions } from "./form-sections/LogisticsBlocks";
import PackingTypeIcon, { isPackingTypeKey } from "@/components/icons/packing/PackingTypeIcon";
import UnitPicker from "./form-sections/UnitPicker";
import { LENGTH_UNITS, MASS_UNITS, displayIn, storeFrom, useEntryUnits, type LengthUnit, type MassUnit } from "@/lib/entry-units";
import KdsSelect from "@/components/kds/Select";
import { COUNTRIES } from "@/types/product-form";
import { flagOf, countryName } from "@/lib/countries-dial";
import { fetchIconBindings, type BindingsMap } from "@/lib/visual-bindings";
import { BACK_CHROME } from "@/components/ui/PageHeader";
import RrIcon from "@/components/ui/RrIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import BoundIcon from "@/components/common/BoundIcon";
import Drawer from "@/components/kds/Drawer";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
/* ── one glyph per concept on the Packing & Logistics sheet ──
   Listed together so a repeat is visible at a glance: an icon that appears
   twice tells the eye two different facts are the same fact, which is exactly
   what the old label-guessing did when half the rows fell back to one circle. */
import BoxIcon from "@/components/icons/ui/BoxIcon";            // packing type
import TruckIcon from "@/components/icons/ui/TruckIcon";        // the tab itself
/* Customs is a border authority, not a planet — and the globe shares its outer
   circle with the clock used for lead time, so at 20px the two read as the
   same round mark. A landmark says "customs house" and cannot be mistaken for
   anything else on the sheet. */
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";  // Origin & Customs card
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";    // one crate (package tile)
import ShipIcon from "@/components/icons/ui/ShipIcon";          // Loading card
import PlaneIcon from "@/components/icons/ui/PlaneIcon";        // volumetric (air)
import FlaskConicalIcon from "@/components/icons/ui/FlaskConicalIcon"; // wood treatment
import FlagIcon from "@/components/icons/ui/FlagIcon";          // country of origin
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";  // HS code
import FileCheckIcon from "@/components/icons/ui/FileCheckIcon";// origin certificate
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon"; // regulated
import ShoppingCartIcon from "@/components/icons/ui/ShoppingCartIcon";       // MOQ
import ClockIcon from "@/components/icons/ui/ClockIcon";        // lead time
import AnchorIcon from "@/components/icons/ui/AnchorIcon";      // port of loading
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";// machine dimensions
import ScaleIcon from "@/components/icons/ui/ScaleIcon";        // machine weight
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";   // Fulfillment card
import InboxRawIcon from "@/components/icons/ui/InboxRawIcon";  // item: inner box
import PlugIcon from "@/components/icons/ui/PlugIcon";          // item: cable
import ShieldIcon from "@/components/icons/ui/ShieldIcon";      // item: cover
import CogIcon from "@/components/icons/ui/CogIcon";            // item: spare parts
import DocumentIcon from "@/components/icons/ui/DocumentIcon";  // item: manual
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";  // item: blades
import Link2Icon from "@/components/icons/ui/Link2Icon";        // item: fasteners
import TableIcon from "@/components/icons/ui/TableIcon";        // item: frame / rails
import CpuIcon from "@/components/icons/ui/CpuIcon";            // item: electronics
import DropletsIcon from "@/components/icons/ui/DropletsIcon";  // item: oil / consumables
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";// item: wheels
import RulerIcon from "@/components/icons/ui/RulerIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import TabStrip from "@/components/ui/TabStrip";
import { useTabMotion } from "@/components/ui/useTabMotion";
import { Group, StatTile, FactChip, CalcBadge, INP_B, SEG, SEG_ON, SEG_OFF } from "./profile/primitives";
/* ⚠️ TWELVE TABS, ONE ON SCREEN — SO ELEVEN OF THEM ARE DEFERRED.
   Every sheet was a static import, so opening ANY product downloaded all of
   them: Hero 54 KB, Supplier 49, Price 32, Options 30, Compliance 25,
   Variants 24, Specs 23, Media 21, Knowledge 13, Review 12 — 283 KB of
   source for panels the operator had not asked for. Measured: /product-data/
   [id] was 1,257 KB against the list's 698, and the route carried no budget
   at all, which is how it got there unnoticed.

   ClassifySheet stays EAGER because `step` starts at 0 and STEPS[0] is
   "classify" — the landing tab must never wait on a chunk.

   This splits for real: the split has to happen inside a "use client" module
   or Next ships every client reference the route declares anyway (the trap
   recorded in project_route_client_reference_preload), and this file is one.
   Verified on a PRODUCTION build, not dev.

   No `loading` placeholder on purpose — a reserved-height box that collapses
   to the real panel is the CLS mistake this screen's list sibling already
   paid for. Instead the tabs are WARMED below once the screen is quiet, so
   the chunk is in cache before anyone clicks. */
import ClassifySheet from "./profile/ClassifySheet";

const PriceSheet      = dynamic(() => import("./profile/PriceSheet"));
const HeroSheet       = dynamic(() => import("./profile/HeroSheet"));
const ComplianceSheet = dynamic(() => import("./profile/ComplianceSheet"));
const SupplierSheet   = dynamic(() => import("./profile/SupplierSheet"));
const VariantsSheet   = dynamic(() => import("./profile/VariantsSheet"));
const OptionsSheet    = dynamic(() => import("./profile/OptionsSheet"));
const SpecsSheet      = dynamic(() => import("./profile/SpecsSheet"));
const KnowledgeSheet  = dynamic(() => import("./profile/KnowledgeSheet"));
const MediaSheet      = dynamic(() => import("./profile/MediaSheet"));
const ReviewSheet     = dynamic(() => import("./profile/ReviewSheet"));

/* The same import specifiers again, as thunks. Calling these warms the exact
   chunks the components above will ask for — webpack dedupes on the specifier,
   so a warmed tab opens from cache. */
const SHEET_CHUNKS = [
  () => import("./profile/PriceSheet"),
  () => import("./profile/HeroSheet"),
  () => import("./profile/ComplianceSheet"),
  () => import("./profile/SupplierSheet"),
  () => import("./profile/VariantsSheet"),
  () => import("./profile/OptionsSheet"),
  () => import("./profile/SpecsSheet"),
  () => import("./profile/KnowledgeSheet"),
  () => import("./profile/MediaSheet"),
  () => import("./profile/ReviewSheet"),
];
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";
import { whenNetworkQuiet } from "@/lib/net-idle";
import FeatureHighlightsDisplay from "./FeatureHighlightsDisplay";
import {
  CONTAINERS, DG_KINDS, ORIGIN_CERTIFICATES, PACKING_TYPES, WOOD_TREATMENTS,
  loadPlan, sumPackages, type ContentItem, type PackageRow, type ProductLogistics,
} from "@/lib/logistics";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

/* ── Translation ──────────────────────────────────────────────────────────
   Per-file dictionary merged over PRODUCTS_UI_I18N, so the media slot labels
   (media.slot.*) and the shared action keys resolve from the editor's own
   dictionary and only the record's labels live here. */
const PROFILE_T: Record<string, { en: string; zh: string; ar: string }> = {
  "pp.untitled":      { en: "Untitled product",   zh: "未命名产品",     ar: "منتج بلا اسم" },
  "pp.noCode":        { en: "no code",            zh: "无编码",         ar: "بلا كود" },
  "pp.hidden":        { en: "Hidden",             zh: "已隐藏",         ar: "مخفي" },
  "pp.publicPage":    { en: "Public page",        zh: "客户页面",       ar: "صفحة العميل" },
  "pp.back":          { en: "Back to Product Data", zh: "返回产品数据", ar: "رجوع إلى بيانات المنتجات" },
  "pp.notSet":        { en: "Not set",            zh: "未填写",         ar: "غير محدّد" },
  "pp.untitledVariant": { en: "Untitled variant", zh: "未命名型号", ar: "موديل بلا اسم" },
  /* Price tab */
  "pr.landed":        { en: "Landed cost",        zh: "到岸成本",       ar: "التكلفة الواصلة" },
  "pr.landedSame":    { en: "Same as the factory cost — nothing to add.", zh: "与工厂成本相同，无需加项。", ar: "نفس تكلفة المصنع — لا إضافات." },
  "pr.source":        { en: "Cost source",        zh: "成本来源",       ar: "مصدر التكلفة" },
  "pr.onVariant":     { en: "On the variant",     zh: "记录在型号上",   ar: "على الموديل" },
  "pr.noLink":        { en: "No supplier linked yet — once one is linked the cost moves onto it.", zh: "尚未关联供应商——关联后成本将记录在供应商上。", ar: "لا مورّد مرتبط بعد — عند ربط مورّد تنتقل التكلفة إليه." },
  "pr.basis":         { en: "Cost basis",         zh: "成本口径",       ar: "أساس التكلفة" },
  "pr.basisOnSupplier": { en: "Set on the Supplier tab", zh: "在供应商标签页设置", ar: "يُحدَّد في تبويب المورّد" },
  "pr.tax":           { en: "Tax",                zh: "税",             ar: "الضريبة" },
  "pr.taxAdded":      { en: "{n}% VAT added to the landed cost", zh: "到岸成本已加 {n}% 增值税", ar: "أُضيفت ضريبة {n}% إلى التكلفة الواصلة" },
  "pr.taxMissing":    { en: "VAT rate not entered — enter it on the Supplier tab.", zh: "未填写增值税率——请在供应商标签页填写。", ar: "نسبة الضريبة غير مدخلة — أدخلها في تبويب المورّد." },
  "pr.noCost":        { en: "No factory cost yet — the Base FOB and market prices below need it.", zh: "尚无工厂成本——下方的基础 FOB 与市场价需要它。", ar: "لا تكلفة مصنع بعد — سعر FOB الأساس وأسعار الأسواق أدناه تحتاجها." },
  "pr.options":       { en: "The supplier's price options", zh: "供应商的其他报价选项", ar: "خيارات أسعار المورّد" },
  "pr.baseNote":      { en: "From the landed cost and the product level, through Commercial Setup — change either and this moves.", zh: "由到岸成本与产品等级经商务设置推导——二者任一变动，此处随之变动。", ar: "من التكلفة الواصلة ومستوى المنتج عبر الإعداد التجاري — غيّر أيّاً منهما يتغيّر هذا." },
  "pr.marketNote":    { en: "The market and channel prices for the cost above, live from Commercial Setup.", zh: "上方成本对应的市场与渠道价格，实时来自商务设置。", ar: "أسعار الأسواق والقنوات للتكلفة أعلاه، مباشرة من الإعداد التجاري." },
  "pr.selling":       { en: "Selling prices",     zh: "售价",           ar: "أسعار البيع" },
  "pr.variantsN":     { en: "{n} variants",       zh: "{n} 个型号",     ar: "{n} موديل" },
  "pr.variant1":      { en: "1 variant",          zh: "1 个型号",       ar: "موديل واحد" },
  "pp.certWord":      { en: "cert",               zh: "证书",           ar: "شهادة" },
  "sup.costNote":     { en: "Price note",         zh: "价格备注",       ar: "ملاحظة السعر" },
  "sp.freqHint":      { en: "Comma-separated — e.g. 50, 60", zh: "逗号分隔——例如 50, 60", ar: "مفصولة بفواصل — مثال: 50, 60" },
  /* Review tab */
  "rv.missingShort":  { en: "Missing",            zh: "缺少",           ar: "ناقص" },
  "rv.dim.data":      { en: "Specifications",     zh: "规格",           ar: "المواصفات" },
  "rv.dim.media":     { en: "Media",              zh: "媒体",           ar: "الوسائط" },
  "rv.dim.commercial": { en: "Commercial",        zh: "商务",           ar: "تجاري" },
  "rv.dim.technical": { en: "Technical",          zh: "技术",           ar: "تقني" },
  "rv.dim.website":   { en: "Website",            zh: "网站",           ar: "الموقع" },
  "rv.dim.ai":        { en: "AI",                 zh: "AI",             ar: "الذكاء الاصطناعي" },
  "rv.dim.brochure":  { en: "Brochure",           zh: "宣传册",         ar: "الكتيّب" },
  "rv.gapsTitle":     { en: "Before it goes live", zh: "上线前",          ar: "قبل النشر" },
  "rv.ready":         { en: "Ready",              zh: "就绪",           ar: "جاهز" },
  "rv.gapsN":         { en: "{n} missing",        zh: "缺 {n} 项",      ar: "{n} ناقص" },
  "rv.liveOk":        { en: "Live and nothing missing — the catalogue shows everything it wants.", zh: "已上线且无缺项——目录已展示所需的一切。", ar: "منشور ولا شيء ناقص — الكتالوج يعرض كل ما يحتاجه." },
  "rv.draftOk":       { en: "Nothing missing — this product can go live from the Hero tab.", zh: "无缺项——可从主页标签页上线。", ar: "لا شيء ناقص — يمكن نشر المنتج من تبويب الواجهة." },
  "rv.liveWithGaps":  { en: "This product is live while the items below are still missing.", zh: "该产品已上线，但以下项目仍缺失。", ar: "هذا المنتج منشور بينما العناصر التالية ما زالت ناقصة." },
  "rv.previewTitle":  { en: "Customer preview",   zh: "客户预览",       ar: "معاينة العميل" },
  "rv.previewBadge":  { en: "Public page · live", zh: "客户页面 · 实时", ar: "صفحة العميل · مباشر" },
  /* Media tab */
  "md.filesWord":     { en: "files",              zh: "个文件",         ar: "ملفات" },
  "md.addFiles":      { en: "Add files",          zh: "添加文件",       ar: "إضافة ملفات" },
  "md.altText":       { en: "Alt text / caption", zh: "替代文本 / 说明", ar: "نص بديل / تعليق" },
  "md.wholeProduct":  { en: "Whole product",      zh: "整个产品",       ar: "المنتج كله" },
  "md.tooBig":        { en: "{name} is over {mb} MB.", zh: "{name} 超过 {mb} MB。", ar: "{name} أكبر من {mb} ميجابايت." },
  "md.identityImages": { en: "Identity images",   zh: "标识图片",       ar: "صور الهوية" },
  "md.onHero":        { en: "edited on the Hero tab", zh: "在主页标签页编辑", ar: "تُعدَّل في تبويب الواجهة" },
  "md.noDocs":        { en: "No documents recorded.", zh: "未记录文档。", ar: "لا مستندات مسجّلة." },
  "md.type":          { en: "Type",               zh: "类型",           ar: "النوع" },
  "md.title":         { en: "Title",              zh: "标题",           ar: "العنوان" },
  "md.version":       { en: "Version",            zh: "版本",           ar: "الإصدار" },
  "md.language":      { en: "Language",           zh: "语言",           ar: "اللغة" },
  "md.needsFile":     { en: "Upload the file to keep this document.", zh: "请上传文件以保留此文档。", ar: "ارفع الملف للاحتفاظ بهذا المستند." },
  "md.addDoc":        { en: "Add document",       zh: "添加文档",       ar: "إضافة مستند" },
  "md.dt.user_manual": { en: "User Manual",       zh: "用户手册",       ar: "دليل المستخدم" },
  "md.dt.spare_parts_list": { en: "Spare Parts List", zh: "备件清单",   ar: "قائمة قطع الغيار" },
  "md.dt.exploded_view": { en: "Exploded View",   zh: "爆炸图",         ar: "رسم تفصيلي (Exploded)" },
  "md.dt.wiring_diagram": { en: "Wiring Diagram", zh: "接线图",         ar: "مخطط الأسلاك" },
  "md.dt.installation_guide": { en: "Installation Guide", zh: "安装指南", ar: "دليل التركيب" },
  "md.dt.brochure":   { en: "Brochure",           zh: "宣传册",         ar: "كتيّب" },
  "md.dt.catalog":    { en: "Catalog",            zh: "目录",           ar: "كتالوج" },
  "md.dt.certificate": { en: "Certificate",       zh: "证书",           ar: "شهادة" },
  "md.dt.test_report": { en: "Test Report",       zh: "测试报告",       ar: "تقرير اختبار" },
  "md.dt.packing_list": { en: "Packing List",     zh: "装箱单",         ar: "قائمة التعبئة" },
  "md.dt.dimension_drawing": { en: "Dimension Drawing", zh: "尺寸图",   ar: "رسم الأبعاد" },
  "md.dt.cad_3d":     { en: "3D CAD File",        zh: "3D CAD 文件",    ar: "ملف CAD ثلاثي الأبعاد" },
  /* Knowledge tab */
  "kn.blocksN":       { en: "{n} blocks",         zh: "{n} 个知识块",   ar: "{n} بلوكات" },
  "kn.none":          { en: "No knowledge blocks yet — press Edit to add the first.", zh: "尚无知识块——点击“编辑”添加第一个。", ar: "لا بلوكات معرفة بعد — اضغط تعديل لإضافة أول بلوك." },
  "kn.aiHigh":        { en: "High",               zh: "高",             ar: "عالٍ" },
  "kn.aiMed":         { en: "Medium",             zh: "中",             ar: "متوسط" },
  "kn.aiLow":         { en: "Low",                zh: "低",             ar: "منخفض" },
  "kn.linkedN":       { en: "{n} linked",         zh: "{n} 个关联",     ar: "{n} مرتبط" },
  "kn.noRelated":     { en: "No related products linked.", zh: "未关联相关产品。", ar: "لا منتجات مرتبطة." },
  "kn.searchPh":      { en: "Search a product to link…", zh: "搜索要关联的产品…", ar: "ابحث عن منتج لربطه…" },
  "rel.related":      { en: "Related",            zh: "相关",           ar: "مرتبط" },
  "rel.accessory":    { en: "Accessory",          zh: "配件",           ar: "ملحق" },
  "rel.spare_part":   { en: "Spare part",         zh: "备件",           ar: "قطعة غيار" },
  "rel.consumable":   { en: "Consumable",         zh: "耗材",           ar: "مستهلكات" },
  "rel.compatible_with": { en: "Compatible with", zh: "兼容",           ar: "متوافق مع" },
  "rel.required_addon": { en: "Required add-on",  zh: "必需附件",       ar: "إضافة إلزامية" },
  "rel.optional_attachment": { en: "Optional attachment", zh: "可选附件", ar: "ملحق اختياري" },
  "rel.upgrade":      { en: "Upgrade",            zh: "升级",           ar: "ترقية" },
  "rel.replaces":     { en: "Replaces",           zh: "替代",           ar: "يحل محل" },
  "rel.replaced_by":  { en: "Replaced by",        zh: "被…替代",        ar: "حلّ محله" },
  "rel.bundle":       { en: "Bundle",             zh: "套装",           ar: "حزمة" },
  /* Variants tab */
  /* Options tab */
  "opt.badgeN":       { en: "{n} questions",      zh: "{n} 个问题",     ar: "{n} أسئلة" },
  "opt.intro":        { en: "The questions a customer answers when ordering — each answer either links a product or carries its own price, weight and volume deltas.", zh: "客户下单时回答的问题——每个答案要么关联一个产品，要么带有自己的价格、重量和体积增量。", ar: "الأسئلة التي يجيب عنها العميل عند الطلب — كل إجابة إما تربط منتجاً أو تحمل فروق سعر ووزن وحجم خاصة بها." },
  "opt.none":         { en: "No buyer options yet.", zh: "尚无买家选项。", ar: "لا خيارات للمشتري بعد." },
  "opt.kind.choice":  { en: "Choice list",        zh: "选择列表",       ar: "قائمة اختيار" },
  "opt.kind.yes_no":  { en: "Yes / No",           zh: "是 / 否",        ar: "نعم / لا" },
  "opt.kind.info":    { en: "Info only",          zh: "仅说明",         ar: "معلومة فقط" },
  "opt.required":     { en: "Required",           zh: "必填",           ar: "إلزامي" },
  "opt.showOnlyWhen": { en: "Show only when",     zh: "仅当…时显示",    ar: "يظهر فقط عندما" },
  "opt.always":       { en: "Always",             zh: "始终",           ar: "دائماً" },
  "opt.questionPh":   { en: "Question — e.g. \"Stand thickness\"", zh: "问题——例如“台架厚度”", ar: "السؤال — مثال: \"سُمك الحامل\"" },
  "opt.answerPh":     { en: "Answer — e.g. \"2 mm\"", zh: "答案——例如“2 mm”", ar: "الإجابة — مثال: \"2 مم\"" },
  "opt.default":      { en: "Default",            zh: "默认",           ar: "الافتراضي" },
  "opt.deleteQuestion": { en: "Delete question",  zh: "删除问题",       ar: "حذف السؤال" },
  "opt.deleteAnswer": { en: "Delete answer",      zh: "删除答案",       ar: "حذف الإجابة" },
  "opt.addAnswer":    { en: "Add answer",         zh: "添加答案",       ar: "إضافة إجابة" },
  "opt.addQuestion":  { en: "Add question",       zh: "添加问题",       ar: "إضافة سؤال" },
  "opt.photoHint":    { en: "Click, drop or paste a photo", zh: "点击、拖放或粘贴照片", ar: "اضغط أو أفلت أو الصق صورة" },
  "opt.priceDelta":   { en: "Price +¥",           zh: "价格 +¥",        ar: "السعر +¥" },
  "opt.weightDelta":  { en: "Weight +kg",         zh: "重量 +kg",       ar: "الوزن +كجم" },
  "opt.cbmDelta":     { en: "Vol +cbm",           zh: "体积 +cbm",      ar: "الحجم +م³" },
  "opt.linkProduct":  { en: "Link a product",     zh: "关联产品",       ar: "ربط منتج" },
  "opt.linkedProduct": { en: "Linked product",    zh: "已关联产品",     ar: "منتج مرتبط" },
  "opt.linkedNoDeltas": { en: "price, weight and volume come from the linked product", zh: "价格、重量和体积来自关联产品", ar: "السعر والوزن والحجم من المنتج المرتبط" },
  "opt.unlink":       { en: "Unlink",             zh: "取消关联",       ar: "فكّ الربط" },
  "opt.noDelta":      { en: "No price, weight or volume change", zh: "无价格、重量或体积变化", ar: "لا تغيير في السعر أو الوزن أو الحجم" },
  "opt.searchPh":     { en: "Search products…",   zh: "搜索产品…",      ar: "ابحث عن منتجات…" },
  "opt.noMatch":      { en: "No products match.", zh: "没有匹配的产品。", ar: "لا منتجات مطابقة." },
  "vs.remove":        { en: "Remove variant",     zh: "移除型号",       ar: "إزالة الموديل" },
  "vs.codeOnHero":    { en: "The primary model's code is checked and approved on the Hero tab.", zh: "主型号编码在主页标签页校验并批准。", ar: "كود الموديل الأساسي يُفحص ويُعتمد في تبويب الواجهة." },
  "vs.addOverride":   { en: "+ Add a spec that differs on this model…", zh: "+ 添加此型号不同的规格…", ar: "+ أضف مواصفة تختلف في هذا الموديل…" },
  "vs.elsewhere":     { en: "Prices on the Price tab · packing on Packing & Logistics.", zh: "价格见“价格”标签页 · 包装见“包装与物流”。", ar: "الأسعار في تبويب السعر · التعبئة في تبويب التعبئة واللوجستيات." },
  /* Classify tab */
  "cl.pickDivision":  { en: "Pick a division…",   zh: "选择事业部…",     ar: "اختر القسم…" },
  "cl.pickCategory":  { en: "Pick a category…",   zh: "选择类别…",       ar: "اختر الفئة…" },
  "cl.pickSubcategory": { en: "Pick a subcategory…", zh: "选择子类别…",   ar: "اختر الفئة الفرعية…" },
  "cl.divisionFirst": { en: "Pick the division first", zh: "请先选择事业部", ar: "اختر القسم أولاً" },
  "cl.categoryFirst": { en: "Pick the category first", zh: "请先选择类别",  ar: "اختر الفئة أولاً" },
  "cl.loading":       { en: "Loading…",           zh: "加载中…",         ar: "جارٍ التحميل…" },
  "cl.templateNote":  { en: "The subcategory picks the spec template and the KOLEEX code prefix — change it and the Specs tab follows.", zh: "子类别决定规格模板与 KOLEEX 编码前缀——更改后规格标签页随之变化。", ar: "الفئة الفرعية تحدد قالب المواصفات وبادئة كود KOLEEX — غيّرها ويتبعها تبويب المواصفات." },
  "cl.familyNote":    { en: "The product and its models on the Variants tab.", zh: "产品及其型号见“型号”标签页。", ar: "المنتج وموديلاته في تبويب الموديلات." },
  "cl.levelOnHero":   { en: "Set on the Hero tab (market tier).", zh: "在主页标签页设置（市场等级）。", ar: "يُحدَّد في تبويب الواجهة (المستوى السوقي)." },
  /* Compliance tab */
  "cw.partsOnly":     { en: "Parts only",         zh: "仅零件",          ar: "قطع الغيار فقط" },
  "cw.partsLabour":   { en: "Parts & labour",     zh: "零件与人工",      ar: "قطع الغيار والعمالة" },
  "cw.onSite":        { en: "On-site",            zh: "上门服务",        ar: "في الموقع" },
  "cw.shipment":      { en: "Shipment",           zh: "发货日",          ar: "تاريخ الشحن" },
  "cw.installation":  { en: "Installation",       zh: "安装日",          ar: "تاريخ التركيب" },
  "cw.invoice":       { en: "Invoice date",       zh: "发票日期",        ar: "تاريخ الفاتورة" },
  "cw.ch.Phone":      { en: "Phone",              zh: "电话",            ar: "هاتف" },
  "cw.ch.Email":      { en: "Email",              zh: "电子邮件",        ar: "بريد إلكتروني" },
  "cw.ch.WeChat":     { en: "WeChat",             zh: "微信",            ar: "WeChat" },
  "cw.ch.WhatsApp":   { en: "WhatsApp",           zh: "WhatsApp",        ar: "واتساب" },
  "cw.ch.On-site":    { en: "On-site",            zh: "上门",            ar: "في الموقع" },
  "cw.ch.Remote":     { en: "Remote",             zh: "远程",            ar: "عن بُعد" },
  "pp.f.sparesStock": { en: "Spare parts stock",  zh: "备件库存",        ar: "مخزون قطع الغيار" },
  "cc.add":           { en: "Add certificate",    zh: "添加证书",        ar: "إضافة شهادة" },
  "cc.none":          { en: "No certificate recorded.", zh: "未记录证书。", ar: "لا شهادات مسجّلة." },
  "cc.type":          { en: "Type",               zh: "类型",            ar: "النوع" },
  "cc.standard":      { en: "Standard",           zh: "标准",            ar: "المعيار" },
  "cc.number":        { en: "Certificate no.",    zh: "证书编号",        ar: "رقم الشهادة" },
  "cc.issuer":        { en: "Issuer",             zh: "签发机构",        ar: "جهة الإصدار" },
  "cc.issued":        { en: "Issued",             zh: "签发日期",        ar: "تاريخ الإصدار" },
  "cc.expires":       { en: "Expires",            zh: "到期日期",        ar: "تاريخ الانتهاء" },
  "cc.remind":        { en: "Remind (days before)", zh: "提前提醒（天）", ar: "تذكير (أيام قبل الانتهاء)" },
  "cc.remindShort":   { en: "remind {n}d before", zh: "提前 {n} 天提醒",  ar: "تذكير قبلها بـ {n} يوم" },
  "cc.scope":         { en: "Country scope",      zh: "适用国家/地区",   ar: "نطاق الدول" },
  "cc.status":        { en: "Status",             zh: "状态",            ar: "الحالة" },
  "cc.st.active":     { en: "Active",             zh: "有效",            ar: "سارية" },
  "cc.st.pending":    { en: "Pending",            zh: "待定",            ar: "قيد الإصدار" },
  "cc.st.expired":    { en: "Expired",            zh: "已过期",          ar: "منتهية" },
  "cc.file":          { en: "Certificate file URL", zh: "证书文件链接",  ar: "رابط ملف الشهادة" },
  "cc.fileShort":     { en: "Certificate file",   zh: "证书文件",        ar: "ملف الشهادة" },
  "cc.verify":        { en: "Verification URL",   zh: "验证链接",        ar: "رابط التحقق" },
  "cc.verifyShort":   { en: "Verify online",      zh: "在线验证",        ar: "تحقق عبر الإنترنت" },
  "cc.notes":         { en: "Notes",              zh: "备注",            ar: "ملاحظات" },
  "cc.remove":        { en: "Remove",             zh: "移除",            ar: "إزالة" },
  /* Hero tab */
  "hs.posterBadge":   { en: "Public page",        zh: "客户页面",        ar: "صفحة العميل" },
  "hs.identityBadge": { en: "Status · Name · Code", zh: "状态 · 名称 · 编码", ar: "الحالة · الاسم · الكود" },
  "hs.mainPhotoHint": { en: "Click the photo to replace it — the gallery and the other slots are on the Media tab.", zh: "点击照片可替换——图库和其他槽位在媒体标签页。", ar: "اضغط على الصورة لاستبدالها — المعرض وباقي الخانات في تبويب الوسائط." },
  "hs.tierAuto":      { en: "Matches the policy's tier for this cost.", zh: "与该成本对应的政策等级一致。", ar: "يطابق مستوى السياسة لهذه التكلفة." },
  "hs.useTier":       { en: "Use it",             zh: "采用",            ar: "اعتمده" },
  "hs.codePrefix":    { en: "Prefix {p} from the subcategory.", zh: "前缀 {p} 来自子类别。", ar: "البادئة {p} من الفئة الفرعية." },
  "hs.code.auto_suggested": { en: "Auto",         zh: "自动",            ar: "تلقائي" },
  "hs.code.edited":   { en: "Edited",             zh: "已编辑",          ar: "معدَّل" },
  "hs.code.approved": { en: "Approved",           zh: "已批准",          ar: "معتمد" },
  "hs.code.locked":   { en: "Locked",             zh: "已锁定",          ar: "مقفول" },
  "hs.slugTaken":     { en: "This URL is already used by {p}.", zh: "该链接已被 {p} 使用。", ar: "هذا الرابط مستخدم بالفعل لـ {p}." },
  "hs.slugFree":      { en: "Available.",         zh: "可用。",          ar: "متاح." },
  "hs.taglinePh":     { en: "One line that sells it", zh: "一句话卖点",   ar: "سطر واحد يبيعه" },
  "hs.codesNote":     { en: "Drawn from the KOLEEX code and the public URL — nothing to type.", zh: "由 KOLEEX 编码与公开链接生成——无需输入。", ar: "مشتقّة من كود KOLEEX والرابط العام — لا شيء لتكتبه." },
  "hs.richText":      { en: "Rich text",          zh: "富文本",          ar: "نص منسّق" },
  "hs.identifiersBadge": { en: "Codes · Dates",   zh: "编码 · 日期",     ar: "أكواد · تواريخ" },
  "hs.gtinHelp":      { en: "EAN / UPC barcode number, if the product has one.", zh: "EAN / UPC 条码号（如有）。", ar: "رقم الباركود EAN / UPC إن وُجد." },
  "hs.revNote":       { en: "What changed",       zh: "变更内容",        ar: "ما الذي تغيّر" },
  "hs.addRevision":   { en: "Add revision",       zh: "添加版本",        ar: "إضافة مراجعة" },
  "hs.seoBadge":      { en: "SEO · OG",           zh: "SEO · OG",        ar: "SEO · OG" },
  "hs.metaTitle":     { en: "Meta title",         zh: "Meta 标题",       ar: "عنوان Meta" },
  "hs.metaTitleHelp": { en: "What search engines show as the page title — leave empty to use the product name.", zh: "搜索引擎显示的页面标题——留空则使用产品名称。", ar: "ما تعرضه محركات البحث كعنوان للصفحة — اتركه فارغاً لاستخدام اسم المنتج." },
  "hs.metaDesc":      { en: "Meta description",   zh: "Meta 描述",       ar: "وصف Meta" },
  "hs.metaDescHelp":  { en: "The two lines under the title in search results — leave empty to use the short description.", zh: "搜索结果中标题下的两行——留空则使用简短描述。", ar: "السطران تحت العنوان في نتائج البحث — اتركه فارغاً لاستخدام الوصف المختصر." },
  "hs.ogImage":       { en: "Social share image (OG)", zh: "社交分享图（OG）", ar: "صورة المشاركة الاجتماعية (OG)" },
  "hs.descTranslated": { en: "Full description translated", zh: "完整描述已翻译", ar: "الوصف الكامل مترجم" },
  "hs.descNotTranslated": { en: "Full description not translated", zh: "完整描述未翻译", ar: "الوصف الكامل غير مترجم" },
  "hero.translateUnsupported": { en: "Auto-translate covers Chinese and Arabic — type this one by hand.", zh: "自动翻译仅支持中文与阿拉伯语——请手动输入。", ar: "الترجمة الآلية تغطي الصينية والعربية — اكتب هذه يدوياً." },
  "pr.saveFailed":    { en: "Couldn't save — try again.", zh: "保存失败——请重试。", ar: "تعذّر الحفظ — حاول مرة أخرى." },
  "pr.conflict":      { en: "This variant was changed by someone else — reload and try again.", zh: "该型号已被他人修改——请刷新后重试。", ar: "عدّل شخص آخر هذا الموديل — أعد التحميل وحاول مجدداً." },
  "pp.yes":           { en: "Yes",                zh: "是",             ar: "نعم" },
  "pp.no":            { en: "No",                 zh: "否",             ar: "لا" },
  "pp.primary":       { en: "Primary",            zh: "主要",           ar: "أساسي" },
  "pp.collapse":      { en: "Collapse",           zh: "收起",           ar: "طيّ" },
  "pp.expand":        { en: "Expand",             zh: "展开",           ar: "توسيع" },
  "pp.fam.label":     { en: "Family",             zh: "系列",           ar: "العائلة" },
  "pp.fam.membersOne":{ en: "model",              zh: "个型号",         ar: "موديل" },
  "pp.fam.members":   { en: "models",             zh: "个型号",         ar: "موديلات" },
  "pp.fam.differs":   { en: "Differs from family value", zh: "与系列值不同", ar: "يختلف عن قيمة العائلة" },
  "pp.fam.diffCount": { en: "differences",        zh: "项差异",         ar: "فروقات" },
  "pp.fam.inheritNote":{ en: "Fields without a dot inherit the family value.", zh: "未标点的字段继承系列值。", ar: "الحقول بدون نقطة ترث قيمة العائلة." },
  "pp.fam.allInherit":{ en: "This model inherits every family specification.", zh: "该型号继承系列的全部规格。", ar: "هذا الموديل يرث كل مواصفات العائلة." },
  "pp.fam.close":     { en: "Close model view",   zh: "关闭型号视图",   ar: "إغلاق عرض الموديل" },
  "pp.fam.resolved":  { en: "Specifications for this model", zh: "该型号的规格", ar: "مواصفات هذا الموديل" },
  /* sections */
  "pp.sec.classification": { en: "Classification", zh: "分类",          ar: "التصنيف" },
  "pp.sec.supplier":  { en: "Supplier & Sourcing", zh: "供应商与采购",  ar: "المورّد والتوريد" },
  "pp.sec.identity":  { en: "Identity & lifecycle", zh: "标识与生命周期", ar: "الهوية ودورة الحياة" },
  "pp.sec.description": { en: "Description",      zh: "描述",           ar: "الوصف" },
  "pp.sec.languages": { en: "Languages & markets", zh: "语言与市场",    ar: "اللغات والأسواق" },
  "pp.sec.specs":     { en: "Specifications",     zh: "技术规格",       ar: "المواصفات" },
  "pp.sec.variants":  { en: "Variants",           zh: "型号",           ar: "المتغيّرات" },
  "pp.sec.price":     { en: "Cost & Price",       zh: "成本与价格",     ar: "التكلفة والسعر" },
  "pp.sec.logistics": { en: "Packing & Logistics", zh: "包装与物流",    ar: "التعبئة واللوجستيات" },
  "pp.sec.compliance": { en: "Compliance & Warranty", zh: "合规与保修", ar: "المطابقة والضمان" },
  "pp.sec.media":     { en: "Media & Documents",  zh: "媒体与文件",     ar: "الوسائط والمستندات" },
  "pp.sec.knowledge": { en: "Knowledge & Relationships", zh: "知识与关联", ar: "المعرفة والعلاقات" },
  "pp.sec.readiness": { en: "Readiness",          zh: "完整度",         ar: "الجاهزية" },
  "pp.sec.record":    { en: "Record",             zh: "记录信息",       ar: "بيانات السجل" },
  /* fields */
  "pp.f.division":    { en: "Division",           zh: "事业部",         ar: "القطاع" },
  "pp.f.category":    { en: "Category",           zh: "类别",           ar: "الفئة" },
  "pp.f.subcategory": { en: "Subcategory",        zh: "子类别",         ar: "الفئة الفرعية" },
  "pp.f.subCode":     { en: "Subcategory code",   zh: "子类别编码",     ar: "كود الفئة الفرعية" },
  "pp.f.family":      { en: "Family",             zh: "产品系列",       ar: "العائلة" },
  "pp.f.level":       { en: "Level",              zh: "等级",           ar: "المستوى" },
  "pp.f.template":    { en: "Spec template",      zh: "规格模板",       ar: "قالب المواصفات" },
  "pp.f.supCode":     { en: "Supplier product code", zh: "供应商产品编码", ar: "كود المنتج لدى المورّد" },
  "pp.f.supName":     { en: "Supplier product name", zh: "供应商产品名称", ar: "اسم المنتج لدى المورّد" },
  "pp.f.unitCost":    { en: "Unit cost (CNY)",    zh: "单位成本(元)",   ar: "تكلفة الوحدة (يوان)" },
  "pp.f.supplyType":  { en: "Supply type",        zh: "供应类型",       ar: "نوع التوريد" },
  "pp.f.incoterms":   { en: "Incoterms",          zh: "贸易术语",       ar: "شروط التسليم" },
  "pp.f.sourcing":    { en: "Sourcing status",    zh: "采购状态",       ar: "حالة التوريد" },
  "pp.f.sampleAvail": { en: "Sample available",   zh: "可提供样品",     ar: "عيّنة متاحة" },
  "pp.f.supWarranty": { en: "Supplier warranty (months)", zh: "供应商保修(月)", ar: "ضمان المورّد (شهور)" },
  "pp.f.productName": { en: "Product name",       zh: "产品名称",       ar: "اسم المنتج" },
  "pp.f.publicUrl":   { en: "Public URL",         zh: "公开网址",       ar: "الرابط العام" },
  "pp.f.brand":       { en: "Brand",              zh: "品牌",           ar: "العلامة" },
  "pp.f.manufacturer": { en: "Manufacturer",      zh: "制造商",         ar: "الصانع" },
  "pp.f.mpn":         { en: "MPN",                zh: "制造商编号",     ar: "رقم الصانع" },
  "pp.f.gtin":        { en: "GTIN",               zh: "全球贸易项目代码", ar: "رمز GTIN" },
  "pp.f.sku":         { en: "Internal SKU",       zh: "内部SKU",        ar: "رمز داخلي" },
  "pp.f.legacy":      { en: "Legacy code",        zh: "旧编码",         ar: "الكود القديم" },
  "pp.f.generation":  { en: "Generation",         zh: "代次",           ar: "الجيل" },
  "pp.f.modelYear":   { en: "Model year",         zh: "年款",           ar: "سنة الطراز" },
  "pp.f.launch":      { en: "Launch date",        zh: "上市日期",       ar: "تاريخ الإطلاق" },
  "pp.f.eol":         { en: "End of life",        zh: "停产日期",       ar: "نهاية العمر" },
  "pp.f.availFrom":   { en: "Available from",     zh: "可供货日期",     ar: "متاح من" },
  "pp.f.lastOrder":   { en: "Last order date",    zh: "最后订购日",     ar: "آخر موعد للطلب" },
  "pp.f.aliases":     { en: "Alternate names",    zh: "别名",           ar: "أسماء بديلة" },
  "pp.f.statusReason": { en: "Status reason",     zh: "状态原因",       ar: "سبب الحالة" },
  "pp.f.featured":    { en: "Featured",           zh: "精选",           ar: "مميّز" },
  "pp.f.visible":     { en: "Visible to customers", zh: "对客户可见",   ar: "ظاهر للعملاء" },
  "pp.f.excerpt":     { en: "Short description",  zh: "简短描述",       ar: "وصف مختصر" },
  "pp.f.description": { en: "Full description",   zh: "完整描述",       ar: "الوصف الكامل" },
  "pp.f.highlights":  { en: "Highlights",         zh: "亮点",           ar: "أبرز المزايا" },
  "pp.f.tags":        { en: "Tags",               zh: "标签",           ar: "الوسوم" },
  "pp.f.variantName": { en: "Variant name",       zh: "型号名称",       ar: "اسم المتغيّر" },
  "pp.f.koleexCode":  { en: "KOLEEX code",        zh: "KOLEEX 编码",    ar: "كود كوليكس" },
  "pp.f.supRef":      { en: "Supplier reference", zh: "供应商型号",     ar: "مرجع المورّد" },
  "pp.f.tagline":     { en: "Tagline",            zh: "标语",           ar: "العبارة التعريفية" },
  "pp.f.stock":       { en: "Stock status",       zh: "库存状态",       ar: "حالة المخزون" },
  "pp.f.barcode":     { en: "Barcode",            zh: "条形码",         ar: "الباركود" },
  "pp.f.status":      { en: "Status",             zh: "状态",           ar: "الحالة" },
  "pp.f.costMeta":    { en: "Updated {date} by {name} · via {src}", zh: "{date} 由 {name} 更新 · 来自{src}", ar: "حُدّثت {date} بواسطة {name} · عبر {src}" },
  "pp.f.costHistory": { en: "Cost history", zh: "成本历史", ar: "سجل التكلفة" },
  "pp.h.empty":       { en: "No cost changes recorded for this variant yet.", zh: "此型号尚无成本变更记录。", ar: "لا توجد تغييرات تكلفة مسجّلة لهذا الموديل بعد." },
  "pp.h.src.quotation_module": { en: "Quotation", zh: "报价单", ar: "عرض السعر" },
  "pp.h.src.product_form":     { en: "Product Data", zh: "产品数据", ar: "بيانات المنتجات" },
  "pp.f.pricingMode": { en: "Pricing mode",       zh: "定价方式",       ar: "طريقة التسعير" },
  "pp.f.priceNote":   { en: "Price note",         zh: "价格说明",       ar: "ملاحظة السعر" },
  "pp.f.costPrice":   { en: "Cost price (CNY)",   zh: "成本价(元)",     ar: "سعر التكلفة (يوان)" },
  "pp.f.globalPrice": { en: "Global price (USD)", zh: "全球价(美元)",   ar: "السعر العالمي (دولار)" },
  "pp.f.headPrice":   { en: "Head-only price",    zh: "机头价",         ar: "سعر الرأس فقط" },
  "pp.f.setPrice":    { en: "Complete-set price", zh: "整套价",         ar: "سعر الطقم الكامل" },
  "pp.f.moq":         { en: "MOQ",                zh: "最小起订量",     ar: "أقل كمية" },
  "pp.f.leadTime":    { en: "Lead time",          zh: "交货周期",       ar: "مدة التوريد" },
  "pp.f.origin":      { en: "Country of origin",  zh: "原产国",         ar: "بلد المنشأ" },
  "pp.f.hs":          { en: "HS code",            zh: "海关编码",       ar: "الرمز الجمركي" },
  "pp.f.machineWeight": { en: "Net weight (N.W.)", zh: "净重 (N.W.)", ar: "الوزن الصافي (N.W.)" },
  "pp.f.machineDims": { en: "Machine dimensions — net, without packing", zh: "机器尺寸 — 净尺寸，不含包装", ar: "أبعاد الماكينة — صافي بدون تغليف" },
  "pp.f.packingTitle": { en: "Primary variant packing", zh: "主型号包装", ar: "تغليف المتغيّر الأساسي" },
  /* Read-side labels for products.logistics (2026-09-13). The profile used to
     print "Primary variant packing" over variant columns; when the product
     carries its own packing the heading has to say so. */
  "pp.f.packingTitleProduct": { en: "Packing & shipment", zh: "包装与发运", ar: "التعبئة والشحن" },
  "pp.f.packingPhotoAlt":     { en: "Packed product", zh: "已包装产品", ar: "المنتج بعد التغليف" },
  "pp.f.woodTreatment":       { en: "Wood treatment", zh: "木材处理", ar: "معالجة الخشب" },
  "pp.f.packages":            { en: "Packages", zh: "包装件数", ar: "الطرود" },
  "pp.f.portOfLoading":       { en: "Port of loading", zh: "装运港", ar: "ميناء الشحن" },
  "pp.f.originCert":          { en: "Origin certificate", zh: "原产地证书", ar: "شهادة المنشأ" },
  "pp.f.regulated":           { en: "Regulated content", zh: "受管制内容物", ar: "محتوى خاضع لقيود" },
  "pp.f.packingEmpty":        { en: "Nothing entered yet. Open Edit to add the crate, its contents, weights and container quantities.", zh: "尚未填写。点击“编辑”添加木箱、箱内清单、重量与装柜数量。", ar: "لسه مفيش حاجة مكتوبة. افتح تعديل عشان تضيف الصندوق ومحتوياته والأوزان وكميات الحاويات." },
  "pp.sec.machine":           { en: "Machine (bare)", zh: "整机（裸机）", ar: "الماكينة (بدون تغليف)" },
  "pp.f.netWeight":   { en: "Net weight (N.W.)",  zh: "净重 (N.W.)",     ar: "الوزن الصافي (N.W.)" },
  "pp.f.grossWeight": { en: "Gross weight (G.W.)", zh: "毛重 (G.W.)",   ar: "الوزن القائم (G.W.)" },
  "pp.f.cbm":         { en: "CBM",                zh: "体积(立方米)",   ar: "الحجم (م³)" },
  "pp.f.carton":      { en: "Carton dimensions",  zh: "箱规",           ar: "أبعاد الكرتونة" },
  "pp.f.packingType": { en: "Packing type",       zh: "包装方式",       ar: "نوع التغليف" },
  "pp.f.q20":         { en: "20ft qty",           zh: "20尺柜数量",     ar: "كمية ٢٠ قدم" },
  "pp.f.q40":         { en: "40ft qty",           zh: "40尺柜数量",     ar: "كمية ٤٠ قدم" },
  "pp.f.q40hq":       { en: "40HQ qty",           zh: "40高柜数量",     ar: "كمية ٤٠ عالي" },
  "pp.f.warrMonths":  { en: "Warranty (months)",  zh: "保修(月)",       ar: "الضمان (شهور)" },
  "pp.f.warrType":    { en: "Warranty type",      zh: "保修类型",       ar: "نوع الضمان" },
  "pp.f.warrStart":   { en: "Starts from",        zh: "起算方式",       ar: "يبدأ من" },
  "pp.f.warrCover":   { en: "Coverage",           zh: "保修范围",       ar: "التغطية" },
  "pp.f.warrExcl":    { en: "Exclusions",         zh: "不保范围",       ar: "الاستثناءات" },
  "pp.f.ce":          { en: "CE certified",       zh: "CE认证",         ar: "شهادة CE" },
  "pp.f.rohs":        { en: "RoHS compliant",     zh: "RoHS合规",       ar: "مطابق RoHS" },
  "pp.f.spares":      { en: "Spare parts availability", zh: "备件供应", ar: "توفّر قطع الغيار" },
  "pp.f.serviceLife": { en: "Service life",       zh: "使用寿命",       ar: "العمر التشغيلي" },
  "pp.f.maintenance": { en: "Maintenance interval", zh: "保养周期",     ar: "دورية الصيانة" },
  "pp.f.support":     { en: "Technical support",  zh: "技术支持",       ar: "الدعم الفني" },
  "pp.f.channels":    { en: "Support channels",   zh: "支持渠道",       ar: "قنوات الدعم" },
  "pp.f.training":    { en: "Training available", zh: "提供培训",       ar: "تدريب متاح" },
  "pp.f.installation": { en: "Installation service", zh: "安装服务",    ar: "خدمة التركيب" },
  "pp.f.returns":     { en: "Returns policy",     zh: "退货政策",       ar: "سياسة الإرجاع" },
  "pp.f.knowledge":   { en: "Knowledge blocks",   zh: "知识条目",       ar: "كتل المعرفة" },
  "pp.f.productId":   { en: "Product id",         zh: "产品ID",         ar: "معرّف المنتج" },
  "pp.f.created":     { en: "Created",            zh: "创建时间",       ar: "تاريخ الإنشاء" },
  "pp.f.updated":     { en: "Last updated",       zh: "最后更新",       ar: "آخر تحديث" },
  "pp.f.schemaVer":   { en: "Schema version",     zh: "模板版本",       ar: "إصدار القالب" },
  "pp.f.supPhoto":    { en: "Supplier product photo", zh: "供应商产品照片", ar: "صورة المنتج لدى المورّد" },
  "pp.f.costFromSupplier": { en: "From the supplier link — not set on this variant.", zh: "来自供应商关联 — 该型号未单独填写。", ar: "من رابط المورّد — غير محدّد على هذا المتغيّر." },
  "pp.f.classification": { en: "Classification", zh: "分类", ar: "التصنيف" },
  "pp.f.heroPoster":  { en: "Hero poster",        zh: "首页海报",       ar: "بوستر الواجهة" },
  "pp.f.brandMark":   { en: "Brand mark",         zh: "品牌标识",       ar: "علامة العلامة التجارية" },
  /* empty-state lines */
  "pp.e.noSupplier":  { en: "No supplier linked.", zh: "未关联供应商。", ar: "لا يوجد مورّد مرتبط." },
  "pp.e.noVariant":   { en: "No variant recorded — a product needs at least one.", zh: "尚无型号 — 产品至少需要一个。", ar: "لا يوجد متغيّر — المنتج يحتاج واحداً على الأقل." },
  "pp.e.noTemplate":  { en: "No spec template resolves for this classification, so there are no specification fields to fill.", zh: "该分类未匹配规格模板，因此没有可填写的规格字段。", ar: "لا يوجد قالب مواصفات لهذا التصنيف، فلا توجد حقول مواصفات لتعبئتها." },
  "pp.e.noScore":     { en: "No spec template resolves, so completeness can't be scored.", zh: "未匹配规格模板，无法计算完整度。", ar: "لا يوجد قالب مواصفات، فلا يمكن حساب نسبة الاكتمال." },
  "pp.e.englishOnly": { en: "English only — no localized names recorded.", zh: "仅英文 — 未录入本地化名称。", ar: "الإنجليزية فقط — لا توجد أسماء مترجمة." },
  "pp.e.noPrice":     { en: "No variant to price.", zh: "没有可定价的型号。", ar: "لا يوجد متغيّر للتسعير." },
};

/* ── shapes (loose on purpose: the products table is column-agnostic) ── */
type Row = Record<string, unknown>;
interface Profile {
  product: Row;
  subcategory: { slug: string; code: string; name: string } | null;
  schema: { name: string; version: string; groups: Array<{ key?: string; title?: string; fields?: Array<{ key: string; label?: string; unit?: string; description?: string; required?: boolean; publicVisible?: boolean; aiReadable?: boolean; internalOnly?: boolean }> }> } | null;
  models: Row[];
  media: Row[];
  translations: Row[];
  suppliers: Array<Row & { supplier: { name: string; logo: string | null } | null }>;
  certifications: Row[];
  documents: Row[];
  related: Array<Row & { product: { name: string; slug: string | null } | null }>;
  readiness: { overall: number; dimensions?: Array<{ dimension?: string; key?: string; label?: string; score: number; filled?: number; total?: number; missing?: Array<{ key: string; label: string }> }> } | null;
  costVisible: boolean;
}

/* ── value rendering ──────────────────────────────────────────────────────
   The whole point of this page is that a blank is information. Empty values
   render as a dim "Not set" rather than collapsing the row away. */
/* The empty placeholder is set once per render from the active language —
   threading it through ~90 <Field/> call sites would be pure noise. */
let NOT_SET = "Not set";


/* ── Row icons — ALWAYS from the Visual Library (Database app), never
   hand-authored (owner standing rule). Monochrome CSS-mask so the SVG
   inherits the label's ghost tone in both themes. iconForLabel() keyword-
   matches the (translated) label so EVERY row in EVERY tab gets a glyph
   automatically — new fields inherit one with zero wiring. */
const VL_BASE = "https://yxyizbnfjrwrnmwhkvme.supabase.co/storage/v1/object/public/media/visual-library/";

let BINDINGS_SNAPSHOT: Record<string, string> = {};

function RowGlyph({ src, className = "h-3 w-3" }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-middle ${className}`}
      style={{ maskImage: `url("${src}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${src}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

/* WHAT THIS TABLE IS FOR, AND WHAT IT MUST NOT DO. It guesses a glyph from a
   field's LABEL. Guessing is acceptable; pretending to know is not — an
   unmatched label used to fall through to `status`, whose glyph is the generic
   info circle, so ONE mark was drawn 56 times across this page for fields that
   have nothing to do with each other. A repeated icon is not an icon, it is
   texture, and it teaches the eye that the marks mean nothing. Unmatched now
   yields no key, no glyph and no tile — the label carries the row on its own. */
const FIELD_KEY_RULES: Array<[RegExp, string]> = [
  [/visible|visibility/i, "visible"],
  [/manufacturer|factory/i, "supplier"],
  [/mpn|gtin|legacy code|product id/i, "barcode"],
  [/generation|model year|schema version|version/i, "level"],
  [/end of life|available from|starts from/i, "dates"],
  [/tags|highlights/i, "knowledge"],
  /* NOT mapped to "warranty": coverage, exclusions, returns, service life,
     maintenance, support, training and installation are eight different
     questions, and pointing them all at the shield only moved the duplication
     from one glyph to another — eleven identical shields down the Compliance
     tab. Until each has a mark of its own in the Visual Library they carry
     none, which at least does not claim they are the same thing. */
  [/featured/i, "featured"],
  [/readiness/i, "readiness"],
  [/status|lifecycle/i, "status"],
  [/level/i, "level"],
  [/division/i, "division"],
  [/subcategory code|category code|koleex code|^code|model code/i, "koleex_code"],
  [/barcode/i, "barcode"],
  [/subcategory/i, "subcategory"],
  [/category/i, "category"],
  [/family/i, "family"],
  [/template/i, "spec_template"],
  [/supplier product code|reference/i, "supplier_code"],
  [/supplier/i, "supplier"],
  [/url|slug|link/i, "public_url"],
  [/brand/i, "brand"],
  [/tagline/i, "tagline"],
  [/excerpt|short description/i, "excerpt"],
  [/description/i, "description"],
  [/price note/i, "price_note"],
  [/note/i, "notes"],
  [/name|title/i, "product_name"],
  [/cost/i, "cost_price"],
  [/pricing mode/i, "pricing_mode"],
  [/price/i, "price"],
  [/margin|percent|tax|vat/i, "tax"],
  [/moq/i, "moq"],
  [/stock|quantity/i, "stock"],
  [/lead|time/i, "lead_time"],
  [/payment/i, "payment_terms"],
  [/currency/i, "currency"],
  [/incoterm/i, "incoterms"],
  [/sample/i, "sample"],
  [/warranty/i, "warranty"],
  [/supply|warehouse|container/i, "supply_type"],
  [/sku/i, "sku"],
  [/weight/i, "weight"],
  [/cbm|volume/i, "cbm"],
  [/box include/i, "box_include"],
  [/packing|carton|box/i, "packing"],
  [/hs /i, "hs_code"],
  [/origin|country/i, "origin"],
  [/voltage|power|watt|frequency|phase|electric|plug|motor/i, "voltage"],
  [/colou?r/i, "colors"],
  [/dimension|size|length|width|height|diameter/i, "dimensions"],
  [/speed|rpm/i, "speed"],
  [/capacity/i, "capacity"],
  [/certificat|cert |diploma|compliance/i, "certifications"],
  [/video/i, "video"],
  [/photo|image|media|gallery/i, "photos"],
  [/manual|datasheet|brochure|document|file/i, "documents"],
  [/language|market/i, "languages"],
  [/date|created|updated|quoted|valid/i, "dates"],
  [/knowledge|related/i, "knowledge"],
];

/* Offline fallback = the registry's own seed URLs, so a failed fetch never
   blanks the tiles. The registry (visual_icon_bindings) always wins. */
const FIELD_ICON_FALLBACK: Record<string, string> = {
  status: "general/status/badge-check.svg", visible: "general/security/eye.svg", featured: "pack/status/ranking-star.svg",
  level: "pack/actions/layers.svg", product_name: "pack/commerce/label.svg", koleex_code: "general/inventory/barcode.svg",
  public_url: "pack/actions/link.svg", brand: "pack/documents/crown.svg", family: "general/inventory/boxes.svg",
  tagline: "pack/actions/text.svg", description: "pack/actions/paragraph.svg", excerpt: "pack/misc/memo.svg",
  spec_template: "general/database/settings.svg", supplier: "general/business/supplier.svg", supplier_code: "pack/devices/barcode-read.svg",
  cost_price: "pack/finance/dollar.svg", price: "pack/finance/money-bill-wave.svg", pricing_mode: "pack/actions/settings-sliders.svg",
  price_note: "pack/misc/memo-pad.svg", currency: "general/finance/coins.svg", payment_terms: "pack/finance/money-check.svg",
  moq: "general/inventory/pallet.svg", lead_time: "general/time/timer.svg", incoterms: "pack/maps/passport.svg",
  sample: "pack/status/cube.svg", warranty: "general/security/shield.svg", supply_type: "pack/misc/container-storage.svg",
  sku: "pack/finance/ticket.svg", barcode: "pack/devices/qrcode.svg", weight: "pack/actions/scale.svg",
  cbm: "pack/misc/cubes.svg", packing: "general/inventory/box.svg", box_include: "pack/actions/box-open.svg",
  hs_code: "general/maps/globe.svg", origin: "pack/maps/flag.svg", voltage: "pack/devices/plug-alt.svg",
  colors: "pack/actions/palette.svg", dimensions: "pack/manufacturing/ruler-combined.svg", speed: "pack/analytics/chart-line-up-down.svg",
  capacity: "pack/devices/battery-full.svg", certifications: "pack/documents/diploma.svg", documents: "general/documents/document.svg",
  photos: "pack/files/camera.svg", video: "general/files/video.svg", languages: "pack/actions/language.svg",
  dates: "general/time/calendar.svg", knowledge: "pack/actions/book-open-cover.svg", readiness: "pack/status/memo-circle-check.svg",
  stock: "general/inventory/warehouse.svg", tax: "pack/misc/percentage.svg", notes: "general/documents/clipboard.svg",
  division: "general/business/building.svg", category: "pack/files/folder-tree.svg", subcategory: "pack/actions/layers.svg",
};

type TaxoName = { en: string; zh: string | null; ar: string | null };
type TaxonomyNames = Record<"division" | "category" | "subcategory", Record<string, TaxoName>>;

/** The classification name in the page's language, falling back to English and
 *  then to a tidied slug — never to the raw slug, which is a URL fragment. */
function taxoLabel(
  taxo: TaxonomyNames,
  kind: "division" | "category" | "subcategory",
  slug: unknown,
  lang: string,
): string {
  const key = typeof slug === "string" ? slug : "";
  const hit = taxo[kind][key];
  if (hit) {
    const localised = lang === "zh" ? hit.zh : lang === "ar" ? hit.ar : null;
    return (localised || hit.en || "").trim() || humanizeSlug(key);
  }
  return humanizeSlug(key);
}

/** "garment-machinery" → "Garment Machinery". */
function humanizeSlug(v: unknown): string {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return "—";
  return raw.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldKeyForLabel(label: string): string {
  for (const [re, k] of FIELD_KEY_RULES) if (re.test(label)) return k;
  return "";
}

function iconForField(bindings: Record<string, string>, fieldKey: string): string {
  if (!fieldKey) return "";
  return bindings[`field.${fieldKey}`] || (FIELD_ICON_FALLBACK[fieldKey] ? VL_BASE + FIELD_ICON_FALLBACK[fieldKey] : "");
}


function Val({ v, mono }: { v: unknown; mono?: boolean }) {
  const empty =
    v === null || v === undefined || v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
  if (empty) return <span className="text-[12px] text-[var(--text-ghost)] italic">{NOT_SET}</span>;
  if (typeof v === "boolean") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${v ? "text-emerald-400" : "text-[var(--text-dim)]"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-emerald-500" : "bg-[var(--border-subtle)]"}`} />
        {v ? "Yes" : "No"}
      </span>
    );
  }
  if (Array.isArray(v)) {
    return (
      <span className="flex flex-wrap gap-1">
        {v.map((x, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px] font-medium text-[var(--text-primary)]">
            {String(x)}
          </span>
        ))}
      </span>
    );
  }
  if (typeof v === "object") {
    return <span className="text-[11px] font-mono text-[var(--text-subtle)] break-all">{JSON.stringify(v)}</span>;
  }
  return <span className={`text-[13.5px] font-semibold text-[var(--text-primary)] ${mono ? "font-mono text-[12.5px] font-medium" : ""} break-words`}>{String(v)}</span>;
}

/* ── Steps ────────────────────────────────────────────────────────────────
   The SAME eleven sections the editor shows, in the same order, under the
   same labels. The record and the editor are two views of one thing, so the
   navigation must not differ between them. */
/* The tab strip. `k` is the dictionary key — the labels were raw English, so
   the whole strip stayed in English while the page under it was Arabic. */
const STEPS = [
  { id: "classify",   short: "Classify",           k: "step.classify" },
  { id: "supplier",   short: "Supplier",           k: "step.supplier" },
  { id: "identity",   short: "Hero",               k: "step.hero" },
  /* Owner call 2026-08-21: highlights get their OWN tab right after Hero. */
  { id: "highlights", short: "Highlights",         k: "step.highlights" },
  { id: "specs",      short: "Specs",              k: "step.specs" },
  { id: "commercial", short: "Variants",           k: "step.models" },
  { id: "pricing",    short: "Price",              k: "step.price" },
  /* The editor's Buyer Options step — the one tab the record never had. */
  { id: "options",    short: "Options",            k: "step.optionsShort" },
  /* The same name as the editor's tab, because it is the same tab. */
  { id: "logistics",  short: "Packing & Logistics", k: "step.logistics" },
  { id: "compliance", short: "Compliance",         k: "step.compliance" },
  { id: "media",      short: "Media & Files",      k: "step.media" },
  { id: "knowledge",  short: "Knowledge",          k: "step.knowledge" },
  { id: "finalize",   short: "Review",             k: "step.review" },
] as const;

/* The editor's own sticky tab bar, via the same canonical TabStrip — not a
   lookalike, the same component. */
function ProfileTabs({ current, onPick }: { current: number; onPick: (i: number) => void }) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  /* This bar hosts the screen's ONE long ramp, so the main header pane
     must not add its flat frost on top — two filtered bands in the same
     strip read as two edges. Declared live, because only the component
     that mounts the layer knows it actually rendered. */
  useTopRampOwner(true);
  return (
    /* Ramp length is tuned to THIS page, not inherited from the list.

       The default 3rem tail is measured from the bar's own box, and on the
       list page that lands in empty space. Here the very next thing under
       the bar is the model-chip row, so the tail was painting a 48px blur
       straight over live data — the owner circled it, and the chips were
       unreadable. Same defect as the list's divisions row, one page along:
       a ramp may only blur what actually passes BEHIND it.

       1rem clears the bar and dies inside the 24px gap above the content;
       the fade is spent behind the tab strip itself, which is this bar's
       own lifted content and stays crisp. */
    <nav
      className="kx-bar-host sticky top-0 z-20 mb-6 py-2 bg-[var(--bg-primary)]/90 backdrop-blur-md [--kx-ramp-ext:1rem] [--kx-ramp-fade:2.5rem]"
    >
      <div aria-hidden className="kx-glass-bar kx-bar-prog"><i /><i /><i /><i /></div>
      <TabStrip
        ariaLabel="Product sections"
        items={STEPS.map((st, i) => ({
          key: st.id,
          label: t(st.k, st.short),
          active: i === current,
          onClick: () => onPick(i),
        }))}
      />
    </nav>
  );
}


/* The editor's field row: label on top, value under it, help line beneath.
   Used by every tab so a reader never meets two different field shapes. */
/* ── the visual grammar of the packing sheet ──────────────────────────────
   A row with a small glyph and a label is a LIST, and a list is read line by
   line. The numbers that matter here — what it weighs, what it cubes, how many
   fit in a container — are looked UP, not read through, and they were buried
   in that list behind glyphs the page was guessing at: labels it could not
   match fell back to the same info circle, so half the rows wore the same icon
   and none of them meant anything.

   So the numbers become tiles, the facts become chips with a glyph that was
   chosen rather than inferred, and the crates become cards with their own
   photographs. Nothing here calls iconForField. */

/* The glyph for one item in a crate. A photo when there is one, otherwise the
   kind the operator picked — never a guess from the label. */
function KindGlyph({ kind, className = "h-5 w-5" }: { kind?: string; className?: string }) {
  switch (kind) {
    case "machine":     return <FactoryIcon className={className} />;
    case "tools":       return <WrenchIcon className={className} />;
    case "cable":       return <PlugIcon className={className} />;
    case "cover":       return <ShieldIcon className={className} />;
    case "parts":       return <CogIcon className={className} />;
    case "blade":       return <ScissorsIcon className={className} />;
    case "fastener":    return <Link2Icon className={className} />;
    case "frame":       return <TableIcon className={className} />;
    case "electronics": return <CpuIcon className={className} />;
    case "consumable":  return <DropletsIcon className={className} />;
    case "wheel":       return <CircleDotIcon className={className} />;
    case "docs":        return <DocumentIcon className={className} />;
    default:            return <InboxRawIcon className={className} />;
  }
}

function ContentRow({ item, mult, depth }: { item: ContentItem; mult: number; depth: number }) {
  const qty = (Number(item.qty) || 1) * mult;
  return (
    <>
      <li className="flex items-center gap-2.5" style={{ paddingInlineStart: `${depth * 20}px` }}>
        <span className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)]">
          {item.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <KindGlyph kind={item.kind} className="h-5 w-5" />
          )}
        </span>
        <span className="text-[13px] text-[var(--text-primary)] truncate">{(item.label || "").trim() || "—"}</span>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-muted)] ms-auto shrink-0">× {qty}</span>
      </li>
      {(item.items ?? []).map((sub, i) => (
        <ContentRow key={i} item={sub} mult={qty} depth={depth + 1} />
      ))}
    </>
  );
}

/* ── Packing & Logistics, read-only ───────────────────────────────────────
   The edit tab with the inputs taken out: the same five sections in the same
   order (Machine, Packing, Loading, Customs, Order) under the same names, so
   moving between the sheet and the form never asks anyone to re-orient.

   Values nobody entered are simply absent — a page of "Not set" is noise, and
   the form is where the gaps are meant to be visible. A section with nothing
   in it does not print an empty heading; when the packing has not been
   entered at all, one line says so and points at Edit. */
type PackingSection = "physical" | "packing" | "loading" | "customs" | "order";
interface PackingDraft {
  logistics: ProductLogistics;
  machine_dimensions: string;
  machine_weight_kg: string;
  country_of_origin: string;
  hs_code: string;
  moq: string;
  lead_time: string;
}
const SEG_WARN = "border-amber-500/60 bg-amber-500/[0.12] text-[var(--text-primary)]";
const TINY = "text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-0.5 truncate";
const HINT = "text-[10px] text-[var(--text-ghost)] leading-relaxed mt-1";
const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : 0;
};

/* Machine L×W×H typed in the operator's unit, stored in mm — the editor's
   own contract (MachineDimensionFields), in the space of one chip. */
function DimsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { length: entry, setLength } = useEntryUnits();
  const [raw, setRaw] = useState<Record<number, string>>({});
  const parts = (value || "").split(/[×xX*,]/).map((x) => x.trim());
  const stored = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  const setAt = (i: number, typed: string) => {
    setRaw((m) => ({ ...m, [i]: typed }));
    const next = [...stored];
    next[i] = String(storeFrom(typed, "mm", entry));
    onChange(next.every((x) => x === "") ? "" : `${next[0]}×${next[1]}×${next[2]}`);
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(["L", "W", "H"] as const).map((ph, i) => (
        <span key={ph} className="flex items-center gap-1.5">
          <input
            aria-label={ph}
            inputMode="decimal"
            value={raw[i] !== undefined ? raw[i] : displayIn(stored[i], "mm", entry)}
            onChange={(e) => setAt(i, e.target.value)}
            onBlur={() => setRaw((m) => { const n = { ...m }; delete n[i]; return n; })}
            placeholder={ph}
            className={`${INP_B} w-[64px] text-center tabular-nums px-1`}
          />
          {i < 2 ? <span className="text-[var(--text-ghost)]">×</span> : null}
        </span>
      ))}
      <UnitPicker value={entry} options={LENGTH_UNITS} onPick={(u) => { setRaw({}); setLength(u as LengthUnit); }} canonical="mm" size="sm" />
    </span>
  );
}

/* One number in the operator's mass unit, stored in kg. */
function WeightInput({ value, onChange, placeholder = "0" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { mass: entry, setMass } = useEntryUnits();
  const [raw, setRaw] = useState<string | undefined>(undefined);
  return (
    <span className="flex items-center gap-1.5">
      <input
        aria-label="kg"
        inputMode="decimal"
        value={raw !== undefined ? raw : displayIn(value, "kg", entry)}
        onChange={(e) => { setRaw(e.target.value); onChange(String(storeFrom(e.target.value, "kg", entry))); }}
        onBlur={() => setRaw(undefined)}
        placeholder={placeholder}
        className={`${INP_B} w-[96px] tabular-nums`}
      />
      <UnitPicker value={entry} options={MASS_UNITS} onPick={(u) => { setRaw(undefined); setMass(u as MassUnit); }} canonical="kg" size="sm" />
    </span>
  );
}

/* The crate tile, editable: the same 64px square with the same number badge,
   now also a click-or-drop target for the crate's photo. */
function CrateTile({ url, badge, onChange, productId, title }: {
  url: string | null; badge: number; onChange: (u: string | null) => void; productId?: string; title: string;
}) {
  const { busy, over, drop, open, input } = useImagePicker(onChange, productId);
  return (
    <>
      {input}
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title={title}
        {...drop}
        className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)] transition-colors disabled:opacity-50 ${
          over ? "border-[#567FB2]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
        }`}
      >
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ArchiveIcon className="h-7 w-7" />
        )}
        <span className="absolute bottom-1 end-1 h-[18px] min-w-[18px] px-1 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10.5px] font-bold tabular-nums leading-none flex items-center justify-center">{badge}</span>
      </button>
    </>
  );
}

function PackingSheet({
  logistics, model, product, t, lang, motion, productId, schemaCovers, onSaved, canEdit, onDirtyChange, aiContext,
}: {
  logistics: ProductLogistics;
  model: Record<string, unknown> | undefined;
  product: Record<string, unknown> | undefined;
  t: (k: string, fb: string) => string;
  lang: string;
  motion: string;
  productId: string | undefined;
  /** Columns the product's spec template owns (its schema_specs is the source
   *  and the column a mirror) — the Physical save writes both, as the form does. */
  schemaCovers: Set<string>;
  /** The saved patch, so the page can show it before the reload lands. */
  onSaved: (patch: Record<string, unknown>) => void;
  /** No edit permission (or viewing as someone) → no Edit, no "+ section". */
  canEdit: boolean;
  /** Unsaved changes exist — the page guards tab switches and leaving. */
  onDirtyChange: (dirty: boolean) => void;
  /** What the HS-code suggestion is asked about — the editor's own context shape. */
  aiContext: Record<string, unknown>;
}) {
  /* ── INLINE EDIT, IN THE SHEET'S OWN LAYOUT. Edit does not swap the card
     for the form: every tile stays where it is and the value inside it
     becomes the control for that value. Owner, after the first version put
     the form's layout inside the card: "it's still totally different layout
     and different field places." One section at a time; the draft is a copy
     taken when Edit is pressed, so Cancel is free and Save sends only that
     section's fields. While a section is being edited, everything derived
     (CBM, gross, container counts) is computed from the draft, live. */
  const [editing, setEditing] = useState<PackingSection | null>(null);
  const [draft, setDraft] = useState<PackingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  /* The draft as it was when Edit was pressed: Save is disabled until the
     draft differs from it, and the page asks before throwing it away. */
  const [initialJson, setInitialJson] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /* Raw keystrokes for the converted number cells — converting on every
     keystroke and echoing the result back eats the decimal point ("1." → 1). */
  const [raw, setRaw] = useState<Record<string, string>>({});
  const { length: dimUnit, mass: wtUnit, setLength, setMass } = useEntryUnits();

  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const begin = (k: PackingSection) => {
    const d: PackingDraft = {
      logistics: JSON.parse(JSON.stringify(logistics ?? {})) as ProductLogistics,
      machine_dimensions: str(product?.machine_dimensions),
      machine_weight_kg: str((product?.schema_specs as Record<string, unknown> | null)?.machine_weight_kg ?? product?.machine_weight_kg),
      country_of_origin: str(product?.country_of_origin),
      hs_code: str(product?.hs_code),
      moq: str(product?.moq),
      lead_time: str(product?.lead_time),
    };
    setDraft(d);
    setInitialJson(JSON.stringify(d));
    setRaw({});
    setSaveErr(null);
    setAiMsg(null);
    setEditing(k);
  };
  const cancel = () => { setEditing(null); setDraft(null); setSaveErr(null); setAiMsg(null); };
  const dirty = !!draft && JSON.stringify(draft) !== initialJson;
  useEffect(() => { onDirtyChange(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  /* An HS code is 4 to 10 digits, dotted or not: 8452, 8452.21, 8452.21.00.
     Anything else ("8451,5", a word) is a typo the customs form would
     bounce, so Save waits for it. */
  const hsOk = (v: string) => { const x = v.trim(); return !x || /^\d{4}(\.?\d{2}){0,3}$/.test(x); };
  const sectionValid = (k: PackingSection, d: PackingDraft) => (k === "customs" ? hsOk(d.hs_code) : true);
  /* HS-code suggestion — the editor's own call and rules: fill the box,
     never save; the model's one-line reason shows under the field so the
     confirmation is informed. */
  const aiSuggestHs = async () => {
    if (aiBusy) return;
    setAiBusy(true); setAiMsg(null);
    try {
      const res = await fetch("/api/ai/product-copy", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ field: "hs_code", context: aiContext }),
      });
      const data = (await res.json()) as { value?: string; reason?: string; fallback?: boolean };
      if (res.ok && !data.fallback && !data.value && data.reason) { setAiMsg({ kind: "error", text: data.reason }); return; }
      if (!res.ok || data.fallback || !data.value) {
        setAiMsg({ kind: "error", text: data.reason === "no_provider" ? t("ai.noProvider", "AI is off — no provider configured.") : t("ai.failed", "Couldn't draft right now — try again.") });
        return;
      }
      patchDraft({ hs_code: data.value });
      setAiMsg({ kind: "ok", text: data.reason ? `${data.value} — ${data.reason}` : data.value });
    } catch {
      setAiMsg({ kind: "error", text: t("ai.failed", "Couldn't draft right now — try again.") });
    } finally {
      setAiBusy(false);
    }
  };
  const patchDraft = (u: Partial<PackingDraft>) => setDraft((d) => (d ? { ...d, ...u } : d));
  const patchLogistics = (u: Partial<ProductLogistics>) => setDraft((d) => (d ? { ...d, logistics: { ...d.logistics, ...u } } : d));
  const payloadFor = (k: PackingSection, d: PackingDraft): Record<string, unknown> => {
    switch (k) {
      case "physical": {
        const dims = d.machine_dimensions.trim();
        const w = d.machine_weight_kg.trim();
        const out: Record<string, unknown> = {
          machine_dimensions: dims || null,
          machine_weight_kg: w ? parseFloat(w) : null,
        };
        /* Template products: schema_specs is the source and the column its
           mirror (ProductForm's schemaColumnMirror). Writing only the column
           would be undone by the next full save, so both are written. */
        if (schemaCovers.has("machine_dimensions") || schemaCovers.has("machine_weight_kg")) {
          const specs = { ...((product?.schema_specs as Record<string, unknown> | null) ?? {}) };
          if (schemaCovers.has("machine_dimensions")) { if (dims) specs.machine_dimensions = dims; else delete specs.machine_dimensions; }
          if (schemaCovers.has("machine_weight_kg")) { if (w) specs.machine_weight_kg = parseFloat(w); else delete specs.machine_weight_kg; }
          out.schema_specs = specs;
        }
        return out;
      }
      case "packing": {
        const w = d.machine_weight_kg.trim();
        const out: Record<string, unknown> = { logistics: d.logistics, machine_weight_kg: w ? parseFloat(w) : null };
        if (schemaCovers.has("machine_weight_kg")) {
          const specs = { ...((product?.schema_specs as Record<string, unknown> | null) ?? {}) };
          if (w) specs.machine_weight_kg = parseFloat(w); else delete specs.machine_weight_kg;
          out.schema_specs = specs;
        }
        return out;
      }
      case "loading":
        return { logistics: d.logistics };
      case "customs":
        return { country_of_origin: d.country_of_origin || null, hs_code: d.hs_code.trim() || null, logistics: d.logistics };
      case "order":
        return { moq: d.moq.trim() ? parseInt(d.moq, 10) : null, lead_time: d.lead_time.trim() || null, logistics: d.logistics };
    }
  };
  const save = async () => {
    if (!draft || !editing || !productId) return;
    if (!dirty || !sectionValid(editing, draft)) return;
    const payload = payloadFor(editing, draft);
    setSaving(true); setSaveErr(null);
    try {
      await updateProduct(productId, payload);
      onSaved(payload);
      setEditing(null); setDraft(null);
    } catch (e) {
      setSaveErr(humanizeError(e));
    } finally {
      setSaving(false);
    }
  };
  /* The header props every card shares. */
  const gp = (k: PackingSection) => ({
    editLabel: t("action.edit", "Edit"),
    onEdit: canEdit ? () => begin(k) : undefined,
    editing: editing === k,
    saving,
    error: editing === k ? saveErr : null,
    onSave: save,
    onCancel: cancel,
    saveLabel: t("action.save", "Save"),
    cancelLabel: t("action.cancel", "Cancel"),
    canSave: dirty && !!draft && sectionValid(k, draft),
  });
  /* Esc cancels, ⌘/Ctrl+Enter saves — plain Enter is left to the dropdowns
     and never submits a card by accident. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
  };

  /* ── What the sheet reads from: the draft while editing, the row otherwise.
     The draft is a copy, so sections not being edited read the same values. */
  const L: ProductLogistics = draft?.logistics ?? logistics;
  const col = (k: keyof PackingDraft & string) => (draft ? draft[k] : product?.[k]);
  const ePhys = editing === "physical";
  const ePack = editing === "packing";
  const eLoad = editing === "loading";
  const eCust = editing === "customs";
  const eOrd = editing === "order";

  const label = (list: readonly { value: string; label: string }[], v: unknown) => {
    const hit = list.find((o) => o.value === v);
    return hit ? t(`pk.opt.${hit.value}`, hit.label) : (v as string) || null;
  };
  const opts = (list: readonly { value: string; label: string }[]) => list.map((o) => ({ value: o.value, label: t(`pk.opt.${o.value}`, o.label) }));
  const rows: PackageRow[] = L.packages?.length ? L.packages : ePack ? [{ qty: 1 }] : [];
  const sums = sumPackages(rows);
  const mode = L.packing_mode === "per_package" ? "per_package" : "per_unit";
  const perPkg = mode === "per_package" ? Math.max(1, Math.floor(num(L.units_per_package) || 1)) : 1;
  const plan = loadPlan(rows, { unitsPerPackage: perPkg });
  const m = (k: string) => (model ? (model as Record<string, unknown>)[k] : undefined);
  const pv = (k: string) => (product ? product[k] : undefined);

  /* The product is the source. A product that never saw the new tab still has
     its numbers on the primary variant, so fall back rather than print an
     empty sheet over data that exists. */
  const fromProduct = sums.packageCount > 0 || !!L.packing_type || !!L.net_weight_kg;
  /* Net weight IS the machine weight (suppliers quote N.W. and G.W.; N.W. is
     the machine). The packing column is a fallback for rows written before
     the two were one. */
  const specsNet = (product?.schema_specs as Record<string, unknown> | null)?.machine_weight_kg;
  const netW = fromProduct
    ? (draft ? num(draft.machine_weight_kg) : (num(specsNet) || num(col("machine_weight_kg")))) || L.net_weight_kg
    : m("net_weight");
  const grossW = fromProduct ? (sums.grossKg || L.gross_weight_kg) : m("weight");
  const cbm = fromProduct ? (sums.cbm || L.cbm) : m("cbm");
  /* A count the operator typed wins; otherwise the count the crates give —
     the editor shows the calculated number in the box, so the sheet does too. */
  const q20 = fromProduct ? (L.qty_20ft ?? (plan.c20.qty || undefined)) : m("container_20ft_qty");
  const q40 = fromProduct ? (L.qty_40ft ?? (plan.c40.qty || undefined)) : m("container_40ft_qty");
  const q40hq = fromProduct ? (L.qty_40hq ?? (plan.c40hq.qty || undefined)) : m("container_40hq_qty");
  const pType = fromProduct ? label(PACKING_TYPES, L.packing_type) : (m("packing_type") as string | undefined);
  const dg = L.dangerous_goods;
  const dgNames = (dg?.kinds ?? []).map((k) => label(DG_KINDS, k) ?? k);
  const perPkgLabel = mode === "per_package" ? t("pk.pcsWord", "pcs") : t("pk.unitsWord", "units");

  const has = (...v: unknown[]) => v.some((x) => x !== undefined && x !== null && x !== "" && x !== false);
  const machine = has(pv("machine_dimensions"), pv("machine_weight_kg"));
  const packing = has(pType, L.wood_treatment, netW, grossW, cbm, sums.packageCount || null, L.packing_photo_url);
  const loading = has(q20, q40, q40hq);
  const customs = has(pv("country_of_origin"), pv("hs_code"), L.origin_certificate && L.origin_certificate !== "none" ? L.origin_certificate : null, dg?.has);
  const order = has(pv("moq"), pv("lead_time"), L.port_of_loading);

  /* ── Packing edit helpers: the same maths as the editor's PackingBlock. */
  const writeRows = (next: PackageRow[]) => {
    const s2 = sumPackages(next);
    patchLogistics({ packages: next, cbm: s2.cbm, gross_weight_kg: s2.grossKg });
  };
  const setRow = (i: number, u: Partial<PackageRow>) => writeRows(rows.map((r, x) => (x === i ? { ...r, ...u } : r)));
  const addRow = () => patchLogistics({ packages: [...rows, { qty: 1 }] });
  const removeRow = (i: number) => writeRows(rows.filter((_, x) => x !== i));
  const cell = (i: number, k: keyof PackageRow, ph: string, lab: string) => {
    const isDim = k === "l_cm" || k === "w_cm" || k === "h_cm";
    const isWeight = k === "gross_kg";
    const id = `${i}:${String(k)}`;
    const converted = isDim ? displayIn(rows[i][k], "cm", dimUnit) : isWeight ? displayIn(rows[i][k], "kg", wtUnit) : String(rows[i][k] ?? "");
    const shown = raw[id] !== undefined ? raw[id] : converted;
    return (
      <span className="min-w-0">
        <span className={TINY}>{lab}</span>
        <input
          aria-label={lab}
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            setRaw((mm) => ({ ...mm, [id]: e.target.value }));
            const stored = isDim ? storeFrom(e.target.value, "cm", dimUnit) : isWeight ? storeFrom(e.target.value, "kg", wtUnit) : e.target.value;
            setRow(i, { [k]: stored } as Partial<PackageRow>);
          }}
          onBlur={() => setRaw((mm) => { const next = { ...mm }; delete next[id]; return next; })}
          placeholder={ph}
          className={`${INP_B} w-full text-center tabular-nums px-1`}
        />
      </span>
    );
  };
  const setDg = (u: Partial<NonNullable<ProductLogistics["dangerous_goods"]>>) => patchLogistics({ dangerous_goods: { ...(dg ?? {}), ...u } });
  const toggleKind = (k: string) => {
    const cur = dg?.kinds ?? [];
    setDg({ kinds: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
  };
  const seg = (on: boolean, warn = false) => `${SEG} ${on ? (warn ? SEG_WARN : SEG_ON) : SEG_OFF}`;
  /* A derived number looks exactly like a typed one until the operator tries
     to type into it. In edit mode every derived tile says so — the same pill
     the container tiles wear — and says what it is derived from. */
  const calc = (hint: string) => (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] leading-snug text-[var(--text-ghost)]">
      <CalcBadge label={t("pk.calculated", "Calculated")} />
      <span>{hint}</span>
    </div>
  );
  const packagingKg = sums.grossKg && num(netW) ? Math.round((sums.grossKg - num(netW)) * 10000) / 10000 : null;
  const selectCls = `${INP_B} w-full pe-8 text-start`;

  /* ONE CARD PER SECTION, not one card with headings inside it. The editor
     puts Physical, Packing, Loading, Origin & Customs and Fulfillment in five
     separate collapsible cards; stacking them as sub-headings inside a single
     card made the same content read as a different screen. Same cards, same
     order, same titles and badges — the sheet is the form with the inputs
     taken out, and Edit puts them back where the values were. */
  if (!machine && !packing && !loading && !customs && !order && editing === null) {
    /* The empty state stands for the whole tab, so it takes the tab's own
       glyph rather than borrowing Origin & Customs' globe. */
    return (
      <Group motion={motion} icon={<BoundIcon semanticKey="section.logistics" className="h-4 w-4" fallback={<TruckIcon className="h-4 w-4" />} />} title={t("pp.sec.logistics", "Packing & Logistics")} editLabel={t("action.edit", "Edit")} onEdit={canEdit ? () => begin("packing") : undefined}>
        <p className="text-[12px] text-[var(--text-ghost)] leading-relaxed">
          {t("pp.f.packingEmpty", "Nothing entered yet. Open Edit to add the crate, its contents, weights and container quantities.")}
        </p>
      </Group>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      {machine || ePhys ? (
        <Group motion={motion} icon={<RulerIcon className="h-4 w-4" />} title={t("tech.secPhysical", "Physical (Bare Machine)")} count={t("logistics.physicalBadge", "Dimensions · Weight")} {...gp("physical")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5">
            {ePhys || pv("machine_dimensions") ? (
              <FactChip
                icon={<Maximize2Icon className="h-6 w-6" />}
                label={t("pp.f.machineDims", "Machine dimensions")}
                value={`${str(col("machine_dimensions"))} mm`}
                input={ePhys && draft ? <DimsInput value={draft.machine_dimensions} onChange={(v) => patchDraft({ machine_dimensions: v })} /> : undefined}
              />
            ) : null}
            {ePhys || pv("machine_weight_kg") ? (
              <FactChip
                icon={<ScaleIcon className="h-6 w-6" />}
                label={t("pp.f.machineWeight", "Machine weight (kg)")}
                value={`${str(col("machine_weight_kg"))} kg`}
                input={ePhys && draft ? <WeightInput value={draft.machine_weight_kg} onChange={(v) => patchDraft({ machine_weight_kg: v })} /> : undefined}
              />
            ) : null}
          </div>
        </Group>
      ) : null}

      {packing || ePack ? (
        <Group motion={motion} icon={<BoxesIcon className="h-4 w-4" />} title={t("logistics.packingSection", "Packing")} count={t("logistics.packingSectionBadge", "Crates · Weights")} {...gp("packing")}>
          {ePack ? (
            <div className="mb-4">
              <PackingPhoto url={L.packing_photo_url ?? null} onChange={(u) => patchLogistics({ packing_photo_url: u })} productId={productId} />
            </div>
          ) : L.packing_photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={L.packing_photo_url}
              alt={t("pp.f.packingPhotoAlt", "Packed product")}
              className="mb-4 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] object-contain bg-black/20"
            />
          ) : null}
          {/* The four numbers a buyer or a forwarder asks for first. */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {ePack || sums.packageCount > 0 ? (
              <StatTile
                label={t("pp.f.packages", "Packages")}
                value={mode === "per_package" && L.units_per_package ? String(L.units_per_package) : String(sums.packageCount)}
                unit={mode === "per_package" && L.units_per_package ? `${t("pk.pcsWord", "pcs")} / ${t("pk.packageOne", "Package").toLowerCase()}` : undefined}
                extra={ePack ? (
                  /* How it is packed — the answer changes what every number
                     below means, so it sits on the count it governs. */
                  <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => patchLogistics({ packing_mode: "per_unit" })} className={seg(mode === "per_unit")}>{t("pk.modePerUnit", "One unit → its own package(s)")}</button>
                      <button type="button" onClick={() => patchLogistics({ packing_mode: "per_package" })} className={seg(mode === "per_package")}>{t("pk.modePerPackage", "One package → many pieces")}</button>
                    </div>
                    {mode === "per_package" ? (
                      <label className="flex items-center gap-2">
                        <span className={`${TINY} mb-0`}>{t("pk.piecesPerPkg", "Pieces per package")}</span>
                        <input aria-label={t("pk.piecesPerPkg", "Pieces per package")} inputMode="numeric" value={String(L.units_per_package ?? "")} onChange={(e) => patchLogistics({ units_per_package: e.target.value })} placeholder="50" className={`${INP_B} w-[72px] text-center tabular-nums`} />
                      </label>
                    ) : null}
                  </div>
                ) : undefined}
              />
            ) : null}
            {ePack || cbm ? <StatTile label={t("pp.f.cbm", "CBM")} value={String(sums.cbm || cbm || "—")} unit="m³" tone="accent" extra={ePack ? calc(t("pk.cbmHintAll", "All packages together.")) : undefined} /> : null}
            {ePack || netW ? (
              <StatTile
                label={t("pp.f.netWeight", "Net weight (N.W.)")}
                value={String(netW ?? "—")}
                unit={ePack ? wtUnit : "kg"}
                input={ePack && draft ? (
                  <input
                    aria-label={t("pp.f.netWeight", "Net weight (N.W.)")}
                    inputMode="decimal"
                    value={raw.net !== undefined ? raw.net : displayIn(draft.machine_weight_kg, "kg", wtUnit)}
                    onChange={(e) => { setRaw((mm) => ({ ...mm, net: e.target.value })); patchDraft({ machine_weight_kg: String(storeFrom(e.target.value, "kg", wtUnit)) }); }}
                    onBlur={() => setRaw((mm) => { const next = { ...mm }; delete next.net; return next; })}
                    placeholder="180"
                    className={`${INP_B} w-full tabular-nums text-[17px]`}
                  />
                ) : undefined}
                extra={(
                  <>
                    {/* One number, shown twice: typed under Physical, read here
                        beside the G.W. it belongs with. Said in both modes so
                        it never reads as a second field. */}
                    <div className="mt-1.5 text-[9.5px] leading-snug text-[var(--text-ghost)]">
                      {ePack ? t("pk.netTypeHere", "One field with Physical — type it here or there.") : t("pk.netSameAsPhysical", "= Physical · one value, shown beside G.W.")}
                    </div>
                    {/* Small goods: the catalogue's N.W. is for the whole carton, so
                        that figure is stated here as well — it is the one the
                        operator is looking at while typing. */}
                    {mode === "per_package" && perPkg > 1 && num(netW) > 0 ? (
                      <div className="mt-1.5 text-[9.5px] leading-snug tabular-nums text-[var(--text-muted)]">
                        {t("pk.netPerCarton", "N.W. per carton: {per} × {unit} = {total} kg").replace("{per}", String(perPkg)).replace("{unit}", String(num(netW))).replace("{total}", String(Math.round(perPkg * num(netW) * 100) / 100))}
                      </div>
                    ) : null}
                  </>
                )}
              />
            ) : null}
            {ePack || grossW ? (
              <StatTile
                label={t("pp.f.grossWeight", "Gross weight (G.W.)")}
                value={String(sums.grossKg || grossW || "—")}
                unit={ePack && rows.length === 1 ? wtUnit : "kg"}
                tone="accent"
                input={ePack && rows.length === 1 ? (
                  <input
                    aria-label={t("pp.f.grossWeight", "Gross weight (G.W.)")}
                    inputMode="decimal"
                    value={raw.gross !== undefined ? raw.gross : displayIn(rows[0].gross_kg, "kg", wtUnit)}
                    onChange={(e) => { setRaw((mm) => ({ ...mm, gross: e.target.value })); setRow(0, { gross_kg: storeFrom(e.target.value, "kg", wtUnit) }); }}
                    onBlur={() => setRaw((mm) => { const next = { ...mm }; delete next.gross; return next; })}
                    placeholder="210"
                    className={`${INP_B} w-full tabular-nums text-[17px]`}
                  />
                ) : undefined}
                extra={ePack ? (rows.length === 1
                  ? <div className="mt-1.5 text-[9.5px] leading-snug text-[var(--text-ghost)]">{t("pk.grossOnePkg", "One package — its gross weight, as on the catalogue.")}</div>
                  : calc(t("pk.grossHint", "Sum of the packages above."))) : undefined}
              />
            ) : null}
            {/* Gross − net: the editor has it, so the sheet has it. Negative
                means one of the two is wrong, which is exactly when it earns
                its place. */}
            {ePack || packagingKg !== null ? (
              <StatTile
                label={t("pk.packagingWeightBare", "Packaging weight")}
                value={packagingKg !== null ? String(packagingKg) : "—"}
                unit="kg"
                tone={packagingKg !== null && packagingKg < 0 ? "warn" : "plain"}
                extra={ePack ? calc(t("pk.packagingHint", "Gross − net. Negative means one of them is wrong.")) : packagingKg !== null && packagingKg < 0 ? (
                  <div className="mt-1.5 text-[9.5px] leading-snug text-amber-400">{t("pk.packagingHint", "Gross − net. Negative means one of them is wrong.")}</div>
                ) : undefined}
              />
            ) : null}
          </div>
          {ePack || pType || L.wood_treatment ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ePack || pType ? (
                <FactChip
                  icon={isPackingTypeKey(L.packing_type) ? <PackingTypeIcon type={L.packing_type} className="h-6 w-6" /> : <BoxIcon className="h-6 w-6" />}
                  label={t("pk.packingType", "Packing type")}
                  value={pType ?? ""}
                  input={ePack ? <KdsSelect value={L.packing_type ?? ""} onChange={(v: string) => patchLogistics({ packing_type: v })} options={packingTypeOptions(t)} placeholder={t("pk.select", "— Select —")} triggerClassName={selectCls} /> : undefined}
                />
              ) : null}
              {ePack || L.wood_treatment ? (
                <FactChip
                  icon={<FlaskConicalIcon className="h-6 w-6" />}
                  label={t("pp.f.woodTreatment", "Wood treatment")}
                  value={label(WOOD_TREATMENTS, L.wood_treatment) ?? ""}
                  tone={L.wood_treatment === "untreated" ? "warn" : "plain"}
                  input={ePack ? <KdsSelect value={L.wood_treatment ?? ""} onChange={(v: string) => patchLogistics({ wood_treatment: v })} options={opts(WOOD_TREATMENTS)} placeholder={t("pk.select", "— Select —")} triggerClassName={selectCls} /> : undefined}
                />
              ) : null}
            </div>
          ) : null}
          {ePack && L.wood_treatment === "untreated" ? (
            <p className="mt-1.5 text-[10.5px] text-amber-400">{t("pk.woodWarn", "⚠ Untreated solid wood is refused by EU / US / AU customs — it must be heat-treated or fumigated and bear the IPPC mark.")}</p>
          ) : null}

          {/* EACH CRATE CARRIES ITS OWN PACKING LIST. They were merged into
              one list under the cards, which answers "what ships" but not the
              question a packing list exists to answer: what is in THIS box.
              One card per crate, its contents inside it, so the machine crate
              and the accessories box can never be read as one pile. */}
          {ePack ? (
            /* The unit switches sit with the numbers they govern. INPUTS
               speak the operator's unit; every TOTAL stays m³ and kg. */
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{mode === "per_package" ? t("pk.packageOne", "Package") : t("pk.packagesPerUnit", "Packages per unit")}</span>
              <div className="flex flex-wrap items-center gap-3">
                <UnitSwitch label={t("pk.unitSize", "Size")} value={dimUnit} options={LENGTH_UNITS} canonical="cm" onChange={(v) => { setRaw({}); setLength(v as LengthUnit); }} />
                <UnitSwitch label={t("pk.unitWeight", "Weight")} value={wtUnit} options={MASS_UNITS} canonical="kg" onChange={(v) => { setRaw({}); setMass(v as MassUnit); }} />
              </div>
            </div>
          ) : null}
          {rows.length ? (
            <div className={`${ePack ? "mt-2" : "mt-4"} space-y-2.5`}>
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center gap-3">
                    {/* A crate glyph AND its number. The number is what the
                        packing list, the crate stencil and the bill of lading
                        all carry, so it stays on the tile as a badge — over the
                        photo too, once there is one. */}
                    {ePack ? (
                      <CrateTile url={r.photo_url ?? null} badge={i + 1} onChange={(u) => setRow(i, { photo_url: u })} productId={productId} title={r.photo_url ? t("pk.photoReplace", "Click or drop an image to replace") : t("pk.photoAdd", "Click or drop an image to add a photo")} />
                    ) : (
                      <span className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                        {r.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={r.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ArchiveIcon className="h-7 w-7" />
                        )}
                        <span className="absolute bottom-1 end-1 h-[18px] min-w-[18px] px-1 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10.5px] font-bold tabular-nums leading-none flex items-center justify-center">{i + 1}</span>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      {ePack ? (
                        <span className="flex items-center gap-2">
                          <input
                            aria-label={t("pk.colPackage", "Package")}
                            value={r.label ?? ""}
                            onChange={(e) => setRow(i, { label: e.target.value })}
                            placeholder={i === 0 ? t("pk.phMachineCrate", "Machine crate") : t("pk.phAccBox", "Accessories box")}
                            className={`${INP_B} w-full min-w-0 flex-1`}
                          />
                          {rows.length > 1 ? (
                            <button type="button" onClick={() => removeRow(i)} aria-label={t("pk.removePackage", "Remove package")} className="h-9 w-8 shrink-0 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors">×</button>
                          ) : null}
                        </span>
                      ) : (
                        <span className="block text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
                          {(r.label || "").trim() || t("pk.packageOne", "Package")}
                          {Number(r.qty) > 1 ? <span className="ms-1.5 text-[11px] font-medium text-[var(--text-muted)]">× {r.qty}</span> : null}
                        </span>
                      )}
                      {ePack ? (
                        /* The measurement line, as five cells in the same place. */
                        <span className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                          {cell(i, "qty", "1", t("pk.colQty", "Qty"))}
                          {cell(i, "l_cm", "120", `${t("pk.colLbare", "L")} (${dimUnit})`)}
                          {cell(i, "w_cm", "80", `${t("pk.colWbare", "W")} (${dimUnit})`)}
                          {cell(i, "h_cm", "110", `${t("pk.colHbare", "H")} (${dimUnit})`)}
                          {cell(i, "gross_kg", "210", `${t("pk.colGrossBare", "Gross")} (${wtUnit})`)}
                        </span>
                      ) : (
                        <span className="block text-[11.5px] tabular-nums text-[var(--text-muted)] mt-0.5">
                          {r.l_cm && r.w_cm && r.h_cm ? `${r.l_cm} × ${r.w_cm} × ${r.h_cm} cm` : "—"}
                          {r.gross_kg ? `  ·  ${r.gross_kg} kg` : ""}
                        </span>
                      )}
                    </span>
                  </div>
                  {ePack ? (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      <ContentsEditor items={r.contents ?? []} onChange={(items) => setRow(i, { contents: items })} productId={productId} />
                    </div>
                  ) : (r.contents ?? []).length ? (
                    <ul className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
                      {(r.contents ?? []).map((it, ci) => (
                        <ContentRow key={ci} item={it} mult={Number(r.qty) || 1} depth={0} />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {ePack ? (
            <div className="mt-2.5">
              <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors">
                {t("pk.addPackage", "+ Add package")}
              </button>
              {/* THE ONE RULE THAT KEEPS THE TOTALS HONEST: a package is what
                  the forwarder loads and weighs; a box inside it is already in
                  its size and weight. Stated where the mistake would be made. */}
              <p className={`${HINT} mt-2`}>
                {t("pk.packagesRule", "A package is one thing the forwarder loads: only what is weighed and measured on its own belongs here. A box inside another box goes under \"What's inside\" — the outer crate's size and weight already include it.")}
              </p>
            </div>
          ) : null}
        </Group>
      ) : null}

      {loading || eLoad ? (
        <Group motion={motion} icon={<ShipIcon className="h-4 w-4" />} title={t("logistics.loadingSection", "Loading & Containers")} count={t("logistics.loadingSectionBadge", "20ft · 40ft · 40HQ")} {...gp("loading")}>
          {/* Three numbers, three tiles: this is the question a forwarder asks
              and it should be answerable at a glance, not read out of a list.
              In edit, each tile is the calculated count with the box the
              operator may overwrite it in — and says which limit decided it. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {([["c20", "qty_20ft", q20], ["c40", "qty_40ft", q40], ["c40hq", "qty_40hq", q40hq]] as const).map(([key, stored, q]) => {
              const r = plan[key];
              const typed = L[stored];
              const overridden = typed !== undefined && typed !== "" && num(typed) !== r.qty;
              return (
                <StatTile
                  key={key}
                  label={CONTAINERS[key].label}
                  value={q ? String(q) : "—"}
                  unit={perPkgLabel}
                  tone="accent"
                  input={eLoad ? (
                    <input aria-label={CONTAINERS[key].label} inputMode="numeric" value={String(typed ?? (r.qty || ""))} onChange={(e) => patchLogistics({ [stored]: e.target.value } as Partial<ProductLogistics>)} placeholder="—" className={`${INP_B} w-full tabular-nums text-[17px]`} />
                  ) : undefined}
                  extra={(
                    <div className="mt-1.5 space-y-1 text-[9.5px] leading-snug text-[var(--text-ghost)]">
                      {/* The two facts about the box, labelled, in one row. */}
                      <div className="grid grid-cols-2 gap-2">
                        <span className="min-w-0"><span className={TINY}>{t("pk.capacityWord", "Capacity")}</span><span className="block text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{r.containerCbm} CBM</span></span>
                        <span className="min-w-0"><span className={TINY}>{t("pk.payload", "payload")}</span><span className="block text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{CONTAINERS[key].payload_kg.toLocaleString()} kg</span></span>
                      </div>
                      {eLoad ? (
                        <div className="flex flex-wrap items-center gap-x-2">
                          {overridden ? (
                            <button type="button" onClick={() => patchLogistics({ [stored]: r.qty } as Partial<ProductLogistics>)} className="font-bold uppercase tracking-[0.1em] text-amber-400 underline underline-offset-2">{t("pk.resetTo", "Edited · reset")} {r.qty}</button>
                          ) : (
                            <CalcBadge label={t("pk.calculated", "Calculated")} />
                          )}
                          <span>{r.qty === 0 ? t("pk.enterPackages", "Enter the packages above.") : loadExplain(t, r, sums.grossKg, CONTAINERS[key].payload_kg)}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {sums.volumetricKg ? (
              <FactChip
                icon={<PlaneIcon className="h-6 w-6" />}
                label={t("pk.volumetric", "Volumetric weight (kg, air)")}
                value={`${sums.volumetricKg} kg`}
                input={eLoad ? (
                  <span className="block">
                    <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{sums.volumetricKg} kg</span>
                    {calc(t("pk.volumetricHint", "L×W×H cm ÷ 6000. Air freight bills the greater of this and the gross weight."))}
                  </span>
                ) : undefined}
              />
            ) : null}
          </div>
        </Group>
      ) : null}

      {customs || eCust ? (
        <Group motion={motion} icon={<LandmarkIcon className="h-4 w-4" />} title={t("logistics.title", "Origin & Customs")} count={t("logistics.badge", "Shipping · Customs")} {...gp("customs")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {eCust || pv("country_of_origin") ? (
              <FactChip
                icon={<FlagIcon className="h-6 w-6" />}
                label={t("pp.f.origin", "Country of origin")}
                value={(() => { const c = COUNTRIES.find((x) => x.code === str(col("country_of_origin"))); return c ? `${flagOf(c.code)} ${countryName(c, lang)}` : str(col("country_of_origin")); })()}
                input={eCust && draft ? (
                  <KdsSelect value={draft.country_of_origin} onChange={(v: string) => patchDraft({ country_of_origin: v })} options={COUNTRIES.map((c) => ({ value: c.code, label: `${flagOf(c.code)} ${countryName(c, lang)}` }))} placeholder="—" triggerClassName={selectCls} />
                ) : undefined}
              />
            ) : null}
            {eCust || pv("hs_code") ? (
              <FactChip
                icon={<ScanLineIcon className="h-6 w-6" />}
                label={t("pp.f.hs", "HS code")}
                value={str(col("hs_code"))}
                input={eCust && draft ? (
                  <span className="block">
                    <span className="flex items-center gap-1.5">
                      <input aria-label={t("pp.f.hs", "HS code")} value={draft.hs_code} onChange={(e) => { patchDraft({ hs_code: e.target.value }); setAiMsg(null); }} placeholder="8452.21" className={`${INP_B} w-full min-w-0 flex-1 font-mono ${hsOk(draft.hs_code) ? "" : "border-amber-500/60"}`} />
                      <button type="button" onClick={() => void aiSuggestHs()} disabled={aiBusy} className="kx-ai-glow h-8 px-2 shrink-0 rounded-md text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 transition-all">
                        {aiBusy ? t("ai.generating", "Drafting…") : t("ai.suggest", "AI Suggest")}
                      </button>
                    </span>
                    {!hsOk(draft.hs_code) ? (
                      <span className="block mt-1 text-[10px] leading-snug text-amber-400">{t("pk.hsInvalid", "4–10 digits, dotted or not — e.g. 8452.21.00.")}</span>
                    ) : aiMsg ? (
                      <span className={`block mt-1 text-[10px] leading-snug ${aiMsg.kind === "ok" ? "text-[var(--text-muted)]" : "text-amber-400"}`}>{aiMsg.text}</span>
                    ) : null}
                  </span>
                ) : undefined}
              />
            ) : null}
            {eCust || (L.origin_certificate && L.origin_certificate !== "none") ? (
              <FactChip
                icon={<FileCheckIcon className="h-6 w-6" />}
                label={t("pp.f.originCert", "Origin certificate")}
                value={label(ORIGIN_CERTIFICATES, L.origin_certificate) ?? ""}
                input={eCust ? <KdsSelect value={L.origin_certificate ?? ""} onChange={(v: string) => patchLogistics({ origin_certificate: v })} options={opts(ORIGIN_CERTIFICATES)} placeholder={t("pk.select", "— Select —")} triggerClassName={selectCls} /> : undefined}
              />
            ) : null}
            {eCust || dg?.has ? (
              <FactChip
                icon={<TriangleWarningIcon className="h-6 w-6" />}
                label={t("pp.f.regulated", "Regulated content")}
                value={dgNames.join(", ") || t("pk.dgHas", "Has regulated content")}
                note={[
                  dg?.has && !(dg?.kinds ?? []).length ? t("pk.dgNoKind", "Type not specified — the MSDS request will ask which.") : null,
                  dg?.un_numbers, dg?.notes,
                ].filter(Boolean).join("  ·  ") || undefined}
                tone={dg?.has ? "warn" : "plain"}
                /* The band, not a cell: wrapped text made it taller than its
                   neighbours; given its own band it stops leaving a hole in
                   the row and reads like the alert it is. */
                wide
                input={eCust ? (
                  <span className="block space-y-2">
                    <span className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setDg({ has: false })} className={seg(!dg?.has)}>{t("pk.dgNone", "Nothing regulated")}</button>
                      <button type="button" onClick={() => setDg({ has: true })} className={seg(!!dg?.has, true)}>{t("pk.dgHas", "Has regulated content")}</button>
                    </span>
                    {dg?.has ? (
                      <>
                        {!(dg?.kinds ?? []).length ? <span className="block text-[10px] leading-snug text-amber-400">{t("pk.dgNoKind", "Type not specified — the MSDS request will ask which.")}</span> : null}
                        <span className="flex flex-wrap gap-1">
                          {DG_KINDS.map((k) => (
                            <button key={k.value} type="button" onClick={() => toggleKind(k.value)} className={seg((dg?.kinds ?? []).includes(k.value), true)}>{t(`pk.opt.${k.value}`, k.label)}</button>
                          ))}
                        </span>
                        <span className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <span>
                            <span className={TINY}>{t("pk.unNumbers", "UN number(s)")}</span>
                            <input aria-label={t("pk.unNumbers", "UN number(s)")} value={dg?.un_numbers ?? ""} onChange={(e) => setDg({ un_numbers: e.target.value })} placeholder="UN3481" className={`${INP_B} w-full font-mono`} />
                          </span>
                          <span>
                            <span className={TINY}>{t("pk.dgNote", "Note for the forwarder")}</span>
                            <input aria-label={t("pk.dgNote", "Note for the forwarder")} value={dg?.notes ?? ""} onChange={(e) => setDg({ notes: e.target.value })} placeholder={t("pk.dgNotePh", "Oil drained before shipment")} className={`${INP_B} w-full`} />
                          </span>
                        </span>
                      </>
                    ) : null}
                  </span>
                ) : undefined}
              />
            ) : null}
          </div>
        </Group>
      ) : null}

      {order || eOrd ? (
        <Group motion={motion} icon={<ClipboardCheckIcon className="h-4 w-4" />} title={t("technical.fulfillmentDefaults", "Fulfillment Defaults")} count={t("technical.fulfillmentBadge", "MOQ · Lead Time")} {...gp("order")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {eOrd || pv("moq") ? (
              <FactChip
                icon={<ShoppingCartIcon className="h-6 w-6" />}
                label={t("pp.f.moq", "MOQ")}
                value={str(col("moq"))}
                input={eOrd && draft ? <input aria-label={t("pp.f.moq", "MOQ")} type="number" min={1} value={draft.moq} onChange={(e) => patchDraft({ moq: e.target.value })} placeholder={t("technical.moqPlaceholder", "e.g. 10")} className={`${INP_B} w-full tabular-nums`} /> : undefined}
              />
            ) : null}
            {eOrd || pv("lead_time") ? (
              <FactChip
                icon={<ClockIcon className="h-6 w-6" />}
                label={t("pp.f.leadTime", "Lead time")}
                value={str(col("lead_time"))}
                input={eOrd && draft ? <input aria-label={t("pp.f.leadTime", "Lead time")} value={draft.lead_time} onChange={(e) => patchDraft({ lead_time: e.target.value })} placeholder={t("technical.leadTimePlaceholder", "e.g. 7-14 days")} className={`${INP_B} w-full`} /> : undefined}
              />
            ) : null}
            {eOrd || L.port_of_loading ? (
              <FactChip
                icon={<AnchorIcon className="h-6 w-6" />}
                label={t("pp.f.portOfLoading", "Port of loading")}
                value={L.port_of_loading ?? ""}
                input={eOrd ? <KdsSelect value={L.port_of_loading ?? ""} onChange={(v: string) => patchLogistics({ port_of_loading: v })} options={portOptions(L.port_of_loading)} placeholder={t("pk.select", "— Select —")} triggerClassName={selectCls} /> : undefined}
              />
            ) : null}
          </div>
        </Group>
      ) : null}

      {/* Sections with nothing in them are not shown as empty cards — but they
          must still be reachable, or the only way to fill them would be the
          editor route this page is meant to replace. One chip per missing
          section opens that card in edit mode. */}
      {editing === null && canEdit ? (() => {
        const missing: { k: PackingSection; label: string }[] = [];
        if (!machine) missing.push({ k: "physical", label: t("tech.secPhysical", "Physical (Bare Machine)") });
        if (!packing) missing.push({ k: "packing", label: t("logistics.packingSection", "Packing") });
        if (!loading) missing.push({ k: "loading", label: t("logistics.loadingSection", "Loading & Containers") });
        if (!customs) missing.push({ k: "customs", label: t("logistics.title", "Origin & Customs") });
        if (!order) missing.push({ k: "order", label: t("technical.fulfillmentDefaults", "Fulfillment Defaults") });
        if (!missing.length) return null;
        return (
          <div className={`${motion} flex flex-wrap items-center gap-2`}>
            {missing.map((mm) => (
              <button key={mm.k} type="button" onClick={() => begin(mm.k)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11.5px] font-medium text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
                + {mm.label}
              </button>
            ))}
          </div>
        );
      })() : null}
    </div>
  );
}

function Row({ label, value, help, mono, badge, iconSrc }: {
  label: string; value: unknown; help?: string; mono?: boolean; badge?: string;
  /** Explicit glyph URL (e.g. the classification icon HUB) — overrides the
      keyword match so hub edits reflect here automatically. */
  iconSrc?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {/* Icon tile — the eye's anchor while scanning down the sheet.
          Always a Visual Library glyph (owner rule). */}
      {/* No glyph for this field? Then no tile — but keep its width, so a row
          without one still lines up with the rows that have one. A box drawn
          around nothing is just another repeated mark. */}
      {(() => {
        const src = iconSrc || iconForField(BINDINGS_SNAPSHOT, fieldKeyForLabel(label));
        return src ? (
          <span className="mt-0.5 h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
            <RowGlyph src={src} className="h-4 w-4" />
          </span>
        ) : (
          <span aria-hidden className="mt-0.5 h-8 w-8 shrink-0" />
        );
      })()}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)]">{label}</span>
          {badge && (
            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">{badge}</span>
          )}
        </div>
        <div><Val v={value} mono={mono} /></div>
        {help && <p className="mt-1 text-[10.5px] text-[var(--text-ghost)]/80 leading-relaxed">{help}</p>}
      </div>
    </div>
  );
}


export default function ProductProfile() {
  const params = useParams<{ id: string }>();
  const handle = params?.id;
  const router = useRouter();
  /* Who may edit here: the same "edit" action the API checks, and never while
     viewing as someone else (the proxy blocks those writes anyway — better
     that the button is not there than that Save fails). */
  const perms = usePermissions();
  const { data: me } = useMeBootstrap();
  /* No `loading` gate: for a super admin `can` answers at once, and for
     everyone else it answers false until the rows land — Edit appears then.
     Gating on loading hid the button from the owner himself on this page. */
  const canEdit = !me?.auth?.viewing_as && (!!me?.isSuperAdmin || perms.can("Product Data", "edit"));
  /* Unsaved inline edits: switching tab, Back, Edit and closing the page all
     ask first — the draft dies with the sheet, silently, otherwise. */
  const dirtyRef = useRef(false);
  const [leaveAsk, setLeaveAsk] = useState<null | (() => void)>(null);
  const guard = useCallback((go: () => void) => {
    if (dirtyRef.current) setLeaveAsk(() => go); else go();
  }, []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  const { t, lang } = useTranslation(useMemo(() => ({ ...PRODUCTS_UI_I18N, ...PROFILE_T }), []));
  const aurora = useSkin() === "aurora";

  const [data, setData] = useState<Profile | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  NOT_SET = t("pp.notSet", "Not set");
  const [step, setStep] = useState(0);

  /* ⚠️ WARM THE OTHER TABS ONCE THE SCREEN IS DONE ASKING FOR THINGS.
     Deferring the sheets makes the OPEN fast; without this it would make the
     first click on every other tab slow instead, which is a worse trade on a
     screen an operator tabs through all day. So the chunks are fetched after
     the profile's own requests go quiet — never alongside them, because a
     prefetch that competes with the data the user is actually waiting for is
     the thing whenNetworkQuiet exists to prevent (same rule as the shell's
     badge reads and the activity beacon).

     Fire-and-forget by design: a failed warm-up is not an error, the tab just
     loads on click as it would have anyway. */
  useEffect(() => {
    let cancelled = false;
    void whenNetworkQuiet({ quietMs: 700, maxWaitMs: 6000 }).then(() => {
      if (cancelled) return;
      for (const load of SHEET_CHUNKS) void load().catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);
  /* Inline edits on the sheet: the saved patch is merged into the page at
     once, and the row is re-read behind it so derived fields catch up. */
  const [reloadTick, setReloadTick] = useState(0);
  /* Directional pane swap (owner pick 3A): forward slides from the end,
     back from the start; RTL flips in CSS. Fed to every Group below. */
  const tabMotion = useTabMotion(step);
  const [error, setError] = useState<string | null>(null);
  /* Family focus — which member the record is spotlighting. -1 = family
     view. Seeded from ?model= (card chips and search deep-link here);
     window.location instead of useSearchParams keeps the page out of the
     CSR-bailout/Suspense contract for one read-once param. */
  const [focusModel, setFocusModel] = useState(-1);
  const wantedModel = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return new URLSearchParams(window.location.search).get("model"); } catch { return null; }
  }, []);

  /* Classification icon HUB — the SAME live map the classify tab uses, so
     changing an icon in the Database app changes it here too (owner:
     "linked"). 60s shared cache; absent entry = keyword fallback. */
  const [classIcons, setClassIcons] = useState<Record<string, Record<string, string>>>({});
  const [, setBindings] = useState<BindingsMap>({});
  /* THE CLASSIFICATION HAS TRANSLATIONS AND THE PAGE WAS NOT ASKING FOR THEM.
     divisions / categories / subcategories each carry name_zh and name_ar, so
     "Garment Machinery" has been "آلات الملابس" in the database all along —
     the sheet simply printed the slug, and later the title-cased slug, which
     is English whatever the page language is. The taxonomy is already fetched
     and cached app-wide, so this costs nothing but the lookup. */
  const [taxo, setTaxo] = useState<TaxonomyNames>({ division: {}, category: {}, subcategory: {} });
  useEffect(() => {
    let alive = true;
    fetchClassificationIcons().then((m) => { if (alive) setClassIcons(m); }).catch(() => {});
    fetchIconBindings().then((m) => { if (alive) { BINDINGS_SNAPSHOT = m; setBindings(m); } }).catch(() => {});
    void import("@/lib/products-admin").then(({ fetchTaxonomyAll }) =>
      fetchTaxonomyAll().then((all) => {
        if (!alive) return;
        const index = (rows: { slug: string; name: string; name_zh?: string | null; name_ar?: string | null }[]) =>
          Object.fromEntries(rows.map((r) => [r.slug, { en: r.name, zh: r.name_zh ?? null, ar: r.name_ar ?? null }]));
        setTaxo({
          division: index(all.divisions),
          category: index(all.categories),
          subcategory: index(all.subcategories),
        });
      }).catch(() => {}),
    );
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        /* The profile response is cached for 15s (private, max-age=15). The
           first read may use that; a re-read AFTER an inline save must not —
           it came back with the pre-save row and overwrote the value the
           operator had just watched land. */
        const res = await fetch(`/api/products/${handle}/profile`, { credentials: "include", cache: reloadTick ? "no-store" : "default" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Profile;
        if (!cancelled) {
          setData(json);
          if (wantedModel) {
            const w = wantedModel.trim().toLowerCase();
            const idx = (json.models ?? []).findIndex((m) =>
              String(m.primary_model ?? "").trim().toLowerCase() === w ||
              String(m.model_name ?? "").trim().toLowerCase() === w);
            if (idx >= 0) setFocusModel(idx);
          }
        }
      } catch (e) {
        if (!cancelled) setError(humanizeError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [handle, wantedModel, reloadTick]);

  const p = data?.product;
  const editHref = p ? `/product-data/${p.id as string}/edit` : "#";
  const goStep = useCallback((step: string) => router.push(`${editHref}#${step}`), [editHref, router]);

  /* Columns the spec template owns — the inline Physical save writes the
     template's schema_specs (source) as well as the column (mirror). */
  const schemaCovers = useMemo(
    () => new Set((data?.schema?.groups ?? []).flatMap((g) => (g.fields ?? []).map((f) => f.key))),
    [data?.schema],
  );
  /* The same context the editor sends for its HS-code suggestion. */
  const aiContext = useMemo(() => {
    const prod = data?.product ?? {};
    const specs: Record<string, string> = {};
    for (const [k, v] of Object.entries((prod.schema_specs as Record<string, unknown> | null) ?? {})) {
      if (v === null || v === undefined || v === "" || typeof v === "object") continue;
      specs[k] = String(v);
      if (Object.keys(specs).length >= 40) break;
    }
    const nameOf = (kind: keyof TaxonomyNames, slug: unknown) => (slug ? taxo[kind][String(slug)]?.en : undefined);
    return {
      name: prod.product_name, brand: prod.brand,
      division: nameOf("division", prod.division_slug), category: nameOf("category", prod.category_slug), subcategory: nameOf("subcategory", prod.subcategory_slug),
      models: (data?.models ?? []).map((mm) => String(mm.primary_model ?? mm.model_name ?? "")).filter(Boolean).slice(0, 6),
      specs,
      description: String(prod.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
    };
  }, [data, taxo]);
  const hero = useMemo(() => {
    const main = (data?.media ?? []).find((m) => m.type === "main_image");
    return (main?.url as string) || null;
  }, [data]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-[13px] text-rose-300">{error}</div>
      </div>
    );
  }
  if (!data || !p) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />)}
      </div>
    );
  }

  const readiness = data.readiness?.overall ?? null;
  /* Cost lives on the variant OR on the supplier link — read both, so the
     Price tab never claims "Not set" while the Supplier tab shows a figure. */
  const primarySupplierCost = (() => {
    const withCost = data.suppliers.filter((x) => x.unit_cost_cny != null);
    const pick = withCost.find((x) => x.is_primary === true) ?? withCost[0];
    return pick ? Number(pick.unit_cost_cny) : null;
  })();

  const s2 = (k: string) => p[k];
  /* One merge for every sheet: show what was saved at once, then re-read the
     row behind it (no-store — the profile response is cached 15s). */
  const mergeSaved = (u: { product?: Row; models?: Record<string, Row>; media?: Row[]; translations?: Row[]; certifications?: Row[]; suppliers?: Row[]; related?: Row[]; documents?: Row[] }) => {
    setData((prev) => {
      if (!prev) return prev;
      const models = u.models
        ? prev.models.map((m) => (u.models![String(m.id)] ? { ...m, ...u.models![String(m.id)] } : m))
        : prev.models;
      return {
        ...prev,
        product: u.product ? { ...prev.product, ...u.product } : prev.product,
        models,
        media: u.media ?? prev.media,
        translations: u.translations ?? prev.translations,
        certifications: u.certifications ?? prev.certifications,
        suppliers: (u.suppliers as Profile["suppliers"] | undefined) ?? prev.suppliers,
        related: (u.related as Profile["related"] | undefined) ?? prev.related,
        documents: u.documents ?? prev.documents,
      };
    });
    setReloadTick((n) => n + 1);
  };
  /* The row glyph for a label — the Visual Library binding table, or nothing. */
  const glyphFor = (label: string) => {
    const src = iconForField(BINDINGS_SNAPSHOT, fieldKeyForLabel(label));
    return src ? <RowGlyph src={src} className="h-4 w-4" /> : null;
  };
  /* products.logistics — the single home for packing since 2026-09-13. */
  const logi = (p?.logistics ?? {}) as ProductLogistics;

  return (
    <div className="kx-pd min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1] w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8 space-y-4">
      {/* The edit screen leads with the tabs, not a page title — so does the
         record. A slim identity strip keeps "what am I looking at?" answered
         without pushing the tabs down the page. */}
      {/* The chrome row sits ABOVE the card, Back at the leading edge where
          every other app keeps it, the actions at the trailing edge. */}
      <div className="flex items-center gap-2 mb-3 min-w-0">
        <Link
          href="/product-data"
          aria-label={t("pp.back", "Back to Product Data")}
          className={BACK_CHROME}
          onClick={(e) => { if (dirtyRef.current) { e.preventDefault(); guard(() => router.push("/product-data")); } }}
        >
          <RrIcon name="arrow-left" size={14} />
          <span className="hidden text-[12px] font-medium sm:inline">{t("pp.backShort", "Product Data")}</span>
        </Link>
        <span className="flex-1" />
        {s2("slug") ? (
          <Link href={`/products/${s2("slug") as string}`} title={t("pp.publicPage", "Public page")}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ExternalLinkIcon className="h-3.5 w-3.5" /> {t("pp.publicPage", "Public page")}
          </Link>
        ) : null}
        {canEdit ? (
          <Link href={editHref}
            onClick={(e) => { if (dirtyRef.current) { e.preventDefault(); guard(() => router.push(editHref)); } }}
            className="h-8 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 transition-all shrink-0">
            <PencilIcon className="h-3.5 w-3.5" /> {t("action.edit", "Edit")}
          </Link>
        ) : null}
      </div>
      {/* THE HEADER IS THE PRODUCT: its photo at a size you can recognise,
          its name, and every KOLEEX model it answers to — the whole family
          when it is one, each code a chip that opens that model's spotlight.
          No new request: the photo is the main image the profile payload
          already carries, served at the CDN's row size. */}
      <div className="mb-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 sm:px-5 sm:py-4">
        {/* Phone: photo and name side by side, the codes under both — a tall
            family list next to a small square left the photo floating. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 sm:contents">
            <div className="h-[84px] w-[84px] sm:h-[124px] sm:w-[124px] shrink-0 rounded-xl bg-gradient-to-b from-white to-[#f4f5f7] border border-black/10 overflow-hidden flex items-center justify-center">
              {hero
                ? <img src={IMG.row(hero)} alt="" decoding="async" className="h-full w-full object-contain p-2" />
                : <ImageRawIcon className="h-6 w-6 text-gray-400" />}
            </div>
            <h1 className="sm:hidden text-[17px] font-semibold tracking-tight text-[var(--text-primary)] leading-snug break-words min-w-0">
              {(s2("product_name") as string) || t("pp.untitled", "Untitled product")}
            </h1>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="hidden sm:block text-[20px] font-semibold tracking-tight text-[var(--text-primary)] leading-snug break-words">
              {(s2("product_name") as string) || t("pp.untitled", "Untitled product")}
            </h1>
            {/* The codes: one chip per model. A family shows every member,
                the primary marked with the dot; a chip opens that model. */}
            {/* Phone: the codes ride ONE scrolling line (a seven-member family
                stacked seven chips tall pushed the tabs off the screen);
                desktop wraps them. The family count sits above the line on a
                phone, inline after it on desktop. */}
            {data.models.length > 1 && (
              <div className="sm:hidden mt-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] tabular-nums">{t("pp.fam.label", "Family")} · {data.models.length} {t("pp.fam.members", "models")}</div>
            )}
            <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:flex-wrap max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:-mx-4 max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
              {data.models.length === 0 ? (
                <span className="text-[11px] font-mono text-[var(--text-ghost)]">{t("pp.noCode", "no code")}</span>
              ) : data.models.map((m, i) => {
                const code = String(m.primary_model ?? m.model_name ?? `#${i + 1}`);
                const active = focusModel === i;
                const family = data.models.length > 1;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!family}
                    onClick={() => family && setFocusModel(active ? -1 : i)}
                    title={family ? (active ? t("pp.fam.close", "Close model view") : String(m.model_name ?? "")) : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11.5px] sm:text-[12px] font-mono font-semibold tabular-nums transition-colors ${
                      active
                        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                        : "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)]"
                    } ${family ? "hover:border-[var(--border-strong)]" : "cursor-default"}`}
                  >
                    {i === 0 && family && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--text-inverted)]" : "bg-[var(--text-ghost)]"}`} title={t("pp.primary", "Primary")} />}
                    {code}
                  </button>
                );
              })}
              {data.models.length > 1 && (
                <span className="hidden sm:inline text-[10.5px] text-[var(--text-ghost)] tabular-nums ms-1">{t("pp.fam.label", "Family")} · {data.models.length} {t("pp.fam.members", "models")}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
                {(() => { const st = (s2("status") as string) || "draft"; return t(`status.${st}`, st); })()}
              </span>
              {readiness != null && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] shrink-0">
                  <span className="inline-block h-1 w-14 rounded-full bg-[var(--bg-surface)] overflow-hidden align-middle">
                    <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
                  </span>
                  {readiness}%
                </span>
              )}
              {data.subcategory?.code ? <span className="text-[10.5px] font-mono text-[var(--text-ghost)]">{data.subcategory.code}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs FIRST — always at the top (owner rule); the family bar and
          the member spotlight live UNDER them. */}
      <ProfileTabs current={step} onPick={(i) => guard(() => setStep(i))} />
      <ConfirmDialog
        open={leaveAsk !== null}
        tone="neutral"
        onCancel={() => setLeaveAsk(null)}
        onConfirm={() => { const go = leaveAsk; setLeaveAsk(null); dirtyRef.current = false; go?.(); }}
        title={t("wizard.confirmDiscardTitle", "Discard unsaved changes?")}
        message={t("wizard.confirmDiscard", "Discard your changes and leave this page? Anything you've edited that hasn't been saved will be lost.")}
        confirmLabel={t("wizard.discardConfirm", "Discard & leave")}
        cancelLabel={t("wizard.discardCancel", "Keep editing")}
      />

      {/* ── Family bar ── one product, several sellable models. Picking a
          member opens its spotlight: square photo, tight one-line facts,
          resolved specs. Display-only. */}
      {/* The family chips live in the header now; only the spotlight of the
          chosen model stays under the tabs. */}
      {data.models.length > 1 && focusModel >= 0 && (
        <div className="mb-4">
          {focusModel >= 0 && data.models[focusModel] && (() => {
            const m = data.models[focusModel];
            const mPhoto = (data.media ?? []).find(
              (md) => md.type === "model_image" && (md.model_id as string | null) === (m.id as string),
            )?.url as string | undefined;
            const photo = mPhoto || hero;
            const specs = (p["schema_specs"] as Record<string, unknown> | null) ?? {};
            const ov = (m.specs_overrides as Record<string, unknown> | null) ?? {};
            const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
            const diffCount = Object.entries(ov).filter(([, v]) => !isEmpty(v)).length;
            /* One-line fact row — dense by design; "Not set" stays visible
               (this is the record) but costs one thin line, not a block. */
            const fact = (label: string, value: unknown, mono = false) => (
              <div key={label} className="flex items-center justify-between gap-3 py-[5px] border-b border-[var(--border-subtle)]/40 last:border-0 text-[12px]">
                <span className="text-[var(--text-dim)] shrink-0">{label}</span>
                {value === null || value === undefined || value === "" ? (
                  <span className="text-[11px] italic text-[var(--text-ghost)]">{t("pp.notSet", "Not set")}</span>
                ) : (
                  <span className={`text-[var(--text-primary)] text-end truncate ${mono ? "font-mono text-[11.5px]" : "tabular-nums"}`}>{String(value)}</span>
                )}
              </div>
            );
            return (
              <div className="mt-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden kx-glow-in">
                {/* Spotlight header */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50">
                  <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
                    {String(m.primary_model ?? m.model_name ?? "")}
                  </span>
                  {Boolean(m.model_name && m.primary_model && String(m.model_name) !== String(m.primary_model)) && (
                    <span className="text-[12px] text-[var(--text-muted)] truncate">{String(m.model_name)}</span>
                  )}
                  {focusModel === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{t("pp.primary", "Primary")}</span>
                  )}
                  {diffCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-dim)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
                      {diffCount} {t("pp.fam.diffCount", "differences")}
                    </span>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setFocusModel(-1)}
                    aria-label={t("pp.fam.close", "Close model view")}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    <CrossIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Body: SQUARE photo + dense facts on the start side; the
                    resolved spec sheet fills the rest. No dead space —
                    every fact is a single line. */}
                {/* Body: square photo + fact list SIDE BY SIDE (their
                    heights pair up — six thin rows ≈ one square), then a
                    hairline divider and the spec sheet filling the rest.
                    Nothing under anything = no dead space. */}
                <div className="p-4 flex flex-col lg:flex-row gap-5">
                  <div className="flex gap-4 shrink-0 min-w-0">
                    {photo && (
                      <div className="h-[150px] w-[150px] max-sm:h-[104px] max-sm:w-[104px] shrink-0 rounded-xl bg-gradient-to-b from-white to-[#f4f5f7] border border-black/5 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={IMG.card(photo)} alt="" className="h-full w-full object-contain p-2.5" loading="lazy" decoding="async" />
                      </div>
                    )}
                    <div className="w-[240px] max-sm:flex-1 max-sm:w-auto self-center">
                      {fact(t("pp.f.koleexCode", "KOLEEX code"), m.primary_model, true)}
                      {fact(t("pp.f.supRef", "Supplier ref"), m.reference_model, true)}
                      {fact(t("pp.f.tagline", "Tagline"), m.tagline)}
                      {fact(t("pp.f.stock", "Stock"), m.stock_status)}
                      {fact(t("pp.f.globalPrice", "Global price (USD)"), m.global_price)}
                      {data.costVisible && fact(t("pp.f.costPrice", "Cost (CNY)"), m.cost_price ?? primarySupplierCost)}
                    </div>
                  </div>

                  <div className="hidden lg:block w-px self-stretch bg-[var(--border-subtle)]/60" />

                  <div className="flex-1 min-w-0">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-2">
                      {t("pp.fam.resolved", "Specifications for this model")}
                    </div>
                    {(() => {
                      const rowsOut: React.ReactNode[] = [];
                      for (const g of data.schema?.groups ?? []) {
                        for (const f of g.fields ?? []) {
                          const overridden = !isEmpty(ov[f.key]);
                          const v = overridden ? ov[f.key] : specs[f.key];
                          if (isEmpty(v)) continue;
                          rowsOut.push(
                            <div key={f.key} className="flex items-baseline justify-between gap-3 text-[12px] py-[5px] border-b border-[var(--border-subtle)]/40">
                              <span className="flex items-center gap-1.5 text-[var(--text-dim)] min-w-0">
                                {overridden && <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2] shrink-0" title={t("pp.fam.differs", "Differs from family value")} />}
                                <span className="truncate">{f.label || f.key}</span>
                              </span>
                              <span className={`text-end tabular-nums ${overridden ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}>
                                {Array.isArray(v) ? v.join(", ") : String(v)}
                                {f.unit ? <span className="text-[var(--text-ghost)] ms-1 font-normal">{f.unit}</span> : null}
                              </span>
                            </div>
                          );
                        }
                      }
                      if (rowsOut.length === 0) {
                        return <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.fam.allInherit", "This model inherits every family specification.")}</p>;
                      }
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">{rowsOut}</div>
                          <p className="mt-2 text-[10.5px] text-[var(--text-ghost)]">
                            {diffCount > 0
                              ? t("pp.fam.inheritNote", "Fields without a dot inherit the family value.")
                              : t("pp.fam.allInherit", "This model inherits every family specification.")}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* The editor keeps the classification visible above every tab but the
         first, so you always know what template you are reading against. */}
      {STEPS[step].id !== "classify" && (
        <div className="flex items-center gap-2 flex-wrap text-[12px] mb-4 px-1">
          <span className="uppercase tracking-wider text-[10px] text-[var(--text-ghost)]">{t("pp.f.classification", "Classification")}:</span>
          {/* A SLUG IS A URL FRAGMENT, NOT A LABEL. Only the subcategory is
              fetched as a row with a name, so the first two links printed
              "garment-machinery" and "fabric-preparation" verbatim — which
              reads as leftover code in every language, Arabic included.
              Title-casing is the honest half-measure available without a
              second request; the real fix is to fetch the division and
              category rows and show their localised names. */}
          <span className="text-[var(--text-dim)]">{taxoLabel(taxo, "division", s2("division_slug"), lang)}</span>
          <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" />
          <span className="text-[var(--text-dim)]">{taxoLabel(taxo, "category", s2("category_slug"), lang)}</span>
          <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" />
          <span className="text-[var(--text-primary)] font-medium">{taxoLabel(taxo, "subcategory", s2("subcategory_slug"), lang)}</span>
          {data.subcategory?.code && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{data.subcategory.code}</span>
          )}
        </div>
      )}

      {/* ── Step panels — one at a time, exactly like the editor ── */}
      {STEPS[step].id === "classify" && (
        <ClassifySheet
          product={p}
          subcategory={data.subcategory}
          schema={data.schema ? { name: data.schema.name, version: data.schema.version } : null}
          modelCount={data.models?.length ?? 0}
          productId={p?.id as string | undefined}
          t={t} lang={lang} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(patch) => mergeSaved({ product: patch })}
          taxoName={(tier, slug) => (typeof slug === "string" && taxo[tier][slug] ? taxoLabel(taxo, tier, slug, lang) : null)}
          classIcons={classIcons}
          glyph={glyphFor}
        />
      )}

      {STEPS[step].id === "supplier" && (
        <SupplierSheet
          suppliers={data.suppliers}
          costVisible={data.costVisible}
          productId={p?.id as string | undefined}
          t={t} lang={lang} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(rows) => mergeSaved({ suppliers: rows })}
          glyph={glyphFor}
        />
      )}

      {STEPS[step].id === "identity" && (
        <HeroSheet
          product={p}
          models={data.models}
          media={data.media}
          translations={data.translations}
          suppliers={data.suppliers}
          subcategoryCode={data.subcategory?.code ?? null}
          productId={p?.id as string | undefined}
          t={t} lang={lang} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={mergeSaved}
          glyph={glyphFor}
          aiContext={aiContext}
        />
      )}

      {STEPS[step].id === "specs" && (
        <SpecsSheet
          product={p}
          schema={data.schema as React.ComponentProps<typeof SpecsSheet>["schema"]}
          productId={p?.id as string | undefined}
          t={t} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(patch) => mergeSaved({ product: patch })}
          glyph={glyphFor}
        />
      )}

      {STEPS[step].id === "commercial" && (
        <VariantsSheet
          product={p}
          models={data.models}
          media={data.media}
          schemaGroups={(data.schema?.groups ?? []) as Array<{ fields?: Array<Record<string, unknown> & { key: string; label?: string; unit?: string }> }>}
          productId={p?.id as string | undefined}
          t={t} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(u) => mergeSaved({ product: u.product })}
          glyph={glyphFor}
        />
      )}

      {STEPS[step].id === "options" && (
        <OptionsSheet
          productId={p?.id as string | undefined}
          t={t} lang={lang} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      )}

      {/* THE EDITOR'S PRICE TAB, READ-ONLY UNTIL EDIT: Cost Price synced to
          the supplier, the Base FOB chain, the market ladder, then the
          selling prices per variant — each card editable where it stands. */}
      {STEPS[step].id === "pricing" && (
        <PriceSheet
          product={p}
          models={data.models}
          suppliers={data.suppliers}
          costVisible={data.costVisible}
          productId={p?.id as string | undefined}
          t={t}
          lang={lang}
          motion={tabMotion}
          canEdit={canEdit}
          notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(u) => {
            /* Show the saved values at once; the re-read behind it catches
               derived fields (the profile response is cached 15s, so the
               re-read is no-store — see the fetch effect). */
            setData((prev) => {
              if (!prev) return prev;
              const models = u.models
                ? prev.models.map((m) => (u.models![String(m.id)] ? { ...m, ...u.models![String(m.id)] } : m))
                : prev.models;
              return { ...prev, models, suppliers: (u.suppliers as Profile["suppliers"] | undefined) ?? prev.suppliers };
            });
            setReloadTick((n) => n + 1);
          }}
          onHistory={setHistoryFor}
        />
      )}

      <CostHistoryDrawer target={historyFor} onClose={() => setHistoryFor(null)} t={t} />

      {/* THIS SHEET IS THE EDIT TAB, READ-ONLY: the same five cards, in the
          same order, under the same titles and badges. It used to be a flat
          list of six rows under one heading, so the page and the form it
          mirrors did not read as the same subject at all - nothing about
          crates, nothing about loading, and the packing just typed on the form
          was nowhere on it. */}
      {STEPS[step].id === "logistics" && (
        <PackingSheet
          logistics={logi}
          model={data.models[0]}
          product={p}
          t={t}
          lang={lang}
          motion={tabMotion}
          productId={p?.id as string | undefined}
          schemaCovers={schemaCovers}
          canEdit={canEdit}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          aiContext={aiContext}
          onSaved={(patch) => {
            setData((prev) => (prev ? { ...prev, product: { ...prev.product, ...patch } } : prev));
            setReloadTick((n) => n + 1);
          }}
        />
      )}

      {STEPS[step].id === "compliance" && (
        <ComplianceSheet
          product={p}
          certifications={data.certifications}
          productId={p?.id as string | undefined}
          t={t} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          schemaCovers={schemaCovers}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(patch, certs) => mergeSaved({ product: patch, certifications: certs })}
          glyph={glyphFor}
        />
      )}

      {/* Feature Highlights — its own tab (owner call): catalog-style
          photo+explanation cards; the component fetches itself. */}
      {STEPS[step].id === "highlights" && (
        <Group motion={tabMotion} icon={<ImageRawIcon className="h-4 w-4" />} title={t("pp.sec.highlights", "Feature Highlights")} count="" editLabel={t("action.edit", "Edit")} onEdit={() => goStep("highlights")}>
          <FeatureHighlightsDisplay productId={String(data.product.id ?? "")} />
        </Group>
      )}

      {STEPS[step].id === "media" && (
        <MediaSheet
          product={p}
          media={data.media}
          documents={data.documents}
          models={data.models}
          productId={p?.id as string | undefined}
          t={t} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(u) => mergeSaved({ media: u.media, documents: u.documents })}
          glyph={glyphFor}
        />
      )}

      {STEPS[step].id === "knowledge" && (
        <KnowledgeSheet
          product={p}
          related={data.related}
          productId={p?.id as string | undefined}
          t={t} lang={lang} motion={tabMotion} canEdit={canEdit} notSet={NOT_SET}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
          onSaved={(u) => mergeSaved({ product: u.product, related: u.related })}
        />
      )}

      {STEPS[step].id === "finalize" && (
        <ReviewSheet
          product={p}
          models={data.models}
          media={data.media}
          translations={data.translations}
          suppliers={data.suppliers}
          schema={data.schema}
          readiness={data.readiness}
          t={t} motion={tabMotion} notSet={NOT_SET}
          glyph={glyphFor}
          onGo={(id) => { const i = STEPS.findIndex((st) => st.id === id); if (i >= 0) guard(() => setStep(i)); }}
        />
      )}
      </div>
    </div>
  );
}

/* ── P6: Cost history drawer ─────────────────────────────────────────────
   Read-only view over the append-only product_cost_history ledger (the
   GET /api/products/cost-history API shipped in P2). Opened per variant
   from the Cost & Price group; visible only to cost-visible viewers. */
function CostHistoryDrawer({ target, onClose, t }: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  t: (k: string, f?: string) => string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    /* No synchronous reset here. The drawer is mounted permanently and only
       `target` changes, so clearing rows on close used to run a setState
       during the effect — a cascading render on every dismissal. The list is
       not rendered while target is null anyway, and the fetch below replaces
       it before the next open can paint, so there is nothing to clear. */
    if (!target) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/products/cost-history?model_id=${encodeURIComponent(target.id)}`, { credentials: "include" });
        const j = (await r.json().catch(() => null)) as { history?: Row[] } | null;
        if (alive) setRows(j?.history ?? []);
      } catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [target]);

  return (
    <Drawer
      open={target !== null}
      onClose={onClose}
      eyebrow={t("pp.f.costHistory", "Cost history")}
      title={target?.name || ""}
    >
      {rows === null ? (
        <div className="space-y-2 p-1">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-[var(--bg-surface-subtle)] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-dim)] py-8 text-center">{t("pp.h.empty", "No cost changes recorded for this variant yet.")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <div key={String(h.id)} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
                  {h.previous_head_cost != null ? `¥${Number(h.previous_head_cost).toLocaleString()} → ` : ""}
                  ¥{Number(h.new_head_cost ?? 0).toLocaleString()}
                </span>
                <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">
                  {new Date(String(h.created_at)).toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                {String(h.user_name ?? "—")} · {t("pp.h.src." + String(h.source ?? ""), String(h.source ?? "—"))}
                {h.note ? <span className="text-[var(--text-ghost)]"> — {String(h.note)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
