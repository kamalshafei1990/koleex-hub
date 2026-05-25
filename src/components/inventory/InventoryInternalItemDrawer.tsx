"use client";

/* ---------------------------------------------------------------------------
   InventoryInternalItemDrawer — centered popup, full visual polish.

   Each of the 18 categories gets a unique color token.
   Every subcategory card carries a matching icon.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import {
  INTERNAL_TAXONOMY,
  suggestSubSubcategories,
  type InternalCategoryHint,
} from "@/lib/inventory/internal-taxonomy";
import { ALLOWED_UNITS, type UnitOfMeasure, type IconName } from "@/lib/inventory/types";

/* ─── i18n ─────────────────────────────────────────────────── */

const T: Translations = {
  "inv.int.title":          { en: "Add Internal Item",        zh: "添加内部物品",       ar: "إضافة عنصر داخلي" },
  "inv.int.step.category":  { en: "Category",                 zh: "类别",              ar: "الفئة" },
  "inv.int.step.sub":       { en: "Subcategory",              zh: "子类别",            ar: "فئة فرعية" },
  "inv.int.step.subsub":    { en: "Variant",                  zh: "变体",              ar: "نوع" },
  "inv.int.step.details":   { en: "Details",                  zh: "详情",              ar: "تفاصيل" },
  "inv.int.step1.title":    { en: "What kind of item?",       zh: "什么类型的物品？",   ar: "أي نوع من العناصر؟" },
  "inv.int.step2.title":    { en: "Pick a subcategory",       zh: "选择子类别",         ar: "اختر فئة فرعية" },
  "inv.int.step3.title":    { en: "Pick a variant",           zh: "选择变体",           ar: "اختر النوع" },
  "inv.int.step4.title":    { en: "Item details",             zh: "物品详情",           ar: "تفاصيل العنصر" },
  "inv.int.back":           { en: "Back",                     zh: "返回",               ar: "رجوع" },
  "inv.int.skip":           { en: "Skip variant",             zh: "跳过变体",           ar: "تخطي النوع" },
  "inv.int.custom":         { en: "Custom…",                  zh: "自定义…",            ar: "مخصص…" },
  "inv.int.custom.placeholder": { en: "Type a subcategory…",  zh: "输入子类别…",        ar: "اكتب فئة فرعية…" },
  "inv.int.name":           { en: "Item name",                zh: "物品名称",           ar: "اسم العنصر" },
  "inv.int.name.ph":        { en: "e.g. A4 Printer Paper",    zh: "例：A4 打印纸",       ar: "مثال: ورق طابعة A4" },
  "inv.int.warehouse":      { en: "Warehouse",                zh: "仓库",               ar: "المستودع" },
  "inv.int.qty":            { en: "Quantity",                 zh: "数量",               ar: "الكمية" },
  "inv.int.unit":           { en: "Unit",                     zh: "单位",               ar: "الوحدة" },
  "inv.int.notes":          { en: "Notes (optional)",         zh: "备注（可选）",        ar: "ملاحظات (اختياري)" },
  "inv.int.notes.ph":       { en: "Anything the next person should know…", zh: "下一个人需要了解的内容…", ar: "أي شيء يجب أن يعرفه الشخص التالي…" },
  "inv.int.notes.add":      { en: "Add notes",                zh: "添加备注",           ar: "إضافة ملاحظات" },
  "inv.int.notes.hide":     { en: "Hide notes",               zh: "隐藏备注",           ar: "إخفاء الملاحظات" },
  "inv.int.save":           { en: "Create item",              zh: "创建物品",           ar: "إنشاء عنصر" },
  "inv.int.saving":         { en: "Saving…",                  zh: "保存中…",            ar: "جارٍ الحفظ…" },
  "inv.int.cancel":         { en: "Cancel",                   zh: "取消",               ar: "إلغاء" },
  "inv.int.close":          { en: "Close",                    zh: "关闭",               ar: "إغلاق" },
  "inv.int.opening.note":   { en: "An opening-balance movement will be posted automatically.", zh: "将自动过账期初余额。", ar: "سيتم ترحيل حركة رصيد افتتاحي تلقائياً." },
  "inv.int.err.name":       { en: "Item name required.",      zh: "请填写物品名称。",     ar: "اسم العنصر مطلوب." },
  "inv.int.err.warehouse":  { en: "Pick a warehouse for the opening quantity.", zh: "请选择期初数量的仓库。", ar: "اختر مستودعاً للكمية الافتتاحية." },
  "inv.int.search.ph":      { en: "Search items — laptop, A4 paper, helmet…", zh: "搜索物品：笔记本、A4纸、头盔…", ar: "ابحث: لاب توب، ورق A4، خوذة…" },
  "inv.int.search.empty":   { en: "No items matched. Try a different keyword.", zh: "未找到匹配物品，请换个关键词。", ar: "لا توجد نتائج. جرب كلمة مختلفة." },
  "inv.int.search.results": { en: "results", zh: "个结果", ar: "نتيجة" },
  "inv.int.cat.office_supply":        { en: "Office Supplies",      zh: "办公用品",     ar: "اللوازم المكتبية" },
  "inv.int.cat.marketing_material":   { en: "Marketing Materials",  zh: "营销物料",     ar: "مواد تسويقية" },
  "inv.int.cat.exhibition_material":  { en: "Exhibition Materials", zh: "展会物料",     ar: "مواد المعارض" },
  "inv.int.cat.employee_item":        { en: "Employee Items",       zh: "员工物品",     ar: "عناصر الموظفين" },
  "inv.int.cat.packaging_material":   { en: "Packaging",            zh: "包装",         ar: "تغليف" },
  "inv.int.cat.maintenance_item":     { en: "Maintenance",          zh: "维护",         ar: "صيانة" },
  "inv.int.cat.it_equipment":         { en: "IT & Electronics",     zh: "IT 与电子",    ar: "تكنولوجيا وإلكترونيات" },
  "inv.int.cat.printed_material":     { en: "Documents & Printing", zh: "文档与印刷",   ar: "مستندات وطباعة" },
  "inv.int.cat.safety_equipment":     { en: "Safety & Facility",    zh: "安全与设施",   ar: "السلامة والمرافق" },
  "inv.int.cat.internal_asset":       { en: "Internal Assets",      zh: "内部资产",     ar: "الأصول الداخلية" },
  "inv.int.cat.branded_merchandise":  { en: "Branded Merchandise",  zh: "品牌物料",     ar: "هدايا تذكارية مميزة" },
  "inv.int.cat.workshop_tools":       { en: "Workshop & Tools",     zh: "车间与工具",   ar: "الورشة والأدوات" },
  "inv.int.cat.cleaning_supply":      { en: "Cleaning Supplies",    zh: "清洁用品",     ar: "مستلزمات التنظيف" },
  "inv.int.cat.kitchen_pantry":       { en: "Kitchen & Pantry",     zh: "厨房与茶水间", ar: "المطبخ والمؤن" },
  "inv.int.cat.first_aid":            { en: "First Aid",            zh: "急救用品",     ar: "الإسعافات الأولية" },
  "inv.int.cat.vehicle_fleet":        { en: "Vehicle & Fleet",      zh: "车辆与车队",   ar: "المركبات والأسطول" },
  "inv.int.cat.photo_video":          { en: "Photography & Video",  zh: "摄影与视频",   ar: "التصوير والفيديو" },
  "inv.int.cat.furniture":            { en: "Furniture",            zh: "家具",         ar: "أثاث" },
};

/* ─── Category icon ─────────────────────────────────────────── */

const CATEGORY_ICON: Record<string, RrIconName> = {
  office_supply:        "clipboard",
  marketing_material:   "megaphone",
  exhibition_material:  "building",
  employee_item:        "users",
  packaging_material:   "box-open",
  maintenance_item:     "tools",
  it_equipment:         "laptop",
  printed_material:     "file",
  safety_equipment:     "shield-check",
  internal_asset:       "briefcase",
  branded_merchandise:  "gift",
  workshop_tools:       "hammer",
  cleaning_supply:      "broom",
  kitchen_pantry:       "coffee",
  first_aid:            "heart-rate",
  vehicle_fleet:        "car-side",
  photo_video:          "camera",
  furniture:            "chair-office",
};

/* ─── Category color tokens (unique per category) ───────────── */
/* All class strings are complete literals so Tailwind JIT includes them. */

interface CategoryColor {
  /** Icon chip background */
  chipBg:   string;
  /** Icon chip text/icon color */
  chipText: string;
  /** Card border on hover/active */
  hoverBorder: string;
  /** Top accent hairline inside the card */
  topLine:  string;
  /** Category label color */
  labelText: string;
}

const CATEGORY_COLOR: Record<string, CategoryColor> = {
  office_supply:       { chipBg: "bg-blue-500/20",    chipText: "text-blue-400",    hoverBorder: "hover:border-blue-500/50",    topLine: "bg-blue-400/70",    labelText: "text-blue-400" },
  marketing_material:  { chipBg: "bg-violet-500/20",  chipText: "text-violet-400",  hoverBorder: "hover:border-violet-500/50",  topLine: "bg-violet-400/70",  labelText: "text-violet-400" },
  exhibition_material: { chipBg: "bg-indigo-500/20",  chipText: "text-indigo-400",  hoverBorder: "hover:border-indigo-500/50",  topLine: "bg-indigo-400/70",  labelText: "text-indigo-400" },
  employee_item:       { chipBg: "bg-teal-500/20",    chipText: "text-teal-400",    hoverBorder: "hover:border-teal-500/50",    topLine: "bg-teal-400/70",    labelText: "text-teal-400" },
  packaging_material:  { chipBg: "bg-amber-500/20",   chipText: "text-amber-400",   hoverBorder: "hover:border-amber-500/50",   topLine: "bg-amber-400/70",   labelText: "text-amber-400" },
  maintenance_item:    { chipBg: "bg-orange-500/20",  chipText: "text-orange-400",  hoverBorder: "hover:border-orange-500/50",  topLine: "bg-orange-400/70",  labelText: "text-orange-400" },
  it_equipment:        { chipBg: "bg-cyan-500/20",    chipText: "text-cyan-400",    hoverBorder: "hover:border-cyan-500/50",    topLine: "bg-cyan-400/70",    labelText: "text-cyan-400" },
  printed_material:    { chipBg: "bg-slate-500/20",   chipText: "text-slate-300",   hoverBorder: "hover:border-slate-500/50",   topLine: "bg-slate-400/70",   labelText: "text-slate-300" },
  safety_equipment:    { chipBg: "bg-rose-500/20",    chipText: "text-rose-400",    hoverBorder: "hover:border-rose-500/50",    topLine: "bg-rose-400/70",    labelText: "text-rose-400" },
  internal_asset:      { chipBg: "bg-emerald-500/20", chipText: "text-emerald-400", hoverBorder: "hover:border-emerald-500/50", topLine: "bg-emerald-400/70", labelText: "text-emerald-400" },
  branded_merchandise: { chipBg: "bg-fuchsia-500/20", chipText: "text-fuchsia-400", hoverBorder: "hover:border-fuchsia-500/50", topLine: "bg-fuchsia-400/70", labelText: "text-fuchsia-400" },
  workshop_tools:      { chipBg: "bg-yellow-500/20",  chipText: "text-yellow-400",  hoverBorder: "hover:border-yellow-500/50",  topLine: "bg-yellow-400/70",  labelText: "text-yellow-400" },
  cleaning_supply:     { chipBg: "bg-sky-500/20",     chipText: "text-sky-400",     hoverBorder: "hover:border-sky-500/50",     topLine: "bg-sky-400/70",     labelText: "text-sky-400" },
  kitchen_pantry:      { chipBg: "bg-green-500/20",   chipText: "text-green-400",   hoverBorder: "hover:border-green-500/50",   topLine: "bg-green-400/70",   labelText: "text-green-400" },
  first_aid:           { chipBg: "bg-red-500/20",     chipText: "text-red-400",     hoverBorder: "hover:border-red-500/50",     topLine: "bg-red-400/70",     labelText: "text-red-400" },
  vehicle_fleet:       { chipBg: "bg-gray-500/20",    chipText: "text-gray-300",    hoverBorder: "hover:border-gray-500/50",    topLine: "bg-gray-400/70",    labelText: "text-gray-300" },
  photo_video:         { chipBg: "bg-purple-500/20",  chipText: "text-purple-400",  hoverBorder: "hover:border-purple-500/50",  topLine: "bg-purple-400/70",  labelText: "text-purple-400" },
  furniture:           { chipBg: "bg-lime-500/20",    chipText: "text-lime-400",    hoverBorder: "hover:border-lime-500/50",    topLine: "bg-lime-400/70",    labelText: "text-lime-400" },
};

const FALLBACK_COLOR: CategoryColor = {
  chipBg: "bg-[var(--bg-secondary)]", chipText: "text-[var(--text-dim)]",
  hoverBorder: "hover:border-[var(--border-color)]", topLine: "bg-[var(--border-subtle)]",
  labelText: "text-[var(--text-primary)]",
};

function catColor(typeKey: string): CategoryColor {
  return CATEGORY_COLOR[typeKey] ?? FALLBACK_COLOR;
}

/* ─── Subcategory icon lookup (keyword-based) ───────────────── */

function subIconFor(label: string): RrIconName {
  const l = label.toLowerCase();

  /* IT / Electronics */
  if (l.includes("laptop") || l.includes("desktop") || l.includes("tablet") || l.includes("notebook") && l.includes("tech")) return "laptop";
  if (l.includes("monitor") || l.includes("screen") || l.includes("tv") || l.includes("display") || l.includes("projector") || l.includes("whiteboard")) return "computer";
  if (l.includes("router") || l.includes("switch") || l.includes("wifi") || l.includes("network")) return "wifi";
  if (l.includes("hard drive") || l.includes("usb stick") || l.includes("memory card") || l.includes("sd card") || l.includes("ssd") || l.includes("hdd")) return "database";
  if (l.includes("dock") || l.includes("charger") || l.includes("cable") || l.includes("keyboard") || l.includes("mouse") || l.includes("webcam")) return "laptop";

  /* Photo / Video */
  if (l.includes("camera") || l.includes("lens") || l.includes("tripod") || l.includes("gimbal") || l.includes("backdrop") || l.includes("reflector")) return "camera";
  if (l.includes("microphone") || l.includes("mic") || l.includes("lavalier") || l.includes("shotgun") || l.includes("handheld")) return "microphone";
  if (l.includes("studio light") || l.includes("light stand")) return "bulb";

  /* Furniture */
  if (l.includes("chair") || l.includes("stool")) return "chair-office";
  if (l.includes("sofa") || l.includes("reception")) return "hotel";
  if (l.includes("shelf") || l.includes("shelve") || l.includes("bookcase") || l.includes("bookshelf")) return "books";
  if (l.includes("rack") || l.includes("pallet")) return "pallet";
  if (l.includes("desk") || l.includes("table") || l.includes("workbench")) return "briefcase";
  if (l.includes("cabinet") || l.includes("filing")) return "clipboard";
  if (l.includes("partition")) return "building";

  /* Kitchen & Pantry */
  if (l.includes("coffee") || l.includes("cup") || l.includes("mug")) return "coffee";
  if (l.includes("tea") || l.includes("herbal")) return "mug-hot";
  if (l.includes("snack") || l.includes("food") || l.includes("plate") || l.includes("cutlery")) return "restaurant";
  if (l.includes("water") && (l.includes("bottle") || l.includes("dispenser"))) return "cocktail";
  if (l.includes("sugar") || l.includes("milk")) return "restaurant";

  /* Cleaning */
  if (l.includes("broom") || l.includes("mop")) return "broom";
  if (l.includes("detergent") || l.includes("cleaner") || l.includes("glass clean") || l.includes("floor clean") || l.includes("disinfect") || l.includes("sanitizer")) return "faucet";
  if (l.includes("trash") || l.includes("garbage") || l.includes("waste")) return "trash";
  if (l.includes("cloth") || l.includes("sponge") || l.includes("vacuum")) return "broom";
  if (l.includes("air freshener") || l.includes("freshener")) return "leaf";
  if (l.includes("towel") || l.includes("napkin") || l.includes("paper towel")) return "clipboard";

  /* Vehicle */
  if (l.includes("fuel card") || l.includes("credit")) return "credit-card";
  if (l.includes("motor oil") || l.includes("engine oil") || l.includes("lubricant") || l.includes("coolant") || l.includes("antifreeze")) return "gas-pump";
  if (l.includes("tire") || l.includes("tyre") || l.includes("wheel")) return "car-side";
  if (l.includes("dashcam")) return "camera";
  if (l.includes("wiper") || l.includes("jumper") || l.includes("tool") && l.includes("car") || l.includes("vehicle tool") || l.includes("spare bulb") || l.includes("car cleaning")) return "car-mechanic";

  /* First Aid */
  if (l.includes("bandage") || l.includes("sterile") || l.includes("gauze") || l.includes("medical tape") || l.includes("first aid kit")) return "heart-rate";
  if (l.includes("painkiller") || l.includes("burn") || l.includes("eye wash") || l.includes("cold pack") || l.includes("defibrillator") || l.includes("thermometer")) return "stethoscope";
  if (l.includes("antiseptic") || l.includes("disinfect") && l.includes("medical")) return "flask";

  /* Safety */
  if (l.includes("fire extinguish") || l.includes("smoke detector") || l.includes("first aid station")) return "shield-check";
  if (l.includes("safety glass") || l.includes("eyewear") || l.includes("goggles")) return "eye";
  if (l.includes("hard hat") || l.includes("helmet")) return "hard-hat";
  if (l.includes("earplug") || l.includes("reflective vest") || l.includes("harness") || l.includes("ppe")) return "shield-check";
  if (l.includes("emergency light")) return "bulb";
  if (l.includes("sign") || l.includes("signage")) return "flag-alt";

  /* Workshop */
  if (l.includes("hammer") || l.includes("screwdriver") || l.includes("wrench") || l.includes("plier")) return "hammer";
  if (l.includes("power tool") || l.includes("drill") || l.includes("saw") || l.includes("grinder") || l.includes("sander") || l.includes("impact driver")) return "tools";
  if (l.includes("measure") || l.includes("caliper") || l.includes("multimeter") || l.includes("laser") || l.includes("level")) return "scale";
  if (l.includes("ladder")) return "tools";
  if (l.includes("tool box") || l.includes("toolbox")) return "briefcase";
  if (l.includes("cutting") || l.includes("welding")) return "tools";

  /* Maintenance */
  if (l.includes("repair kit")) return "tools";
  if (l.includes("adhesive") || l.includes("sealant") || l.includes("glue")) return "tools";
  if (l.includes("fastener") || l.includes("belt") || l.includes("filter") || l.includes("consumable")) return "tools";
  if (l.includes("lubricant") || l.includes("grease")) return "faucet";

  /* Packaging */
  if (l.includes("carton") || l.includes("box")) return "box-open";
  if (l.includes("pallet")) return "pallet";
  if (l.includes("bubble") || l.includes("foam") || l.includes("wrapping") || l.includes("stretch film")) return "box-open";
  if (l.includes("tape") || l.includes("strapping")) return "tools";
  if (l.includes("label") || l.includes("sticker")) return "stamp";
  if (l.includes("bag") || l.includes("pouch")) return "briefcase";

  /* Print / Documents */
  if (l.includes("manual") || l.includes("document") || l.includes("warranty") || l.includes("compliance") || l.includes("certificate") || l.includes("booklet") || l.includes("training")) return "file";
  if (l.includes("printed label") || l.includes("tag") || l.includes("stamp")) return "stamp";
  if (l.includes("award") || l.includes("recognition")) return "award";
  if (l.includes("print") || l.includes("ink") || l.includes("toner")) return "print";

  /* Office */
  if (l.includes("printer paper") || l.includes("paper")) return "file";
  if (l.includes("pen") || l.includes("pencil") || l.includes("marker") || l.includes("highlighter") || l.includes("whiteboard marker")) return "pencil";
  if (l.includes("notebook") || l.includes("folder") || l.includes("binder") || l.includes("file")) return "clipboard";
  if (l.includes("envelope") || l.includes("sticky note")) return "clipboard";
  if (l.includes("staple") || l.includes("desk accessory") || l.includes("desk acc")) return "briefcase";

  /* Marketing */
  if (l.includes("catalog") || l.includes("brochure") || l.includes("newspaper")) return "newspaper";
  if (l.includes("flyer") || l.includes("poster") || l.includes("banner") || l.includes("rollup") || l.includes("roll-up")) return "megaphone";
  if (l.includes("sticker")) return "stamp";
  if (l.includes("business card") || l.includes("id card") || l.includes("lanyard") || l.includes("name badge")) return "id-badge";
  if (l.includes("sample")) return "flask";
  if (l.includes("promo gift") || l.includes("promotional gift") || l.includes("gift")) return "gift";

  /* Employee / Branded */
  if (l.includes("uniform") || l.includes("shirt") || l.includes("pant") || l.includes("jacket") || l.includes("cap") || l.includes("apron") || l.includes("coverall")) return "id-badge";
  if (l.includes("safety shoe") || l.includes("boot") || l.includes("glove")) return "shield-check";
  if (l.includes("welcome pack") || l.includes("employee kit") || l.includes("starter kit")) return "briefcase";
  if (l.includes("mug")) return "mug-hot";
  if (l.includes("water bottle")) return "cocktail";
  if (l.includes("keychain") || l.includes("key")) return "key";
  if (l.includes("calendar")) return "clipboard";
  if (l.includes("tote") || l.includes("backpack") || l.includes("drawstring")) return "briefcase";
  if (l.includes("t-shirt")) return "id-badge";

  /* Exhibition */
  if (l.includes("booth")) return "building";
  if (l.includes("lighting") || l.includes("light")) return "bulb";
  if (l.includes("demo unit") || l.includes("display stand")) return "laptop";
  if (l.includes("carpet") || l.includes("floor mat")) return "home";
  if (l.includes("power strip")) return "tools";

  /* Internal assets */
  if (l.includes("conference phone")) return "microphone";
  if (l.includes("office equipment")) return "computer";
  if (l.includes("storage rack")) return "pallet";
  if (l.includes("company tool")) return "tools";

  return "box-open";
}

/* ─── Search ────────────────────────────────────────────────── */

interface SearchResult {
  /** How deep the match is */
  kind:        "category" | "subcategory" | "subsub";
  category:    InternalCategoryHint;
  subcategory?: string;
  subSub?:      string;
  /** The word(s) that matched the query */
  matchText:   string;
  /** Full breadcrumb path for the subtitle */
  path:        string;
}

function searchTaxonomy(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: SearchResult[] = [];

  for (const cat of INTERNAL_TAXONOMY) {
    const catLabel = cat.label;
    const catKey   = cat.type_key.replace(/_/g, " ");

    // Category-level match
    if (catLabel.toLowerCase().includes(q) || catKey.includes(q) || cat.hint?.toLowerCase().includes(q)) {
      results.push({ kind: "category", category: cat, matchText: catLabel, path: catLabel });
    }

    // Subcategory + sub-sub
    for (const sub of cat.subcategories) {
      if (sub.toLowerCase().includes(q)) {
        results.push({ kind: "subcategory", category: cat, subcategory: sub, matchText: sub, path: `${catLabel} › ${sub}` });
      }
      const subs = cat.sub_subcategories?.[sub] ?? [];
      for (const ss of subs) {
        if (ss.toLowerCase().includes(q)) {
          results.push({ kind: "subsub", category: cat, subcategory: sub, subSub: ss, matchText: ss, path: `${catLabel} › ${sub} › ${ss}` });
        }
      }
    }
  }

  // Deduplicate and cap
  return results.slice(0, 24);
}

/* ─── Types ─────────────────────────────────────────────────── */

interface Warehouse { id: string; code: string; name: string; is_default: boolean }
interface ItemType {
  id: string;
  type_key: string;
  type_name: string;
  icon: IconName;
  is_active: boolean;
  usage_scope?: "product_related" | "internal_use";
  requires_product?: boolean;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type StepNo = 1 | 2 | 3 | 4;

/* ─── Main component ─────────────────────────────────────────── */

export default function InventoryInternalItemDrawer({ onClose, onSuccess }: Props) {
  const { t } = useTranslation(T);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [step, setStep] = useState<StepNo>(1);
  const [category, setCategory] = useState<InternalCategoryHint | null>(null);
  const [subcategory, setSubcategory] = useState<string>("");
  const [subSub, setSubSub] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [wRes, tRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" }),
          fetch("/api/inventory/item-types",  { credentials: "include", cache: "no-store" }),
        ]);
        const wJ = await wRes.json();
        const tJ = await tRes.json();
        if (cancelled) return;
        const wh = (wJ.warehouses ?? []) as Warehouse[];
        setWarehouses(wh);
        setWarehouseId(wh.find((w) => w.is_default)?.id ?? wh[0]?.id ?? "");
        setTypes((tJ.types ?? []) as ItemType[]);
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ESC to close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const subSubList = useMemo(
    () => suggestSubSubcategories(category?.type_key, subcategory),
    [category, subcategory],
  );
  const hasSubSubStep = subSubList.length > 0;
  const totalSteps = hasSubSubStep ? 4 : 3;

  const handleSearchSelect = (r: SearchResult) => {
    setSearchQuery("");
    setCategory(r.category);
    setCustomMode(false);
    if (r.kind === "category") {
      setSubcategory(""); setSubSub(""); setStep(2);
    } else if (r.kind === "subcategory" && r.subcategory) {
      setSubcategory(r.subcategory); setSubSub("");
      const ss = suggestSubSubcategories(r.category.type_key, r.subcategory);
      setStep(ss.length > 0 ? 3 : 4);
    } else if (r.kind === "subsub" && r.subcategory && r.subSub) {
      setSubcategory(r.subcategory); setSubSub(r.subSub); setStep(4);
    }
  };

  const submit = async () => {
    if (!name.trim()) { setError(t("inv.int.err.name")); return; }
    if (!category) { setStep(1); return; }
    const numQty = Number(qty) || 0;
    if (numQty > 0 && !warehouseId) { setError(t("inv.int.err.warehouse")); return; }
    setSubmitting(true);
    setError(null);
    try {
      const typeRow = types.find((tt) => tt.type_key === category.type_key && tt.is_active);
      const combinedSub = subSub.trim()
        ? `${subcategory.trim()} · ${subSub.trim()}`
        : subcategory.trim();
      const payload: Record<string, unknown> = {
        item_name: name.trim(),
        type_key: category.type_key,
        unit_of_measure: unit,
      };
      if (typeRow) payload.item_type_id = typeRow.id;
      if (combinedSub) payload.subcategory = combinedSub;
      if (notes.trim()) payload.notes = notes.trim();
      if (numQty > 0) {
        payload.initial_quantity = numQty;
        payload.initial_warehouse_id = warehouseId;
      }
      const r = await fetch("/api/inventory/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = useMemo(() => {
    if (!category) return "";
    const key = `inv.int.cat.${category.type_key}`;
    const translated = t(key);
    return translated === key ? category.label : translated;
  }, [category, t]);

  const stepIndex: number =
    step === 1 ? 1 :
    step === 2 ? 2 :
    step === 3 ? 3 :
    totalSteps;

  const color = category ? catColor(category.type_key) : FALLBACK_COLOR;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/65 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      data-testid="inv-internal-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-[min(760px,94vw)] sm:rounded-2xl sm:border sm:border-[var(--border-color)]"
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] ${category ? color.chipBg : "bg-[var(--bg-surface)]"}`}>
              <RrIcon
                name={category ? (CATEGORY_ICON[category.type_key] ?? "briefcase") : "briefcase"}
                size={15}
                className={category ? color.chipText : "text-[var(--text-dim)]"}
              />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold leading-none tracking-tight">{t("inv.int.title")}</h2>
              {category && (
                <div className={`mt-0.5 text-[11px] ${color.labelText}`}>{categoryLabel}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("inv.int.close")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={13} />
          </button>
        </div>

        {/* ── Step strip ──────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[var(--border-color)] px-5 py-3">
          <StepStrip
            current={stepIndex}
            hasSubSub={hasSubSubStep}
            color={color}
            labels={{
              cat:     t("inv.int.step.category"),
              sub:     t("inv.int.step.sub"),
              subsub:  t("inv.int.step.subsub"),
              details: t("inv.int.step.details"),
            }}
          />
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-5 sm:pb-5">
          {step === 1 && (
            <Step1
              t={t}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onPick={(c) => { setCategory(c); setSubcategory(""); setSubSub(""); setCustomMode(false); setStep(2); }}
              onSearchSelect={handleSearchSelect}
            />
          )}
          {step === 2 && category && (
            <Step2
              t={t} category={category} categoryLabel={categoryLabel} color={color}
              customMode={customMode} subcategory={subcategory}
              setSubcategory={setSubcategory} setCustomMode={setCustomMode}
              onBack={() => setStep(1)}
              onPick={(s) => { setSubcategory(s); setSubSub(""); const ss = suggestSubSubcategories(category.type_key, s); setStep(ss.length > 0 ? 3 : 4); }}
            />
          )}
          {step === 3 && category && (
            <Step3SubSub
              t={t} category={category} categoryLabel={categoryLabel} color={color}
              subcategory={subcategory} subSubList={subSubList}
              onBack={() => setStep(2)}
              onPick={(v) => { setSubSub(v); setStep(4); }}
              onSkip={() => { setSubSub(""); setStep(4); }}
            />
          )}
          {step === 4 && category && (
            <Step4Details
              t={t} category={category} categoryLabel={categoryLabel} color={color}
              subcategory={subcategory} subSub={subSub} warehouses={warehouses}
              name={name} setName={setName}
              warehouseId={warehouseId} setWarehouseId={setWarehouseId}
              qty={qty} setQty={setQty}
              unit={unit} setUnit={setUnit}
              notes={notes} setNotes={setNotes}
              notesOpen={notesOpen} setNotesOpen={setNotesOpen}
              error={error}
              onBack={() => setStep(hasSubSubStep ? 3 : 2)}
            />
          )}
        </div>

        {/* ── Footer (details step only) ───────────────────────── */}
        {step === 4 && (
          <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-primary)] px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                {t("inv.int.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={submitting || !name.trim()}
                data-testid="inv-internal-save"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[var(--bg-inverted)] px-5 py-2 text-[13px] font-semibold text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50"
              >
                {!submitting && <RrIcon name="check" size={12} />}
                {submitting ? t("inv.int.saving") : t("inv.int.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── StepStrip ─────────────────────────────────────────────── */

function StepStrip({
  current, hasSubSub, color, labels,
}: {
  current: number;
  hasSubSub: boolean;
  color: CategoryColor;
  labels: { cat: string; sub: string; subsub: string; details: string };
}) {
  const steps = hasSubSub
    ? [labels.cat, labels.sub, labels.subsub, labels.details]
    : [labels.cat, labels.sub, labels.details];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const idx = i + 1;
        const isCur  = idx === current;
        const isDone = idx < current;
        return (
          <div key={s} className="flex flex-1 items-center gap-1.5 min-w-0">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold tabular-nums transition-colors ${
              isCur  ? `${color.chipBg} ${color.chipText} border-transparent` :
              isDone ? "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]" :
                       "border-[var(--border-subtle)] bg-transparent text-[var(--text-dim)]"
            }`}>
              {isDone ? <RrIcon name="check" size={8} /> : idx}
            </span>
            <span className={`truncate text-[10.5px] uppercase tracking-[0.10em] ${isCur ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
              {s}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="ml-1 h-px flex-1 shrink bg-[var(--border-subtle)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Step 1 — search bar + category grid ────────────────────── */

function Step1({
  t, searchQuery, setSearchQuery, onPick, onSearchSelect,
}: {
  t: (k: string, fallback?: string) => string;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  onPick: (c: InternalCategoryHint) => void;
  onSearchSelect: (r: SearchResult) => void;
}) {
  const results = useMemo(() => searchTaxonomy(searchQuery), [searchQuery]);
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div>
      {/* ── Search bar ────────────────────────────────────── */}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]">
          <RrIcon name="search" size={14} />
        </span>
        <input
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("inv.int.search.ph")}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-9 text-[13px] outline-none transition-colors focus:border-[var(--text-dim)] placeholder:text-[var(--text-dim)]"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={9} />
          </button>
        )}
      </div>

      {/* ── Search results ────────────────────────────────── */}
      {hasQuery ? (
        <div className="mt-3">
          {results.length > 0 && (
            <div className="mb-2 text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
              {results.length} {t("inv.int.search.results")}
            </div>
          )}
          <SearchResultsList results={results} t={t} onSelect={onSearchSelect} />
        </div>
      ) : (
        /* ── Category grid ──────────────────────────────── */
        <>
          <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{t("inv.int.step1.title")}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">Choose the type that best fits what you're adding.</p>
          <div
            data-testid="inv-internal-cat-grid"
            className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
          >
            {INTERNAL_TAXONOMY.map((c) => {
              const key   = `inv.int.cat.${c.type_key}`;
              const label = t(key) === key ? c.label : t(key);
              const icon  = CATEGORY_ICON[c.type_key] ?? "box-open";
              const col   = catColor(c.type_key);
              return (
                <button
                  key={c.type_key}
                  type="button"
                  onClick={() => onPick(c)}
                  data-testid={`inv-internal-cat-${c.type_key}`}
                  className={`group relative flex min-h-[100px] flex-col items-start gap-2 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-left transition-all ${col.hoverBorder} hover:bg-[var(--bg-elevated)]`}
                >
                  <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${col.topLine}`} />
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${col.chipBg}`}>
                    <RrIcon name={icon} size={15} className={col.chipText} />
                  </span>
                  <div className="flex-1">
                    <div className="text-[12.5px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">{label}</div>
                    <div className="mt-0.5 text-[10.5px] leading-snug text-[var(--text-dim)]">{c.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Search results list ─────────────────────────────────────── */

function SearchResultsList({
  results, t, onSelect,
}: {
  results: SearchResult[];
  t: (k: string, fallback?: string) => string;
  onSelect: (r: SearchResult) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-dim)]">
          <RrIcon name="search" size={20} />
        </span>
        <div className="text-[13px] text-[var(--text-dim)]">{t("inv.int.search.empty")}</div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {results.map((r, i) => {
        const col  = catColor(r.category.type_key);
        const icon = CATEGORY_ICON[r.category.type_key] ?? "box-open";
        const kindIcon: RrIconName =
          r.kind === "subsub"      ? "arrow-up-right" :
          r.kind === "subcategory" ? "arrow-up-right" :
                                     "box-open";
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(r)}
            className={`flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-left transition-all ${col.hoverBorder} hover:bg-[var(--bg-elevated)]`}
          >
            {/* Category color chip */}
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${col.chipBg}`}>
              <RrIcon name={icon} size={13} className={col.chipText} />
            </span>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{r.matchText}</div>
              {r.path !== r.matchText && (
                <div className="mt-0.5 truncate text-[10.5px] text-[var(--text-dim)]">{r.path}</div>
              )}
            </div>

            {/* Kind badge */}
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] font-semibold ${col.chipBg} ${col.chipText}`}>
              {r.kind === "subsub" ? "variant" : r.kind === "subcategory" ? "sub" : "cat"}
            </span>

            <RrIcon name={kindIcon} size={11} className="shrink-0 text-[var(--text-dim)]" />
          </button>
        );
      })}
    </div>
  );
}

/* ─── Step 2 — subcategory grid (with icons) ─────────────────── */

function Step2({
  t, category, categoryLabel, color, customMode, subcategory,
  setSubcategory, setCustomMode, onBack, onPick,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  color: CategoryColor;
  customMode: boolean;
  subcategory: string;
  setSubcategory: (s: string) => void;
  setCustomMode: (b: boolean) => void;
  onBack: () => void;
  onPick: (s: string) => void;
}) {
  const icon = CATEGORY_ICON[category.type_key] ?? "box-open";
  return (
    <div>
      <BreadcrumbHeader t={t} icon={icon} color={color} categoryLabel={categoryLabel} sub={t("inv.int.step2.title")} onBack={onBack} />
      <div
        data-testid="inv-internal-sub-grid"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {category.subcategories.map((s) => {
          const variants = category.sub_subcategories?.[s]?.length ?? 0;
          const subIcon  = subIconFor(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              data-testid={`inv-internal-sub-${s.replace(/\s+/g, "_").toLowerCase()}`}
              className={`group flex min-h-[72px] flex-col gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5 text-left transition-all ${color.hoverBorder} hover:bg-[var(--bg-elevated)]`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color.chipBg}`}>
                  <RrIcon name={subIcon} size={12} className={color.chipText} />
                </span>
                <div className="text-[12px] font-medium leading-tight text-[var(--text-primary)]">{s}</div>
              </div>
              {variants > 0 && (
                <div className={`inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.08em] ${color.labelText}`}>
                  <RrIcon name="box-circle-check" size={9} />
                  {variants} variants
                </div>
              )}
            </button>
          );
        })}
        {/* Custom */}
        {!customMode ? (
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-color)] bg-transparent p-2.5 text-[11px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="plus" size={13} />
            {t("inv.int.custom")}
          </button>
        ) : (
          <div className="col-span-2 flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 sm:col-span-3 lg:col-span-4">
            <input
              autoFocus
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={t("inv.int.custom.placeholder")}
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-dim)]"
            />
            <button
              type="button"
              onClick={() => subcategory.trim() && onPick(subcategory.trim())}
              disabled={!subcategory.trim()}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[11px] font-semibold ${color.chipBg} ${color.chipText} disabled:opacity-40`}
            >
              <RrIcon name="arrow-up-right" size={11} /> Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3 — sub-sub grid (with icons) ─────────────────────── */

function Step3SubSub({
  t, category, categoryLabel, color, subcategory, subSubList, onBack, onPick, onSkip,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  color: CategoryColor;
  subcategory: string;
  subSubList: string[];
  onBack: () => void;
  onPick: (s: string) => void;
  onSkip: () => void;
}) {
  const icon = CATEGORY_ICON[category.type_key] ?? "box-open";
  return (
    <div>
      <BreadcrumbHeader t={t} icon={icon} color={color} categoryLabel={categoryLabel} sub={`${subcategory} · ${t("inv.int.step3.title")}`} onBack={onBack} />
      <div
        data-testid="inv-internal-subsub-grid"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {subSubList.map((v) => {
          const subIcon = subIconFor(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              data-testid={`inv-internal-subsub-${v.replace(/\s+/g, "_").toLowerCase()}`}
              className={`flex min-h-[64px] flex-col items-start gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5 text-left transition-all ${color.hoverBorder} hover:bg-[var(--bg-elevated)]`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${color.chipBg}`}>
                <RrIcon name={subIcon} size={12} className={color.chipText} />
              </span>
              <div className="text-[12px] font-medium leading-tight text-[var(--text-primary)]">{v}</div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onSkip}
          data-testid="inv-internal-subsub-skip"
          className="flex min-h-[64px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-color)] bg-transparent p-2.5 text-[11px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <RrIcon name="arrow-up-right" size={10} />
          {t("inv.int.skip")}
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4 — details form ──────────────────────────────────── */

function Step4Details({
  t, category, categoryLabel, color, subcategory, subSub, warehouses,
  name, setName, warehouseId, setWarehouseId, qty, setQty, unit, setUnit,
  notes, setNotes, notesOpen, setNotesOpen, error, onBack,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  color: CategoryColor;
  subcategory: string;
  subSub: string;
  warehouses: Warehouse[];
  name: string; setName: (s: string) => void;
  warehouseId: string; setWarehouseId: (s: string) => void;
  qty: string; setQty: (s: string) => void;
  unit: UnitOfMeasure; setUnit: (u: UnitOfMeasure) => void;
  notes: string; setNotes: (s: string) => void;
  notesOpen: boolean; setNotesOpen: (b: boolean) => void;
  error: string | null;
  onBack: () => void;
}) {
  const icon    = CATEGORY_ICON[category.type_key] ?? "box-open";
  const subLine = subSub ? `${subcategory} · ${subSub}` : subcategory;
  return (
    <div className="space-y-4">
      <BreadcrumbHeader t={t} icon={icon} color={color} categoryLabel={categoryLabel} sub={subLine || t("inv.int.step4.title")} onBack={onBack} />

      <label className="block">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.name")} *</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder={t("inv.int.name.ph")}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--text-dim)] placeholder:text-[var(--text-dim)]"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.warehouse")}</div>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehouses.length === 0}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2.5 text-[13px] disabled:opacity-50"
          >
            {warehouses.length === 0 && <option value="">—</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code}{w.is_default ? " · default" : ""}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.qty")}</div>
          <input
            type="number" min="0" step="0.0001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] tabular-nums outline-none focus:border-[var(--text-dim)]"
          />
        </label>
      </div>

      <label className="block">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.unit")}</div>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2.5 text-[13px] sm:w-48"
        >
          {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>

      {Number(qty) > 0 && warehouseId && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11.5px] ${color.chipBg} border-[var(--border-subtle)]`}>
          <RrIcon name="info" size={12} className={`mt-0.5 shrink-0 ${color.chipText}`} />
          <span className="text-[var(--text-dim)]">{t("inv.int.opening.note")}</span>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setNotesOpen(!notesOpen)}
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden className="text-[13px] leading-none">{notesOpen ? "−" : "+"}</span>
          {notesOpen ? t("inv.int.notes.hide") : t("inv.int.notes.add")}
        </button>
        {notesOpen && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("inv.int.notes.ph")}
            rows={3}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--text-dim)] placeholder:text-[var(--text-dim)]"
          />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}

/* ─── BreadcrumbHeader ───────────────────────────────────────── */

function BreadcrumbHeader({
  t, icon, color, categoryLabel, sub, onBack,
}: {
  t: (k: string, fallback?: string) => string;
  icon: RrIconName;
  color: CategoryColor;
  categoryLabel: string;
  sub: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        onClick={onBack}
        aria-label={t("inv.int.back")}
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
      >
        <RrIcon name="arrow-left" size={13} />
      </button>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color.chipBg}`}>
        <RrIcon name={icon} size={14} className={color.chipText} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight">{categoryLabel}</h3>
        {sub && <div className={`mt-0.5 truncate text-[11.5px] ${color.labelText}`}>{sub}</div>}
      </div>
    </div>
  );
}
