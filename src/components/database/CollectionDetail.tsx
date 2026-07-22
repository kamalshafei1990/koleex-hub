"use client";

/* ---------------------------------------------------------------------------
   CollectionDetail — hero + member asset grid (drag-reorder / remove / open) +
   inline add-assets search + collection intelligence (computed, no AI).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COLLECTION_TYPE_LABEL, type VisualCollection, type CollectionAsset, type CollectionType, type VisualAsset,
} from "@/lib/visual-library/types";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import CollectionModal from "@/components/database/CollectionModal";
import VisualLibraryUploadModal from "@/components/database/VisualLibraryUploadModal";
import UsageGovernance from "@/components/database/UsageGovernance";
import { COLLECTION_STYLES } from "@/lib/visual-library/types";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.colDetail.collections":      { en: "Collections", zh: "合集", ar: "المجموعات" },
  "vl.colDetail.deleteConfirm":    { en: "Delete this collection? Assets stay in the library.", zh: "删除此合集？素材仍保留在库中。", ar: "هل تريد حذف هذه المجموعة؟ ستبقى العناصر في المكتبة." },
  "vl.colDetail.notFound":         { en: "Collection not found.", zh: "未找到该合集。", ar: "لم يتم العثور على المجموعة." },
  "vl.colDetail.backToCollections": { en: "← Back to collections", zh: "← 返回合集", ar: "← العودة إلى المجموعات" },
  "vl.colDetail.edit":             { en: "Edit", zh: "编辑", ar: "تعديل" },
  "vl.colDetail.approve":          { en: "Approve", zh: "批准", ar: "اعتماد" },
  "vl.colDetail.unapprove":        { en: "Unapprove", zh: "取消批准", ar: "إلغاء الاعتماد" },
  "vl.colDetail.archive":          { en: "Archive", zh: "归档", ar: "أرشفة" },
  "vl.colDetail.restore":          { en: "Restore", zh: "恢复", ar: "استعادة" },
  "vl.colDetail.assetsCount":      { en: "{n} assets", zh: "{n} 个素材", ar: "{n} عنصرًا" },
  "vl.colDetail.usesCount":        { en: "{n} uses", zh: "{n} 次使用", ar: "{n} استخدامًا" },
  "vl.colDetail.emptyAssets":      { en: "No assets yet — search above to add some.", zh: "暂无素材 — 在上方搜索并添加。", ar: "لا توجد عناصر بعد — ابحث أعلاه لإضافتها." },
  "vl.colDetail.noIcon":           { en: "no icon", zh: "无图标", ar: "بلا أيقونة" },
  "vl.colDetail.remove":           { en: "Remove", zh: "移除", ar: "إزالة" },
  "vl.colDetail.intelligence":     { en: "Collection intelligence", zh: "合集智能分析", ar: "تحليلات المجموعة" },
  "vl.colDetail.dominantStyle":    { en: "Dominant style", zh: "主导风格", ar: "النمط السائد" },
  "vl.colDetail.categories":       { en: "Categories", zh: "分类", ar: "الفئات" },
  "vl.colDetail.commonMeanings":   { en: "Common meanings", zh: "常见含义", ar: "المعاني الشائعة" },
  "vl.colDetail.duplicateConcepts": { en: "Duplicate concepts", zh: "重复概念", ar: "مفاهيم مكررة" },
  "vl.colDetail.noneDetected":     { en: "None detected", zh: "未检测到", ar: "لم يُرصد أي منها" },
  "vl.colDetail.styleRules":       { en: "Style rules", zh: "风格规则", ar: "قواعد النمط" },
  "vl.colDetail.preferredStyle":   { en: "Preferred style", zh: "首选风格", ar: "النمط المفضل" },
  "vl.colDetail.preferMonochrome": { en: "Prefer monochrome", zh: "偏好单色", ar: "تفضيل أحادي اللون" },
  "vl.colDetail.addSearchPlaceholder": { en: "Search the library to add assets…", zh: "搜索素材库以添加素材…", ar: "ابحث في المكتبة لإضافة عناصر…" },
  "vl.colDetail.upload":           { en: "Upload", zh: "上传", ar: "رفع" },
};

interface Intel {
  total: number; total_usage: number;
  styles: { value: string; count: number }[];
  categories: { value: string; count: number }[];
  meanings: { value: string; count: number }[];
  duplicate_concepts: { value: string; count: number }[];
}

export default function CollectionDetail({ cid }: { cid: string }) {
  const { t } = useTranslation(T);
  const router = useRouter();
  const [col, setCol] = useState<VisualCollection | null>(null);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [items, setItems] = useState<CollectionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/visual-library/collections/${cid}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) { setCol(null); return; }
    const j = await res.json();
    setCol(j.collection); setIntel(j.intelligence);
  }, [cid]);
  const loadAssets = useCallback(async () => {
    const res = await fetch(`/api/visual-library/collections/${cid}/assets?pageSize=200`, { credentials: "include", cache: "no-store" });
    const j = res.ok ? await res.json() : { items: [] };
    setItems(j.items ?? []);
  }, [cid]);
  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadMeta(), loadAssets()]); setLoading(false); })(); }, [loadMeta, loadAssets]);

  const colAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    await fetch(`/api/visual-library/collections/${cid}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false); loadMeta();
  };
  const removeAsset = async (linkId: string) => {
    await fetch(`/api/visual-library/collections/${cid}/assets?link_id=${linkId}`, { method: "DELETE", credentials: "include" });
    loadAssets(); loadMeta();
  };
  const del = async () => {
    if (!confirm(t("vl.colDetail.deleteConfirm", "Delete this collection? Assets stay in the library."))) return;
    await fetch(`/api/visual-library/collections/${cid}`, { method: "DELETE", credentials: "include" });
    router.push("/database/collections");
  };

  // Drag reorder
  const onDrop = async (toIdx: number) => {
    const from = dragIdx.current; dragIdx.current = null;
    if (from === null || from === toIdx) return;
    const next = [...items]; const [moved] = next.splice(from, 1); next.splice(toIdx, 0, moved);
    setItems(next);
    await fetch(`/api/visual-library/collections/${cid}/assets`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  };

  if (loading) return <div className="flex justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;
  if (!col) return (
    <div className="py-16 text-center">
      <p className="text-[14px] text-[var(--text-muted)]">{t("vl.colDetail.notFound", "Collection not found.")}</p>
      <Link href="/database/collections" className="mt-2 inline-block text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("vl.colDetail.backToCollections", "← Back to collections")}</Link>
    </div>
  );

  const isApproved = col.approval_status === "approved";
  const isArchived = col.approval_status === "archived";

  return (
    <div className="space-y-5">
      <Link href="/database/collections" className="inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"><ArrowLeftIcon size={12} /> {t("vl.colDetail.collections", "Collections")}</Link>

      {/* Hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">{col.name}</h1>
              {col.code && <span className="rounded-md bg-[var(--bg-surface-hover)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-dim)]">{col.code}</span>}
            </div>
            {col.description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">{col.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-dim)]">
              <Tag>{COLLECTION_TYPE_LABEL[col.collection_type as CollectionType]}</Tag>
              {col.category && <Tag>{col.category}</Tag>}
              {col.style_type && <Tag>{col.style_type.replace(/_/g, " ")}</Tag>}
              <Tag>{t("vl.colDetail.assetsCount", "{n} assets").replace("{n}", String(items.length))}</Tag>
              {intel && <Tag>{t("vl.colDetail.usesCount", "{n} uses").replace("{n}", String(intel.total_usage))}</Tag>}
              <Tag>{col.approval_status.replace(/_/g, " ")}</Tag>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowEdit(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PencilIcon size={12} /> {t("vl.colDetail.edit", "Edit")}</button>
            {!isApproved
              ? <button type="button" disabled={busy} onClick={() => colAction({ action: "approve" })} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"><BadgeCheckIcon size={12} /> {t("vl.colDetail.approve", "Approve")}</button>
              : <button type="button" disabled={busy} onClick={() => colAction({ action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("vl.colDetail.unapprove", "Unapprove")}</button>}
            {!isArchived
              ? <button type="button" disabled={busy} onClick={() => colAction({ action: "archive" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArchiveIcon size={12} /> {t("vl.colDetail.archive", "Archive")}</button>
              : <button type="button" disabled={busy} onClick={() => colAction({ action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("vl.colDetail.restore", "Restore")}</button>}
            <button type="button" onClick={del} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-dim)] hover:text-rose-400"><TrashIcon size={12} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        {/* Asset grid + add */}
        <div className="space-y-3">
          <AddAssets cid={cid} existing={new Set(items.map((i) => i.asset_id))} onAdded={() => { loadAssets(); loadMeta(); }} />
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-12 text-center text-[12.5px] text-[var(--text-muted)]">{t("vl.colDetail.emptyAssets", "No assets yet — search above to add some.")}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((it, idx) => (
                <div key={it.id} draggable onDragStart={() => { dragIdx.current = idx; }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)}
                  className="group relative flex cursor-grab flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] active:cursor-grabbing">
                  <button type="button" onClick={() => it.asset && setOpenAsset(it.asset as VisualAsset)} className="flex aspect-square items-center justify-center bg-white p-3 text-neutral-900">
                    {it.asset?.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.asset.public_url} alt={it.asset.title} className="h-full w-full object-contain" loading="lazy" />
                    ) : <span className="text-[9px] uppercase text-neutral-400">{t("vl.colDetail.noIcon", "no icon")}</span>}
                  </button>
                  <div className="flex items-center justify-between gap-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
                    <span className="truncate text-[10.5px] text-[var(--text-muted)]">{it.asset?.title ?? "—"}</span>
                    <button type="button" onClick={() => removeAsset(it.id)} title={t("vl.colDetail.remove", "Remove")} className="shrink-0 text-[var(--text-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"><TrashIcon size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intelligence */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("vl.colDetail.intelligence", "Collection intelligence")}</h3>
            <IntelBlock label={t("vl.colDetail.dominantStyle", "Dominant style")} rows={intel?.styles} fmt={(v) => v.replace(/_/g, " ")} />
            <IntelBlock label={t("vl.colDetail.categories", "Categories")} rows={intel?.categories} />
            <IntelBlock label={t("vl.colDetail.commonMeanings", "Common meanings")} rows={intel?.meanings} />
            <IntelBlock label={t("vl.colDetail.duplicateConcepts", "Duplicate concepts")} rows={intel?.duplicate_concepts} empty={t("vl.colDetail.noneDetected", "None detected")} />
          </div>

          {/* Style rules */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("vl.colDetail.styleRules", "Style rules")}</h3>
            <label className="mb-2 block">
              <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">{t("vl.colDetail.preferredStyle", "Preferred style")}</span>
              <select value={col.preferred_style ?? ""} onChange={(e) => colAction({ preferred_style: e.target.value || null })}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
                <option value="">—</option>
                {COLLECTION_STYLES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <input type="checkbox" checked={!!col.preferred_monochrome} onChange={(e) => colAction({ preferred_monochrome: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-[var(--border-color)] bg-transparent" />
              {t("vl.colDetail.preferMonochrome", "Prefer monochrome")}
            </label>
          </div>

          {/* Usage governance (context rules for this collection) */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <UsageGovernance entityType="collection" entityId={col.id} />
          </div>
        </aside>
      </div>

      {openAsset && <VisualAssetDetailDrawer asset={openAsset} onClose={() => setOpenAsset(null)} onChanged={() => { loadAssets(); loadMeta(); }} />}
      {showEdit && <CollectionModal existing={col} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadMeta(); }} />}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 capitalize">{children}</span>;
}

function IntelBlock({ label, rows, fmt, empty }: { label: string; rows?: { value: string; count: number }[]; fmt?: (v: string) => string; empty?: string }) {
  return (
    <div className="border-t border-[var(--border-subtle)] py-2 first:border-t-0 first:pt-0">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      {!rows || rows.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{empty ?? "—"}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.value} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
              <span className="capitalize">{fmt ? fmt(r.value) : r.value}</span>
              <span className="tabular-nums text-[var(--text-dim)]">{r.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AddAssets({ cid, existing, onAdded }: { cid: string; existing: Set<string>; onAdded: () => void }) {
  const { t } = useTranslation(T);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VisualAsset[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    if (!q.trim()) { setResults([]); return; }
    deb.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/visual-library?view=list&q=${encodeURIComponent(q.trim())}&pageSize=24&sort=name`, { credentials: "include", cache: "no-store" });
      const j = res.ok ? await res.json() : { assets: [] };
      setResults((j.assets ?? []).filter((a: VisualAsset) => !existing.has(a.id)));
      setSearching(false);
    }, 250);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [q, existing]);

  const add = async (id: string) => {
    setAdding(id);
    await fetch(`/api/visual-library/collections/${cid}/assets`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset_id: id }),
    });
    setAdding(null); setResults((r) => r.filter((x) => x.id !== id)); onAdded();
  };

  // Add a freshly-uploaded asset straight into this collection.
  const addUploaded = async (id?: string) => {
    setUploadOpen(false);
    if (id) {
      await fetch(`/api/visual-library/collections/${cid}/assets`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset_id: id }),
      });
    }
    onAdded();
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 focus-within:border-[var(--border-focus)]">
          <PlusIcon size={13} className="shrink-0 text-[var(--text-dim)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vl.colDetail.addSearchPlaceholder", "Search the library to add assets…")} className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-dim)]" />
          {searching && <SpinnerIcon size={13} className="animate-spin text-[var(--text-dim)]" />}
        </div>
        <button type="button" onClick={() => setUploadOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
          <PlusIcon size={12} /> {t("vl.colDetail.upload", "Upload")}
        </button>
      </div>
      {uploadOpen && <VisualLibraryUploadModal onClose={() => setUploadOpen(false)} onUploaded={addUploaded} />}
      {results.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {results.map((a) => (
            <button key={a.id} type="button" disabled={adding === a.id} onClick={() => add(a.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 pl-1 pr-2.5 text-[11.5px] text-[var(--text-primary)] hover:border-[var(--border-color)] disabled:opacity-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                {a.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.public_url} alt="" className="h-3.5 w-3.5 object-contain" />
                ) : null}
              </span>
              {a.title}
              {adding === a.id ? <SpinnerIcon size={10} className="animate-spin" /> : <PlusIcon size={10} className="text-[var(--text-dim)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
