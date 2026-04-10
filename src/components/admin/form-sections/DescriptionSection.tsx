"use client";

import { FileText, Sparkles, Target, Layers } from "lucide-react";
import type { ProductFormState } from "@/types/product-form";
import RichTextEditor from "./RichTextEditor";

interface Props {
  data: Pick<ProductFormState, "description">;
  onChange: (u: Partial<ProductFormState>) => void;
}

const PRESET_BLOCKS: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  html: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: <FileText className="h-3.5 w-3.5" />,
    description: "High-level product summary",
    html: `<h2>Overview</h2><p>Brief, compelling description of what this product is and who it's for. Highlight the problem it solves and the core value proposition.</p>`,
  },
  {
    id: "key-features",
    label: "Key Features",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    description: "Bullet list of main features",
    html: `<h3>Key Features</h3><ul><li>Primary feature or capability</li><li>Notable technology or component</li><li>Performance highlight</li><li>Build quality or durability</li><li>Ease of operation / maintenance</li></ul>`,
  },
  {
    id: "applications",
    label: "Applications",
    icon: <Target className="h-3.5 w-3.5" />,
    description: "Use cases and industries",
    html: `<h3>Applications</h3><p>Ideal for the following use cases and industries:</p><ul><li>Industry or use case 1</li><li>Industry or use case 2</li><li>Industry or use case 3</li></ul>`,
  },
  {
    id: "whats-included",
    label: "What's Included",
    icon: <Layers className="h-3.5 w-3.5" />,
    description: "Package contents",
    html: `<h3>What's Included</h3><ul><li>Main unit</li><li>Standard accessories</li><li>Documentation</li></ul>`,
  },
];

export default function DescriptionSection({ data, onChange }: Props) {
  // Strip HTML for plain-text character count
  const plainText = (data.description || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  const insertBlock = (html: string) => {
    const current = (data.description || "").trim();
    const separator = current && !current.endsWith(">") ? "<br/>" : "";
    const next = current ? `${current}${separator}${html}` : html;
    onChange({ description: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-2">Product Description</label>

        {/* Preset content blocks */}
        <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick Start Blocks</span>
            <span className="text-[10px] text-[var(--text-ghost)] italic">— insert pre-built sections</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PRESET_BLOCKS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => insertBlock(b.html)}
                className="group text-left p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-hover)] transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-5 w-5 rounded-md bg-[var(--bg-inverted)] flex items-center justify-center text-[var(--text-inverted)]">
                    {b.icon}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{b.label}</span>
                </div>
                <p className="text-[9px] text-[var(--text-ghost)] leading-tight">{b.description}</p>
              </button>
            ))}
          </div>
        </div>

        <RichTextEditor
          value={data.description}
          onChange={(html) => onChange({ description: html })}
          placeholder="Write a compelling description for this product. Use the quick start blocks above, or start typing. Headings for sections, bullet lists for features, and tables for specs all supported."
          minHeight={320}
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-[var(--text-ghost)]">{plainText.length} characters</p>
          <p className="text-[10px] text-[var(--text-ghost)] italic">Rich text · HTML saved to Supabase</p>
        </div>
      </div>
    </div>
  );
}
