"use client";

/* ---------------------------------------------------------------------------
   VisualLibraryBrowser — the General Icons Registry browser.

   Category sidebar (20 categories) + search + state/type filters + grid/list
   toggle + bulk select/approve/archive + upload + detail drawer. The dataset
   is small (hundreds), so it loads once and filters/searches CLIENT-SIDE for
   instant, snappy interaction (search-first UX).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { VisualAsset, DisplayState } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import { ASSET_TYPES } from "@/lib/visual-library/types";
import { GENERAL_ICON_CATEGORIES, fetchIconCategories, createIconCategory, type FetchedIconCategory } from "@/lib/visual-library/taxonomy";
import VisualAssetCard, { STATE_PILL } from "@/components/database/VisualAssetCard";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import VisualLibraryUploadModal from "@/components/database/VisualLibraryUploadModal";
import AddToCollectionModal from "@/components/database/AddToCollectionModal";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { VL_LABELS_T } from "@/lib/translations/visual-library-labels";

const T: Translations = {
  ...VL_LABELS_T,
  "vl.browse.add-category-failed": { en: "Failed to add category", zh: "添加分类失败", ar: "فشل في إضافة الفئة" },
  "vl.browse.all-categories":      { en: "All categories", zh: "全部分类", ar: "جميع الفئات" },
  "vl.browse.category-name":       { en: "Category name…", zh: "分类名称…", ar: "اسم الفئة…" },
  "vl.browse.add":                 { en: "Add", zh: "添加", ar: "إضافة" },
  "vl.browse.add-category":        { en: "Add category", zh: "添加分类", ar: "إضافة فئة" },
  "vl.browse.search-placeholder":  { en: "Search name, code, keyword, synonym…", zh: "搜索名称、编码、关键词、同义词…", ar: "ابحث بالاسم أو الرمز أو الكلمة المفتاحية أو المرادف…" },
  "vl.browse.grid-view":           { en: "Grid view", zh: "网格视图", ar: "عرض شبكي" },
  "vl.browse.list-view":           { en: "List view", zh: "列表视图", ar: "عرض قائمة" },
  "vl.browse.new-entity":          { en: "New entity", zh: "新建条目", ar: "كيان جديد" },
  "vl.browse.all-states":          { en: "All states", zh: "全部状态", ar: "جميع الحالات" },
  "vl.browse.all-types":           { en: "All types", zh: "全部类型", ar: "جميع الأنواع" },
  "vl.browse.allowed-in-context":  { en: "Allowed in context", zh: "允许的使用场景", ar: "مسموح به في السياق" },
  "vl.browse.any-context":         { en: "Any context", zh: "任意场景", ar: "أي سياق" },
  "vl.browse.clear":               { en: "Clear", zh: "清除", ar: "مسح" },
  "vl.browse.count-of":            { en: "{a} of {b}", zh: "{b} 项中的 {a} 项", ar: "{a} من {b}" },
  "vl.browse.nothing-matches":     { en: "Nothing matches", zh: "没有匹配结果", ar: "لا توجد نتائج مطابقة" },
  "vl.browse.try-different":       { en: "Try a different category, state, or search term.", zh: "请尝试其他分类、状态或搜索词。", ar: "جرّب فئة أو حالة أو كلمة بحث مختلفة." },
  "vl.browse.show-more":           { en: "Show more — {a} of {b} remaining", zh: "显示更多 — 剩余 {a} 项（共 {b} 项）", ar: "عرض المزيد — {a} من {b} متبقية" },
  "vl.browse.n-selected":          { en: "{n} selected", zh: "已选择 {n} 项", ar: "تم تحديد {n}" },
  "vl.browse.approve":             { en: "Approve", zh: "批准", ar: "اعتماد" },
  "vl.browse.collection":          { en: "Collection", zh: "合集", ar: "مجموعة" },
  "vl.browse.archive":             { en: "Archive", zh: "归档", ar: "أرشفة" },
  "vl.state.missing":              { en: "Missing", zh: "缺失", ar: "مفقود" },
  "vl.state.draft":                { en: "Draft", zh: "草稿", ar: "مسودة" },
  "vl.state.pending":              { en: "Pending", zh: "待审核", ar: "قيد الانتظار" },
  "vl.state.approved":             { en: "Approved", zh: "已批准", ar: "معتمد" },
  "vl.state.deprecated":           { en: "Deprecated", zh: "已弃用", ar: "مهمل" },
  "vl.state.archived":             { en: "Archived", zh: "已归档", ar: "مؤرشف" },
};

const SELECT ="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const STATES: DisplayState[] = ["missing", "draft", "pending", "approved", "deprecated", "archived"];

export default function VisualLibraryBrowser() {
  const { t } = useTranslation(T);
  const params = useSearchParams();
  const [all, setAll] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [state, setState] = useState<string>(params.get("state") ?? "");
  const [assetType, setAssetType] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(300);
  const [contexts, setContexts] = useState<{ slug: string; name: string; context_type: string }[]>([]);
  const [contextSlug, setContextSlug] = useState("");
  const [contextIds, setContextIds] = useState<Set<string> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulkCol, setShowBulkCol] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [categories, setCategories] = useState<FetchedIconCategory[]>(
    GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code })),
  );
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  useEffect(() => { fetchIconCategories().then(setCategories).catch(() => {}); }, []);

  const addCategory = async () => {
    const label = newCat.trim();
    if (!label) return;
    setCatBusy(true);
    try {
      await createIconCategory(label);
      setCategories(await fetchIconCategories());
      setNewCat(""); setAddingCat(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("vl.browse.add-category-failed", "Failed to add category"));
    } finally { setCatBusy(false); }
  };

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      /* Supabase caps each response at 1000 rows — the in-memory set (used
         for counts + instant search) needs them all. ?view=list keeps rows to
         the ~24 columns this browser renders/searches (full 68-column rows
         made this warm-up a ~10 MB download), and after page 1 reports the
         total, the remaining pages download in PARALLEL instead of one after
         another. The detail drawer hydrates the full row by id separately. */
      const pageUrl = (page: number) =>
        `/api/visual-library?view=list&pageSize=1000&page=${page}&sort=name`;
      const first = await fetch(pageUrl(1), { credentials: "include", cache: "no-store" });
      if (!first.ok) throw new Error(`HTTP ${first.status}`);
      const j1 = await first.json();
      const acc: VisualAsset[] = [...(j1.assets ?? [])];
      const total: number = j1.total ?? acc.length;
      const pages = Math.min(40, Math.ceil(total / 1000));
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            fetch(pageUrl(i + 2), { credentials: "include", cache: "no-store" })
              .then((r) => (r.ok ? r.json() : { assets: [] }))
              .catch(() => ({ assets: [] })),
          ),
        );
        for (const j of rest) acc.push(...(j.assets ?? []));
      }
      if (myReq === reqRef.current) setAll(acc);
    } catch {
      if (myReq === reqRef.current) setAll([]);
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Load usage contexts for the governance filter.
  useEffect(() => {
    fetch("/api/visual-library/contexts", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { contexts: [] }).then((j) => setContexts(j.contexts ?? [])).catch(() => {});
  }, []);
  // When a context is chosen, fetch the set of assets allowed in it.
  useEffect(() => {
    if (!contextSlug) { setContextIds(null); return; }
    let alive = true;
    fetch(`/api/visual-library?view=list&context=${encodeURIComponent(contextSlug)}&rule=allowed&pageSize=1000&sort=name`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { assets: [] })
      .then((j) => { if (alive) setContextIds(new Set((j.assets ?? []).map((a: VisualAsset) => a.id))); })
      .catch(() => { if (alive) setContextIds(new Set()); });
    return () => { alive = false; };
  }, [contextSlug]);

  /* The list holds slim rows (?view=list) — the drawer needs the full asset.
     Hydrate it by id when it opens, and re-hydrate after edits (`all` is
     replaced by load(), signalling data changed). The drawer opens instantly
     with the slim row and fills in the remaining fields when this lands. */
  const openId = openAsset?.id ?? null;
  useEffect(() => {
    if (!openId) return;
    let alive = true;
    fetch(`/api/visual-library/${openId}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.asset) setOpenAsset(j.asset); })
      .catch(() => {});
    return () => { alive = false; };
  }, [openId, all]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of all) m[a.category ?? "misc"] = (m[a.category ?? "misc"] ?? 0) + 1;
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((a) => {
      if (category && a.category !== category) return false;
      if (assetType && a.asset_type !== assetType) return false;
      if (state && displayState(a) !== state) return false;
      if (contextIds && !contextIds.has(a.id)) return false;
      if (term) {
        const hay = [
          a.title, a.visual_asset_code, a.slug, a.source_name, a.description,
          ...(a.keywords ?? []), ...(a.synonyms ?? []), ...(a.search_aliases ?? []), ...(a.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, q, category, assetType, state, contextIds]);

  // Render in slices so 5,000+ rows never all mount at once.
  useEffect(() => { setLimit(300); }, [q, category, assetType, state, view, contextSlug]);
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const bulkAction = async (action: "approve" | "archive") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    await Promise.all(Array.from(selected).map((id) =>
      fetch(`/api/visual-library/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => null)));
    setBulkBusy(false);
    clearSelection();
    load();
  };

  return (
    <div className="flex gap-5">
      {/* Category sidebar (desktop) */}
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-2 space-y-0.5">
          <SidebarItem label={t("vl.browse.all-categories", "All categories")} count={all.length} active={category === ""} onClick={() => setCategory("")} />
          {categories.map((c) => (
            <SidebarItem key={c.key} label={c.label} count={categoryCounts[c.key] ?? 0} active={category === c.key} onClick={() => setCategory(c.key)} />
          ))}
          {addingCat ? (
            <div className="flex items-center gap-1.5 px-1 pt-1.5">
              <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { setAddingCat(false); setNewCat(""); } }}
                placeholder={t("vl.browse.category-name", "Category name…")}
                className="min-w-0 flex-1 rounded-md border border-[var(--border-focus)] bg-[var(--bg-card)] px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none" />
              <button type="button" disabled={catBusy || !newCat.trim()} onClick={addCategory}
                className="shrink-0 rounded-md bg-[var(--bg-inverted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">
                {catBusy ? "…" : t("vl.browse.add", "Add")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingCat(true)}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]">
              <PlusIcon size={12} /> {t("vl.browse.add-category", "Add category")}
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)]">
            <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vl.browse.search-placeholder", "Search name, code, keyword, synonym…")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-0.5">
              <button type="button" onClick={() => setView("grid")} aria-label={t("vl.browse.grid-view", "Grid view")}
                className={`flex h-7 w-7 items-center justify-center rounded-md ${view === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)]"}`}>
                <LayoutGridIcon size={13} />
              </button>
              <button type="button" onClick={() => setView("list")} aria-label={t("vl.browse.list-view", "List view")}
                className={`flex h-7 w-7 items-center justify-center rounded-md ${view === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)]"}`}>
                <ListIcon size={13} />
              </button>
            </div>
            <button type="button" onClick={() => setShowUpload(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
              <PlusIcon size={14} /> {t("vl.browse.new-entity", "New entity")}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${SELECT} lg:hidden`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("vl.browse.all-categories", "All categories")}</option>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select className={SELECT} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t("vl.browse.all-states", "All states")}</option>
            {STATES.map((s) => <option key={s} value={s}>{t(`vl.state.${s}`, s[0].toUpperCase() + s.slice(1))}</option>)}
          </select>
          <select className={SELECT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            <option value="">{t("vl.browse.all-types", "All types")}</option>
            {ASSET_TYPES.map((v) => <option key={v} value={v}>{t(`vl.type.${v}`, v.replace(/_/g, " "))}</option>)}
          </select>
          {contexts.length > 0 && (
            <select className={SELECT} value={contextSlug} onChange={(e) => setContextSlug(e.target.value)} title={t("vl.browse.allowed-in-context", "Allowed in context")}>
              <option value="">{t("vl.browse.any-context", "Any context")}</option>
              {contexts.map((c) => <option key={c.slug} value={c.slug}>✓ {c.name}</option>)}
            </select>
          )}
          {(category || state || assetType || q || contextSlug) && (
            <button type="button" onClick={() => { setCategory(""); setState(""); setAssetType(""); setQ(""); setContextSlug(""); }}
              className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("vl.browse.clear", "Clear")}</button>
          )}
          <span className="ml-auto text-[12px] text-[var(--text-dim)] tabular-nums">{loading ? "…" : t("vl.browse.count-of", "{a} of {b}").replace("{a}", String(filtered.length)).replace("{b}", String(all.length))}</span>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
            <ImageRawIcon size={32} className="text-[var(--text-dim)]" />
            <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">{t("vl.browse.nothing-matches", "Nothing matches")}</p>
            <p className="mt-1 text-[12px] text-[var(--text-dim)]">{t("vl.browse.try-different", "Try a different category, state, or search term.")}</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9">
            {visible.map((a) => (
              <VisualAssetCard key={a.id} asset={a} selected={selected.has(a.id)} onToggleSelect={() => toggleSelect(a.id)} onOpen={() => setOpenAsset(a)} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {visible.map((a, i) => {
              const st = displayState(a);
              return (
                <button key={a.id} type="button" onClick={() => setOpenAsset(a)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface-hover)] ${i > 0 ? "border-t border-[var(--border-subtle)]" : ""}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white text-neutral-900">
                    {a.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.public_url} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                    ) : <ImageRawIcon size={14} className="text-neutral-400" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{a.title}</span>
                    <span className="block truncate font-mono text-[10.5px] text-[var(--text-dim)]">{a.visual_asset_code}</span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-[var(--text-dim)] sm:block">{a.category}</span>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_PILL[st] ?? STATE_PILL.draft}`}>{t(`vl.state.${st}`, st)}</span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > visible.length && (
          <div className="flex justify-center pt-1">
            <button type="button" onClick={() => setLimit((l) => l + 300)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]">
              {t("vl.browse.show-more", "Show more — {a} of {b} remaining").replace("{a}", String(filtered.length - visible.length)).replace("{b}", String(filtered.length))}
            </button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[110] mx-auto flex w-[calc(100%-2rem)] max-w-lg items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 shadow-lg">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)] tabular-nums">{t("vl.browse.n-selected", "{n} selected").replace("{n}", String(selected.size))}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("approve")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {bulkBusy ? <SpinnerIcon size={12} className="animate-spin" /> : <BadgeCheckIcon size={12} />} {t("vl.browse.approve", "Approve")}
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => setShowBulkCol(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              <LayersIcon size={12} /> {t("vl.browse.collection", "Collection")}
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("archive")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              <ArchiveIcon size={12} /> {t("vl.browse.archive", "Archive")}
            </button>
            <button type="button" onClick={clearSelection} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("vl.browse.clear", "Clear")}</button>
          </div>
        </div>
      )}

      {openAsset && (
        <VisualAssetDetailDrawer asset={openAsset} onClose={() => setOpenAsset(null)} onChanged={load}
          onOpenAsset={(rid) => { const a = all.find((x) => x.id === rid); if (a) setOpenAsset(a); }} />
      )}
      {showUpload && (
        <VisualLibraryUploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); load(); }} />
      )}
      {showBulkCol && (
        <AddToCollectionModal assetIds={Array.from(selected)} onClose={() => setShowBulkCol(false)} onDone={() => { setShowBulkCol(false); clearSelection(); }} />
      )}
    </div>
  );
}

function SidebarItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
        active ? "bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
      }`}>
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{count}</span>
    </button>
  );
}
