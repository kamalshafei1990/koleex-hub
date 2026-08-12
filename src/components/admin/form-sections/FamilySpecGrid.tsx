"use client";

/* ---------------------------------------------------------------------------
   FamilySpecGrid — enter a product family THE WAY THE CATALOG PRINTS IT.

   Every machinery catalog ends in the same artifact: a TECHNICAL
   SPECIFICATION table — rows are spec fields, columns are models. Our
   Variants cards asked a junior operator to translate that table into
   per-model panels and dropdown pickers; this grid removes the
   translation. You transcribe the catalog cell by cell:

     · The FAMILY column is the shared value (products.schema_specs) —
       type once, every model inherits it.
     · A MODEL cell left empty shows the inherited value greyed; typing
       in it records an override (model.specs_overrides[key]) and the
       cell earns the Hub-Blue dot — the same dot the profile spotlight
       and the public lineup use for "differs".
     · Model codes are edited straight in the column headers; "+ Model"
       appends a column, exactly like the catalog adds a size.

   Pure form-state component: no fetches, no persistence — the form's
   normal save path writes schema_specs and specs_overrides.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import KdsSelect from "@/components/kds/Select";
import BoundIcon from "@/components/common/BoundIcon";
import type { ModelFormState } from "@/types/product-form";
import { createEmptyModel, slugify } from "@/types/product-form";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import type { VariantSpecField } from "./ModelsSection";
import ConfirmDialog from "@/components/kds/ConfirmDialog";

const isEmptyVal = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const show = (v: unknown): string =>
  isEmptyVal(v) ? "" : Array.isArray(v) ? v.join(", ") : String(v);

export default function FamilySpecGrid({
  specFields,
  productSpecs,
  onChangeProductSpecs,
  models,
  onChange,
  familyProductName,
  seedModel,
}: {
  specFields: VariantSpecField[];
  productSpecs: Record<string, unknown>;
  onChangeProductSpecs: (next: Record<string, unknown>) => void;
  models: ModelFormState[];
  onChange: (models: ModelFormState[]) => void;
  familyProductName?: string;
  /* Preferred member factory — seeds identity from the primary. */
  seedModel?: () => ModelFormState;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [askRemoveIdx, setAskRemoveIdx] = useState<number | null>(null);

  const setFamily = (key: string, raw: string, fieldType: string) => {
    const next = { ...productSpecs };
    if (raw === "") {
      delete next[key];
    } else if (fieldType === "unit_number") {
      const n = parseFloat(raw);
      next[key] = Number.isFinite(n) ? n : raw;
    } else {
      next[key] = raw;
    }
    onChangeProductSpecs(next);
  };

  const setOverride = (mi: number, key: string, raw: string) => {
    const next = models.map((m, i) => {
      if (i !== mi) return m;
      const ov = { ...(m.specs_overrides ?? {}) };
      if (raw === "") delete ov[key];
      else ov[key] = raw;
      return { ...m, specs_overrides: ov };
    });
    onChange(next);
  };

  const setCode = (mi: number, code: string) => {
    const next = models.map((m, i) =>
      i === mi
        ? { ...m, primary_model: code, slug: m.slug || slugify(code) }
        : m);
    onChange(next);
  };

  const addModel = () => {
    const m = seedModel ? seedModel() : (() => {
      const x = createEmptyModel();
      x.model_name = familyProductName || models[0]?.model_name || "";
      return x;
    })();
    m.order = models.length;
    onChange([...models, m]);
  };

  const removeModel = (mi: number) => {
    onChange(models.filter((_, i) => i !== mi).map((m, i) => ({ ...m, order: i })));
  };

  /* Cell editor per field type — the smallest control that fits a table
     cell. Selects render their option labels; everything else is text. */
  const cell = (
    f: VariantSpecField,
    value: string,
    placeholder: string,
    overridden: boolean,
    onSet: (raw: string) => void,
  ) => {
    const base =
      "w-full h-8 px-2 rounded-md bg-transparent border text-[12px] outline-none transition-colors " +
      (overridden
        ? "border-[#567FB2]/50 text-[var(--text-primary)] font-medium focus:border-[#567FB2]"
        : "border-transparent hover:border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)]");
    if (f.fieldType === "select" && f.options.length > 0) {
      return (
        <KdsSelect value={value} onChange={onSet}
          options={f.options.map((o) => ({ value: o.value, label: o.label }))}
          placeholder={placeholder ? `↳ ${placeholder}` : "—"}
          triggerClassName={`${base} pe-7 text-start`} />
      );
    }
    if (f.fieldType === "boolean") {
      return (
        <KdsSelect value={value} onChange={onSet}
          options={[{ value: "true", label: t("pp.yes", "Yes") }, { value: "false", label: t("pp.no", "No") }]}
          placeholder={placeholder ? `↳ ${placeholder}` : "—"}
          triggerClassName={`${base} pe-7 text-start`} />
      );
    }
    return (
      <input
        value={value}
        onChange={(e) => onSet(e.target.value)}
        placeholder={placeholder || "—"}
        inputMode={f.fieldType === "unit_number" ? "decimal" : undefined}
        className={`${base} placeholder:text-[var(--text-ghost)] tabular-nums`}
      />
    );
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-[var(--text-ghost)] leading-relaxed">
        {t("famGrid.hint", "Type in FAMILY once — every model inherits it. Type in a model column only where the catalog shows a different value; that cell becomes the model's difference (blue).")}
      </p>

      {/* The catalog table itself. First column sticky so long families
          scroll horizontally without losing the field names (fits the
          screen on mobile too — the page never scrolls sideways). */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 560 }}>
          <thead>
            <tr className="bg-[var(--bg-surface-subtle)]">
              <th className="sticky start-0 z-10 bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-start text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] min-w-[150px]">
                {t("famGrid.field", "Specification")}
              </th>
              <th className="px-2 py-2.5 text-start text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] min-w-[130px]">
                {t("famGrid.family", "Family (all models)")}
              </th>
              {models.map((m, mi) => (
                <th key={m._tempId} className="px-2 py-1.5 min-w-[130px]">
                  <div className="flex items-center gap-1">
                    <input
                      value={m.primary_model || ""}
                      onChange={(e) => setCode(mi, e.target.value)}
                      placeholder={t("famGrid.code", "Model code")}
                      className="w-full h-8 px-2 rounded-md bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] text-[11.5px] font-bold tabular-nums text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                    />
                    {models.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAskRemoveIdx(mi)}
                        aria-label={t("famGrid.removeModel", "Remove model")}
                        className="h-7 w-7 shrink-0 rounded-md inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {mi === 0 && (
                    <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] text-start px-0.5">
                      {t("pp.primary", "Primary")}
                    </div>
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 w-[90px]">
                <button
                  type="button"
                  onClick={addModel}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-dashed border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap"
                >
                  <PlusIcon className="h-3 w-3" /> {t("famGrid.addModel", "Model")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {specFields.map((f) => {
              const fam = show(productSpecs[f.key]);
              return (
                <tr key={f.key} className="border-t border-[var(--border-subtle)]/60 hover:bg-[var(--bg-surface-subtle)]/30">
                  <td className="sticky start-0 z-10 bg-[var(--bg-secondary)] px-3 py-1 text-[11.5px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5 truncate" title={f.label}>
                      <BoundIcon semanticKey={`spec.${f.key}`} className="h-3 w-3 text-[var(--text-ghost)]" fallback={null} />
                      <span className="truncate">
                        {f.label}
                        {f.unit ? <span className="text-[var(--text-ghost)]"> ({f.unit})</span> : null}
                      </span>
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    {cell(f, fam, "", false, (raw) => setFamily(f.key, raw, f.fieldType))}
                  </td>
                  {models.map((m, mi) => {
                    const ovRaw = (m.specs_overrides ?? {})[f.key];
                    const overridden = !isEmptyVal(ovRaw);
                    return (
                      <td key={m._tempId} className="px-1 py-1">
                        <div className="relative">
                          {overridden && (
                            <span className="absolute -start-0.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
                          )}
                          {cell(f, show(ovRaw), fam, overridden, (raw) => setOverride(mi, f.key, raw))}
                        </div>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={askRemoveIdx != null}
        onCancel={() => setAskRemoveIdx(null)}
        onConfirm={() => { if (askRemoveIdx != null) removeModel(askRemoveIdx); setAskRemoveIdx(null); }}
        title={t("famGrid.removeModel", "Remove model")}
        message={t("famGrid.removeConfirm", "Remove this model from the family? Its differences are discarded when you save.")}
        confirmLabel={t("famGrid.removeModel", "Remove model")}
      />
    </div>
  );
}
