"use client";

import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import type { ProductFormState } from "@/types/product-form";
import { useMemo } from "react";
import { Plus, Check, ChevronRight, FolderTree, Layers, Tag } from "lucide-react";
import Image from "next/image";

interface Props {
  data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">;
  onChange: (u: Partial<ProductFormState>) => void;
  divisions: DivisionRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  divisionLogos?: Record<string, string>;
  categoryLogos?: Record<string, string>;
  onClickCreateDivision?: () => void;
  onClickCreateCategory?: () => void;
  onClickCreateSubcategory?: () => void;
}

/* ── Color palette for cards without logos ── */
const COLORS = [
  "from-blue-500/20 to-blue-600/5",
  "from-purple-500/20 to-purple-600/5",
  "from-emerald-500/20 to-emerald-600/5",
  "from-amber-500/20 to-amber-600/5",
  "from-cyan-500/20 to-cyan-600/5",
  "from-pink-500/20 to-pink-600/5",
  "from-indigo-500/20 to-indigo-600/5",
  "from-rose-500/20 to-rose-600/5",
];

function getColor(idx: number) {
  return COLORS[idx % COLORS.length];
}

/* ── Step label ── */
function StepLabel({ step, label, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
        done ? "bg-emerald-500 text-white" : active ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface)] text-[var(--text-ghost)] border border-[var(--border-subtle)]"
      }`}>
        {done ? <Check className="h-3 w-3" /> : step}
      </div>
      <span className={`text-[12px] font-semibold tracking-tight ${active || done ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}`}>{label}</span>
      {done && <ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" />}
    </div>
  );
}

export default function ClassificationSection({
  data, onChange, divisions, categories, subcategories,
  divisionLogos, categoryLogos,
  onClickCreateDivision, onClickCreateCategory, onClickCreateSubcategory,
}: Props) {
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === data.division_slug)?.id, [divisions, data.division_slug]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : [], [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === data.category_slug)?.id, [categories, data.category_slug]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : [], [subcategories, selectedCatId]);

  const selectedDiv = divisions.find(d => d.slug === data.division_slug);
  const selectedCat = categories.find(c => c.slug === data.category_slug);
  const selectedSub = subcategories.find(s => s.slug === data.subcategory_slug);

  return (
    <div className="space-y-6">

      {/* ── Breadcrumb summary ── */}
      {(data.division_slug || data.category_slug || data.subcategory_slug) && (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-lg bg-[var(--bg-inverted)]/[0.03] border border-[var(--border-subtle)]/50">
          <FolderTree className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
          {selectedDiv && (
            <button onClick={() => onChange({ division_slug: data.division_slug, category_slug: "", subcategory_slug: "" })} className="text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">{selectedDiv.name}</button>
          )}
          {selectedCat && (
            <>
              <ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" />
              <button onClick={() => onChange({ category_slug: data.category_slug, subcategory_slug: "" })} className="text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">{selectedCat.name}</button>
            </>
          )}
          {selectedSub && (
            <>
              <ChevronRight className="h-3 w-3 text-[var(--text-ghost)]" />
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">{selectedSub.name}</span>
            </>
          )}
        </div>
      )}

      {/* ═══════ Step 1: Division ═══════ */}
      <div>
        <StepLabel step={1} label="Division" active={!data.division_slug} done={!!data.division_slug} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {divisions.map((div, idx) => {
            const selected = data.division_slug === div.slug;
            const logo = divisionLogos?.[div.slug];
            return (
              <button
                key={div.id}
                onClick={() => onChange({ division_slug: div.slug, category_slug: "", subcategory_slug: "" })}
                className={`group relative flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border transition-all text-center ${
                  selected
                    ? "border-[var(--text-primary)] bg-[var(--bg-inverted)]/[0.08] shadow-[0_0_0_1px_var(--text-primary)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50"
                }`}
              >
                {selected && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${getColor(idx)} ${selected ? "ring-1 ring-[var(--text-primary)]/20" : ""}`}>
                  {logo ? (
                    <Image src={logo} alt={div.name} width={40} height={40} className="h-full w-full object-cover rounded-xl" unoptimized />
                  ) : (
                    <Layers className="h-4.5 w-4.5 text-[var(--text-dim)]" />
                  )}
                </div>
                <span className={`text-[11px] font-medium leading-tight ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>{div.name}</span>
                {div.tagline && <span className="text-[9px] text-[var(--text-ghost)] leading-tight line-clamp-1">{div.tagline}</span>}
              </button>
            );
          })}
          {onClickCreateDivision && (
            <button
              onClick={onClickCreateDivision}
              className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium">New Division</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Step 2: Category ═══════ */}
      {data.division_slug && (
        <div>
          <StepLabel step={2} label="Category" active={!!data.division_slug && !data.category_slug} done={!!data.category_slug} />
          {filteredCats.length === 0 && !onClickCreateCategory ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">No categories in this division</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredCats.map((cat, idx) => {
                const selected = data.category_slug === cat.slug;
                const logo = categoryLogos?.[cat.slug];
                return (
                  <button
                    key={cat.id}
                    onClick={() => onChange({ category_slug: cat.slug, subcategory_slug: "" })}
                    className={`group relative flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border transition-all text-center ${
                      selected
                        ? "border-[var(--text-primary)] bg-[var(--bg-inverted)]/[0.08] shadow-[0_0_0_1px_var(--text-primary)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50"
                    }`}
                  >
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${getColor(idx + 3)} ${selected ? "ring-1 ring-[var(--text-primary)]/20" : ""}`}>
                      {logo ? (
                        <Image src={logo} alt={cat.name} width={40} height={40} className="h-full w-full object-cover rounded-xl" unoptimized />
                      ) : (
                        <FolderTree className="h-4.5 w-4.5 text-[var(--text-dim)]" />
                      )}
                    </div>
                    <span className={`text-[11px] font-medium leading-tight ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>{cat.name}</span>
                  </button>
                );
              })}
              {onClickCreateCategory && (
                <button
                  onClick={onClickCreateCategory}
                  className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium">New Category</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Step 3: Subcategory ═══════ */}
      {data.category_slug && (
        <div>
          <StepLabel step={3} label="Subcategory" active={!!data.category_slug && !data.subcategory_slug} done={!!data.subcategory_slug} />
          {filteredSubs.length === 0 && !onClickCreateSubcategory ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">No subcategories in this category</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredSubs.map((sub, idx) => {
                const selected = data.subcategory_slug === sub.slug;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onChange({ subcategory_slug: sub.slug })}
                    className={`group relative flex flex-col items-center justify-center gap-2 px-3 py-3.5 rounded-xl border transition-all text-center ${
                      selected
                        ? "border-[var(--text-primary)] bg-[var(--bg-inverted)]/[0.08] shadow-[0_0_0_1px_var(--text-primary)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50"
                    }`}
                  >
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${getColor(idx + 5)} ${selected ? "ring-1 ring-[var(--text-primary)]/20" : ""}`}>
                      <Tag className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                    </div>
                    <span className={`text-[11px] font-medium leading-tight ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>{sub.name}</span>
                  </button>
                );
              })}
              {onClickCreateSubcategory && (
                <button
                  onClick={onClickCreateSubcategory}
                  className="flex flex-col items-center justify-center gap-2 px-3 py-3.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/40 transition-all"
                >
                  <div className="h-9 w-9 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium">New Subcategory</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
