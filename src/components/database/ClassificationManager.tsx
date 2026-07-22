"use client";

/* ---------------------------------------------------------------------------
   ClassificationManager — KOLEEX product classification, in the SAME layout as
   the Visual Library: a left sidebar (Divisions) + a toolbar + a grid of icon
   cards. Drill Division → Category → Subcategory → Kind via the breadcrumb.

   SOURCE OF TRUTH = the real product taxonomy (divisions / categories /
   subcategories via /api/taxonomy/*, the SAME tables the Add-Product Classify
   form uses) + machine kinds from the code catalog. Editing here syncs with
   the Product Data app. Icons are stored in the classification-icon HUB
   (/api/classification-icons) keyed by (level, slug), so an icon set here
   shows up in the Classify form and anywhere else that reads the hub.

   Kinds are listed read-only from the catalog (you can set their icon, but
   creating/renaming kinds stays in the product schema engine).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { getKindsForSubcategory } from "@/lib/machine-kinds";
import { getDivisionIcon } from "@/components/icons/divisions";
import { GENERAL_ICON_CATEGORIES, fetchIconCategories, type FetchedIconCategory } from "@/lib/visual-library/taxonomy";
import {
  fetchDivisions, fetchCategories, fetchSubcategories, fetchClassificationIcons,
  createDivision, updateDivision, deleteDivision,
  createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.class.divisions":         { en: "Divisions",       zh: "大类",     ar: "الأقسام" },
  "vl.class.newDivision":       { en: "New division",    zh: "新建大类", ar: "قسم جديد" },
  "vl.class.lvl.divisions":     { en: "divisions",       zh: "大类",     ar: "الأقسام" },
  "vl.class.lvl.categories":    { en: "categories",      zh: "类别",     ar: "الفئات" },
  "vl.class.lvl.subcategories": { en: "subcategories",   zh: "子类别",   ar: "الفئات الفرعية" },
  "vl.class.lvl.kinds":         { en: "kinds",           zh: "类型",     ar: "الأنواع" },
  "vl.class.one.division":      { en: "division",        zh: "大类",     ar: "قسم" },
  "vl.class.one.category":      { en: "category",        zh: "类别",     ar: "فئة" },
  "vl.class.one.subcategory":   { en: "subcategory",     zh: "子类别",   ar: "فئة فرعية" },
  "vl.class.one.kind":          { en: "kind",            zh: "类型",     ar: "نوع" },
  "vl.class.search":            { en: "Search {x}…",     zh: "搜索{x}…", ar: "ابحث في {x}…" },
  "vl.class.new":               { en: "New {x}",         zh: "新建{x}",  ar: "إضافة {x}" },
  "vl.class.newNamePh":         { en: "New {x} name…",   zh: "新{x}名称…", ar: "اسم {x} الجديد…" },
  "vl.class.add":               { en: "Add",             zh: "添加",     ar: "إضافة" },
  "vl.class.cancel":            { en: "Cancel",          zh: "取消",     ar: "إلغاء" },
  "vl.class.kindsNote":         { en: "Kinds come from the product schema engine — set their icon here; add/rename kinds in the schema.", zh: "类型来自产品架构引擎——可在此设置图标；添加/重命名类型请在架构中进行。", ar: "الأنواع مصدرها محرك مخطط المنتجات — عيّن أيقوناتها هنا؛ وتتم إضافتها وإعادة تسميتها في المخطط." },
  "vl.class.noMatch":           { en: "Nothing matches", zh: "没有匹配项", ar: "لا توجد نتائج مطابقة" },
  "vl.class.noKinds":           { en: "No kinds for this subcategory", zh: "该子类别暂无类型", ar: "لا توجد أنواع لهذه الفئة الفرعية" },
  "vl.class.noneYet":           { en: "No {x} yet",      zh: "暂无{x}",  ar: "لا توجد {x} بعد" },
  "vl.class.tryAnother":        { en: "Try another search term.", zh: "请尝试其他搜索词。", ar: "جرّب كلمة بحث أخرى." },
  "vl.class.useNew":            { en: "Use “New {x}” to add one.", zh: "使用“新建{x}”来添加。", ar: "استخدم «إضافة {x}» للإضافة." },
  "vl.class.createFail":        { en: "Couldn't create — the name/slug may already exist.", zh: "创建失败——名称或标识可能已存在。", ar: "تعذّر الإنشاء — قد يكون الاسم أو المعرّف موجودًا بالفعل." },
  "vl.class.removeConfirm":     { en: "Remove this from the product taxonomy? Products that use it may be affected.", zh: "确定从产品分类体系中移除？使用它的产品可能会受影响。", ar: "هل تريد إزالة هذا من تصنيف المنتجات؟ قد تتأثر المنتجات التي تستخدمه." },
  "vl.class.deleteFail":        { en: "Couldn't delete — it may still be in use by products.", zh: "删除失败——可能仍被产品使用。", ar: "تعذّر الحذف — قد يكون لا يزال مستخدمًا في منتجات." },
  "vl.class.iconSaveFail":      { en: "Couldn't save the icon. Please try again.", zh: "无法保存图标，请重试。", ar: "تعذّر حفظ الأيقونة. يُرجى المحاولة مرة أخرى." },
  "vl.class.iconSaveNetwork":   { en: "Couldn't save the icon — network error. Please try again.", zh: "无法保存图标——网络错误，请重试。", ar: "تعذّر حفظ الأيقونة — خطأ في الشبكة. يُرجى المحاولة مرة أخرى." },
  "vl.class.moveUp":            { en: "Move up",         zh: "上移",     ar: "نقل لأعلى" },
  "vl.class.moveDown":          { en: "Move down",       zh: "下移",     ar: "نقل لأسفل" },
  "vl.class.rename":            { en: "Rename",          zh: "重命名",   ar: "إعادة تسمية" },
  "vl.class.delete":            { en: "Delete",          zh: "删除",     ar: "حذف" },
  "vl.class.changeIcon":        { en: "Change icon",     zh: "更换图标", ar: "تغيير الأيقونة" },
  "vl.class.addIcon":           { en: "Add icon from Visual Library", zh: "从视觉库添加图标", ar: "إضافة أيقونة من مكتبة الصور" },
  "vl.class.noIcon":            { en: "No icon",         zh: "无图标",   ar: "بدون أيقونة" },
  "vl.class.pickTitle":         { en: "Choose an icon from the Visual Library", zh: "从视觉库选择图标", ar: "اختر أيقونة من مكتبة الصور" },
  "vl.class.pickSearch":        { en: "Search Visual Library icons…", zh: "搜索视觉库图标…", ar: "ابحث في أيقونات مكتبة الصور…" },
  "vl.class.allCategories":     { en: "All categories",  zh: "所有类别", ar: "كل الفئات" },
  "vl.class.allIcons":          { en: "All icons",       zh: "所有图标", ar: "كل الأيقونات" },
  "vl.class.noIconsFound":      { en: "No icons found.", zh: "未找到图标。", ar: "لم يتم العثور على أيقونات." },
  "vl.class.noIconsYet":        { en: "No icons here yet.", zh: "这里还没有图标。", ar: "لا توجد أيقونات هنا بعد." },
  "vl.class.showing":           { en: "Showing {n} of {m}", zh: "显示 {n} / {m}", ar: "عرض {n} من {m}" },
  "vl.class.iconsLive":         { en: "Icons live in the Visual Library.", zh: "图标存放在视觉库中。", ar: "الأيقونات محفوظة في مكتبة الصور." },
  "vl.class.clearIcon":         { en: "Clear icon",      zh: "清除图标", ar: "إزالة الأيقونة" },
};

interface Item { id: string; name: string; slug: string; order: number }
interface VlIcon { id: string; title: string; visual_asset_code: string; public_url: string | null }

type LevelKey = "divisions" | "categories" | "subcategories" | "types";
const CHILD_OF: Record<Exclude<LevelKey, "types">, LevelKey> = {
  divisions: "categories", categories: "subcategories", subcategories: "types",
};
const SINGULAR: Record<LevelKey, string> = { divisions: "division", categories: "category", subcategories: "subcategory", types: "kind" };
/* This screen's level keys → classification-icon HUB levels ("types" → "kind"). */
const HUB_LEVEL: Record<LevelKey, "division" | "category" | "subcategory" | "kind"> = {
  divisions: "division", categories: "category", subcategories: "subcategory", types: "kind",
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function ClassificationManager() {
  const { t } = useTranslation(T);
  // drill trail below the root; empty = showing divisions. Each entry carries
  // the slug so the kinds level (keyed by subcategory slug) can resolve.
  const [trail, setTrail] = useState<{ level: LevelKey; id: string; name: string; slug: string }[]>([]);

  // Full real taxonomy (loaded once, refreshed on write) + the icon hub map.
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [hubIcons, setHubIcons] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [picker, setPicker] = useState<{ id: string; level: LevelKey; slug: string } | null>(null);

  const activeDivId = trail[0]?.id ?? null;
  const level: LevelKey = trail.length === 0 ? "divisions"
    : trail.length === 1 ? "categories"
    : trail.length === 2 ? "subcategories" : "types";
  /* Translated level labels ("divisions" / "division", …) used in templates. */
  const lvlLabel = t(`vl.class.lvl.${level === "types" ? "kinds" : level}`, level === "types" ? "kinds" : level);
  const oneLabel = t(`vl.class.one.${SINGULAR[level]}`, SINGULAR[level]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, s, icons] = await Promise.all([
        fetchDivisions(), fetchCategories(), fetchSubcategories(), fetchClassificationIcons(),
      ]);
      setDivisions(d); setCategories(c); setSubcategories(s); setHubIcons(icons);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const ord = (n: number | null | undefined) => (typeof n === "number" ? n : 0);

  /* Items at the current level, derived from the real taxonomy (+ code kinds). */
  const items: Item[] = useMemo(() => {
    if (level === "divisions") {
      return [...divisions].sort((a, b) => ord(a.order) - ord(b.order))
        .map((d) => ({ id: d.id, name: d.name, slug: d.slug, order: ord(d.order) }));
    }
    if (level === "categories") {
      return categories.filter((c) => c.division_id === trail[0]?.id)
        .sort((a, b) => ord(a.order) - ord(b.order))
        .map((c) => ({ id: c.id, name: c.name, slug: c.slug, order: ord(c.order) }));
    }
    if (level === "subcategories") {
      return subcategories.filter((s) => s.category_id === trail[1]?.id)
        .sort((a, b) => ord(a.order) - ord(b.order))
        .map((s) => ({ id: s.id, name: s.name, slug: s.slug, order: ord(s.order) }));
    }
    // kinds — read-only from the catalog, keyed by the parent subcategory slug
    const subSlug = trail[2]?.slug;
    if (!subSlug) return [];
    return getKindsForSubcategory(subSlug)
      .filter((k) => k.subcategory === subSlug)
      .map((k) => ({ id: k.slug, name: k.name, slug: k.slug, order: 0 }));
  }, [level, divisions, categories, subcategories, trail]);

  const childCount = (it: Item): number | undefined => {
    if (level === "divisions") return categories.filter((c) => c.division_id === it.id).length;
    if (level === "categories") return subcategories.filter((s) => s.category_id === it.id).length;
    if (level === "subcategories") return getKindsForSubcategory(it.slug).filter((k) => k.subcategory === it.slug).length;
    return undefined; // kinds are terminal
  };

  const iconFor = (it: Item): string | undefined => hubIcons[HUB_LEVEL[level]]?.[it.slug];
  const isTypes = level === "types";

  /* Built-in code-icon fallback (shown when the hub has no override), so the
     card never reads "No icon" for a classification that already ships an
     icon in the product UI: divisions → custom division SVG; kinds → the
     machine-kind schematic. Categories/subcategories ship their icon via
     Storage, which is mirrored into the hub, so they need no code fallback. */
  const fallbackFor = (it: Item): React.ReactNode => {
    if (level === "divisions") {
      const Div = getDivisionIcon(it.slug);
      return Div ? <Div className="h-full w-full" /> : null;
    }
    if (level === "types") {
      const Kind = getKindsForSubcategory(trail[2]?.slug ?? "").find((k) => k.slug === it.slug)?.icon;
      return Kind ? <Kind className="h-full w-full" /> : null;
    }
    return null;
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || isTypes) { setAdding(false); setNewName(""); return; }
    setBusyId("new");
    const slug = slugify(name);
    let res: unknown = null;
    try {
      if (level === "divisions") {
        res = await createDivision({ name, slug, order: Math.max(0, ...divisions.map((d) => ord(d.order))) + 1 });
      } else if (level === "categories") {
        const sibs = categories.filter((c) => c.division_id === trail[0].id);
        res = await createCategory({ name, slug, division_id: trail[0].id, order: Math.max(0, ...sibs.map((c) => ord(c.order))) + 1 });
      } else if (level === "subcategories") {
        const sibs = subcategories.filter((s) => s.category_id === trail[1].id);
        res = await createSubcategory({ name, slug, category_id: trail[1].id, order: Math.max(0, ...sibs.map((s) => ord(s.order))) + 1 });
      }
    } catch { /* surfaced below */ }
    setBusyId(null); setNewName(""); setAdding(false);
    if (!res) alert(t("vl.class.createFail", "Couldn't create — the name/slug may already exist."));
    refresh();
  };

  const rename = async (id: string) => {
    const name = editName.trim();
    if (!name || isTypes) { setEditId(null); return; }
    setBusyId(id);
    if (level === "divisions") await updateDivision(id, { name });
    else if (level === "categories") await updateCategory(id, { name });
    else if (level === "subcategories") await updateSubcategory(id, { name });
    setBusyId(null); setEditId(null); refresh();
  };

  const remove = async (id: string) => {
    if (isTypes) return;
    if (!confirm(t("vl.class.removeConfirm", "Remove this from the product taxonomy? Products that use it may be affected."))) return;
    setBusyId(id);
    let ok = true;
    if (level === "divisions") ok = await deleteDivision(id);
    else if (level === "categories") ok = await deleteCategory(id);
    else if (level === "subcategories") ok = await deleteSubcategory(id);
    setBusyId(null);
    if (!ok) { alert(t("vl.class.deleteFail", "Couldn't delete — it may still be in use by products.")); refresh(); return; }
    if (trail.some((t) => t.id === id)) setTrail((prev) => prev.slice(0, prev.findIndex((t) => t.id === id)));
    refresh();
  };

  const move = async (it: Item, dir: -1 | 1, list: Item[]) => {
    if (isTypes) return;
    const idx = list.findIndex((x) => x.id === it.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const a = list[idx], b = list[swap];
    const upd = level === "divisions" ? updateDivision : level === "categories" ? updateCategory : updateSubcategory;
    setBusyId(it.id);
    await Promise.all([upd(a.id, { order: b.order }), upd(b.id, { order: a.order })]);
    setBusyId(null); refresh();
  };

  const assignIcon = async (icon: VlIcon | null) => {
    if (!picker) return;
    const { id, level: pLevel, slug } = picker;
    setBusyId(id);
    try {
      const r = await fetch("/api/classification-icons", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: HUB_LEVEL[pLevel], slug, icon_asset_id: icon?.id ?? null, icon_url: icon?.public_url ?? null }),
      });
      if (!r.ok) alert(t("vl.class.iconSaveFail", "Couldn't save the icon. Please try again."));
    } catch {
      alert(t("vl.class.iconSaveNetwork", "Couldn't save the icon — network error. Please try again."));
    } finally {
      setBusyId(null); setPicker(null); refresh();
    }
  };

  const drill = (it: Item) => {
    if (level === "types") return;
    const childLevel = CHILD_OF[level as Exclude<LevelKey, "types">];
    setTrail((prev) => [...prev, { level: childLevel, id: it.id, name: it.name, slug: it.slug }]);
  };
  const goTo = (depth: number) => setTrail((prev) => prev.slice(0, depth));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((i) => i.name.toLowerCase().includes(term) || i.slug.toLowerCase().includes(term)) : items;
  }, [items, q]);

  return (
    <div className="flex gap-5">
      {/* Divisions sidebar (Library-style) */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-2 space-y-0.5">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.class.divisions", "Divisions")}</span>
            <button type="button" onClick={() => { setTrail([]); setAdding(true); }} title={t("vl.class.newDivision", "New division")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"><PlusIcon size={12} /></button>
          </div>
          {loading && divisions.length === 0 ? <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
            : [...divisions].sort((a, b) => ord(a.order) - ord(b.order)).map((d) => (
              <button key={d.id} type="button" onClick={() => setTrail([{ level: "categories", id: d.id, name: d.name, slug: d.slug }])}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  activeDivId === d.id ? "bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"}`}>
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{categories.filter((c) => c.division_id === d.id).length}</span>
              </button>
            ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <Crumb label={t("vl.class.divisions", "Divisions")} active={trail.length === 0} onClick={() => goTo(0)} />
          {trail.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="text-[var(--text-dim)]">›</span>
              <Crumb label={t.name} active={i === trail.length - 1} onClick={() => goTo(i + 1)} />
            </span>
          ))}
        </nav>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)]">
            <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vl.class.search", "Search {x}…").replace("{x}", lvlLabel)}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
          </div>
          {!isTypes && (
            <button type="button" onClick={() => setAdding((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
              <PlusIcon size={14} /> {t("vl.class.new", "New {x}").replace("{x}", oneLabel)}
            </button>
          )}
        </div>

        {isTypes && (
          <p className="text-[11.5px] text-[var(--text-dim)]">{t("vl.class.kindsNote", "Kinds come from the product schema engine — set their icon here; add/rename kinds in the schema.")}</p>
        )}

        {adding && !isTypes && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder={t("vl.class.newNamePh", "New {x} name…").replace("{x}", oneLabel)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
            <button type="button" disabled={busyId === "new"} onClick={create} className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">{busyId === "new" ? <SpinnerIcon size={12} className="animate-spin" /> : t("vl.class.add", "Add")}</button>
            <button type="button" onClick={() => { setAdding(false); setNewName(""); }} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("vl.class.cancel", "Cancel")}</button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
            <ImageRawIcon size={32} className="text-[var(--text-dim)]" />
            <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">{q ? t("vl.class.noMatch", "Nothing matches") : isTypes ? t("vl.class.noKinds", "No kinds for this subcategory") : t("vl.class.noneYet", "No {x} yet").replace("{x}", lvlLabel)}</p>
            {!isTypes && <p className="mt-1 text-[12px] text-[var(--text-dim)]">{q ? t("vl.class.tryAnother", "Try another search term.") : t("vl.class.useNew", "Use “New {x}” to add one.").replace("{x}", oneLabel)}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((it, idx) => (
              <ClassificationCard
                key={it.id} item={it} iconUrl={iconFor(it)} fallback={fallbackFor(it)} level={level} count={childCount(it)}
                busy={busyId === it.id} editing={editId === it.id} editName={editName}
                onEditName={setEditName} onCommitRename={() => rename(it.id)} onCancelRename={() => setEditId(null)}
                onStartRename={isTypes ? undefined : () => { setEditId(it.id); setEditName(it.name); }}
                onDelete={isTypes ? undefined : () => remove(it.id)}
                onMoveUp={!q && !isTypes && idx > 0 ? () => move(it, -1, filtered) : undefined}
                onMoveDown={!q && !isTypes && idx < filtered.length - 1 ? () => move(it, 1, filtered) : undefined}
                onOpenIcon={() => setPicker({ id: it.id, level, slug: it.slug })}
                onDrill={level !== "types" ? () => drill(it) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {picker && <IconPicker onClose={() => setPicker(null)} onPick={assignIcon} />}
    </div>
  );
}

/* One Library-style card. White icon tile (click → assign from Library). The
   icon comes from the classification-icon HUB. */
function ClassificationCard({
  item, iconUrl, fallback, level, count, busy, editing, editName, onEditName, onCommitRename, onCancelRename,
  onStartRename, onDelete, onMoveUp, onMoveDown, onOpenIcon, onDrill,
}: {
  item: Item; iconUrl?: string; fallback?: React.ReactNode; level: LevelKey; count?: number; busy: boolean; editing: boolean; editName: string;
  onEditName: (v: string) => void; onCommitRename: () => void; onCancelRename: () => void;
  onStartRename?: () => void; onDelete?: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
  onOpenIcon: () => void; onDrill?: () => void;
}) {
  const { t } = useTranslation(T);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
      {/* hover actions */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onMoveUp && <CardBtn title={t("vl.class.moveUp", "Move up")} onClick={onMoveUp}><ArrowUpIcon size={11} /></CardBtn>}
        {onMoveDown && <CardBtn title={t("vl.class.moveDown", "Move down")} onClick={onMoveDown}><ArrowDownIcon size={11} /></CardBtn>}
        {onStartRename && <CardBtn title={t("vl.class.rename", "Rename")} onClick={onStartRename}><PencilIcon size={11} /></CardBtn>}
        {onDelete && <CardBtn title={t("vl.class.delete", "Delete")} tone="rose" onClick={onDelete}><TrashIcon size={11} /></CardBtn>}
      </div>

      {/* icon tile — empty by default; click to assign a Visual Library icon */}
      <button type="button" onClick={onOpenIcon} title={iconUrl ? t("vl.class.changeIcon", "Change icon") : t("vl.class.addIcon", "Add icon from Visual Library")}
        className="flex aspect-square w-full items-center justify-center bg-white p-3 text-neutral-900">
        {busy ? <SpinnerIcon size={18} className="animate-spin text-neutral-400" /> : iconUrl ? (
          // Render the override via a CSS mask so single-tone SVGs (incl.
          // white-stroked ones) stay visible on the white tile, in theme color.
          <MonoImg src={iconUrl} className="h-full w-full" />
        ) : fallback ? (
          <span className="flex h-full w-full items-center justify-center [&_svg]:h-full [&_svg]:w-full">{fallback}</span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-neutral-300">
            <ImageRawIcon size={20} />
            <span className="text-[8px] font-semibold uppercase tracking-wide">{t("vl.class.noIcon", "No icon")}</span>
          </span>
        )}
      </button>

      {/* footer */}
      {editing ? (
        <div className="border-t border-[var(--border-subtle)] p-1.5">
          <input autoFocus value={editName} onChange={(e) => onEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitRename(); if (e.key === "Escape") onCancelRename(); }}
            onBlur={onCommitRename}
            className="w-full rounded border border-[var(--border-focus)] bg-[var(--bg-card)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none" />
        </div>
      ) : (
        <button type="button" onClick={onDrill ?? onOpenIcon} className="flex flex-col items-start gap-0.5 border-t border-[var(--border-subtle)] px-2 py-1.5 text-left">
          <div className="flex w-full items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.name}</span>
            {count !== undefined ? (
              <span className="shrink-0 rounded-full bg-[var(--bg-card)] px-1.5 text-[9px] font-semibold tabular-nums text-[var(--text-dim)]">{count}</span>
            ) : level === "types" ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)] opacity-40" />
            ) : null}
          </div>
          <span className="truncate font-mono text-[9px] text-[var(--text-dim)]">{item.slug}</span>
        </button>
      )}
    </div>
  );
}

/* Renders an SVG URL as a single-tone (currentColor) mask so it is always
   visible on the white icon tile, regardless of the source SVG's own color. */
function MonoImg({ src, className }: { src: string; className?: string }) {
  // Whitespace (e.g. a stray newline in a stored URL) invalidates the CSS
  // mask value and the tile paints as a solid square — strip it.
  const url = src.replace(/\s+/g, "");
  return (
    <span
      aria-hidden
      className={`inline-block bg-current ${className ?? ""}`}
      style={{
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

function CardBtn({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: "rose" }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 text-[var(--text-dim)] backdrop-blur hover:text-[var(--text-primary)] ${tone === "rose" ? "hover:text-rose-400" : ""}`}>
      {children}
    </button>
  );
}

function Crumb({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`max-w-[200px] truncate ${active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>{label}</button>;
}

/* Pick / clear a Visual Library icon. */
type PickerCollection = { id: string; name: string; asset_count?: number };

function IconPicker({ onClose, onPick }: { onClose: () => void; onPick: (icon: VlIcon | null) => void }) {
  const { t } = useTranslation(T);
  const [q, setQ] = useState("");
  const [cols, setCols] = useState<PickerCollection[]>([]);
  const [cats, setCats] = useState<FetchedIconCategory[]>(GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code })));
  const [activeCol, setActiveCol] = useState<string | null>(null); // null = All icons (collection axis)
  const [activeCat, setActiveCat] = useState<string>("");          // "" = All categories
  const [items, setItems] = useState<VlIcon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);  // first page (replace)
  const [more, setMore] = useState(false);         // appending next page
  const PAGE = 60;

  // Collections (with at least one asset) for the filter row — loaded once.
  useEffect(() => {
    fetch("/api/visual-library/collections", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((j) => setCols((j.collections ?? []).filter((c: PickerCollection) => (c.asset_count ?? 0) > 0)))
      .catch(() => {});
    fetchIconCategories().then(setCats).catch(() => {});
  }, []);

  // Fetch one page from either the whole library (with optional search) or a
  // single collection's members. Returns the icon assets + the server total.
  const fetchPage = useCallback(async (pg: number, term: string, col: string | null, cat: string) => {
    const url = col
      ? `/api/visual-library/collections/${col}/assets?page=${pg}&pageSize=${PAGE}`
      : `/api/visual-library?view=list&asset_type=icon&sort=usage&pageSize=${PAGE}&page=${pg}${term.trim().length >= 2 ? `&q=${encodeURIComponent(term.trim())}` : ""}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
    const r = await fetch(url, { credentials: "include", cache: "no-store" });
    const j = r.ok ? await r.json() : {};
    const assets: VlIcon[] = col
      ? (j.items ?? []).map((i: { asset: VlIcon | null }) => i.asset).filter((a: VlIcon | null): a is VlIcon => !!a && !!a.public_url)
      : (j.assets ?? []).filter((a: VlIcon) => a.public_url);
    return { assets, total: (j.total as number) ?? assets.length };
  }, []);

  // Reset + load page 1 whenever the search term, category, or collection changes.
  useEffect(() => {
    let alive = true; setLoading(true); setPage(1);
    const t = setTimeout(async () => {
      const { assets, total: tot } = await fetchPage(1, q, activeCol, activeCat);
      if (!alive) return;
      setItems(assets); setTotal(tot); setLoading(false);
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q, activeCol, activeCat, fetchPage]);

  const loadMore = async () => {
    if (more || loading || items.length >= total) return;
    const next = page + 1; setMore(true);
    const { assets } = await fetchPage(next, q, activeCol, activeCat);
    setItems((prev) => [...prev, ...assets]); setPage(next); setMore(false);
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && items.length < total && !more && !loading) loadMore();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center bg-black/60 pt-20" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{t("vl.class.pickTitle", "Choose an icon from the Visual Library")}</span>
          <button type="button" onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={14} /></button>
        </div>
        {/* Search + category. Typing searches across icons (clears any active
            collection); the category dropdown narrows by icon category. */}
        <div className="flex gap-1.5">
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) setActiveCol(null); }} placeholder={t("vl.class.pickSearch", "Search Visual Library icons…")}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
          <select value={activeCat} onChange={(e) => { setActiveCat(e.target.value); if (e.target.value) setActiveCol(null); }}
            className="shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
            <option value="">{t("vl.class.allCategories", "All categories")}</option>
            {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>

        {/* Collection filter row */}
        {cols.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <PickerChip active={activeCol === null && !q && !activeCat} label={t("vl.class.allIcons", "All icons")} onClick={() => { setQ(""); setActiveCat(""); setActiveCol(null); }} />
            {cols.map((c) => (
              <PickerChip key={c.id} active={activeCol === c.id} label={c.name} count={c.asset_count}
                onClick={() => { setQ(""); setActiveCat(""); setActiveCol(c.id); }} />
            ))}
          </div>
        )}

        <div className="mt-2 max-h-[280px] min-h-[120px] overflow-y-auto" onScroll={onScroll}>
          {loading ? <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
            : items.length === 0 ? <p className="py-6 text-center text-[11.5px] text-[var(--text-dim)]">{q.trim() ? t("vl.class.noIconsFound", "No icons found.") : t("vl.class.noIconsYet", "No icons here yet.")}</p>
            : (
              <>
                <div className="grid grid-cols-6 gap-1.5">
                  {items.map((a, i) => (
                    <button key={`${a.id}-${i}`} type="button" title={a.title} onClick={() => onPick(a)}
                      className="flex aspect-square items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white hover:border-[var(--border-focus)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.public_url!} alt={a.title} className="h-6 w-6 object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
                {more && <div className="flex justify-center py-3 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>}
              </>
            )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
          <span className="text-[10.5px] text-[var(--text-dim)]">{total > 0 ? t("vl.class.showing", "Showing {n} of {m}").replace("{n}", String(items.length)).replace("{m}", String(total)) : t("vl.class.iconsLive", "Icons live in the Visual Library.")}</span>
          <button type="button" onClick={() => onPick(null)} className="text-[11.5px] font-medium text-[var(--text-dim)] hover:text-rose-400">{t("vl.class.clearIcon", "Clear icon")}</button>
        </div>
      </div>
    </div>
  );
}

function PickerChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-[var(--bg-inverted)] bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-color)]"
      }`}>
      {label}{typeof count === "number" ? <span className="ml-1 opacity-60">{count}</span> : null}
    </button>
  );
}
