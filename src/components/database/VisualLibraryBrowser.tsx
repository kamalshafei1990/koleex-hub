"use client";

/* ---------------------------------------------------------------------------
   VisualLibraryBrowser — the Visual Library browser.

   Search + filters (category, type, approval) + responsive card grid +
   bulk select/approve/archive + upload + detail drawer. Reads the URL's
   ?q / ?approval_status so deep links from the dashboard land filtered.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { VisualAsset } from "@/lib/visual-library/types";
import { ASSET_TYPES, ASSET_CATEGORIES } from "@/lib/visual-library/types";
import VisualAssetCard from "@/components/database/VisualAssetCard";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import VisualLibraryUploadModal from "@/components/database/VisualLibraryUploadModal";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";

const SELECT = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

export default function VisualLibraryBrowser() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [category, setCategory] = useState("");
  const [assetType, setAssetType] = useState("");
  const [approval, setApproval] = useState(params.get("approval_status") ?? "");

  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (category) sp.set("category", category);
    if (assetType) sp.set("asset_type", assetType);
    if (approval) sp.set("approval_status", approval);
    sp.set("pageSize", "120");
    try {
      const res = await fetch(`/api/visual-library?${sp.toString()}`, { credentials: "include", cache: "no-store" });
      const json = res.ok ? await res.json() : { assets: [], total: 0 };
      if (myReq === reqRef.current) {
        setAssets(json.assets ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      if (myReq === reqRef.current) { setAssets([]); setTotal(0); }
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, [debouncedQ, category, assetType, approval]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkAction = async (action: "approve" | "archive") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch(`/api/visual-library/${id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }).catch(() => null),
      ),
    );
    setBulkBusy(false);
    clearSelection();
    load();
  };

  const hasFilters = !!(category || assetType || approval);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)] sm:max-w-md">
            <FilterIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, code, tag…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90"
        >
          <PlusIcon size={14} /> Upload asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={SELECT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className={SELECT} value={approval} onChange={(e) => setApproval(e.target.value)}>
          <option value="">All approval</option>
          <option value="approved">Approved</option>
          <option value="draft">Pending (draft)</option>
          <option value="deprecated">Deprecated</option>
          <option value="archived">Archived</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={() => { setCategory(""); setAssetType(""); setApproval(""); }}
            className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Clear</button>
        )}
        <span className="ml-auto text-[12px] text-[var(--text-dim)] tabular-nums">{loading ? "…" : `${total} asset${total === 1 ? "" : "s"}`}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
          <ImageRawIcon size={32} className="text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">No assets yet</p>
          <p className="mt-1 max-w-xs text-[12px] text-[var(--text-dim)]">
            {hasFilters || debouncedQ ? "Nothing matches these filters." : "Upload your first visual asset to start the library."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((a) => (
            <VisualAssetCard
              key={a.id}
              asset={a}
              selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelect(a.id)}
              onOpen={() => setOpenAsset(a)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar */}
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
        <VisualAssetDetailDrawer
          asset={openAsset}
          onClose={() => setOpenAsset(null)}
          onChanged={() => { setOpenAsset(null); load(); }}
        />
      )}
      {showUpload && (
        <VisualLibraryUploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); load(); }} />
      )}
    </div>
  );
}
