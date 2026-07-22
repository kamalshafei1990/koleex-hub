"use client";

/* ---------------------------------------------------------------------------
   VisualAssetCard — one entity tile in the registry grid.
   Square preview (or a "Missing" placeholder) + name + code + state chip.
   Selection checkbox overlay for bulk actions.
   --------------------------------------------------------------------------- */

import type { VisualAsset } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useTranslation, type Translations } from "@/lib/i18n";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";

const T: Translations = {
  "vl.card.deselect":         { en: "Deselect", zh: "取消选择", ar: "إلغاء التحديد" },
  "vl.card.select":           { en: "Select", zh: "选择", ar: "تحديد" },
  "vl.card.no-icon":          { en: "No icon", zh: "无图标", ar: "بدون أيقونة" },
  "vl.state.missing":         { en: "missing", zh: "缺失", ar: "مفقود" },
  "vl.state.draft":           { en: "draft", zh: "草稿", ar: "مسودة" },
  "vl.state.pending":         { en: "pending", zh: "待审核", ar: "قيد الانتظار" },
  "vl.state.approved":        { en: "approved", zh: "已批准", ar: "معتمد" },
  "vl.state.deprecated":      { en: "deprecated", zh: "已弃用", ar: "مهمل" },
  "vl.state.archived":        { en: "archived", zh: "已归档", ar: "مؤرشف" },
};

export const STATE_PILL: Record<string, string> = {
  approved:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  draft:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  missing:    "bg-[var(--bg-surface)] text-[var(--text-dim)] border-dashed border-[var(--border-color)]",
  deprecated: "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]",
  archived:   "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]",
};

/** Compact status dot for small cards. */
export const STATE_DOT: Record<string, string> = {
  approved:   "bg-emerald-400",
  pending:    "bg-amber-400",
  draft:      "bg-blue-400",
  missing:    "bg-[var(--text-dim)] opacity-40 ring-1 ring-[var(--border-color)]",
  deprecated: "bg-[var(--text-dim)]",
  archived:   "bg-[var(--text-dim)]",
};

export default function VisualAssetCard({
  asset,
  selected,
  onToggleSelect,
  onOpen,
}: {
  asset: VisualAsset;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation(T);
  const state = displayState(asset);
  return (
    <div
      {...kxInspectAttrs({ component: "VisualAssetCard", module: "Database", section: "Visual Library", recordId: asset.id })}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-[var(--bg-surface)] transition-all duration-200 hover:bg-[var(--bg-surface-hover)] ${
        selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] hover:border-[var(--border-color)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        aria-label={selected ? t("vl.card.deselect", "Deselect") : t("vl.card.select", "Select")}
        className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--border-color)] bg-[var(--bg-primary)]/70 text-transparent opacity-0 group-hover:opacity-100"
        }`}
      >
        <CheckIcon size={11} />
      </button>

      <button type="button" onClick={onOpen} className="flex aspect-square w-full items-center justify-center bg-white p-3 text-neutral-900">
        {asset.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.public_url} alt={asset.title} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-neutral-400">
            <ImageRawIcon size={20} />
            <span className="text-[8px] font-semibold uppercase tracking-wide">{t("vl.card.no-icon", "No icon")}</span>
          </span>
        )}
      </button>

      <button type="button" onClick={onOpen} className="flex flex-col items-start gap-0.5 border-t border-[var(--border-subtle)] px-2 py-1.5 text-left">
        <div className="flex w-full items-center justify-between gap-1.5">
          <AutoTranslatedText text={asset.title} plain className="truncate text-[11px] font-medium text-[var(--text-primary)]" />
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT[state] ?? STATE_DOT.draft}`} title={t(`vl.state.${state}`, state)} />
        </div>
        <span className="truncate font-mono text-[9px] text-[var(--text-dim)]">{asset.visual_asset_code}</span>
      </button>
    </div>
  );
}
