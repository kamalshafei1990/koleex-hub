"use client";

/* ---------------------------------------------------------------------------
   SemanticRelationships — the relationship layer for one asset, shown inside
   the detail drawer. Lazy-loads on mount, renders a compact related-asset
   grid with per-edge quick actions, a type/approved filter, and the
   Add-Relationship modal. KOLEEX dark / minimal.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RELATIONSHIP_TYPES, RELATIONSHIP_LABEL, type VisualAssetRelationship, type RelationshipType,
} from "@/lib/visual-library/types";
import VisualRelationshipModal from "@/components/database/VisualRelationshipModal";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useTranslation, type Translations } from "@/lib/i18n";
import { VL_LABELS_T } from "@/lib/translations/visual-library-labels";

const T: Translations = {
  ...VL_LABELS_T,
  "vl.sem.heading":          { en: "Semantic relationships", zh: "语义关系", ar: "العلاقات الدلالية" },
  "vl.sem.add":              { en: "Add", zh: "添加", ar: "إضافة" },
  "vl.sem.all-types":        { en: "All types", zh: "全部类型", ar: "جميع الأنواع" },
  "vl.sem.approved-only":    { en: "Approved only", zh: "仅显示已批准", ar: "المعتمد فقط" },
  "vl.sem.no-relationships": { en: "No relationships yet.", zh: "暂无关系。", ar: "لا توجد علاقات بعد." },
  "vl.sem.connect-hint":     { en: "Connect this icon to related meanings, opposites, or collections.", zh: "将此图标关联到相关含义、反义或合集。", ar: "اربط هذه الأيقونة بمعانٍ ذات صلة أو أضداد أو مجموعات." },
  "vl.sem.status.approved":  { en: "approved", zh: "已批准", ar: "معتمد" },
  "vl.sem.status.suggested": { en: "suggested", zh: "建议中", ar: "مقترح" },
  "vl.sem.status.rejected":  { en: "rejected", zh: "已拒绝", ar: "مرفوض" },
  "vl.sem.status.archived":  { en: "archived", zh: "已归档", ar: "مؤرشف" },
  "vl.sem.approve":          { en: "Approve", zh: "批准", ar: "اعتماد" },
  "vl.sem.reverse":          { en: "Reverse", zh: "反转", ar: "عكس" },
  "vl.sem.remove":           { en: "Remove", zh: "移除", ar: "إزالة" },
};

const STATUS_DOT: Record<string, string> = {
  approved: "bg-emerald-400", suggested: "bg-amber-400", rejected: "bg-rose-400", archived: "bg-[var(--text-dim)]",
};

export default function SemanticRelationships({
  asset, onOpenAsset,
}: {
  asset: { id: string; title: string };
  onOpenAsset?: (id: string) => void;
}) {
  const { t } = useTranslation(T);
  const [rels, setRels] = useState<VisualAssetRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visual-library/${asset.id}/relationships`, { credentials: "include", cache: "no-store" });
      const json = res.ok ? await res.json() : { relationships: [] };
      setRels(json.relationships ?? []);
    } catch { setRels([]); } finally { setLoading(false); }
  }, [asset.id]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rels.filter((r) =>
    (!typeFilter || r.relationship_type === typeFilter) && (!approvedOnly || r.status === "approved")
  ), [rels, typeFilter, approvedOnly]);

  const act = async (relId: string, body: Record<string, unknown>, method = "PATCH") => {
    setBusy(relId);
    try {
      await fetch(`/api/visual-library/relationships/${relId}`, {
        method, credentials: "include",
        headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      await load();
    } finally { setBusy(null); }
  };

  const presentTypes = useMemo(() => Array.from(new Set(rels.map((r) => r.relationship_type))), [rels]);

  return (
    <div className="mt-4" {...kxInspectAttrs({ component: "AssetRelationshipsTab", module: "Database", section: "Relationships" })}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          {t("vl.sem.heading", "Semantic relationships")}{rels.length > 0 ? ` · ${rels.length}` : ""}
        </span>
        <button type="button" onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
          <PlusIcon size={12} /> {t("vl.sem.add", "Add")}
        </button>
      </div>

      {rels.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
            <option value="">{t("vl.sem.all-types", "All types")}</option>
            {presentTypes.map((v) => <option key={v} value={v}>{t(`vl.relType.${v}`, RELATIONSHIP_LABEL[v as RelationshipType] ?? v)}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--border-color)] bg-transparent" />
            {t("vl.sem.approved-only", "Approved only")}
          </label>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={16} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-6 text-center">
          <p className="text-[12px] text-[var(--text-muted)]">{t("vl.sem.no-relationships", "No relationships yet.")}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("vl.sem.connect-hint", "Connect this icon to related meanings, opposites, or collections.")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => {
            const ra = r.related_asset;
            return (
              <div key={r.id} className="group flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 transition-colors hover:border-[var(--border-color)]">
                <button type="button" onClick={() => ra && onOpenAsset?.(ra.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white text-neutral-900">
                  {ra?.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ra.public_url} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                  ) : <ImageRawIcon size={13} className="text-neutral-400" />}
                </button>
                <button type="button" onClick={() => ra && onOpenAsset?.(ra.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{ra?.title ?? "—"}</span>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[r.status] ?? STATUS_DOT.approved}`} title={t(`vl.sem.status.${r.status}`, r.status)} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
                    <span className="rounded bg-[var(--bg-surface-hover)] px-1.5 py-0.5 text-[var(--text-muted)]">{t(`vl.relType.${r.relationship_type}`, RELATIONSHIP_LABEL[r.relationship_type] ?? r.relationship_type)}</span>
                    <span className="tabular-nums">{r.confidence_score}%</span>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {r.status !== "approved" && (
                    <IconBtn title={t("vl.sem.approve", "Approve")} busy={busy === r.id} onClick={() => act(r.id, { action: "approve" })}><BadgeCheckIcon size={13} /></IconBtn>
                  )}
                  <IconBtn title={t("vl.sem.reverse", "Reverse")} busy={busy === r.id} onClick={() => act(r.id, { action: "reverse" })}><RefreshCwIcon size={13} /></IconBtn>
                  <IconBtn title={t("vl.sem.remove", "Remove")} busy={busy === r.id} onClick={() => act(r.id, {}, "DELETE")}><TrashIcon size={13} /></IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <VisualRelationshipModal
          source={asset}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, busy }: { children: React.ReactNode; title: string; onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={busy}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50">
      {busy ? <SpinnerIcon size={12} className="animate-spin" /> : children}
    </button>
  );
}
