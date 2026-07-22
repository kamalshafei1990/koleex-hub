"use client";

/* Add one or many assets to one or many collections. Lists collections with
   search, supports multi-select, and can create a new collection inline. */

import { useEffect, useMemo, useState } from "react";
import { COLLECTION_TYPE_LABEL, type VisualCollection, type CollectionType } from "@/lib/visual-library/types";
import CollectionModal from "@/components/database/CollectionModal";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.addCol.title":             { en: "Add to collection", zh: "添加到合集", ar: "إضافة إلى مجموعة" },
  "vl.addCol.assetCountOne":     { en: "{n} asset", zh: "{n} 个素材", ar: "{n} عنصر" },
  "vl.addCol.assetCount":        { en: "{n} assets", zh: "{n} 个素材", ar: "{n} عناصر" },
  "vl.addCol.close":             { en: "Close", zh: "关闭", ar: "إغلاق" },
  "vl.addCol.searchPlaceholder": { en: "Search collections…", zh: "搜索合集…", ar: "ابحث في المجموعات…" },
  "vl.addCol.createNew":         { en: "Create new collection", zh: "新建合集", ar: "إنشاء مجموعة جديدة" },
  "vl.addCol.selectedCount":     { en: "{n} selected", zh: "已选 {n} 项", ar: "{n} محدد" },
  "vl.addCol.add":               { en: "Add", zh: "添加", ar: "إضافة" },
};

export default function AddToCollectionModal({
  assetIds, onClose, onDone,
}: { assetIds: string[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation(T);
  const [cols, setCols] = useState<VisualCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/visual-library/collections?sort=updated", { credentials: "include", cache: "no-store" });
    const json = res.ok ? await res.json() : { collections: [] };
    setCols(json.collections ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cols.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.code ?? "").toLowerCase().includes(term));
  }, [cols, q]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    if (sel.size === 0) return;
    setSaving(true);
    await Promise.all(Array.from(sel).map((cid) =>
      fetch(`/api/visual-library/collections/${cid}/assets`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: assetIds }),
      }).catch(() => null)));
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("vl.addCol.title", "Add to collection")}</h3>
            <p className="text-[11.5px] text-[var(--text-dim)]">{(assetIds.length === 1 ? t("vl.addCol.assetCountOne", "{n} asset") : t("vl.addCol.assetCount", "{n} assets")).replace("{n}", String(assetIds.length))}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("vl.addCol.close", "Close")} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>

        <div className="border-b border-[var(--border-subtle)] px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 focus-within:border-[var(--border-focus)]">
            <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vl.addCol.searchPlaceholder", "Search collections…")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] text-[var(--text-dim)]"><PlusIcon size={14} /></span>
            {t("vl.addCol.createNew", "Create new collection")}
          </button>
          {loading ? (
            <div className="flex justify-center py-8 text-[var(--text-dim)]"><SpinnerIcon size={16} className="animate-spin" /></div>
          ) : filtered.map((c) => {
            const on = sel.has(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--bg-surface-hover)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white text-neutral-900">
                  {c.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon_url} alt="" className="h-5 w-5 object-contain" />
                  ) : <LayersIcon size={14} className="text-neutral-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{c.name}</span>
                  <span className="block truncate text-[10.5px] text-[var(--text-dim)]">{COLLECTION_TYPE_LABEL[c.collection_type as CollectionType]} · {c.asset_count ?? 0}</span>
                </span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-color)] text-transparent"}`}>
                  <CheckIcon size={11} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <span className="text-[11.5px] text-[var(--text-dim)] tabular-nums">{t("vl.addCol.selectedCount", "{n} selected").replace("{n}", String(sel.size))}</span>
          <button type="button" onClick={save} disabled={saving || sel.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {saving && <SpinnerIcon size={14} className="animate-spin" />}{t("vl.addCol.add", "Add")}
          </button>
        </div>
      </div>

      {showCreate && (
        <CollectionModal onClose={() => setShowCreate(false)} onSaved={async (id) => { setShowCreate(false); await load(); if (id) setSel((p) => new Set(p).add(id)); }} />
      )}
    </div>
  );
}
