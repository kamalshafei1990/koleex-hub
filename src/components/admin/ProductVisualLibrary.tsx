"use client";

/* ---------------------------------------------------------------------------
   ProductVisualLibrary — the single home for every visual in Product Data.

   One place to manage ALL product data points and decide how each is shown:
   Icon · Photo · Text · Icon+Text. Grouped into tabs:
     • Commercial      — merges the Control Panel value lists (Levels, Tags,
                          Colors, Voltage, Watt, Plug Types). Add/edit values
                          AND set each value's visual + representation here.
     • Classification  — Divisions / Categories / Subcategories  (next)
     • Identity & Common — the universal fields shared by all products (next)
     • Specs           — the SPECIAL specs unique to each Type (not the common
                          ones — those live in Identity & Common).
     • Media           — image / gallery / video / docs            (next)

   Kamal always picks/uploads the visual; nothing is auto-generated.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VisualAssetPicker, { type PickedAsset } from "@/components/admin/VisualAssetPicker";
import {
  fetchAttributeConfig, saveAttributeConfig, uploadAttributeImage,
  fetchAttributeUsage, mergeConfigWithUsage,
  type AttributeConfig, type VisualMode,
} from "@/lib/product-attributes";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  /* Page header */
  "vl.specs.kicker":   { en: "Product Data",   zh: "产品数据", ar: "بيانات المنتجات" },
  "vl.specs.title":    { en: "Visual Library", zh: "视觉库",   ar: "مكتبة الصور" },
  "vl.specs.subtitle": {
    en: "The single home for every product data point and how it shows — Icon, Photo, Text, or Icon+Text. You pick from the Visual Library or upload; nothing is auto-generated.",
    zh: "所有产品数据点及其展示方式的唯一归属——图标、照片、文字或图标+文字。由你从视觉库选择或上传，不会自动生成。",
    ar: "الموطن الوحيد لكل نقطة بيانات في المنتجات وطريقة عرضها — أيقونة أو صورة أو نص أو أيقونة+نص. أنت تختار من مكتبة الصور أو ترفع بنفسك؛ لا شيء يُنشأ تلقائيًا.",
  },

  /* Tabs */
  "vl.specs.tab.commercial": { en: "Commercial",        zh: "商务",           ar: "تجاري" },
  "vl.specs.tab.identity":   { en: "Identity & Common", zh: "标识与通用",     ar: "الهوية والمشترك" },
  "vl.specs.tab.specs":      { en: "Specs (per type)",  zh: "规格（按类型）", ar: "المواصفات (حسب النوع)" },
  "vl.specs.tab.media":      { en: "Media",             zh: "媒体",           ar: "الوسائط" },

  /* Commercial value-list groups */
  "vl.specs.group.levels":         { en: "Levels",     zh: "等级",     ar: "المستويات" },
  "vl.specs.group.levels.hint":    { en: "Entry · Mid · Premium · Enterprise", zh: "入门 · 中端 · 高端 · 企业级", ar: "مبتدئ · متوسط · مميز · مؤسسي" },
  "vl.specs.group.tags":           { en: "Tags",       zh: "标签",     ar: "الوسوم" },
  "vl.specs.group.tags.hint":      { en: "Free-form product tags", zh: "自由填写的产品标签", ar: "وسوم منتجات حرة" },
  "vl.specs.group.colors":         { en: "Colors",     zh: "颜色",     ar: "الألوان" },
  "vl.specs.group.colors.hint":    { en: "Body / finish colors", zh: "机身/外观颜色", ar: "ألوان الهيكل / التشطيب" },
  "vl.specs.group.voltage":        { en: "Voltage",    zh: "电压",     ar: "الجهد الكهربائي" },
  "vl.specs.group.voltage.hint":   { en: "110V · 220V · 380V…", zh: "110V · 220V · 380V…", ar: "110V · 220V · 380V…" },
  "vl.specs.group.watt":           { en: "Watt",       zh: "瓦数",     ar: "الواط" },
  "vl.specs.group.watt.hint":      { en: "Motor power options", zh: "电机功率选项", ar: "خيارات قدرة المحرك" },
  "vl.specs.group.plug_types":     { en: "Plug Types", zh: "插头类型", ar: "أنواع القوابس" },
  "vl.specs.group.plug_types.hint":{ en: "Socket standards by region", zh: "各地区插座标准", ar: "معايير المقابس حسب المنطقة" },

  /* Visual modes */
  "vl.specs.mode.icon":      { en: "Icon",      zh: "图标",      ar: "أيقونة" },
  "vl.specs.mode.photo":     { en: "Photo",     zh: "照片",      ar: "صورة" },
  "vl.specs.mode.text":      { en: "Text",      zh: "文字",      ar: "نص" },
  "vl.specs.mode.icon_text": { en: "Icon+Text", zh: "图标+文字", ar: "أيقونة+نص" },

  /* Shared states */
  "vl.specs.loading": { en: "Loading…", zh: "加载中…",  ar: "جارٍ التحميل…" },
  "vl.specs.saving":  { en: "saving…",  zh: "保存中…",  ar: "جارٍ الحفظ…" },

  /* Commercial tab */
  "vl.specs.commercialIntro": {
    en: "These value lists used to live in the Control Panel — now managed here, each with its own visual.",
    zh: "这些值列表原先位于控制面板——现在在此管理，每个值都有自己的视觉。",
    ar: "كانت قوائم القيم هذه في لوحة التحكم — وتُدار الآن هنا، ولكل قيمة عنصرها المرئي.",
  },
  "vl.specs.valueCount.one":   { en: "{n} value",  zh: "{n} 个值", ar: "{n} قيمة" },
  "vl.specs.valueCount.other": { en: "{n} values", zh: "{n} 个值", ar: "{n} قيم" },
  "vl.specs.noValues": {
    en: "No values yet — add some in the product form or here later.",
    zh: "暂无值——稍后可在产品表单或此处添加。",
    ar: "لا توجد قيم بعد — أضِف بعضها في نموذج المنتج أو هنا لاحقًا.",
  },
  "vl.specs.none":        { en: "none",    zh: "无",     ar: "لا شيء" },
  "vl.specs.library":     { en: "Library", zh: "素材库", ar: "المكتبة" },
  "vl.specs.upload":      { en: "Upload",  zh: "上传",   ar: "رفع" },
  "vl.specs.visualFor":   { en: "Visual for \"{v}\"", zh: "“{v}”的视觉", ar: "العنصر المرئي لـ \"{v}\"" },
  "vl.specs.chooseVisual":{ en: "Choose a visual", zh: "选择视觉", ar: "اختر عنصرًا مرئيًا" },

  /* Specs tab */
  "vl.specs.specsIntro": {
    en: "Only the {special} specs of each type. Common specs live in Identity & Common.",
    zh: "仅限每个类型的{special}规格。通用规格位于“标识与通用”。",
    ar: "فقط المواصفات {special} لكل نوع. أما المواصفات العامة فتوجد في «الهوية والمشترك».",
  },
  "vl.specs.special":         { en: "special",   zh: "专属",       ar: "الخاصة" },
  "vl.specs.noTemplate":      { en: "No template.", zh: "暂无模板。", ar: "لا يوجد قالب." },
  "vl.specs.noSpecial":       { en: "No special specs for this type yet.", zh: "该类型暂无专属规格。", ar: "لا توجد مواصفات خاصة لهذا النوع بعد." },
  "vl.specs.setIcon":         { en: "Set icon", zh: "设置图标", ar: "تعيين أيقونة" },
  "vl.specs.iconPlaceholder": { en: "icon",     zh: "图标",     ar: "أيقونة" },
  "vl.specs.iconFor":         { en: "Icon for \"{v}\"", zh: "“{v}”的图标", ar: "أيقونة \"{v}\"" },

  /* Coming-next placeholders */
  "vl.specs.comingNext": { en: "Coming next", zh: "即将推出", ar: "قريبًا" },
  "vl.specs.coming.identity": {
    en: "The universal fields shared by all products (name · code · status · main image · the common specs) — mapped once here.",
    zh: "所有产品共享的通用字段（名称 · 编码 · 状态 · 主图 · 通用规格）——在此一次性映射。",
    ar: "الحقول العامة المشتركة بين جميع المنتجات (الاسم · الرمز · الحالة · الصورة الرئيسية · المواصفات العامة) — تُحدد هنا مرة واحدة.",
  },
  "vl.specs.coming.media": {
    en: "Image · gallery · video · documents representation — building next.",
    zh: "图片 · 图库 · 视频 · 文档的展示方式——即将构建。",
    ar: "طريقة عرض الصورة · المعرض · الفيديو · المستندات — قيد البناء لاحقًا.",
  },
};

/* Classification & Brands & the asset repository live in the Database app's
   own Visual Library tabs — not duplicated here. This screen owns only the
   product-specific layers: commercial value lists, common data, and the
   special per-type specs. */
const TABS = [
  { id: "commercial", label: "Commercial" },
  { id: "identity", label: "Identity & Common" },
  { id: "specs", label: "Specs (per type)" },
  { id: "media", label: "Media" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* The commercial value lists we merge from the Control Panel. */
const ATTR_GROUPS: { key: keyof AttributeConfig; label: string; hint: string }[] = [
  { key: "levels", label: "Levels", hint: "Entry · Mid · Premium · Enterprise" },
  { key: "tags", label: "Tags", hint: "Free-form product tags" },
  { key: "colors", label: "Colors", hint: "Body / finish colors" },
  { key: "voltage", label: "Voltage", hint: "110V · 220V · 380V…" },
  { key: "watt", label: "Watt", hint: "Motor power options" },
  { key: "plug_types", label: "Plug Types", hint: "Socket standards by region" },
];

const MODES: { id: VisualMode; label: string }[] = [
  { id: "icon", label: "Icon" },
  { id: "photo", label: "Photo" },
  { id: "text", label: "Text" },
  { id: "icon_text", label: "Icon+Text" },
];

function valuesOf(cfg: AttributeConfig, key: keyof AttributeConfig): string[] {
  if (key === "plug_types") return (cfg.plug_types ?? []).map((p) => p.name);
  const v = cfg[key];
  return Array.isArray(v) ? (v as string[]) : [];
}
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProductVisualLibrary({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation(T);
  const [tab, setTab] = useState<TabId>("commercial");

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-[1240px] px-4 md:px-6 lg:px-10 py-6"}>
      {/* Header — hidden when embedded inside the Database app (its layout shows the title). */}
      {!embedded && (
        <div className="mb-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">{t("vl.specs.kicker", "Product Data")}</p>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">{t("vl.specs.title", "Visual Library")}</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[720px]">
            {t("vl.specs.subtitle", "The single home for every product data point and how it shows — Icon, Photo, Text, or Icon+Text. You pick from the Visual Library or upload; nothing is auto-generated.")}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6 border-b border-[var(--border-subtle)] pb-3">
        {TABS.map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors ${
              tab === tt.id
                ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {t(`vl.specs.tab.${tt.id}`, tt.label)}
          </button>
        ))}
      </div>

      {tab === "commercial" && <CommercialTab />}
      {tab === "specs" && <SpecsTab />}
      {(tab === "identity" || tab === "media") && <ComingNext tab={tab} />}
    </div>
  );
}

/* ── Commercial tab — the Control Panel merge ──────────────────────────── */

function CommercialTab() {
  const { t } = useTranslation(T);
  const [cfg, setCfg] = useState<AttributeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ group: keyof AttributeConfig; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ group: keyof AttributeConfig; value: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, usage] = await Promise.all([fetchAttributeConfig(), fetchAttributeUsage()]);
        setCfg(mergeConfigWithUsage(c, usage));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: AttributeConfig, touchKey: string) => {
    setCfg(next);
    setSavingKey(touchKey);
    try {
      await saveAttributeConfig(next);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const imageFor = (c: AttributeConfig, group: keyof AttributeConfig, value: string): string => {
    const k = `${String(group)}:${value}`;
    if (c.value_images?.[k]) return c.value_images[k];
    if (group === "plug_types") return c.plug_types.find((p) => p.name === value)?.image ?? "";
    return "";
  };
  const modeFor = (c: AttributeConfig, group: keyof AttributeConfig, value: string): VisualMode => {
    const k = `${String(group)}:${value}`;
    if (c.value_modes?.[k]) return c.value_modes[k];
    return imageFor(c, group, value) ? "icon" : "text";
  };

  const setVisual = useCallback(
    (group: keyof AttributeConfig, value: string, url: string | null, mode?: VisualMode) => {
      if (!cfg) return;
      const k = `${String(group)}:${value}`;
      const images = { ...(cfg.value_images ?? {}) };
      const modes = { ...(cfg.value_modes ?? {}) };
      if (url === null) { delete images[k]; }
      else if (url) { images[k] = url; }
      if (mode) modes[k] = mode;
      else if (url && !modes[k]) modes[k] = "icon";
      persist({ ...cfg, value_images: images, value_modes: modes }, k);
    },
    [cfg, persist],
  );

  const onUploadFile = useCallback(
    async (file: File) => {
      const tgt = uploadTarget.current;
      if (!tgt || !cfg) return;
      setSavingKey(`${String(tgt.group)}:${tgt.value}`);
      const url = await uploadAttributeImage(String(tgt.group), slugify(tgt.value), file);
      if (url) setVisual(tgt.group, tgt.value, `${url}?t=${Date.now()}`, "icon");
      else setSavingKey(null);
      uploadTarget.current = null;
    },
    [cfg, setVisual],
  );

  if (loading || !cfg) {
    return <div className="h-60 grid place-items-center text-[13px] text-[var(--text-dim)]">{t("vl.specs.loading", "Loading…")}</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-[var(--text-dim)] -mt-2">
        {t("vl.specs.commercialIntro", "These value lists used to live in the Control Panel — now managed here, each with its own visual.")}
      </p>

      {ATTR_GROUPS.map((g) => {
        const values = valuesOf(cfg, g.key);
        return (
          <section key={String(g.key)} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t(`vl.specs.group.${String(g.key)}`, g.label)}</h2>
                <p className="text-[11px] text-[var(--text-dim)]">{t(`vl.specs.group.${String(g.key)}.hint`, g.hint)}</p>
              </div>
              <span className="text-[11px] text-[var(--text-dim)]">
                {(values.length === 1
                  ? t("vl.specs.valueCount.one", "{n} value")
                  : t("vl.specs.valueCount.other", "{n} values")
                ).replace("{n}", String(values.length))}
              </span>
            </div>

            {values.length === 0 ? (
              <p className="px-4 py-5 text-[12px] text-[var(--text-dim)]">{t("vl.specs.noValues", "No values yet — add some in the product form or here later.")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-subtle)]">
                {values.map((value) => {
                  const img = imageFor(cfg, g.key, value);
                  const mode = modeFor(cfg, g.key, value);
                  const k = `${String(g.key)}:${value}`;
                  return (
                    <div key={value} className="bg-[var(--bg-secondary)] p-3 flex items-center gap-3">
                      <span className="h-11 w-11 shrink-0 grid place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
                        {img ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={img} alt={value} className="max-h-8 max-w-8 object-contain" />
                        ) : (
                          <span className="text-[var(--text-ghost)] text-[10px] uppercase">{t("vl.specs.none", "none")}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{value}</p>
                        {/* Mode segmented control */}
                        <div className="mt-1.5 inline-flex rounded-md border border-[var(--border-subtle)] overflow-hidden">
                          {MODES.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setVisual(g.key, value, img || "", m.id)}
                              className={`px-2 h-6 text-[10px] font-medium border-r border-[var(--border-subtle)] last:border-r-0 transition-colors ${
                                mode === m.id
                                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                                  : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {t(`vl.specs.mode.${m.id}`, m.label)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => setPicker({ group: g.key, value })}
                          className="h-6 px-2 rounded-md text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                        >
                          {t("vl.specs.library", "Library")}
                        </button>
                        <button
                          onClick={() => { uploadTarget.current = { group: g.key, value }; fileRef.current?.click(); }}
                          className="h-6 px-2 rounded-md text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                        >
                          {t("vl.specs.upload", "Upload")}
                        </button>
                      </div>
                      {savingKey === k && <span className="text-[10px] text-[var(--text-dim)] shrink-0">{t("vl.specs.saving", "saving…")}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadFile(f); e.target.value = ""; }}
      />

      <VisualAssetPicker
        open={picker !== null}
        title={picker ? t("vl.specs.visualFor", "Visual for \"{v}\"").replace("{v}", picker.value) : t("vl.specs.chooseVisual", "Choose a visual")}
        onPick={(a: PickedAsset | null) => {
          if (picker) setVisual(picker.group, picker.value, a ? a.public_url : null, a ? "icon" : "text");
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}

/* ── Specs tab — SPECIAL specs per type (not common) ───────────────────── */

interface FieldRow { id: string; field_key: string; field_label: string; field_type: string; unit: string | null; options_json: Record<string, unknown> | null; }
interface SectionRow { id: string; title: string; fields: FieldRow[]; }
interface Tree { id: string; name: string; slug: string; sections: SectionRow[]; }
interface TemplateLite { id: string; name: string; slug: string; }

/* Sections that hold COMMON data (handled in Identity & Common), hidden here
   so the Specs tab shows only what's SPECIAL to the type. */
const COMMON_SECTIONS = new Set(["Basic Information", "Features & Highlights", "Packaging", "Electrical Specs", "Accessories"]);

function SpecsTab() {
  const { t } = useTranslation(T);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [slug, setSlug] = useState("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<{ field: FieldRow; value?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/product-templates");
        const data = (await res.json()) as { templates?: TemplateLite[] };
        const list = data.templates ?? [];
        setTemplates(list);
        if (list.length) setSlug((s) => s || list[0].slug);
      } catch { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/product-templates/${slug}`);
        setTree((await res.json()) as Tree);
      } catch { setTree(null); } finally { setLoading(false); }
    })();
  }, [slug]);

  const specialSections = useMemo(
    () => (tree ? tree.sections.filter((s) => !COMMON_SECTIONS.has(s.title)) : []),
    [tree],
  );

  const readOptions = (oj: Record<string, unknown> | null): Array<{ value: string; label?: string; icon?: string }> => {
    const arr = oj && Array.isArray((oj as { options?: unknown }).options) ? (oj as { options: unknown[] }).options : [];
    return arr.filter((o): o is { value: string } => !!o && typeof (o as { value?: unknown }).value === "string") as Array<{ value: string; label?: string; icon?: string }>;
  };

  const save = useCallback(async (field: FieldRow, nextOj: Record<string, unknown>) => {
    setSavingId(field.id);
    setTree((prev) => prev ? { ...prev, sections: prev.sections.map((s) => ({ ...s, fields: s.fields.map((f) => f.id === field.id ? { ...f, options_json: nextOj } : f) })) } : prev);
    try {
      await fetch(`/api/product-templates/${slug}/visual-map`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ field_id: field.id, options_json: nextOj }),
      });
    } finally { setSavingId(null); }
  }, [slug]);

  const applyPick = (asset: PickedAsset | null) => {
    if (!picker) return;
    const url = asset?.public_url ?? "";
    const f = picker.field;
    const oj: Record<string, unknown> = { ...(f.options_json ?? {}) };
    if (picker.value === undefined) {
      if (url) oj.field_icon_url = url; else delete oj.field_icon_url;
    } else {
      oj.options = readOptions(f.options_json).map((o) => o.value === picker.value ? { ...o, icon: url || undefined } : o);
    }
    setPicker(null);
    void save(f, oj);
  };

  /* The intro sentence keeps its emphasized word across languages via a
     {special} placeholder split — no English-only concatenation. */
  const intro = t("vl.specs.specsIntro", "Only the {special} specs of each type. Common specs live in Identity & Common.");
  const [introPre, introPost] = intro.split("{special}");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--text-dim)]">{introPre}<span className="text-[var(--text-muted)] font-medium">{t("vl.specs.special", "special")}</span>{introPost}</p>
        {templates.length > 0 && (
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] outline-none">
            {templates.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-40 grid place-items-center text-[13px] text-[var(--text-dim)]">{t("vl.specs.loading", "Loading…")}</div>
      ) : !tree ? (
        <div className="h-32 grid place-items-center text-[13px] text-[var(--text-dim)]">{t("vl.specs.noTemplate", "No template.")}</div>
      ) : specialSections.length === 0 ? (
        <div className="h-32 grid place-items-center text-[13px] text-[var(--text-dim)]">{t("vl.specs.noSpecial", "No special specs for this type yet.")}</div>
      ) : (
        specialSections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]"><h2 className="text-[13px] font-bold text-[var(--text-primary)]">{section.title}</h2></div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {section.fields.map((field) => {
                const oj = (field.options_json ?? {}) as { field_icon_url?: string };
                const options = readOptions(field.options_json);
                return (
                  <div key={field.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPicker({ field })} title={t("vl.specs.setIcon", "Set icon")} className={`shrink-0 h-10 w-10 grid place-items-center rounded-lg border overflow-hidden ${oj.field_icon_url ? "border-[var(--border-subtle)] bg-[var(--bg-surface)]" : "border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40"}`}>
                        {oj.field_icon_url
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={oj.field_icon_url} alt="" className="max-h-7 max-w-7 object-contain" />
                          : <span className="text-[9px] uppercase text-[var(--text-ghost)]">{t("vl.specs.iconPlaceholder", "icon")}</span>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{field.field_label}{field.unit ? <span className="text-[var(--text-dim)] font-normal"> · {field.unit}</span> : null}</p>
                        <p className="text-[11px] text-[var(--text-dim)]">{field.field_key} · {field.field_type}</p>
                      </div>
                      {savingId === field.id && <span className="text-[11px] text-[var(--text-dim)]">{t("vl.specs.saving", "saving…")}</span>}
                    </div>
                    {options.length > 0 && (
                      <div className="mt-3 ml-[52px] flex flex-wrap gap-2">
                        {options.map((o) => (
                          <button key={o.value} onClick={() => setPicker({ field, value: o.value })} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]" title={t("vl.specs.iconFor", "Icon for \"{v}\"").replace("{v}", o.label ?? o.value)}>
                            <span className="h-6 w-6 grid place-items-center rounded bg-[var(--bg-surface-subtle)] overflow-hidden">
                              {o.icon
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={o.icon} alt="" className="max-h-5 max-w-5 object-contain" />
                                : <span className="text-[var(--text-ghost)] text-[12px]">+</span>}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)]">{o.label ?? o.value}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <VisualAssetPicker
        open={picker !== null}
        title={picker?.value !== undefined ? t("vl.specs.iconFor", "Icon for \"{v}\"").replace("{v}", picker.value) : picker ? t("vl.specs.iconFor", "Icon for \"{v}\"").replace("{v}", picker.field.field_label) : t("vl.specs.chooseVisual", "Choose a visual")}
        onPick={applyPick}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}

function ComingNext({ tab }: { tab: TabId }) {
  const { t } = useTranslation(T);
  const copy: Record<string, string> = {
    identity: t("vl.specs.coming.identity", "The universal fields shared by all products (name · code · status · main image · the common specs) — mapped once here."),
    media: t("vl.specs.coming.media", "Image · gallery · video · documents representation — building next."),
  };
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-8 text-center">
      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{t("vl.specs.comingNext", "Coming next")}</p>
      <p className="text-[12px] text-[var(--text-muted)] mt-1 max-w-[520px] mx-auto leading-relaxed">{copy[tab]}</p>
    </div>
  );
}
