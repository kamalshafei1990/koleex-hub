"use client";

/* ---------------------------------------------------------------------------
   Search & Social preview — Phase 7 (universal info).
   DERIVED, no new columns: shows how the product will appear in a Google
   result and a shared social card, driven by the fields the operator already
   fills (product_name, brand, slug, excerpt, primary image). The only
   editable lever here is the excerpt, which is the same field as the Short
   description on the Identity tab (shared form state — no duplication).
   --------------------------------------------------------------------------- */

import SearchIcon from "@/components/icons/ui/SearchIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import KoleexLogo from "@/components/layout/KoleexLogo";

const SITE = "koleexgroup.com";
const TITLE_MAX = 60;
const DESC_MAX = 155;

interface Props {
  productName: string;
  brand: string;
  slug: string;
  excerpt: string;
  primaryImageUrl?: string;
  primaryModel?: string;
  categoryName?: string;
  onExcerptChange: (v: string) => void;
  /* Stored SEO overrides — blank falls back to the derived
     title / excerpt / main image. */
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  onMetaTitleChange?: (v: string) => void;
  onMetaDescriptionChange?: (v: string) => void;
  onOgImageUrlChange?: (v: string) => void;
}

/** Trim to a soft limit, appending an ellipsis only when it actually cuts. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export default function SearchSocialSection({
  productName,
  brand,
  slug,
  excerpt,
  primaryImageUrl,
  primaryModel,
  categoryName,
  onExcerptChange,
  metaTitle: metaTitleOverride,
  metaDescription: metaDescriptionOverride,
  ogImageUrl: ogImageOverride,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onOgImageUrlChange,
}: Props) {
  const name = productName.trim() || "Product name";
  const derivedTitle = `${name}${brand ? ` | ${brand}` : ""}`;
  const metaTitle = (metaTitleOverride || "").trim() || derivedTitle;
  const desc = ((metaDescriptionOverride || "").trim() || excerpt.trim());
  /* Branded share card (matches the generated og:image): black background,
     real KOLEEX logo, the product photo, and the name + model. A custom
     Social/OG image URL still wins when the operator explicitly sets one. */
  const customOg = (ogImageOverride || "").trim();
  const modelCode = (primaryModel || "").trim();
  const previewDesc = desc || "Add a short description to control how this product reads in search results and shared links.";
  const path = slug ? `products › ${slug}` : "products › product-slug";
  const editable = !!(onMetaTitleChange || onMetaDescriptionChange || onOgImageUrlChange);

  const titleOver = metaTitle.length > TITLE_MAX;
  const descLen = desc.length;
  const descOver = descLen > DESC_MAX;

  return (
    <div className="space-y-5">
      <p className="text-[11px] leading-relaxed text-[var(--text-ghost)]">
        Auto-generated from the product name, brand, slug and short description.
        Edit those fields on the Identity tab — this is a live preview of how the
        product appears in search and when shared.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Google result preview ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">
            <SearchIcon className="h-3 w-3" /> Search result
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-[var(--text-muted)] truncate">{SITE} › {path}</div>
            <div className="text-[16px] leading-snug text-[var(--accent,#0066FF)] truncate">{clamp(metaTitle, TITLE_MAX)}</div>
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">{clamp(previewDesc, DESC_MAX)}</p>
          </div>
        </div>

        {/* ── Social / share card preview ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">
            <Share2Icon className="h-3 w-3" /> Social card
          </div>
          <div className="rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            <div className="aspect-[1.91/1] overflow-hidden">
              {customOg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={customOg} alt="" className="w-full h-full object-contain bg-[var(--bg-surface)]" />
              ) : (
                /* Product poster — two columns. Left: KOLEEX logo (top) +
                   product name + model number. Right: the product photo.
                   Matches the generated og:image. */
                <div className="w-full h-full bg-black flex items-stretch">
                  <div className="w-[42%] shrink-0 flex flex-col items-start pl-6 pr-3 py-4">
                    {/* logo near the top, small — nudged down a touch */}
                    <KoleexLogo className="h-2 w-auto text-white/90 shrink-0 block mt-1.5" />
                    {/* name + model centred in the remaining space; name font
                        shrinks for longer names so it never crowds */}
                    <div className="flex-1 min-h-0 min-w-0 flex flex-col justify-center">
                      <div className={`${name.length > 42 ? "text-[13px]" : name.length > 24 ? "text-[15px]" : "text-[17px]"} font-bold leading-snug text-white line-clamp-4`}>{name}</div>
                      {modelCode && (
                        <div className="text-[12px] font-mono tracking-wide text-white/55 mt-2 truncate">{modelCode}</div>
                      )}
                    </div>
                    {/* official footer */}
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 shrink-0">koleexgroup.com</div>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-center p-3">
                    {primaryImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={primaryImageUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      /* empty-photo fallback — a faint KOLEEX watermark so the
                         photo side never reads as a broken black void */
                      <KoleexLogo className="h-8 w-auto text-white/[0.08]" />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-3 py-2.5 bg-[var(--bg-surface-subtle)]">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{SITE}</div>
              <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{clamp(metaTitle, TITLE_MAX)}</div>
              <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{clamp(previewDesc, DESC_MAX)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Length signals ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Title length</span>
          <span className={`text-[11px] font-medium ${titleOver ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-secondary)]"}`}>
            {metaTitle.length} / {TITLE_MAX}{titleOver ? " · long" : ""}
          </span>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Description length</span>
          <span className={`text-[11px] font-medium ${descOver ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-secondary)]"}`}>
            {descLen} / {DESC_MAX}{descOver ? " · long" : descLen === 0 ? " · empty" : ""}
          </span>
        </div>
      </div>

      {/* ── Inline excerpt editor (same field as Identity › Short description) ── */}
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">
          Short description <span className="text-[var(--text-ghost)] font-normal">· drives the search & social description</span>
        </label>
        <textarea
          value={excerpt}
          onChange={(e) => onExcerptChange(e.target.value)}
          rows={2}
          placeholder="One or two sentences describing this product…"
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] resize-y"
        />
        <p className="text-[10px] text-[var(--text-ghost)] mt-1">{categoryName ? `Category: ${categoryName}. ` : ""}Synced with the Short description on the Identity tab.</p>
      </div>

      {/* ── SEO overrides (optional, stored) ──
          Blank fields fall back to the derived title / excerpt / main image
          shown in the previews above. */}
      {editable && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-4 space-y-3">
          <p className="text-[11px] font-semibold text-[var(--text-muted)]">SEO overrides <span className="font-normal text-[var(--text-ghost)]">· leave blank to use the auto-derived values above</span></p>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-faint)] mb-1">Meta title</label>
            <input
              type="text"
              value={metaTitleOverride || ""}
              onChange={(e) => onMetaTitleChange?.(e.target.value)}
              placeholder={derivedTitle}
              className="w-full h-10 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-faint)] mb-1">Meta description</label>
            <textarea
              value={metaDescriptionOverride || ""}
              onChange={(e) => onMetaDescriptionChange?.(e.target.value)}
              rows={2}
              placeholder={excerpt.trim() || "Falls back to the short description"}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] resize-y"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-faint)] mb-1">Social / OG image URL</label>
            <input
              type="text"
              value={ogImageOverride || ""}
              onChange={(e) => onOgImageUrlChange?.(e.target.value)}
              placeholder="Falls back to the main product image"
              className="w-full h-10 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
