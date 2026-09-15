"use client";

/* ---------------------------------------------------------------------------
   ListEditors — the small list controls the product editor and the product
   profile share: the Key Highlights list (max 5) and the tags / keywords chip
   input. Moved out of ProductForm so the profile can edit in place without
   pulling the whole editor into its bundle.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";

/* ═══════════════════════════════════════════════════════════════════
   HIGHLIGHTS EDITOR — 3-5 short bullet strings

   Renders each highlight as a row with a leading check icon and an
   inline remove button, plus a single add-row input at the bottom.
   Enforces a soft cap of 5 so the public hero doesn't turn into a
   wall of bullets.
   ═══════════════════════════════════════════════════════════════════ */
export function HighlightsEditor({
  highlights,
  onChange,
  t,
}: {
  highlights: string[];
  onChange: (next: string[]) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [input, setInput] = useState("");
  const atCap = highlights.length >= 5;

  const add = () => {
    const v = input.trim();
    if (!v || atCap) return;
    onChange([...highlights, v]);
    setInput("");
  };

  const remove = (i: number) => {
    onChange(highlights.filter((_, idx) => idx !== i));
  };

  const update = (i: number, next: string) => {
    onChange(highlights.map((h, idx) => (idx === i ? next : h)));
  };

  return (
    <div className="space-y-2">
      {highlights.length === 0 && (
        <p className="text-[11px] text-[var(--text-ghost)] italic px-1">
          {t("hero.highlightsEmptyHint", "Add 3–5 short bullets that describe what makes this product stand out.")}
        </p>
      )}
      {highlights.map((h, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 h-11 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)]"
        >
          <CheckIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={h}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            aria-label={t("hero.removeHighlight", `Remove highlight ${i + 1}`).replace("{n}", String(i + 1))}
          >
            <CrossIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
      {!atCap && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={highlights.length === 0 ? t("hero.highlightPlaceholderFirst", "e.g. Max 5000 SPM") : t("hero.highlightPlaceholderMore", "Add another highlight...")}
            maxLength={80}
            className="flex-1 h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-all"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="h-11 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {t("hero.add", "Add")}
          </button>
        </div>
      )}
      {atCap && (
        <p className="text-[10px] text-[var(--text-ghost)] italic px-1">
          {t("hero.highlightCap", "You've reached the 5-bullet cap. Remove one to add another.")}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAGS INPUT — with suggestions dropdown
   ═══════════════════════════════════════════════════════════════════ */
export function TagsInput({ tags, onChange, suggestions = [], t }: { tags: string[]; onChange: (t: string[]) => void; suggestions?: string[]; t: (key: string, fallback?: string) => string }) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const available = suggestions.filter(s => !tags.includes(s));
  const filtered = input.trim()
    ? available.filter(s => s.toLowerCase().includes(input.toLowerCase()))
    : available;
  const canCreate = input.trim() && !suggestions.includes(input.trim().toLowerCase()) && !tags.includes(input.trim().toLowerCase());

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)]">
              {tag}
              <button onClick={() => onChange(tags.filter(t => t !== tag))} className="text-[var(--text-ghost)] hover:text-red-400 ml-0.5 transition-colors">
                <span className="text-[10px]">&times;</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }}
          placeholder={t("hero.tagsPlaceholder", "Type or choose tags...")}
          className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
        />
        {showDropdown && (filtered.length > 0 || canCreate) && (
          <div className="kx-glass-pop absolute z-50 top-full left-0 right-0 mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl shadow-black/30 overflow-hidden max-h-[200px] overflow-y-auto py-1">
            {filtered.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="w-full px-4 py-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                {s}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => addTag(input)}
                className="w-full px-4 py-2 text-left text-[12px] font-medium text-blue-400 hover:bg-blue-500/10 flex items-center gap-2 border-t border-[var(--border-subtle)] transition-colors"
              >
                <span className="h-4 w-4 rounded bg-blue-500/20 flex items-center justify-center text-[10px]">+</span>
                {t("hero.createTag", "Create \"{tag}\"").replace("{tag}", input.trim())}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
