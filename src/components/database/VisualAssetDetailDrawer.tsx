"use client";

/* ---------------------------------------------------------------------------
   VisualAssetDetailDrawer — right-side slide-over with the asset preview,
   metadata, and approval/archive actions.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { VisualAsset } from "@/lib/visual-library/types";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

async function action(id: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/visual-library/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <span className="text-right text-[12.5px] text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export default function VisualAssetDetailDrawer({
  asset,
  onClose,
  onChanged,
}: {
  asset: VisualAsset;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    const ok = await action(asset.id, body);
    setBusy(null);
    if (ok) onChanged();
  };

  const isApproved = asset.approval_status === "approved";
  const isArchived = asset.status === "archived";

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{asset.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <CrossIcon size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Preview */}
          <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-[var(--text-primary)]">
            {asset.public_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.public_url} alt={asset.title} className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageRawIcon size={36} className="text-[var(--text-dim)]" />
            )}
          </div>

          <div className="mt-4 divide-y divide-[var(--border-subtle)]">
            <Row label="Code" value={<span className="font-mono text-[11.5px]">{asset.visual_asset_code}</span>} />
            <Row label="Type" value={asset.asset_type.replace(/_/g, " ")} />
            <Row label="Category" value={[asset.category, asset.subcategory].filter(Boolean).join(" · ") || "—"} />
            <Row label="Style" value={asset.style ?? "—"} />
            <Row label="Approval" value={asset.approval_status} />
            <Row label="Status" value={asset.status} />
            <Row label="Source" value={asset.source ?? "—"} />
            {asset.tags.length > 0 && (
              <div className="py-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Tags</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {asset.tags.map((t) => (
                    <span key={t} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] text-[var(--text-muted)]">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          {!isApproved ? (
            <button type="button" disabled={!!busy} onClick={() => run("approve", { action: "approve" })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {busy === "approve" ? <SpinnerIcon size={13} className="animate-spin" /> : <BadgeCheckIcon size={13} />} Approve
            </button>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => run("unapprove", { action: "unapprove" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {busy === "unapprove" ? <SpinnerIcon size={13} className="animate-spin" /> : null} Un-approve
            </button>
          )}
          {!isArchived ? (
            <button type="button" disabled={!!busy} onClick={() => run("archive", { action: "archive" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {busy === "archive" ? <SpinnerIcon size={13} className="animate-spin" /> : <ArchiveIcon size={13} />} Archive
            </button>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => run("restore", { action: "restore" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              Restore
            </button>
          )}
          {asset.public_url && (
            <a href={asset.public_url} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">Open file ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}
