"use client";

import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type { ProductFormState } from "@/types/product-form";
import { useMemo } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import Image from "next/image";

interface Props {
  data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">;
  onChange: (u: Partial<ProductFormState>) => void;
  divisions: DivisionRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  divisionLogos?: Record<string, string>;
  categoryLogos?: Record<string, string>;
  subcategoryLogos?: Record<string, string>;
  onClickCreateDivision?: () => void;
  onClickCreateCategory?: () => void;
  onClickCreateSubcategory?: () => void;
}

/* ── Determine which step we're on ── */
function getStep(data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">) {
  if (data.subcategory_slug) return 3; // all selected
  if (data.category_slug) return 2;    // picking subcategory
  if (data.division_slug) return 1;    // picking category
  return 0;                            // picking division
}

export default function ClassificationSection({
  data, onChange, divisions, categories, subcategories,
  divisionLogos, categoryLogos, subcategoryLogos,
  onClickCreateDivision, onClickCreateCategory, onClickCreateSubcategory,
}: Props) {
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === data.division_slug)?.id, [divisions, data.division_slug]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : [], [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === data.category_slug)?.id, [categories, data.category_slug]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : [], [subcategories, selectedCatId]);

  const selectedDiv = divisions.find(d => d.slug === data.division_slug);
  const selectedCat = categories.find(c => c.slug === data.category_slug);
  const selectedSub = subcategories.find(s => s.slug === data.subcategory_slug);

  const step = getStep(data);

  return (
    <div className="space-y-4">

      {/* ── Breadcrumb trail ── */}
      {step > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedDiv && (
            <button
              onClick={() => onChange({ division_slug: "", category_slug: "", subcategory_slug: "" })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
            >
              {divisionLogos?.[selectedDiv.slug] && (
                <Image src={divisionLogos[selectedDiv.slug]} alt="" width={14} height={14} className="rounded-sm object-contain" unoptimized />
              )}
              {selectedDiv.name}
            </button>
          )}
          {selectedCat && (
            <>
              <span className="text-[var(--text-ghost)] text-[10px]">/</span>
              <button
                onClick={() => onChange({ category_slug: "", subcategory_slug: "" })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
              >
                {categoryLogos?.[selectedCat.slug] && (
                  <Image src={categoryLogos[selectedCat.slug]} alt="" width={14} height={14} className="rounded-sm object-contain" unoptimized />
                )}
                {selectedCat.name}
              </button>
            </>
          )}
          {selectedSub && (
            <>
              <span className="text-[var(--text-ghost)] text-[10px]">/</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
                <CheckIcon className="h-3 w-3" />
                {selectedSub.name}
              </span>
            </>
          )}
        </div>
      )}

      {/* ═══════ Step 0: Pick Division ═══════ */}
      {step === 0 && (
        <div>
          <p className="text-[12px] font-medium text-[var(--text-subtle)] mb-3">Select Division</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {divisions.map((div) => {
              const logo = divisionLogos?.[div.slug];
              return (
                <button
                  key={div.id}
                  onClick={() => onChange({ division_slug: div.slug, category_slug: "", subcategory_slug: "" })}
                  className="group flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50 transition-all text-center"
                >
                  {logo ? (
                    <Image src={logo} alt={div.name} width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                  ) : (
                    <LayersIcon className="h-10 w-10 text-[var(--text-ghost)]" />
                  )}
                  <div>
                    <span className="text-[12px] font-medium text-[var(--text-primary)] leading-tight block">{div.name}</span>
                    {div.tagline && <span className="text-[10px] text-[var(--text-ghost)] leading-tight line-clamp-1 mt-0.5 block">{div.tagline}</span>}
                  </div>
                </button>
              );
            })}
            {onClickCreateDivision && (
              <button
                onClick={onClickCreateDivision}
                className="flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
              >
                <PlusIcon className="h-8 w-8" />
                <span className="text-[11px] font-medium">New Division</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════ Step 1: Division selected → Pick Category ═══════ */}
      {step === 1 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onChange({ division_slug: "", category_slug: "", subcategory_slug: "" })}
              className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
            >
              <AngleLeftIcon className="h-3.5 w-3.5" />
            </button>
            <p className="text-[12px] font-medium text-[var(--text-subtle)]">Select Category in <span className="text-[var(--text-primary)]">{selectedDiv?.name}</span></p>
          </div>
          {filteredCats.length === 0 && !onClickCreateCategory ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic py-6 text-center">No categories in this division</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredCats.map((cat) => {
                const logo = categoryLogos?.[cat.slug];
                return (
                  <button
                    key={cat.id}
                    onClick={() => onChange({ category_slug: cat.slug, subcategory_slug: "" })}
                    className="group flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50 transition-all text-center"
                  >
                    {logo ? (
                      <Image src={logo} alt={cat.name} width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                    ) : (
                      <FolderTreeIcon className="h-10 w-10 text-[var(--text-ghost)]" />
                    )}
                    <span className="text-[12px] font-medium text-[var(--text-primary)] leading-tight">{cat.name}</span>
                  </button>
                );
              })}
              {onClickCreateCategory && (
                <button
                  onClick={onClickCreateCategory}
                  className="flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
                >
                  <PlusIcon className="h-8 w-8" />
                  <span className="text-[11px] font-medium">New Category</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Step 2: Category selected → Pick Subcategory ═══════ */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onChange({ category_slug: "", subcategory_slug: "" })}
              className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
            >
              <AngleLeftIcon className="h-3.5 w-3.5" />
            </button>
            <p className="text-[12px] font-medium text-[var(--text-subtle)]">Select Subcategory in <span className="text-[var(--text-primary)]">{selectedCat?.name}</span></p>
          </div>
          {filteredSubs.length === 0 && !onClickCreateSubcategory ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic py-6 text-center">No subcategories in this category</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredSubs.map((sub) => {
                const logo = subcategoryLogos?.[sub.slug];
                return (
                  <button
                    key={sub.id}
                    onClick={() => onChange({ subcategory_slug: sub.slug })}
                    className="group flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50 transition-all text-center"
                  >
                    {logo ? (
                      <Image src={logo} alt={sub.name} width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                    ) : (
                      <TagsIcon className="h-8 w-8 text-[var(--text-ghost)]" />
                    )}
                    <span className="text-[12px] font-medium text-[var(--text-primary)] leading-tight">{sub.name}</span>
                  </button>
                );
              })}
              {onClickCreateSubcategory && (
                <button
                  onClick={onClickCreateSubcategory}
                  className="flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
                >
                  <PlusIcon className="h-8 w-8" />
                  <span className="text-[11px] font-medium">New Subcategory</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Step 3: All selected — done state ═══════ */}
      {step === 3 && (
        <p className="text-[11px] text-emerald-400/70 font-medium">Classification complete. Click the breadcrumb above to change.</p>
      )}
    </div>
  );
}
