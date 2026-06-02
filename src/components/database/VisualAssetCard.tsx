"use client";

/* ---------------------------------------------------------------------------
   VisualAssetCard — one asset tile in the Visual Library grid.
   Square preview (SVG/image on a neutral surface) + code + title + status.
   Selection checkbox overlay for bulk actions.
   --------------------------------------------------------------------------- */

import type { VisualAsset } from "@/lib/visual-library/types";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";

const APPROVAL_PILL: Record<string, string> = {
  approved:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  draft:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  deprecated: "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]",
  archived:   "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]",
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
  const isIcon = asset.asset_type === "icon" || asset.file_type === "svg";
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--bg-surface)] transition-all duration-200 hover:bg-[var(--bg-surface-hover)] ${
        selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] hover:border-[var(--border-color)]"
      }`}
    >
      {/* Selection checkbox */}
      <button
        type="button"
        onClick={onToggleSelect}
        aria-label={selected ? "Deselect" : "Select"}
        className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--border-color)] bg-[var(--bg-primary)]/70 text-transparent opacity-0 group-hover:opacity-100"
        }`}
      >
        <CheckIcon size={11} />
      </button>

      {/* Preview */}
      <button type="button" onClick={onOpen} className="flex aspect-square w-full items-center justify-center bg-[var(--bg-primary)] p-5">
        {asset.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.public_url}
            alt={asset.title}
            className={`h-full w-full ${isIcon ? "object-contain p-2 text-[var(--text-primary)] [filter:none]" : "object-contain"}`}
            loading="lazy"
          />
        ) : (
          <ImageRawIcon size={28} className="text-[var(--text-dim)]" />
        )}
      </button>

      {/* Meta */}
      <button type="button" onClick={onOpen} className="flex flex-col items-start gap-1 border-t border-[var(--border-subtle)] px-3 py-2.5 text-left">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{asset.title}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${APPROVAL_PILL[asset.approval_status] ?? APPROVAL_PILL.draft}`}>
            {asset.approval_status}
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-[var(--text-dim)]">{asset.visual_asset_code}</span>
      </button>
    </div>
  );
}
