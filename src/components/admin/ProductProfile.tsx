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

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IMG } from "@/lib/cdn";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import TabStrip from "@/components/ui/TabStrip";

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
  "pp.sec.logistics": { en: "Logistics & Customs", zh: "物流与海关",    ar: "اللوجستيات والجمارك" },
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
  "pp.f.machineWeight": { en: "Machine weight (kg)", zh: "机器重量(kg)", ar: "وزن الماكينة (كجم)" },
  "pp.f.machineDims": { en: "Machine dimensions", zh: "机器尺寸",       ar: "أبعاد الماكينة" },
  "pp.f.packingTitle": { en: "Primary variant packing", zh: "主型号包装", ar: "تغليف المتغيّر الأساسي" },
  "pp.f.netWeight":   { en: "Net weight",         zh: "净重",           ar: "الوزن الصافي" },
  "pp.f.grossWeight": { en: "Gross weight",       zh: "毛重",           ar: "الوزن القائم" },
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
  readiness: { overall: number; dimensions?: Array<{ key: string; label: string; score: number }> } | null;
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

function RowGlyph({ src, className = "h-3 w-3" }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-middle ${className}`}
      style={{ maskImage: `url("${src}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${src}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

const VL_ICON_RULES: Array<[RegExp, string]> = [
  [/visible|visibility/i, "general/security/eye.svg"],
  [/featured/i, "pack/status/ranking-star.svg"],
  [/sourcing status/i, "pack/status/memo-circle-check.svg"],
  [/status|lifecycle/i, "general/status/info.svg"],
  [/level/i, "pack/actions/layers.svg"],
  [/division/i, "general/business/building.svg"],
  [/subcategory code|category code|koleex code|^code|model code|barcode/i, "general/inventory/barcode.svg"],
  [/subcategory/i, "pack/actions/layers.svg"],
  [/category/i, "pack/files/folder-tree.svg"],
  [/family/i, "general/inventory/boxes.svg"],
  [/template/i, "general/database/settings.svg"],
  [/supplier product code|reference/i, "pack/devices/barcode-read.svg"],
  [/supplier/i, "general/manufacturing/factory.svg"],
  [/url|slug|link/i, "pack/actions/link.svg"],
  [/brand/i, "pack/documents/crown.svg"],
  [/name|title/i, "pack/commerce/label.svg"],
  [/tagline|description|excerpt|note/i, "general/documents/document.svg"],
  [/cost/i, "pack/finance/dollar.svg"],
  [/pricing mode/i, "pack/actions/settings-sliders.svg"],
  [/price/i, "pack/finance/money-bill-wave.svg"],
  [/margin|percent|tax|vat/i, "pack/misc/percentage.svg"],
  [/moq|quantity|stock/i, "general/inventory/boxes.svg"],
  [/lead|time/i, "general/time/clock.svg"],
  [/payment/i, "pack/finance/money-bill-wave.svg"],
  [/currency/i, "general/finance/coins.svg"],
  [/incoterm/i, "pack/maps/passport.svg"],
  [/sample/i, "pack/status/cube.svg"],
  [/warranty|shield/i, "general/security/shield.svg"],
  [/supply|warehouse|container/i, "pack/misc/container-storage.svg"],
  [/sku/i, "pack/commerce/label.svg"],
  [/weight/i, "pack/actions/scale.svg"],
  [/cbm|volume/i, "pack/status/cube.svg"],
  [/packing|carton|box/i, "general/inventory/box.svg"],
  [/hs /i, "general/maps/globe.svg"],
  [/origin|country/i, "pack/maps/flag.svg"],
  [/voltage|power|watt|frequency|phase|electric|plug|motor/i, "pack/manufacturing/bolt.svg"],
  [/colou?r/i, "pack/actions/palette.svg"],
  [/dimension|size|length|width|height|diameter/i, "pack/manufacturing/ruler-combined.svg"],
  [/speed|rpm/i, "pack/analytics/chart-line-up-down.svg"],
  [/capacity/i, "pack/devices/battery-full.svg"],
  [/certificat|cert |diploma|compliance/i, "pack/documents/diploma.svg"],
  [/manual|datasheet|brochure|document|file/i, "general/documents/document.svg"],
  [/photo|image|media|gallery|video/i, "pack/files/camera.svg"],
  [/language|market/i, "pack/actions/language.svg"],
  [/date|created|updated|quoted|valid/i, "general/time/calendar.svg"],
  [/knowledge|related/i, "pack/actions/book-open-cover.svg"],
  [/readiness/i, "pack/status/memo-circle-check.svg"],
];

function iconForLabel(label: string): string {
  for (const [re, path] of VL_ICON_RULES) if (re.test(label)) return VL_BASE + path;
  return VL_BASE + "general/status/info.svg";
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

/* The editor's Section card, field-for-field: icon in a rounded square,
   title, optional badge, collapse chevron. */
function Group({
  icon, title, count, onEdit, children,
}: { icon?: React.ReactNode; title: string; count?: string; onEdit?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="kx-tab-in scroll-mt-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
      <div className="w-full flex items-center gap-3 px-6 py-4">
        <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
          {icon}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left truncate">{title}</h2>
        {count && (
          <span className="text-[10px] font-medium text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full shrink-0">{count}</span>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <PencilIcon className="h-3 w-3" /> Edit
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors" aria-label={open ? "Collapse" : "Expand"}>
          <AngleDownIcon className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && <div className="px-6 pb-6 pt-4 border-t border-[var(--border-subtle)]">{children}</div>}
    </section>
  );
}

/* ── Steps ────────────────────────────────────────────────────────────────
   The SAME eleven sections the editor shows, in the same order, under the
   same labels. The record and the editor are two views of one thing, so the
   navigation must not differ between them. */
const STEPS = [
  { id: "classify",   short: "Classify" },
  { id: "supplier",   short: "Supplier" },
  { id: "identity",   short: "Hero" },
  { id: "specs",      short: "Specs" },
  { id: "commercial", short: "Variants" },
  { id: "pricing",    short: "Price" },
  { id: "logistics",  short: "Logistics" },
  { id: "compliance", short: "Compliance" },
  { id: "media",      short: "Media & Files" },
  { id: "knowledge",  short: "Knowledge" },
  { id: "finalize",   short: "Review" },
] as const;

/* The editor's own sticky tab bar, via the same canonical TabStrip — not a
   lookalike, the same component. */
function ProfileTabs({ current, onPick }: { current: number; onPick: (i: number) => void }) {
  return (
    <nav className="sticky top-0 z-20 mb-6 py-2 bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <TabStrip
        ariaLabel="Product sections"
        items={STEPS.map((st, i) => ({
          key: st.id,
          label: st.short,
          active: i === current,
          onClick: () => onPick(i),
        }))}
      />
    </nav>
  );
}

/* The editor's eleven media slots, in its order, resolved through ITS OWN
   i18n keys (media.slot.*). The record has to show the empty slots too —
   "no packing photos" is exactly the kind of thing an operator opens this
   page to discover, and a bare thumbnail grid hides it. */
const MEDIA_SLOTS: Array<{ type: string; fallback: string }> = [
  { type: "main_image",    fallback: "Main Image" },
  { type: "gallery",       fallback: "Gallery" },
  { type: "packing_photo", fallback: "Packing Photos" },
  { type: "label",         fallback: "Labels & Logos" },
  { type: "manual",        fallback: "User Manual" },
  { type: "datasheet",     fallback: "Datasheet" },
  { type: "brochure",      fallback: "Brochure" },
  { type: "certificate",   fallback: "Certificate" },
  { type: "parts_list",    fallback: "Parts List" },
  { type: "ar_3d",         fallback: "3D / AR" },
  { type: "video",         fallback: "Video" },
];

/* The editor's field row: label on top, value under it, help line beneath.
   Used by every tab so a reader never meets two different field shapes. */
function Row({ label, value, help, mono, badge }: {
  label: string; value: unknown; help?: string; mono?: boolean; badge?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {/* Icon tile — the eye's anchor while scanning down the sheet.
          Always a Visual Library glyph (owner rule). */}
      <span className="mt-0.5 h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
        <RowGlyph src={iconForLabel(label)} className="h-4 w-4" />
      </span>
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

const rows = "divide-y divide-[var(--border-subtle)]";

const grid = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4";

export default function ProductProfile() {
  const params = useParams<{ id: string }>();
  const handle = params?.id;
  const router = useRouter();
  const { t } = useTranslation(useMemo(() => ({ ...PRODUCTS_UI_I18N, ...PROFILE_T }), []));

  const [data, setData] = useState<Profile | null>(null);
  NOT_SET = t("pp.notSet", "Not set");
  const [step, setStep] = useState(0);
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

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${handle}/profile`, { credentials: "include" });
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
  }, [handle, wantedModel]);

  const p = data?.product;
  const editHref = p ? `/product-data/${p.id as string}/edit` : "#";
  const goStep = useCallback((step: string) => router.push(`${editHref}#${step}`), [editHref, router]);

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 md:py-8 space-y-4">
      {/* The edit screen leads with the tabs, not a page title — so does the
         record. A slim identity strip keeps "what am I looking at?" answered
         without pushing the tabs down the page. */}
      <div className="flex items-center gap-3 mb-3 min-w-0">
        <Link
          href="/product-data"
          aria-label={t("pp.back", "Back to Product Data")}
          className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
        </Link>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
          {(s2("product_name") as string) || t("pp.untitled", "Untitled product")}
        </h1>
        <span className="text-[11px] font-mono text-[var(--text-dim)] shrink-0">{(data.models[0]?.primary_model as string) || ""}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
          {(s2("status") as string) || "draft"}
        </span>
        {readiness != null && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] shrink-0">
            <span className="inline-block h-1 w-14 rounded-full bg-[var(--bg-surface)] overflow-hidden align-middle">
              <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
            </span>
            {readiness}%
          </span>
        )}
        <span className="flex-1" />
        {s2("slug") ? (
          <Link href={`/products/${s2("slug") as string}`} title={t("pp.publicPage", "Public page")}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0">
            <ExternalLinkIcon className="h-3.5 w-3.5" /> {t("pp.publicPage", "Public page")}
          </Link>
        ) : null}
        <Link href={editHref}
          className="h-8 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all shrink-0">
          <PencilIcon className="h-3.5 w-3.5" /> {t("action.edit", "Edit")}
        </Link>
      </div>

      {/* Tabs FIRST — always at the top (owner rule); the family bar and
          the member spotlight live UNDER them. */}
      <ProfileTabs current={step} onPick={setStep} />

      {/* ── Family bar ── one product, several sellable models. Picking a
          member opens its spotlight: square photo, tight one-line facts,
          resolved specs. Display-only. */}
      {data.models.length > 1 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="uppercase tracking-wider text-[10px] text-[var(--text-ghost)]">
              {t("pp.fam.label", "Family")}
            </span>
            <span className="text-[10px] text-[var(--text-dim)] tabular-nums">
              {data.models.length} {t("pp.fam.members", "models")}
            </span>
            <span className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />
            {data.models.map((m, i) => {
              const code = String(m.primary_model ?? m.model_name ?? `#${i + 1}`);
              const active = focusModel === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFocusModel(active ? -1 : i)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold tabular-nums transition-colors ${
                    active
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                      : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                  }`}
                >
                  {i === 0 && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--text-inverted)]" : "bg-[var(--text-ghost)]"}`} title={t("pp.primary", "Primary")} />}
                  {code}
                </button>
              );
            })}
          </div>

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
          <span className="text-[var(--text-dim)]">{(s2("division_slug") as string) || "—"}</span>
          <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" />
          <span className="text-[var(--text-dim)]">{(s2("category_slug") as string) || "—"}</span>
          <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)]" />
          <span className="text-[var(--text-primary)] font-medium">{data.subcategory?.name ?? "—"}</span>
          {data.subcategory?.code && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{data.subcategory.code}</span>
          )}
        </div>
      )}

      {/* ── Step panels — one at a time, exactly like the editor ── */}
      {STEPS[step].id === "classify" && (
      <Group icon={<FolderTreeIcon className="h-4 w-4" />} title={t("pp.sec.classification", "Classification")} onEdit={() => goStep("classify")}>
        <div className={rows}>
          <Row label={t("pp.f.division", "Division")} value={s2("division_slug")} />
          <Row label={t("pp.f.category", "Category")} value={s2("category_slug")} />
          <Row label={t("pp.f.subcategory", "Subcategory")} value={data.subcategory?.name ?? s2("subcategory_slug")} />
          <Row label={t("pp.f.subCode", "Subcategory code")} value={data.subcategory?.code} mono />
          {/* "Not set" reads as MISSING data, but a standalone product
              legitimately has no family (owner). Real family → member
              count; otherwise the free-text family; otherwise the honest
              default value "Standalone product". */}
          <Row
            label={t("pp.f.family", "Family")}
            value={
              (data.models?.length ?? 0) > 1
                ? t("pp.f.familyOfN", "Family of {n} models").replace("{n}", String(data.models.length))
                : (s2("family") as string | null) || t("pp.f.standalone", "Standalone product")
            }
          />
          <Row
                label={t("pp.f.level", "Level")}
                /* Show the tier LABEL, not the stored key — the record must
                   speak the same words as the editor and the policy page. */
                value={(() => {
                  const v = s2("level") as string | null;
                  if (!v) return null;
                  return t(`hero.level${v.charAt(0).toUpperCase()}${v.slice(1)}`, v);
                })()}
              />
          <Row label={t("pp.f.template", "Spec template")} value={data.schema ? `${data.schema.name} v${data.schema.version}` : null} />
        </div>
      </Group>
      )}

      {STEPS[step].id === "supplier" && (
      <Group icon={<FactoryIcon className="h-4 w-4" />} title={t("pp.sec.supplier", "Supplier & Sourcing")} count={`${data.suppliers.length}`} onEdit={() => goStep("supplier")}>
        {data.suppliers.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noSupplier", "No supplier linked.")}</p>
        ) : (
          <div className="space-y-3">
            {data.suppliers.map((sup, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="h-8 w-8 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                    {sup.supplier?.logo ? <img src={IMG.thumb(sup.supplier.logo)} alt="" className="h-full w-full object-contain p-0.5" /> : <FactoryIcon className="h-3.5 w-3.5 text-gray-400" />}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{sup.supplier?.name ?? "—"}</span>
                  {sup.is_primary === true && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{t("pp.primary", "Primary")}</span>}
                </div>
                {/* The supplier tab leads with the supplier's own product photo,
                    so the record shows that slot too — filled or empty. */}
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-2">
                      {t("pp.f.supPhoto", "Supplier product photo")}
                    </div>
                    <div className="aspect-square w-full rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden flex items-center justify-center">
                      {sup.supplier_product_photo
                        ? <img src={IMG.card(sup.supplier_product_photo as string)} alt="" className="h-full w-full object-contain p-2" />
                        : <span className="text-[12px] text-[var(--text-ghost)] italic">{NOT_SET}</span>}
                    </div>
                  </div>
                  <div className={rows}>
                  <Row label={t("pp.f.supCode", "Supplier product code")} value={sup.supplier_product_code} mono />
                  <Row label={t("pp.f.supName", "Supplier product name")} value={sup.supplier_product_name} />
                  {data.costVisible && <Row label={t("pp.f.unitCost", "Unit cost (CNY)")} value={sup.unit_cost_cny} />}
                  <Row label={t("pp.f.supplyType", "Supply type")} value={sup.supply_type} />
                  <Row label={t("pp.f.incoterms", "Incoterms")} value={sup.incoterms} />
                  <Row label={t("pp.f.sourcing", "Sourcing status")} value={sup.sourcing_status} />
                  <Row label={t("pp.f.sampleAvail", "Sample available")} value={sup.sample_available} />
                  <Row label={t("pp.f.supWarranty", "Supplier warranty (months)")} value={sup.supplier_warranty_months} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "identity" && (
      <div className="space-y-4">
        {/* Same two-column hero the editor opens with: the product photo owns
            the left, status/visibility/name the right. */}
        <Group icon={<SparklesIcon className="h-4 w-4" />} title={t("pp.sec.identity", "Identity & lifecycle")} onEdit={() => goStep("identity")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-2">
                {t("media.slot.main_image.label", "Main Product Photo")}
              </div>
              <div className="aspect-square w-full max-w-[320px] rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden flex items-center justify-center">
                {hero
                  ? <img src={IMG.card(hero)} alt="" className="h-full w-full object-contain p-2" />
                  : <span className="text-[12px] text-[var(--text-ghost)] italic">{NOT_SET}</span>}
              </div>
            </div>
            <div className={rows}>
              <Row label={t("pp.f.status", "Status")} value={s2("status")} />
              <Row label={t("pp.f.visible", "Visible to customers")} value={s2("visible")} />
              <Row label={t("pp.f.featured", "Featured")} value={s2("featured")} />
              <Row label={t("pp.f.level", "Level")} value={s2("level")} />
              <Row label={t("pp.f.productName", "Product name")} value={s2("product_name")} />
              <Row label={t("pp.f.koleexCode", "KOLEEX code")} value={data.models[0]?.primary_model} mono />
            </div>
          </div>
          <div className={rows}>
            <Row label={t("pp.f.publicUrl", "Public URL")} value={s2("slug")} mono />
            <Row label={t("pp.f.brand", "Brand")} value={s2("brand")} />
            <Row label={t("pp.f.manufacturer", "Manufacturer")} value={s2("manufacturer")} />
            <Row label={t("pp.f.mpn", "MPN")} value={s2("mpn")} mono />
            <Row label={t("pp.f.gtin", "GTIN")} value={s2("gtin")} mono />
            <Row label={t("pp.f.sku", "Internal SKU")} value={s2("internal_sku")} mono />
            <Row label={t("pp.f.legacy", "Legacy code")} value={s2("legacy_code")} mono />
            <Row label={t("pp.f.generation", "Generation")} value={s2("generation")} />
            <Row label={t("pp.f.modelYear", "Model year")} value={s2("model_year")} />
            <Row label={t("pp.f.launch", "Launch date")} value={s2("launch_date")} />
            <Row label={t("pp.f.eol", "End of life")} value={s2("eol_date")} />
            <Row label={t("pp.f.availFrom", "Available from")} value={s2("available_from")} />
            <Row label={t("pp.f.lastOrder", "Last order date")} value={s2("last_order_date")} />
            <Row label={t("pp.f.aliases", "Alternate names")} value={s2("alternate_names")} />
            <Row label={t("pp.f.statusReason", "Status reason")} value={s2("status_reason")} />
          </div>
        </Group>
        <Group icon={<SparklesIcon className="h-4 w-4" />} title={t("pp.sec.description", "Description")} onEdit={() => goStep("identity")}>
          <div className="space-y-4">
            <Row label={t("pp.f.excerpt", "Short description")} value={s2("excerpt")} />
            <Row label={t("pp.f.description", "Full description")} value={s2("description")} />
            <Row label={t("pp.f.highlights", "Highlights")} value={s2("highlights")} />
            <Row label={t("pp.f.tags", "Tags")} value={s2("tags")} />
          </div>
        </Group>
        <Group icon={<SparklesIcon className="h-4 w-4" />} title={t("pp.sec.languages", "Languages & markets")} count={`${data.translations.length}`} onEdit={() => goStep("identity")}>
          {data.translations.length === 0
            ? <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.englishOnly", "English only — no localized names recorded.")}</p>
            : <div className={rows}>{data.translations.map((tr, i) => <Row key={i} label={String(tr.locale ?? "?")} value={tr.product_name} />)}</div>}
        </Group>
      </div>
      )}

      {STEPS[step].id === "specs" && (
      !data.schema ? (
        <Group icon={<Settings2Icon className="h-4 w-4" />} title={t("pp.sec.specs", "Specifications")} onEdit={() => goStep("specs")}>
          <p className="text-[12px] text-[var(--text-ghost)] italic">
            {t("pp.e.noTemplate", "No spec template resolves for this classification, so there are no specification fields to fill.")}
          </p>
        </Group>
      ) : (
        <div className="space-y-4">
          {(data.schema.groups ?? []).map((g, gi) => {
            const fields = g.fields ?? [];
            const specs = (s2("schema_specs") as Record<string, unknown> | null) ?? {};
            const isFilled = (k: string) => {
              const v = specs[k];
              return !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
            };
            const done = fields.filter((f) => isFilled(f.key)).length;
            return (
              <Group
                key={gi}
                icon={<Settings2Icon className="h-4 w-4" />}
                title={g.title || g.key || ""}
                count={`${done}/${fields.length}`}
                onEdit={() => goStep("specs")}
              >
                {/* One field per row with its own help line — the editor's
                    shape. A four-column grid packed more in but stripped the
                    descriptions, which are half of what makes a spec field
                    fillable. */}
                <div className="divide-y divide-[var(--border-subtle)]">
                  {fields.map((f) => (
                    <div key={f.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                        <RowGlyph src={iconForLabel(f.label || f.key)} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)]">
                            {f.label || f.key}
                            {f.required && <span className="text-rose-400 ms-1">*</span>}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {f.internalOnly
                              ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">INTERNAL</span>
                              : f.publicVisible
                              ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/90">PUBLIC</span>
                              : null}
                            {f.aiReadable && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">AI</span>}
                          </span>
                        </div>
                        <div>
                          <Val v={specs[f.key]} />
                          {f.unit && isFilled(f.key) ? <span className="text-[11px] text-[var(--text-ghost)] ms-1">{f.unit}</span> : null}
                        </div>
                        {f.description && (
                          <p className="mt-1 text-[10.5px] text-[var(--text-ghost)]/80 leading-relaxed">{f.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Group>
            );
          })}
        </div>
      )
      )}

      {STEPS[step].id === "commercial" && (
      <Group icon={<BoxesIcon className="h-4 w-4" />} title={t("pp.sec.variants", "Variants")} count={`${data.models.length}`} onEdit={() => goStep("commercial")}>
        {data.models.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noVariant", "No variant recorded — a product needs at least one.")}</p>
        ) : (
          <div className="space-y-3">
            {data.models.map((m, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{(m.model_name as string) || "Untitled variant"}</span>
                  <span className="text-[11px] font-mono text-[var(--text-dim)]">{(m.primary_model as string) || "—"}</span>
                  {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{t("pp.primary", "Primary")}</span>}
                </div>
                <div className={rows}>
                  <Row label={t("pp.f.variantName", "Variant name")} value={m.model_name} />
                  <Row label={t("pp.f.koleexCode", "KOLEEX code")} value={m.primary_model} mono />
                  <Row label={t("pp.f.supRef", "Supplier reference")} value={m.reference_model} mono />
                  <Row label={t("pp.f.tagline", "Tagline")} value={m.tagline} />
                  <Row label={t("pp.f.stock", "Stock status")} value={m.stock_status} />
                  <Row label={t("pp.f.barcode", "Barcode")} value={m.barcode} mono />
                  <Row label={t("pp.f.visible", "Visible")} value={m.visible} />
                  <Row label={t("pp.f.status", "Status")} value={m.status} />
                </div>
                {/* Per-model spec differences — the answer to "what makes
                    this size different". Labels/units come from the same
                    schema the Specs tab renders, so the two views can never
                    name a field differently. Everything not listed inherits
                    the product's Specifications. */}
                {(() => {
                  const ov = (m.specs_overrides as Record<string, unknown> | null) ?? {};
                  const entries = Object.entries(ov).filter(([, v]) => v !== null && v !== undefined && v !== "");
                  const fieldByKey = new Map<string, { label: string; unit?: string }>();
                  for (const g of data.schema?.groups ?? []) {
                    for (const f of g.fields ?? []) fieldByKey.set(f.key, { label: f.label || f.key, unit: f.unit });
                  }
                  if (entries.length === 0) {
                    return (
                      <p className="mt-2 text-[11px] text-[var(--text-ghost)] italic">
                        {t("pp.f.inheritsSpecs", "Inherits all product specifications — no per-model differences recorded yet.")}
                      </p>
                    );
                  }
                  return (
                    <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-2.5">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1.5">
                        {t("pp.f.techDiff", "Technical differences vs product specs")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {entries.map(([k, v]) => {
                          const f = fieldByKey.get(k);
                          return (
                            <div key={k} className="flex items-baseline justify-between gap-3 text-[12px]">
                              <span className="text-[var(--text-dim)]">{f?.label ?? k}</span>
                              <span className="text-[var(--text-primary)] font-medium tabular-nums text-end">
                                {Array.isArray(v) ? v.join(", ") : String(v)}
                                {f?.unit ? <span className="text-[var(--text-ghost)] ms-1 font-normal">{f.unit}</span> : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "pricing" && (
      <Group icon={<DollarSignIcon className="h-4 w-4" />} title={t("pp.sec.price", "Cost & Price")} count={`${data.models.length} variant`} onEdit={() => goStep("pricing")}>
        {data.models.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noPrice", "No variant to price.")}</p>
        ) : (
          <div className="space-y-3">
            {data.models.map((m, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
                  {(m.model_name as string) || "Untitled variant"}
                </div>
                <div className={rows}>
                  <Row label={t("pp.f.pricingMode", "Pricing mode")} value={m.pricing_mode ?? "fixed"} />
                  <Row label={t("pp.f.priceNote", "Price note")} value={m.price_note} />
                  {data.costVisible && (
                    <Row
                      label={t("pp.f.costPrice", "Cost price (CNY)")}
                      value={m.cost_price ?? primarySupplierCost}
                      help={m.cost_price == null && primarySupplierCost != null
                        ? t("pp.f.costFromSupplier", "From the supplier link — not set on this variant.")
                        : undefined}
                    />
                  )}
                  <Row label={t("pp.f.globalPrice", "Global price (USD)")} value={m.global_price} />
                  {data.costVisible && <Row label={t("pp.f.headPrice", "Head-only price")} value={m.head_only_price} />}
                  {data.costVisible && <Row label={t("pp.f.setPrice", "Complete-set price")} value={m.complete_set_price} />}
                  <Row label={t("pp.f.moq", "MOQ")} value={m.moq} />
                  <Row label={t("pp.f.leadTime", "Lead time")} value={m.lead_time} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "logistics" && (
      <Group icon={<GlobeIcon className="h-4 w-4" />} title={t("pp.sec.logistics", "Logistics & Customs")} onEdit={() => goStep("logistics")}>
        <div className={rows}>
          <Row label={t("pp.f.origin", "Country of origin")} value={s2("country_of_origin")} />
          <Row label={t("pp.f.hs", "HS code")} value={s2("hs_code")} mono />
          <Row label={t("pp.f.moq", "MOQ")} value={s2("moq")} />
          <Row label={t("pp.f.leadTime", "Lead time")} value={s2("lead_time")} />
          <Row label={t("pp.f.machineWeight", "Machine weight (kg)")} value={s2("machine_weight_kg")} />
          <Row label={t("pp.f.machineDims", "Machine dimensions")} value={s2("machine_dimensions")} />
        </div>
        {data.models[0] && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-2.5">{t("pp.f.packingTitle", "Primary variant packing")}</div>
            <div className={rows}>
              <Row label={t("pp.f.netWeight", "Net weight")} value={data.models[0].net_weight} />
              <Row label={t("pp.f.grossWeight", "Gross weight")} value={data.models[0].weight} />
              <Row label={t("pp.f.cbm", "CBM")} value={data.models[0].cbm} />
              <Row label={t("pp.f.carton", "Carton dimensions")} value={data.models[0].carton_dimensions} />
              <Row label={t("pp.f.packingType", "Packing type")} value={data.models[0].packing_type} />
              <Row label={t("pp.f.q20", "20ft qty")} value={data.models[0].container_20ft_qty} />
              <Row label={t("pp.f.q40", "40ft qty")} value={data.models[0].container_40ft_qty} />
              <Row label={t("pp.f.q40hq", "40HQ qty")} value={data.models[0].container_40hq_qty} />
            </div>
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "compliance" && (
      <Group icon={<ShieldCheckIcon className="h-4 w-4" />} title={t("pp.sec.compliance", "Compliance & Warranty")} count={`${data.certifications.length} cert`} onEdit={() => goStep("compliance")}>
        <div className={rows}>
          <Row label={t("pp.f.warrMonths", "Warranty (months)")} value={s2("warranty_months")} />
          <Row label={t("pp.f.warrType", "Warranty type")} value={s2("warranty_type")} />
          <Row label={t("pp.f.warrStart", "Starts from")} value={s2("warranty_start_from")} />
          <Row label={t("pp.f.warrCover", "Coverage")} value={s2("warranty_coverage")} />
          <Row label={t("pp.f.warrExcl", "Exclusions")} value={s2("warranty_exclusions")} />
          <Row label={t("pp.f.ce", "CE certified")} value={s2("ce_certified")} />
          <Row label={t("pp.f.rohs", "RoHS compliant")} value={s2("rohs_compliant")} />
          <Row label={t("pp.f.spares", "Spare parts availability")} value={s2("spare_parts_availability")} />
          <Row label={t("pp.f.serviceLife", "Service life")} value={s2("service_life")} />
          <Row label={t("pp.f.maintenance", "Maintenance interval")} value={s2("maintenance_interval")} />
          <Row label={t("pp.f.support", "Technical support")} value={s2("technical_support")} />
          <Row label={t("pp.f.channels", "Support channels")} value={s2("support_channels")} />
          <Row label={t("pp.f.training", "Training available")} value={s2("training_available")} />
          <Row label={t("pp.f.installation", "Installation service")} value={s2("installation_service")} />
          <Row label={t("pp.f.returns", "Returns policy")} value={s2("returns_policy")} />
        </div>
        {data.certifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-2">
            {data.certifications.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className="font-medium text-[var(--text-primary)]">{(c.cert_type as string) || "—"}</span>
                <span className="text-[var(--text-dim)]">{(c.certified_standard as string) || ""}</span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">{(c.cert_number as string) || ""}</span>
                {c.expiry_date ? <span className="text-[11px] text-[var(--text-ghost)]">expires {String(c.expiry_date)}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "media" && (
      <Group icon={<ImageRawIcon className="h-4 w-4" />} title={t("pp.sec.media", "Media & Documents")} count={`${data.media.length} media · ${data.documents.length} docs`} onEdit={() => goStep("media")}>
        {/* Photo / file slots — every slot, filled or not. */}
        <div className="space-y-4">
          {MEDIA_SLOTS.map((slot) => {
            const items = data.media.filter((m) => m.type === slot.type);
            const label = t(`media.slot.${slot.type}.label`, slot.fallback);
            return (
              <div key={slot.type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</span>
                  <span className="text-[10px] text-[var(--text-ghost)]">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <span className="text-[12px] text-[var(--text-ghost)] italic">{NOT_SET}</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {items.map((m, i) => {
                      const url = typeof m.url === "string" ? m.url : "";
                      const isImg = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
                      return (
                        <a key={i} href={url || undefined} target="_blank" rel="noreferrer"
                           className="h-20 w-20 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white flex items-center justify-center hover:border-[var(--border-focus)] transition-colors">
                          {isImg
                            ? <img src={IMG.thumb(url)} alt="" className="h-full w-full object-contain p-0.5" />
                            : <span className="text-[9px] text-gray-500 px-1 text-center break-all">{(m.file_name as string) || slot.fallback}</span>}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Identity images live on the product row, not in product_media —
              but they ARE photos, so an operator looking for "where are the
              images?" must find them here too. */}
          <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-4">
            {([["hero_poster_url", t("pp.f.heroPoster", "Hero poster")], ["brand_mark_url", t("pp.f.brandMark", "Brand mark")], ["og_image_url", "OG image"]] as const).map(([key, lbl]) => {
              const url = s2(key) as string | null;
              return (
                <div key={key}>
                  <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-1">{lbl}</div>
                  {url
                    ? <a href={url} target="_blank" rel="noreferrer" className="block h-20 w-full rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white">
                        <img src={IMG.thumb(url)} alt="" className="h-full w-full object-contain p-0.5" />
                      </a>
                    : <span className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.notSet", "Not set")}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {data.documents.length > 0 && (
          <div className="space-y-1.5">
            {data.documents.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="text-[var(--text-muted)]">{(d.doc_type as string) || "document"}</span>
                <span className="text-[var(--text-primary)] truncate">{(d.title as string) || (d.file_name as string) || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "knowledge" && (
      <Group icon={<BookOpenIcon className="h-4 w-4" />} title={t("pp.sec.knowledge", "Knowledge & Relationships")} count={`${data.related.length} linked`} onEdit={() => goStep("knowledge")}>
        <div className={rows}>
          <Row label={t("pp.f.knowledge", "Knowledge blocks")} value={((s2("schema_knowledge") as unknown[]) ?? []).length || null} />
        </div>
        {data.related.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-1.5">
            {data.related.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{(r.relation_type as string) || "related"}</span>
                {r.product?.slug
                  ? <Link href={`/product-data/${r.product.slug}`} className="text-[var(--text-primary)] hover:underline truncate">{r.product.name}</Link>
                  : <span className="text-[var(--text-dim)] truncate">{r.product?.name ?? "—"}</span>}
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      {STEPS[step].id === "finalize" && (
      <div className="space-y-4">
        <Group icon={<CheckIcon className="h-4 w-4" />} title={t("pp.sec.readiness", "Readiness")}>
          {readiness == null ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noScore", "No spec template resolves, so completeness can\u2019t be scored.")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-block h-1.5 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <span className={`block h-full rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500/80"}`} style={{ width: `${Math.max(2, readiness)}%` }} />
                </span>
                <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{readiness}%</span>
              </div>
              {data.readiness?.dimensions && (
                <div className={rows}>
                  {data.readiness.dimensions.map((d) => <Row key={d.key} label={d.label} value={`${d.score}%`} />)}
                </div>
              )}
            </div>
          )}
        </Group>
        <Group icon={<CheckIcon className="h-4 w-4" />} title={t("pp.sec.record", "Record")}>
          <div className={rows}>
            <Row label={t("pp.f.productId", "Product id")} value={s2("id")} mono />
            <Row label={t("pp.f.created", "Created")} value={s2("created_at")} />
            <Row label={t("pp.f.updated", "Last updated")} value={s2("updated_at")} />
            <Row label={t("pp.f.schemaVer", "Schema version")} value={s2("schema_version")} />
          </div>
        </Group>
      </div>
      )}
      </div>
    </div>
  );
}
