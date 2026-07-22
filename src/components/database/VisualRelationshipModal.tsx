"use client";

/* ---------------------------------------------------------------------------
   VisualRelationshipModal — connect an asset to one or more targets.
   Live-search the library, multi-select targets, pick a relationship type,
   set a confidence score, add a note. Bidirectional types auto-link the reverse.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import {
  RELATIONSHIP_TYPES, RELATIONSHIP_LABEL, REVERSE_TYPE, type RelationshipType,
} from "@/lib/visual-library/types";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { VL_LABELS_T } from "@/lib/translations/visual-library-labels";

const T: Translations = {
  ...VL_LABELS_T,
  "vl.rel.title":              { en: "Add relationship", zh: "添加关系", ar: "إضافة علاقة" },
  "vl.rel.from":               { en: "from", zh: "来自", ar: "من" },
  "vl.rel.close":              { en: "Close", zh: "关闭", ar: "إغلاق" },
  "vl.rel.relationship":       { en: "Relationship", zh: "关系", ar: "العلاقة" },
  "vl.rel.bidirectional-note": { en: "Bidirectional — auto-links the reverse ({x}).", zh: "双向 — 自动创建反向关联（{x}）。", ar: "ثنائي الاتجاه — يربط العكس تلقائيًا ({x})." },
  "vl.rel.one-way":            { en: "One-way relationship.", zh: "单向关系。", ar: "علاقة أحادية الاتجاه." },
  "vl.rel.confidence":         { en: "Confidence", zh: "置信度", ar: "درجة الثقة" },
  "vl.rel.target-assets":      { en: "Target asset(s)", zh: "目标资产", ar: "الأصل (الأصول) المستهدفة" },
  "vl.rel.search-placeholder": { en: "Search the library to link…", zh: "搜索库以建立关联…", ar: "ابحث في المكتبة للربط…" },
  "vl.rel.notes":              { en: "Notes", zh: "备注", ar: "ملاحظات" },
  "vl.rel.optional":           { en: "(optional)", zh: "（可选）", ar: "(اختياري)" },
  "vl.rel.notes-placeholder":  { en: "e.g. Preferred in Apple-style navigation contexts.", zh: "例如：在苹果风格导航场景中优先使用。", ar: "مثال: يُفضَّل في سياقات التنقل بأسلوب Apple." },
  "vl.rel.pick-target":        { en: "Pick at least one target asset.", zh: "请至少选择一个目标资产。", ar: "اختر أصلًا مستهدفًا واحدًا على الأقل." },
  "vl.rel.save-failed":        { en: "Save failed", zh: "保存失败", ar: "فشل الحفظ" },
  "vl.rel.failed":             { en: "Failed", zh: "操作失败", ar: "فشلت العملية" },
  "vl.rel.n-selected":         { en: "{n} selected", zh: "已选择 {n} 项", ar: "تم تحديد {n}" },
  "vl.rel.cancel":             { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "vl.rel.linking":            { en: "Linking…", zh: "关联中…", ar: "جارٍ الربط…" },
  "vl.rel.link":               { en: "Link", zh: "关联", ar: "ربط" },
};

interface Target { id: string; title: string; visual_asset_code: string; public_url: string | null; category: string | null }

export default function VisualRelationshipModal({
  source, onClose, onSaved,
}: {
  source: { id: string; title: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(T);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Target[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Target[]>([]);
  const [relType, setRelType] = useState<RelationshipType>("similar_to");
  const [confidence, setConfidence] = useState(80);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (!q.trim()) { setResults([]); return; }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/visual-library?view=list&q=${encodeURIComponent(q.trim())}&pageSize=24&sort=name`, { credentials: "include", cache: "no-store" });
        const json = res.ok ? await res.json() : { assets: [] };
        const pickedIds = new Set(picked.map((p) => p.id));
        setResults((json.assets ?? [])
          .filter((a: Target) => a.id !== source.id && !pickedIds.has(a.id))
          .map((a: { id: string; title: string; visual_asset_code: string; public_url: string | null; category: string | null }) => ({
            id: a.id, title: a.title, visual_asset_code: a.visual_asset_code, public_url: a.public_url, category: a.category,
          })));
      } catch { setResults([]); } finally { setSearching(false); }
    }, 250);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q, picked, source.id]);

  const addPick = (t: Target) => { setPicked((p) => [...p, t]); setResults((r) => r.filter((x) => x.id !== t.id)); };
  const removePick = (id: string) => setPicked((p) => p.filter((x) => x.id !== id));

  const save = async () => {
    if (!picked.length) { setError(t("vl.rel.pick-target", "Pick at least one target asset.")); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/visual-library/${source.id}/relationships`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_asset_ids: picked.map((p) => p.id),
          relationship_type: relType, confidence_score: confidence, notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError((j as { error?: string }).error ?? t("vl.rel.save-failed", "Save failed")); setSaving(false); return; }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : t("vl.rel.failed", "Failed")); setSaving(false); }
  };

  const reverseNote = REVERSE_TYPE[relType];

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("vl.rel.title", "Add relationship")}</h3>
            <p className="truncate text-[11.5px] text-[var(--text-dim)]">{t("vl.rel.from", "from")} <span className="text-[var(--text-muted)]">{source.title}</span></p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("vl.rel.close", "Close")} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Relationship type */}
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.rel.relationship", "Relationship")}</span>
            <select value={relType} onChange={(e) => setRelType(e.target.value as RelationshipType)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
              {RELATIONSHIP_TYPES.map((v) => <option key={v} value={v}>{t(`vl.relType.${v}`, RELATIONSHIP_LABEL[v])}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[var(--text-dim)]">
              {reverseNote ? t("vl.rel.bidirectional-note", "Bidirectional — auto-links the reverse ({x}).").replace("{x}", t(`vl.relType.${reverseNote}`, RELATIONSHIP_LABEL[reverseNote])) : t("vl.rel.one-way", "One-way relationship.")}
            </p>
          </div>

          {/* Confidence */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.rel.confidence", "Confidence")}</span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{confidence}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-[var(--accent)]" />
          </div>

          {/* Target search */}
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.rel.target-assets", "Target asset(s)")}</span>
            {picked.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-0.5 pl-1 pr-2 text-[11.5px] text-[var(--text-primary)]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      {p.public_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.public_url} alt="" className="h-3 w-3 object-contain" />
                      ) : null}
                    </span>
                    {p.title}
                    <button type="button" onClick={() => removePick(p.id)} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 focus-within:border-[var(--border-focus)]">
              <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("vl.rel.search-placeholder", "Search the library to link…")}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
              {searching && <SpinnerIcon size={13} className="animate-spin text-[var(--text-dim)]" />}
            </div>

            {results.length > 0 && (
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] p-1">
                {results.map((t) => (
                  <button key={t.id} type="button" onClick={() => addPick(t)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[var(--bg-surface-hover)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white text-neutral-900">
                      {t.public_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.public_url} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                      ) : <ImageRawIcon size={12} className="text-neutral-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-[var(--text-primary)]">{t.title}</span>
                      <span className="block truncate text-[10px] text-[var(--text-dim)]">{t.category}</span>
                    </span>
                    <CheckIcon size={13} className="shrink-0 text-[var(--text-dim)]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.rel.notes", "Notes")} <span className="font-normal normal-case">{t("vl.rel.optional", "(optional)")}</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder={t("vl.rel.notes-placeholder", "e.g. Preferred in Apple-style navigation contexts.")}
              className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
          </div>

          {error && <p className="text-[12px] text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <span className="text-[11.5px] text-[var(--text-dim)] tabular-nums">{t("vl.rel.n-selected", "{n} selected").replace("{n}", String(picked.length))}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("vl.rel.cancel", "Cancel")}</button>
            <button type="button" onClick={save} disabled={saving || !picked.length}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {saving && <SpinnerIcon size={14} className="animate-spin" />}{saving ? t("vl.rel.linking", "Linking…") : t("vl.rel.link", "Link")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
