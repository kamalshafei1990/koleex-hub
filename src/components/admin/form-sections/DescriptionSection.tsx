"use client";

import { useMemo, useState } from "react";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import type { ProductFormState } from "@/types/product-form";
import RichTextEditor from "./RichTextEditor";
import ConfirmDialog from "./ConfirmDialog";
import { getDescriptionTemplates } from "@/lib/description-templates";
import { getKindBySlug } from "@/lib/machine-kinds";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
  /* Subcategory slug from the Classify step. Drives which family
     of Quick Start templates we use ("lockstitch", "overlock",
     "automatic", etc.). Falls back to generic sewing copy if
     unknown. */
  subcategorySlug?: string;
  /* Machine kind slug from Classify → interpolated into the
     Overview paragraph as the product's display name so the draft
     reads as if written for that exact kind. */
  machineKindSlug?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Start Blocks
   ───────────────────────────────────────────────────────────────────────────
   Skeleton metadata — labels, icons, descriptions, and the HTML
   heading used for dedup. The actual body HTML comes from the
   kind-aware template module so a Walking-Foot Lockstitch gets
   lockstitch-specific copy and a 5-Thread Overlock gets overlock
   copy instead of both sharing a generic industrial-sewing draft.
   ═══════════════════════════════════════════════════════════════════════════ */

interface PresetBlockMeta {
  id: "overview" | "key-features" | "applications" | "whats-included";
  label: string;
  icon: React.ReactNode;
  description: string;
  heading: string; // Used for dedup detection in the rich-text HTML
}

const BLOCK_META: PresetBlockMeta[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <DocumentIcon className="h-3.5 w-3.5" />,
    description: "High-level product summary",
    heading: "<h2>Overview</h2>",
  },
  {
    id: "key-features",
    label: "Key Features",
    icon: <SparklesIcon className="h-3.5 w-3.5" />,
    description: "Bullet list of main features",
    heading: "<h3>Key Features</h3>",
  },
  {
    id: "applications",
    label: "Applications",
    icon: <TargetIcon className="h-3.5 w-3.5" />,
    description: "Use cases and industries",
    heading: "<h3>Applications</h3>",
  },
  {
    id: "whats-included",
    label: "What's Included",
    icon: <LayersIcon className="h-3.5 w-3.5" />,
    description: "Package contents",
    heading: "<h3>What's Included</h3>",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Reading metrics — the public-facing counters below the editor.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Extract plain text from the HTML description (strips tags, collapses
 *  entities). Runs client-side only — no DOMParser so it's safe in any
 *  React render path. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/* Sweet-spot word count for product-page SEO. Google tends to treat
   300+ words as "substantial" content; shorter descriptions often get
   down-weighted in favour of competitor pages with more body copy. */
const SEO_MIN_WORDS = 300;
const WORDS_PER_MINUTE = 200;

export default function DescriptionSection({
  data,
  onChange,
  subcategorySlug,
  machineKindSlug,
}: Props) {
  const description = data.description || "";

  /* Resolve the Quick Start Block body HTML for each block based on
     the subcategory + kind chosen in Classify. A Lockstitch kind
     gets lockstitch-specific bullets; a 5-Thread Safety Stitch gets
     overlock-specific bullets; non-sewing subcategories get the
     generic fallback. Recomputed whenever the classification
     changes. */
  const templates = useMemo(() => {
    const kind = machineKindSlug ? getKindBySlug(machineKindSlug) : null;
    return getDescriptionTemplates(subcategorySlug, kind?.name);
  }, [subcategorySlug, machineKindSlug]);

  /* Mapping from block id → HTML body for this product's family. */
  const blockHtmlFor = (id: PresetBlockMeta["id"]): string => {
    switch (id) {
      case "overview": return templates.overview;
      case "key-features": return templates.keyFeatures;
      case "applications": return templates.applications;
      case "whats-included": return templates.whatsIncluded;
    }
  };

  const { plainText, wordCount, charCount, readMinutes } = useMemo(() => {
    const plain = htmlToPlainText(description);
    const words = plain ? plain.split(/\s+/).filter(Boolean) : [];
    return {
      plainText: plain,
      wordCount: words.length,
      charCount: plain.length,
      readMinutes: Math.max(1, Math.ceil(words.length / WORDS_PER_MINUTE)),
    };
  }, [description]);

  /* Dedup state: tracks which preset block triggered the
     "section already exists" confirm. null = no prompt active. */
  const [pendingDupBlock, setPendingDupBlock] = useState<PresetBlockMeta | null>(null);

  /* Low-level insert — appends the HTML to the end of the current
     content, separating with a <br/> if the current doc doesn't
     already end with a closing tag. Used by both the first-time
     insert and the "append anyway" branch of the dedup prompt. */
  const doInsert = (html: string) => {
    const current = description.trim();
    const separator = current && !current.endsWith(">") ? "<br/>" : "";
    const next = current ? `${current}${separator}${html}` : html;
    onChange({ description: next });
  };

  /* Public handler wired to each Quick Start Block card. If the
     block's heading already exists in the description, stash the
     block and show the themed ConfirmDialog; otherwise insert
     immediately. Prevents the footgun where an admin clicks
     "Key Features" twice and ends up with duplicate sections. */
  const handleBlockClick = (block: PresetBlockMeta) => {
    if (description.includes(block.heading)) {
      setPendingDupBlock(block);
      return;
    }
    doInsert(blockHtmlFor(block.id));
  };

  const confirmDuplicate = () => {
    if (pendingDupBlock) doInsert(blockHtmlFor(pendingDupBlock.id));
    setPendingDupBlock(null);
  };

  const belowSeoThreshold = plainText.length > 0 && wordCount < SEO_MIN_WORDS;

  /* Header hint for the Quick Start Blocks panel. Lets admins know
     whether their classification is driving the template choice
     (nice signal that the Classify step matters downstream). */
  const activeKind = machineKindSlug ? getKindBySlug(machineKindSlug) : null;
  const templateLabel = activeKind?.name || "generic industrial sewing machine";

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-2">Product Description</label>

        {/* Preset content blocks */}
        <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick Start Blocks</span>
            <span className="text-[10px] text-[var(--text-ghost)] italic">— tailored for {templateLabel}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {BLOCK_META.map((b) => {
              const alreadyAdded = description.includes(b.heading);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleBlockClick(b)}
                  className={`group text-left p-2.5 rounded-lg border transition-all ${
                    alreadyAdded
                      ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`h-5 w-5 rounded-md flex items-center justify-center ${
                        alreadyAdded
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      }`}
                    >
                      {b.icon}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{b.label}</span>
                    {alreadyAdded && (
                      <span className="ml-auto text-[8px] font-semibold uppercase tracking-wider text-emerald-400">
                        Added
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--text-ghost)] leading-tight">{b.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <RichTextEditor
          value={description}
          onChange={(html) => onChange({ description: html })}
          placeholder="Write a compelling description for this product. Use the Quick Start Blocks above, or start typing. Supports headings, bullet lists, tables, links, and inline images."
          minHeight={320}
        />
        <p className="text-[10px] text-[var(--text-ghost)] mt-1 italic">
          Tip: paste strips formatting by default (clean copy from Word). Use Shift + Paste (⌘⇧V / Ctrl+Shift+V) to preserve bold, bullets, and headings.
        </p>

        {/* ── Metrics row ─────────────────────────────────────────
            Shows char count + word count + read-time. SEO hint is
            appended when the description is short (below the 300-
            word sweet spot Google favours for product pages). */}
        <div className="flex items-center justify-between mt-1.5 gap-4 flex-wrap">
          <p className="text-[11px] text-[var(--text-ghost)]">
            {charCount.toLocaleString()} chars
            <span className="mx-1.5 text-[var(--text-faint)]">·</span>
            <span className={belowSeoThreshold ? "text-amber-400 font-medium" : ""}>{wordCount.toLocaleString()} words</span>
            <span className="mx-1.5 text-[var(--text-faint)]">·</span>
            {readMinutes} min read
          </p>
          <p className="text-[10px] text-[var(--text-ghost)] italic">Rich text · HTML saved to Supabase</p>
        </div>
        {belowSeoThreshold && (
          <p className="text-[10px] text-amber-400/80 mt-1">
            Aim for {SEO_MIN_WORDS}+ words for best search visibility. Longer descriptions
            with real specs, use cases, and benefits rank better in product search.
          </p>
        )}
      </div>

      {/* Dedup confirmation — only shown when the admin clicks a
          Quick Start Block whose heading already exists in the
          description. Lets them choose between adding a duplicate
          section or cancelling out of the click. */}
      <ConfirmDialog
        open={pendingDupBlock !== null}
        onClose={() => setPendingDupBlock(null)}
        onConfirm={confirmDuplicate}
        title={pendingDupBlock ? `${pendingDupBlock.label} is already added` : ""}
        message="This section already appears in the description. Add another copy below anyway?"
        confirmLabel="Add another copy"
        cancelLabel="Cancel"
      />
    </div>
  );
}
