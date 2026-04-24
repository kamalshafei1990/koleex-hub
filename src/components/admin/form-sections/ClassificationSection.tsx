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
import { getDivisionIcon } from "@/components/icons/divisions";
import {
  getKindsForSubcategory,
  getKindBySlug,
  type MachineKind,
} from "@/lib/machine-kinds";

/* Koleex's flagship division. Rendered first in any division picker
   and given a visual accent so it reads as the primary line. Keep
   in sync with the constant in ProductList / ProductForm. */
const FLAGSHIP_DIVISION_SLUG = "garment-machinery";

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

  /* Machine-kind classification (4th tier).
     Kind applies when the chosen subcategory has machine kinds
     registered in the catalog (industrial sewing machines today,
     other machinery divisions in the future). When no kinds exist
     for the subcategory, step 2 is the terminal step.
     · `machineKindSlug` — currently selected kind (from
       sewing_specs.common_specs.machine_kind in the parent)
     · `onMachineKindChange` — fires with the kind so the parent
       can persist both the kind slug and its implied template slug. */
  machineKindSlug?: string;
  onMachineKindChange?: (kind: MachineKind) => void;
}

/* Steps in the internal wizard:
     0 — pick division
     1 — pick category
     2 — pick subcategory
     3 — pick machine kind (only if kinds exist for this subcategory)
     4 — fully classified / done */
function getStep(
  data: Pick<ProductFormState, "division_slug" | "category_slug" | "subcategory_slug">,
  hasKindStage: boolean,
  machineKindSlug: string,
) {
  if (data.subcategory_slug) {
    if (hasKindStage && !machineKindSlug) return 3;
    return 4;
  }
  if (data.category_slug) return 2;
  if (data.division_slug) return 1;
  return 0;
}

export default function ClassificationSection({
  data, onChange, divisions, categories, subcategories,
  divisionLogos, categoryLogos, subcategoryLogos,
  onClickCreateDivision, onClickCreateCategory, onClickCreateSubcategory,
  machineKindSlug = "",
  onMachineKindChange,
}: Props) {
  const selectedDivId = useMemo(() => divisions.find(d => d.slug === data.division_slug)?.id, [divisions, data.division_slug]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : [], [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === data.category_slug)?.id, [categories, data.category_slug]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : [], [subcategories, selectedCatId]);

  const selectedDiv = divisions.find(d => d.slug === data.division_slug);
  const selectedCat = categories.find(c => c.slug === data.category_slug);
  const selectedSub = subcategories.find(s => s.slug === data.subcategory_slug);

  /* Machine kinds available for the chosen subcategory. If there
     are none (non-sewing subcategories today) we skip the kind
     step entirely — classification ends at Subcategory. */
  const availableKinds = useMemo(() => {
    if (!data.subcategory_slug) return [] as MachineKind[];
    const kinds = getKindsForSubcategory(data.subcategory_slug);
    // getKindsForSubcategory returns the full catalog when no match exists;
    // we only want kinds that *explicitly* belong to the chosen subcategory.
    return kinds.filter((k) => k.subcategory === data.subcategory_slug);
  }, [data.subcategory_slug]);

  const hasKindStage = availableKinds.length > 0 && !!onMachineKindChange;
  const selectedKind = useMemo(
    () => (machineKindSlug ? getKindBySlug(machineKindSlug) : null),
    [machineKindSlug]
  );

  /* Promote the flagship division to the head of the grid so admins
     creating a product see the primary Koleex line first. The rest
     stay in their original order. */
  const orderedDivisions = useMemo(() => {
    const flagship = divisions.filter(d => d.slug === FLAGSHIP_DIVISION_SLUG);
    const rest = divisions.filter(d => d.slug !== FLAGSHIP_DIVISION_SLUG);
    return [...flagship, ...rest];
  }, [divisions]);

  const step = getStep(data, hasKindStage, machineKindSlug);

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
              {(() => {
                const DivIcon = getDivisionIcon(selectedDiv.slug);
                if (DivIcon) return <DivIcon className="h-3.5 w-3.5" />;
                if (divisionLogos?.[selectedDiv.slug]) return <Image src={divisionLogos[selectedDiv.slug]} alt="" width={14} height={14} className="rounded-sm object-contain" unoptimized />;
                return null;
              })()}
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
              {/* When there's a machine-kind stage below, subcategory is
                  no longer the terminal node — render it as a neutral
                  nav chip so clicking it jumps back to subcategory
                  selection (and cascade-clears the kind the same way
                  division / category chips cascade-clear their
                  descendants). The final green chip moves to the kind. */}
              {hasKindStage ? (
                <button
                  onClick={() => {
                    /* Going back to pick a different subcategory — wipe
                       subcategory and cascade-clear the kind so stale
                       data doesn't linger after the taxonomy changes. */
                    onChange({ subcategory_slug: "" });
                    if (onMachineKindChange && machineKindSlug) {
                      onMachineKindChange({
                        slug: "",
                        name: "",
                        description: "",
                        subcategory: "",
                        templateSlug: "",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        icon: null as any,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
                >
                  {selectedSub.name}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
                  <CheckIcon className="h-3 w-3" />
                  {selectedSub.name}
                </span>
              )}
            </>
          )}
          {selectedKind && (
            <>
              <span className="text-[var(--text-ghost)] text-[10px]">/</span>
              <button
                onClick={() => {
                  /* Click the kind chip to change just the kind
                     without touching subcategory above. */
                  if (onMachineKindChange) {
                    onMachineKindChange({
                      slug: "",
                      name: "",
                      description: "",
                      subcategory: "",
                      templateSlug: "",
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      icon: null as any,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-all"
              >
                <selectedKind.icon size={12} />
                {selectedKind.name}
              </button>
            </>
          )}
        </div>
      )}

      {/* ═══════ Step 0: Pick Division ═══════ */}
      {step === 0 && (
        <div>
          <p className="text-[12px] font-medium text-[var(--text-subtle)] mb-3">Select Division</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {orderedDivisions.map((div) => {
              const DivIcon = getDivisionIcon(div.slug);
              const logo = divisionLogos?.[div.slug];
              const isFlagship = div.slug === FLAGSHIP_DIVISION_SLUG;
              /* Flagship tile gets an accent border + a subtle tinted
                 background + a "Primary line" caption, so it's clearly
                 the hub's main division at a glance. Other tiles keep
                 the neutral surface treatment. */
              const tileCls = isFlagship
                ? "group relative flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-[var(--text-primary)]/30 bg-[var(--text-primary)]/[0.04] hover:border-[var(--text-primary)]/60 hover:bg-[var(--text-primary)]/[0.08] transition-all text-center"
                : "group flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)]/50 hover:bg-[var(--bg-surface-subtle)]/50 transition-all text-center";
              return (
                <button
                  key={div.id}
                  onClick={() => onChange({ division_slug: div.slug, category_slug: "", subcategory_slug: "" })}
                  className={tileCls}
                >
                  {isFlagship && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-[var(--text-primary)]/70">
                      Flagship
                    </span>
                  )}
                  {DivIcon ? (
                    <DivIcon className={`h-10 w-10 transition-colors ${
                      isFlagship
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                    }`} />
                  ) : logo ? (
                    <Image src={logo} alt={div.name} width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
                  ) : (
                    <LayersIcon className="h-10 w-10 text-[var(--text-ghost)]" />
                  )}
                  <div>
                    <span className={`text-[12px] leading-tight block ${
                      isFlagship
                        ? "font-semibold text-[var(--text-primary)]"
                        : "font-medium text-[var(--text-primary)]"
                    }`}>{div.name}</span>
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
                    onClick={() => {
                      onChange({ subcategory_slug: sub.slug });
                      /* Switching to a different subcategory — cascade
                         clear any previously selected machine kind so
                         the breadcrumb doesn't show a kind that
                         belongs to the old subcategory. */
                      if (
                        onMachineKindChange &&
                        machineKindSlug &&
                        sub.slug !== data.subcategory_slug
                      ) {
                        onMachineKindChange({
                          slug: "",
                          name: "",
                          description: "",
                          subcategory: "",
                          templateSlug: "",
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          icon: null as any,
                        });
                      }
                    }}
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

      {/* ═══════ Step 3: Subcategory selected → Pick Machine Kind ═══════
            Only shown when the chosen subcategory has machine kinds
            registered in the catalog (industrial sewing machines etc.).
            For every other subcategory, classification ends at Step 2. */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onChange({ subcategory_slug: "" })}
              className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]/50 transition-all"
            >
              <AngleLeftIcon className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-[var(--text-subtle)]">
                Select Machine Kind in <span className="text-[var(--text-primary)]">{selectedSub?.name}</span>
              </p>
              <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">
                Specific sub-type. Drives the spec fields you&apos;ll fill in later.
              </p>
            </div>
            <span className="text-[10px] font-medium text-[var(--text-ghost)] uppercase tracking-wider shrink-0">
              {availableKinds.length} {availableKinds.length === 1 ? "option" : "options"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {availableKinds.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.slug}
                  type="button"
                  onClick={() => onMachineKindChange?.(k)}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/80 hover:-translate-y-0.5 transition-all text-center"
                >
                  <Icon
                    size={28}
                    className="mt-1 mb-1 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors"
                  />
                  <span className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
                    {k.name}
                  </span>
                  <span className="text-[9px] text-[var(--text-ghost)] leading-snug line-clamp-2">
                    {k.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ Step 4: Fully classified — done state ═══════ */}
      {step === 4 && (
        <div className="space-y-2">
          <p className="text-[11px] text-emerald-400/70 font-medium">
            Classification complete. Click any chip above to change.
          </p>
          {/* Explain why a Kind wasn't asked for when the chosen
              subcategory has no machine kinds in the catalog. Without
              this, admins who just finished "Automatic Sewing Systems
              → Pocket Welting Machines" wonder why Lockstitch got a
              4th stage but their flow didn't. */}
          {selectedSub && !hasKindStage && availableKinds.length === 0 && (
            <p className="text-[11px] text-[var(--text-ghost)]">
              <span className="text-[var(--text-dim)]">Machine Kind</span>{" "}
              doesn&apos;t apply to this subcategory — you can move on.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
