"use client";

import { useMemo, useState } from "react";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import type { ProductFormState } from "@/types/product-form";
import RichTextEditor from "./RichTextEditor";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Start Blocks
   ───────────────────────────────────────────────────────────────────────────
   Pre-built HTML skeletons admins drop into the rich text area and
   customise. The defaults below are written for industrial sewing
   machinery — Koleex's primary catalogue — so most lines are
   plausible first drafts that admins only tweak rather than write
   from scratch. Still editable after insertion; admins can delete
   anything that doesn't apply to a specific machine.

   `heading` is the opening tag the dedup check looks for so we can
   stop an admin accidentally pasting the same section twice.
   ═══════════════════════════════════════════════════════════════════════════ */

interface PresetBlock {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  heading: string; // Used for dedup detection in the rich-text HTML
  html: string;
}

const PRESET_BLOCKS: PresetBlock[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <DocumentIcon className="h-3.5 w-3.5" />,
    description: "High-level product summary",
    heading: "<h2>Overview</h2>",
    html:
      `<h2>Overview</h2>` +
      `<p>This industrial sewing machine is engineered for professional garment production, ` +
      `combining high-speed performance with operator-friendly controls. ` +
      `Built for continuous factory use, it delivers consistent stitch quality on light, ` +
      `medium, and heavy fabrics while keeping downtime and maintenance low.</p>`,
  },
  {
    id: "key-features",
    label: "Key Features",
    icon: <SparklesIcon className="h-3.5 w-3.5" />,
    description: "Bullet list of main features",
    heading: "<h3>Key Features</h3>",
    html:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>High-speed direct-drive servo motor (up to 5,000 SPM)</li>` +
      `<li>Automatic thread trimmer for clean seam endings</li>` +
      `<li>Needle-position detection (stop-up / stop-down)</li>` +
      `<li>Auto backtack and auto presser-foot lift</li>` +
      `<li>Energy-saving design with low-noise operation</li>` +
      `<li>LED workspace lighting for improved operator accuracy</li>` +
      `</ul>`,
  },
  {
    id: "applications",
    label: "Applications",
    icon: <TargetIcon className="h-3.5 w-3.5" />,
    description: "Use cases and industries",
    heading: "<h3>Applications</h3>",
    html:
      `<h3>Applications</h3>` +
      `<p>Suitable for a wide range of garment and textile production:</p>` +
      `<ul>` +
      `<li>Ready-to-wear garment manufacturing</li>` +
      `<li>Denim, workwear, and uniforms</li>` +
      `<li>Home textiles and upholstery</li>` +
      `<li>Technical textiles and automotive interiors</li>` +
      `<li>Leather goods and footwear assembly</li>` +
      `</ul>`,
  },
  {
    id: "whats-included",
    label: "What's Included",
    icon: <LayersIcon className="h-3.5 w-3.5" />,
    description: "Package contents",
    heading: "<h3>What's Included</h3>",
    html:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Machine head with direct-drive servo motor</li>` +
      `<li>Industrial table with built-in LED worklight</li>` +
      `<li>Motor control box with foot pedal</li>` +
      `<li>Standard needle plate, feed dog, and presser foot</li>` +
      `<li>Basic accessories kit (bobbins, oil, needles, screwdriver)</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
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

export default function DescriptionSection({ data, onChange }: Props) {
  const description = data.description || "";

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
  const [pendingDupBlock, setPendingDupBlock] = useState<PresetBlock | null>(null);

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
  const handleBlockClick = (block: PresetBlock) => {
    if (description.includes(block.heading)) {
      setPendingDupBlock(block);
      return;
    }
    doInsert(block.html);
  };

  const confirmDuplicate = () => {
    if (pendingDupBlock) doInsert(pendingDupBlock.html);
    setPendingDupBlock(null);
  };

  const belowSeoThreshold = plainText.length > 0 && wordCount < SEO_MIN_WORDS;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-2">Product Description</label>

        {/* Preset content blocks */}
        <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick Start Blocks</span>
            <span className="text-[10px] text-[var(--text-ghost)] italic">— insert pre-built sections</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PRESET_BLOCKS.map((b) => {
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
          placeholder="Write a compelling description for this product. Use the Quick Start Blocks above, or start typing. Headings for sections, bullet lists for features, and tables for specs are all supported."
          minHeight={320}
        />

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
