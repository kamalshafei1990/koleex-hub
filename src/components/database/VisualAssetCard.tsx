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

export const STATE_PILL: Record<string, string> = {
  approved:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  draft:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  missing:    "bg-[var(--bg-surface)] text-[var(--text-dim)] border-dashed border-[var(--border-color)]",
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
  const state = displayState(asset);
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--bg-surface)] transition-all duration-200 hover:bg-[var(--bg-surface-hover)] ${
        selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] hover:border-[var(--border-color)]"
      }`}
    >
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

      <button type="button" onClick={onOpen} className="flex aspect-square w-full items-center justify-center bg-[var(--bg-primary)] p-5">
        {asset.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.public_url} alt={asset.title} className="h-full w-full object-contain p-2 text-[var(--text-primary)]" loading="lazy" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-[var(--text-dim)]">
            <ImageRawIcon size={26} />
            <span className="text-[9px] font-semibold uppercase tracking-wide">No icon</span>
          </span>
        )}
      </button>

      <button type="button" onClick={onOpen} className="flex flex-col items-start gap-1 border-t border-[var(--border-subtle)] px-3 py-2.5 text-left">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{asset.title}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_PILL[state] ?? STATE_PILL.draft}`}>
            {state}
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-[var(--text-dim)]">{asset.visual_asset_code}</span>
      </button>
    </div>
  );
}
