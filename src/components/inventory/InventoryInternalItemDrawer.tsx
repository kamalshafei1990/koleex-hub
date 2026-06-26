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
  "inv.int.unit_cost":      { en: "Unit cost (optional)",     zh: "单价（可选）",         ar: "تكلفة الوحدة (اختياري)" },
  "inv.int.unit_cost.ph":   { en: "0.00",                     zh: "0.00",                ar: "0.00" },
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
  vehicle_fleet:       { chipBg: "bg-gray-500/20",    chipText: "text-[var(--text-muted)]",    hoverBorder: "hover:border-gray-500/50",    topLine: "bg-gray-400/70",    labelText: "text-[var(--text-muted)]" },
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

/* ─── Subcategory icon lookup ────────────────────────────────── */
/*
 * Rule: no two subcategories in the SAME category share an icon.
 * Cross-category reuse is fine (you never see both at once in a grid).
 *
 * Lookup order:
 *   1. Exact lowercase match against taxonomy subcategory names.
 *   2. Keyword scan for custom / free-text subcategory names.
 */

const SUB_ICON_EXACT: Record<string, RrIconName> = {
  /* ── Office Supplies (13) — unique within group ───────────────────────── */
  "printer paper":      "file",           "pens":               "pencil",
  "pencils":            "palette",        "notebooks":          "clipboard",
  "files":              "document",       "envelopes":          "paper-plane",
  "folders":            "books",          "ink":                "print",
  "toner":              "cloud-download", "desk accessories":   "balance-scale-left",
  "sticky notes":       "stamp",          "staplers":           "badge-check",
  "binders":            "contract",

  /* ── Marketing Materials (10) ────────────────────────────────────────── */
  "catalogs":           "newspaper",      "flyers":             "megaphone",
  "brochures":          "ad",             "posters":            "flag-alt",
  "samples":            "flask",          "rollups":            "flag-checkered",
  "stickers":           "signature",      "promotional gifts":  "gift",
  "banners":            "award",          "business cards":     "id-badge",

  /* ── Exhibition Materials (8) ────────────────────────────────────────── */
  "booth parts":        "building",       "lighting":           "bulb",
  "screens":            "eye",            "demo units":         "laptop",
  "display stands":     "ticket",         "furniture":          "chair-office",
  "power strips":       "upload",         "carpets":            "home",

  /* ── Employee Items (8) ──────────────────────────────────────────────── */
  "uniforms":           "users",          "id cards":           "id-badge",
  "safety shoes":       "shield-check",   "helmets":            "hard-hat",
  "gloves":             "hand-holding-heart", "employee kits":  "briefcase",
  "lanyards":           "key",            "welcome packs":      "graduation-cap",

  /* ── Packaging (10) ──────────────────────────────────────────────────── */
  "cartons":            "box-open",       "tape":               "stamp",
  "foam":               "box-circle-check","labels":            "badge-check",
  "wrapping":           "recycle",        "pallets":            "pallet",
  "bags":               "delivery-truck", "bubble wrap":        "cloud",
  "strapping":          "contract",       "stretch film":       "receipt",

  /* ── Maintenance (8) ─────────────────────────────────────────────────── */
  "repair kits":        "tools",          "lubricants":         "faucet",
  "spare consumables":  "download",       "adhesives":          "lock",
  "sealants":           "shield-check",   "fasteners":          "coins",
  "belts":              "car-mechanic",   "filters":            "recycle",

  /* ── IT & Electronics (15) ───────────────────────────────────────────── */
  "laptops":            "laptop",         "desktops":           "computer",
  "tablets":            "ad",             "monitors":           "eye",
  "keyboards":          "receipt",        "mice":               "bullseye-arrow",
  "routers":            "wifi",           "switches":           "signal-stream",
  "cables":             "delivery-truck", "chargers":           "bulb",
  "docking stations":   "cloud-download", "webcams":            "camera",
  "hard drives":        "database",       "usb sticks":         "download",
  "memory cards":       "fingerprint",

  /* ── Documents & Printing (8) ────────────────────────────────────────── */
  "manuals":            "document",       "certificates":       "award",
  "printed labels":     "stamp",          "warranty cards":     "contract",
  "internal documents": "clipboard",      "training booklets":  "books",
  "compliance sheets":  "gavel",          "tags":               "flag-checkered",

  /* ── Safety & Facility (10) ──────────────────────────────────────────── */
  "fire extinguishers": "shield-check",   "smoke detectors":    "cloud",
  "first aid stations": "heart-rate",     "safety glasses":     "eye",
  "hard hats":          "hard-hat",       "earplugs":           "user-headset",
  "reflective vests":   "id-badge",       "safety harnesses":   "lock",
  "emergency lights":   "bulb",           "safety signs":       "flag-alt",

  /* ── Internal Assets (7) ─────────────────────────────────────────────── */
  "office equipment":   "briefcase",      "storage racks":      "pallet",
  "company tools":      "tools",          "whiteboards":        "palette",
  "projectors":         "signal-stream",  "conference phones":  "microphone",
  "tvs":                "computer",

  /* ── Branded Merchandise (12) ────────────────────────────────────────── */
  "mugs":               "mug-hot",        "t-shirts":           "users",
  "water bottles":      "cocktail",       "keychains":          "fingerprint",
  "calendars":          "clock",          "caps":               "award",
  /* pens/notebooks/usb sticks/lanyards/bags/stickers reuse icons from
     matching items in other categories — same physical item = same icon */

  /* ── Workshop & Tools (10) ───────────────────────────────────────────── */
  "hand tools":         "hammer",         "power tools":        "tools",
  "measuring instruments": "scale",       "cutting tools":      "gavel",
  "welding equipment":  "gas-pump",       "drill bits":         "bullseye-arrow",
  "workbenches":        "building",       "tool boxes":         "box-open",
  "ladders":            "arrow-up-right",

  /* ── Cleaning Supplies (12) ──────────────────────────────────────────── */
  "detergents":         "faucet",         "brooms":             "broom",
  "mops":               "recycle",        "cleaning cloths":    "box-circle-check",
  "trash bags":         "trash",          "sanitizers":         "flask",
  "disinfectants":      "shield-check",   "vacuum bags":        "cloud-download",
  "glass cleaner":      "eye",            "floor cleaner":      "home",
  "air fresheners":     "leaf",
  /* gloves: shares hand-holding-heart with Employee > Gloves (same item) */

  /* ── Kitchen & Pantry (13) ───────────────────────────────────────────── */
  "coffee":             "coffee",         "tea":                "mug-hot",
  "snacks":             "restaurant",     "sugar":              "flask",
  "milk":               "cocktail",       "cups":               "ticket",
  "cutlery":            "receipt",        "plates":             "coins",
  "water dispenser":    "faucet",         "paper towels":       "file",
  "napkins":            "leaf",           "bottled water":      "cloud",
  "cleaning sponges":   "broom",

  /* ── First Aid (11) ──────────────────────────────────────────────────── */
  "bandages":           "heart-rate",     "antiseptics":        "flask",
  "painkillers":        "stethoscope",    "thermometers":       "scale",
  "first aid kits":     "briefcase",      "burn cream":         "hand-holding-heart",
  "eye wash":           "eye",            "cold packs":         "cloud",
  "sterile gauze":      "box-circle-check","medical tape":      "stamp",
  "defibrillators":     "signal-stream",

  /* ── Vehicle & Fleet (11) ────────────────────────────────────────────── */
  "fuel cards":         "credit-card",    "motor oil":          "gas-pump",
  "tires":              "car-side",       "vehicle tools":      "car-mechanic",
  "dashcams":           "camera",         "car cleaning":       "broom",
  "engine coolant":     "faucet",         "wiper blades":       "eye",
  "spare bulbs":        "bulb",           "jumper cables":      "signal-stream",
  "first aid (vehicle)":"heart-rate",

  /* ── Photography & Video (12) ────────────────────────────────────────── */
  "cameras":            "camera",         "lenses":             "eye",
  "tripods":            "building",       "studio lights":      "bulb",
  "microphones":        "microphone",     "sd cards":           "database",
  "camera batteries":   "download",       "memory card readers":"fingerprint",
  "light stands":       "flag-alt",       "reflectors":         "palette",
  "backdrops":          "home",           "gimbal stabilizers": "scale",

  /* ── Furniture (12) ──────────────────────────────────────────────────── */
  "office chairs":      "chair-office",   "desks":              "briefcase",
  "conference tables":  "users",          "shelves":            "books",
  "partitions":         "building",
  "filing cabinets":    "document",       "sofas":              "hotel",
  "stools":             "cocktail",       "side tables":        "clock",
  "reception furniture":"handshake",      "bookcases":          "graduation-cap",
};


function subIconFor(label: string): RrIconName {
  const l = label.toLowerCase().trim();

  /* 1 — exact taxonomy match */
  const exact = SUB_ICON_EXACT[l];
  if (exact) return exact;

  /* 2 — keyword fallback for custom / free-text entries */
  if (l.includes("laptop") || (l.includes("notebook") && l.includes("computer"))) return "laptop";
  if (l.includes("desktop") || l.includes("workstation")) return "computer";
  if (l.includes("monitor") || l.includes("screen") || l.includes("display")) return "eye";
  if (l.includes("tablet")) return "cloud";
  if (l.includes("router") || l.includes("wifi") || l.includes("network")) return "wifi";
  if (l.includes("hard drive") || l.includes("ssd") || l.includes("hdd") || l.includes("storage drive")) return "database";
  if (l.includes("usb") || l.includes("memory card") || l.includes("sd card")) return "download";
  if (l.includes("camera") || l.includes("lens") || l.includes("gimbal")) return "camera";
  if (l.includes("tripod") || l.includes("light stand")) return "flag-alt";
  if (l.includes("microphone") || l.includes(" mic ") || l.includes("audio recorder")) return "microphone";
  if (l.includes("studio light") || l.includes("ring light")) return "bulb";
  if (l.includes("backdrop") || l.includes("green screen")) return "home";
  if (l.includes("chair") || l.includes("stool")) return "chair-office";
  if (l.includes("sofa") || l.includes("couch")) return "hotel";
  if (l.includes("shelf") || l.includes("bookcase") || l.includes("bookshelf")) return "books";
  if (l.includes("desk") || l.includes("workbench")) return "briefcase";
  if (l.includes("cabinet") || l.includes("filing")) return "document";
  if (l.includes("partition") || l.includes("divider")) return "building";
  if (l.includes("coffee") || l.includes("espresso")) return "coffee";
  if (l.includes("tea") || l.includes("herbal")) return "mug-hot";
  if (l.includes("snack") || l.includes("food") || l.includes("meal")) return "restaurant";
  if (l.includes("water bottle") || l.includes("dispenser")) return "cocktail";
  if (l.includes("broom") || l.includes("brush")) return "broom";
  if (l.includes("mop") || l.includes("vacuum")) return "recycle";
  if (l.includes("trash") || l.includes("garbage") || l.includes("waste bag")) return "trash";
  if (l.includes("detergent") || l.includes("cleaner") || l.includes("disinfect")) return "faucet";
  if (l.includes("air freshener") || l.includes("freshener")) return "leaf";
  if (l.includes("fuel") || l.includes("motor oil") || l.includes("engine oil")) return "gas-pump";
  if (l.includes("tire") || l.includes("tyre")) return "car-side";
  if (l.includes("vehicle") || l.includes("car cleaning")) return "car-mechanic";
  if (l.includes("bandage") || l.includes("first aid kit")) return "heart-rate";
  if (l.includes("medicine") || l.includes("painkiller") || l.includes("antiseptic")) return "stethoscope";
  if (l.includes("fire extinguish") || l.includes("smoke detector")) return "shield-check";
  if (l.includes("hard hat") || l.includes("helmet")) return "hard-hat";
  if (l.includes("hammer") || l.includes("screwdriver") || l.includes("wrench")) return "hammer";
  if (l.includes("drill") || l.includes("saw") || l.includes("grinder")) return "tools";
  if (l.includes("measure") || l.includes("caliper") || l.includes("level")) return "scale";
  if (l.includes("printer") || l.includes("toner") || l.includes(" ink ")) return "print";
  if (l.includes("certificate") || l.includes("award")) return "award";
  if (l.includes("manual") || l.includes("document") || l.includes("compliance")) return "file";
  if (l.includes("carton") || l.includes("cardboard box")) return "box-open";
  if (l.includes("pallet")) return "pallet";
  if (l.includes("bubble") || l.includes("foam")) return "box-circle-check";
  if (l.includes("label") || l.includes("sticker")) return "stamp";
  if (l.includes("gift") || l.includes("promo")) return "gift";
  if (l.includes("uniform") || l.includes("shirt") || l.includes("jacket")) return "users";
  if (l.includes("pen") || l.includes("pencil") || l.includes("marker")) return "pencil";
  if (l.includes("notebook") || l.includes("binder") || l.includes("folder")) return "clipboard";
  if (l.includes("envelope") || l.includes("letter")) return "paper-plane";
  if (l.includes("mug") || l.includes("cup")) return "mug-hot";
  if (l.includes("key") || l.includes("keychain")) return "key";

  return "box-open"; /* ultimate fallback */
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
  const [currency, setCurrency] = useState("CNY");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [step, setStep] = useState<StepNo>(1);
  const [category, setCategory] = useState<InternalCategoryHint | null>(null);
  const [subcategory, setSubcategory] = useState<string>("");
  const [subSub, setSubSub] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);
  const [customIconUrl, setCustomIconUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [wRes, tRes, dRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" }),
          fetch("/api/inventory/item-types",  { credentials: "include", cache: "no-store" }),
          fetch("/api/create/defaults",       { credentials: "include", cache: "no-store" }),
        ]);
        const wJ = await wRes.json();
        const tJ = await tRes.json();
        const dJ = await dRes.json();
        if (cancelled) return;
        const wh = (wJ.warehouses ?? []) as Warehouse[];
        setWarehouses(wh);
        setWarehouseId(wh.find((w) => w.is_default)?.id ?? wh[0]?.id ?? "");
        setTypes((tJ.types ?? []) as ItemType[]);
        const ccy = (dJ as { defaults?: { base_currency?: string } }).defaults?.base_currency;
        if (ccy) setCurrency(ccy);
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
    setCustomIconUrl(null);
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
        currency,
      };
      if (typeRow) payload.item_type_id = typeRow.id;
      if (combinedSub) payload.subcategory = combinedSub;
      if (notes.trim()) payload.notes = notes.trim();
      if (customIconUrl) payload.metadata = { custom_icon: customIconUrl };
      const numCost = parseFloat(unitCost) || 0;
      if (numCost > 0) payload.cost_price = numCost;
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
              onPick={(c) => { setCategory(c); setSubcategory(""); setSubSub(""); setCustomMode(false); setCustomIconUrl(null); setStep(2); }}
              onSearchSelect={handleSearchSelect}
            />
          )}
          {step === 2 && category && (
            <Step2
              t={t} category={category} categoryLabel={categoryLabel} color={color}
              customMode={customMode} subcategory={subcategory}
              setSubcategory={setSubcategory} setCustomMode={setCustomMode}
              customIconUrl={customIconUrl} setCustomIconUrl={setCustomIconUrl}
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
              unitCost={unitCost} setUnitCost={setUnitCost}
              currency={currency}
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
        const col      = catColor(r.category.type_key);
        const catIcon  = CATEGORY_ICON[r.category.type_key] ?? "box-open";
        const catKey   = `inv.int.cat.${r.category.type_key}`;
        const catLabel = t(catKey) === catKey ? r.category.label : t(catKey);

        /* The "in" attribution line (always shown except top-level cat match) */
        const inLine =
          r.kind === "category"    ? null :
          r.kind === "subcategory" ? catLabel :
          /* subsub */               `${r.subcategory} · ${catLabel}`;

        /* Kind badge label */
        const kindLabel =
          r.kind === "subsub"      ? "variant" :
          r.kind === "subcategory" ? "subcategory" :
                                     "category";

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(r)}
            className={`flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-left transition-all ${col.hoverBorder} hover:bg-[var(--bg-elevated)]`}
          >
            {/* Category color chip — always the category's icon */}
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${col.chipBg}`}>
              <RrIcon name={catIcon} size={13} className={col.chipText} />
            </span>

            {/* Name + category attribution */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                {r.matchText}
              </div>
              {inLine && (
                <div className={`mt-0.5 flex items-center gap-1 truncate text-[10.5px] font-medium ${col.labelText}`}>
                  <RrIcon name={catIcon} size={9} />
                  <span>{inLine}</span>
                </div>
              )}
            </div>

            {/* Kind badge */}
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] font-semibold ${col.chipBg} ${col.chipText}`}>
              {kindLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Step 2 — subcategory grid (with icons) ─────────────────── */

function Step2({
  t, category, categoryLabel, color, customMode, subcategory,
  setSubcategory, setCustomMode, customIconUrl, setCustomIconUrl, onBack, onPick,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  color: CategoryColor;
  customMode: boolean;
  subcategory: string;
  setSubcategory: (s: string) => void;
  setCustomMode: (b: boolean) => void;
  customIconUrl: string | null;
  setCustomIconUrl: (u: string | null) => void;
  onBack: () => void;
  onPick: (s: string) => void;
}) {
  const icon = CATEGORY_ICON[category.type_key] ?? "box-open";

  function handleIconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomIconUrl((ev.target?.result as string) ?? null);
    reader.readAsDataURL(file);
    /* reset so re-picking same file fires onChange again */
    e.target.value = "";
  }

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

        {/* ── Custom entry ─────────────────────────────────── */}
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
          <div className="col-span-2 space-y-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:col-span-3 lg:col-span-4">
            {/* Name + icon upload row */}
            <div className="flex items-center gap-2">
              {/* ── Icon upload chip ─────────────────────── */}
              <label
                htmlFor="custom-icon-upload"
                title="Upload custom icon (PNG, SVG, JPG)"
                className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${color.chipBg} border-[var(--border-color)] hover:border-[var(--border-color)]`}
              >
                {customIconUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={customIconUrl} alt="custom icon" className="h-6 w-6 object-contain" />
                ) : (
                  <RrIcon name="upload" size={13} className="text-[var(--text-dim)]" />
                )}
              </label>
              <input
                id="custom-icon-upload"
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={handleIconFile}
              />

              {/* ── Name input ───────────────────────────── */}
              <input
                autoFocus
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder={t("inv.int.custom.placeholder")}
                className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-dim)]"
              />

              {/* ── Next button ──────────────────────────── */}
              <button
                type="button"
                onClick={() => subcategory.trim() && onPick(subcategory.trim())}
                disabled={!subcategory.trim()}
                className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[11px] font-semibold ${color.chipBg} ${color.chipText} disabled:opacity-40`}
              >
                <RrIcon name="arrow-up-right" size={11} /> Next
              </button>
            </div>

            {/* Hint row */}
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
              <RrIcon name="upload" size={10} />
              <span>Click the icon chip to upload a custom icon · PNG, SVG or JPG</span>
              {customIconUrl && (
                <button
                  type="button"
                  onClick={() => setCustomIconUrl(null)}
                  className="ml-1 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  <RrIcon name="cross" size={9} />
                </button>
              )}
            </div>
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
  name, setName, warehouseId, setWarehouseId, qty, setQty, unitCost, setUnitCost,
  currency, unit, setUnit, notes, setNotes, notesOpen, setNotesOpen, error, onBack,
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
  unitCost: string; setUnitCost: (s: string) => void;
  currency: string;
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
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] tabular-nums outline-none focus:border-[var(--text-dim)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.unit_cost")}</div>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] focus-within:border-[var(--text-dim)]">
            <span className="flex shrink-0 items-center border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 text-[11px] font-semibold tabular-nums text-[var(--text-dim)]">
              {currency || "CNY"}
            </span>
            <input
              type="number" min="0" step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] tabular-nums outline-none placeholder:text-[var(--text-dim)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </label>
        <label className="block">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.unit")}</div>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2.5 text-[13px]"
          >
            {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>

      {Number(qty) > 0 && warehouseId && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11.5px] ${color.chipBg} border-[var(--border-subtle)]`}>
          <RrIcon name="info" size={12} className={`mt-0.5 shrink-0 ${color.chipText}`} />
          <span className="text-[var(--text-dim)]">
            {t("inv.int.opening.note")}
            {Number(unitCost) > 0 && (
              <span className={`ml-1.5 font-semibold tabular-nums ${color.chipText}`}>
                Stock value: {(Number(qty) * Number(unitCost)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </span>
            )}
          </span>
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
