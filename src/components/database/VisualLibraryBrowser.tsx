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
import { GENERAL_ICON_CATEGORIES } from "@/lib/visual-library/taxonomy";
import VisualAssetCard, { STATE_PILL } from "@/components/database/VisualAssetCard";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import VisualLibraryUploadModal from "@/components/database/VisualLibraryUploadModal";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";

const SELECT = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const STATES: DisplayState[] = ["missing", "draft", "pending", "approved", "deprecated", "archived"];

export default function VisualLibraryBrowser() {
  const params = useSearchParams();
  const [all, setAll] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [state, setState] = useState<string>(params.get("state") ?? "");
  const [assetType, setAssetType] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      // Supabase caps each response at 1000 rows — page through until exhausted
      // so the in-memory set (used for counts + instant search) is complete.
      const acc: VisualAsset[] = [];
      for (let page = 1; page <= 40; page++) {
        const res = await fetch(`/api/visual-library?pageSize=1000&page=${page}&sort=name`, { credentials: "include", cache: "no-store" });
        if (!res.ok) break;
        const json = await res.json();
        const batch: VisualAsset[] = json.assets ?? [];
        acc.push(...batch);
        if (batch.length < 1000) break;
      }
      if (myReq === reqRef.current) setAll(acc);
    } catch {
      if (myReq === reqRef.current) setAll([]);
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // keep the open drawer's data fresh after edits
  useEffect(() => {
    if (!openAsset) return;
    const fresh = all.find((a) => a.id === openAsset.id);
    if (fresh && fresh !== openAsset) setOpenAsset(fresh);
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (term) {
        const hay = [
          a.title, a.visual_asset_code, a.slug, a.source_name, a.description,
          ...(a.keywords ?? []), ...(a.synonyms ?? []), ...(a.search_aliases ?? []), ...(a.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, q, category, assetType, state]);

  // Render in slices so 5,000+ rows never all mount at once.
  useEffect(() => { setLimit(300); }, [q, category, assetType, state, view]);
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
          <SidebarItem label="All categories" count={all.length} active={category === ""} onClick={() => setCategory("")} />
          {GENERAL_ICON_CATEGORIES.map((c) => (
            <SidebarItem key={c.key} label={c.label} count={categoryCounts[c.key] ?? 0} active={category === c.key} onClick={() => setCategory(c.key)} />
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)]">
            <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, keyword, synonym…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-0.5">
              <button type="button" onClick={() => setView("grid")} aria-label="Grid view"
                className={`flex h-7 w-7 items-center justify-center rounded-md ${view === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)]"}`}>
                <LayoutGridIcon size={13} />
              </button>
              <button type="button" onClick={() => setView("list")} aria-label="List view"
                className={`flex h-7 w-7 items-center justify-center rounded-md ${view === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)]"}`}>
                <ListIcon size={13} />
              </button>
            </div>
            <button type="button" onClick={() => setShowUpload(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
              <PlusIcon size={14} /> New entity
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${SELECT} lg:hidden`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {GENERAL_ICON_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select className={SELECT} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {STATES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select className={SELECT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            <option value="">All types</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          {(category || state || assetType || q) && (
            <button type="button" onClick={() => { setCategory(""); setState(""); setAssetType(""); setQ(""); }}
              className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Clear</button>
          )}
          <span className="ml-auto text-[12px] text-[var(--text-dim)] tabular-nums">{loading ? "…" : `${filtered.length} of ${all.length}`}</span>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
            <ImageRawIcon size={32} className="text-[var(--text-dim)]" />
            <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">Nothing matches</p>
            <p className="mt-1 text-[12px] text-[var(--text-dim)]">Try a different category, state, or search term.</p>
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
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_PILL[st] ?? STATE_PILL.draft}`}>{st}</span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > visible.length && (
          <div className="flex justify-center pt-1">
            <button type="button" onClick={() => setLimit((l) => l + 300)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]">
              Show more — {filtered.length - visible.length} of {filtered.length} remaining
            </button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[110] mx-auto flex w-[calc(100%-2rem)] max-w-lg items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 shadow-lg">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)] tabular-nums">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("approve")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {bulkBusy ? <SpinnerIcon size={12} className="animate-spin" /> : <BadgeCheckIcon size={12} />} Approve
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("archive")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              <ArchiveIcon size={12} /> Archive
            </button>
            <button type="button" onClick={clearSelection} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Clear</button>
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
