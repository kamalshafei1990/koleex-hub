"use client";

/* ---------------------------------------------------------------------------
   LivePreviewPanel — sticky right rail that mirrors what the user is building.

   Renders a mini product card (image, name, pricing, specs, tags) and updates
   live as the form state changes. Designed for xl+ screens (shown to the right
   of the wizard content). On smaller screens the parent can hide it.
   --------------------------------------------------------------------------- */

import { Eye, Camera, Tag, DollarSign, Factory, Star, Package, Gauge, Scissors } from "lucide-react";
import type { ProductFormState, ModelFormState, MediaFormState } from "@/types/product-form";

interface Props {
  product: ProductFormState;
  primaryModel: ModelFormState | undefined;
  mainImageSrc: string | null;
  mediaCount: number;
  modelCount: number;
  sewingTemplateName?: string | null;
  sewingCommonSpecs?: Record<string, unknown>;
  divisionName?: string;
  categoryName?: string;
  subcategoryName?: string;
}

function SpecRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-1.5">
      <span className="flex items-center gap-1.5 text-[var(--text-ghost)] shrink-0">
        {icon}
        {label}
      </span>
      <span className="font-medium text-[var(--text-muted)] truncate text-right">{value}</span>
    </div>
  );
}

export default function LivePreviewPanel({
  product,
  primaryModel,
  mainImageSrc,
  mediaCount,
  modelCount,
  sewingTemplateName,
  sewingCommonSpecs,
  divisionName,
  categoryName,
  subcategoryName,
}: Props) {
  const costPrice = primaryModel?.cost_price ? parseFloat(primaryModel.cost_price) : null;
  const globalPrice = primaryModel?.global_price ? parseFloat(primaryModel.global_price) : null;
  const margin =
    costPrice !== null && globalPrice !== null && costPrice > 0
      ? Math.round(((globalPrice - costPrice) / globalPrice) * 100)
      : null;

  const speed = sewingCommonSpecs?.max_sewing_speed;
  const needle = sewingCommonSpecs?.needle_system;
  const suitableFabric = sewingCommonSpecs?.suitable_fabric;

  const hasAnyContent =
    product.product_name || primaryModel?.model_name || mainImageSrc;

  return (
    <aside className="w-[320px] shrink-0 hidden xl:block">
      <div className="sticky top-[132px] space-y-3">
        {/* Header chip */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
          <div className="h-6 w-6 rounded-lg bg-[var(--bg-inverted)] flex items-center justify-center">
            <Eye className="h-3 w-3 text-[var(--text-inverted)]" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Live Preview</span>
          <span className="ml-auto text-[9px] text-[var(--text-ghost)]">updates as you type</span>
        </div>

        {/* Main preview card */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          {/* Image */}
          <div className="relative aspect-square bg-gradient-to-br from-[var(--bg-surface-subtle)] to-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
            {mainImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImageSrc} alt={product.product_name || "Product preview"} className="w-full h-full object-contain p-6" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <Camera className="h-5 w-5 text-[var(--text-ghost)]" />
                </div>
                <p className="text-[11px] text-[var(--text-ghost)] font-medium">No image yet</p>
              </div>
            )}
            {product.featured && (
              <div className="absolute top-2 left-2 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold uppercase text-amber-400">
                <Star className="h-2.5 w-2.5" /> Featured
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Classification breadcrumb */}
            {(divisionName || categoryName || subcategoryName) && (
              <div className="flex items-center gap-1 text-[9px] font-medium text-[var(--text-ghost)] uppercase tracking-wider flex-wrap">
                {divisionName && <span>{divisionName}</span>}
                {categoryName && <><span>›</span><span>{categoryName}</span></>}
                {subcategoryName && <><span>›</span><span className="text-emerald-400">{subcategoryName}</span></>}
              </div>
            )}

            {/* Name + model */}
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">
                {product.product_name || <span className="text-[var(--text-ghost)] italic font-normal">Untitled product</span>}
              </h3>
              {primaryModel?.model_name && (
                <p className="text-[11px] font-mono text-[var(--text-dim)] mt-0.5">{primaryModel.model_name}</p>
              )}
              {primaryModel?.tagline && (
                <p className="text-[11px] text-[var(--text-ghost)] italic mt-1 line-clamp-2">{primaryModel.tagline}</p>
              )}
            </div>

            {/* Brand + family pills */}
            {(product.brand || product.family) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {product.brand && (
                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-muted)]">
                    <Star className="h-2.5 w-2.5" /> {product.brand}
                  </span>
                )}
                {product.family && (
                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-muted)]">
                    <Package className="h-2.5 w-2.5" /> {product.family}
                  </span>
                )}
              </div>
            )}

            {/* Pricing block */}
            {(costPrice !== null || globalPrice !== null) && (
              <div className="rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] p-3 space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-[var(--text-ghost)]">
                  <DollarSign className="h-2.5 w-2.5" /> Commercial
                </div>
                {globalPrice !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-dim)]">Global price</span>
                    <span className="text-[16px] font-bold text-emerald-400">${globalPrice.toFixed(2)}</span>
                  </div>
                )}
                {costPrice !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-dim)]">Cost</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">${costPrice.toFixed(2)}</span>
                  </div>
                )}
                {margin !== null && (
                  <div className="flex items-center justify-between pt-1 mt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-dim)]">Margin</span>
                    <span className={`text-[11px] font-bold ${margin >= 40 ? "text-emerald-400" : margin >= 20 ? "text-amber-400" : "text-red-400"}`}>
                      {margin}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Supplier */}
            {primaryModel?.supplier && (
              <SpecRow icon={<Factory className="h-2.5 w-2.5" />} label="Supplier" value={primaryModel.supplier} />
            )}
            {primaryModel?.reference_model && (
              <SpecRow label="Ref model" value={<span className="font-mono">{primaryModel.reference_model}</span>} />
            )}

            {/* Sewing template + key specs */}
            {sewingTemplateName && (
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-3 space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-blue-400">
                  <Scissors className="h-2.5 w-2.5" /> {sewingTemplateName}
                </div>
                {speed ? (
                  <SpecRow icon={<Gauge className="h-2.5 w-2.5" />} label="Speed" value={`${speed} spm`} />
                ) : null}
                {needle ? (
                  <SpecRow label="Needle" value={String(needle)} />
                ) : null}
                {suitableFabric ? (
                  <SpecRow label="Fabric" value={String(suitableFabric).replace(/-/g, " ")} />
                ) : null}
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.slice(0, 6).map(t => (
                  <span key={t} className="inline-flex items-center h-4 px-1.5 rounded bg-[var(--bg-surface)] text-[9px] text-[var(--text-dim)]">#{t}</span>
                ))}
                {product.tags.length > 6 && (
                  <span className="inline-flex items-center h-4 px-1.5 rounded text-[9px] text-[var(--text-ghost)]">+{product.tags.length - 6}</span>
                )}
              </div>
            )}

            {/* Footer meta strip */}
            <div className="flex items-center justify-between text-[9px] text-[var(--text-ghost)] pt-2 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-1">
                <Package className="h-2.5 w-2.5" /> {modelCount} model{modelCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Camera className="h-2.5 w-2.5" /> {mediaCount} file{mediaCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-2.5 w-2.5" /> {product.tags?.length || 0} tag{product.tags?.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {!hasAnyContent && (
          <p className="text-[10px] text-[var(--text-ghost)] italic text-center px-2">Start filling in the form and the preview will populate live.</p>
        )}
      </div>
    </aside>
  );
}
