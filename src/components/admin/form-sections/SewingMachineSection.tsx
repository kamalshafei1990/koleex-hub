"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, Settings2, Cpu, Zap, Info, Check } from "lucide-react";
import type { TemplateField, SewingMachineTemplate } from "@/lib/sewing-machine-templates";
import {
  COMMON_SEWING_FIELDS,
  SEWING_MACHINE_TEMPLATES,
  getTemplateForSubcategory,
  groupFields,
  getAllTemplates,
} from "@/lib/sewing-machine-templates";

/* ── Types ── */
export interface SewingSpecsFormState {
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
}

interface Props {
  data: SewingSpecsFormState;
  onChange: (data: SewingSpecsFormState) => void;
  subcategorySlug: string;
}

/* ── Group Header ── */
function GroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-1.5 first:pt-0">
      <div className="h-px flex-1 bg-white/[0.04]" />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-ghost)] px-1">{label}</span>
      <div className="h-px flex-1 bg-white/[0.04]" />
    </div>
  );
}

/* ── Individual Field Renderer ── */
function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inp =
    "w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
  const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";

  switch (field.type) {
    case "text":
      return (
        <div>
          <label className={lbl}>
            {field.label}
            {field.unit && <span className="text-[var(--text-ghost)] ml-1">({field.unit})</span>}
          </label>
          <input
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inp}
          />
          {field.helpText && (
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 flex items-center gap-1">
              <Info className="h-2.5 w-2.5 shrink-0" /> {field.helpText}
            </p>
          )}
        </div>
      );

    case "number":
      return (
        <div>
          <label className={lbl}>
            {field.label}
            {field.unit && <span className="text-[var(--text-ghost)] ml-1">({field.unit})</span>}
          </label>
          <div className="relative">
            <input
              type="number"
              value={(value as string | number) ?? ""}
              onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : "")}
              placeholder={field.placeholder}
              step={field.step}
              min={field.min}
              max={field.max}
              className={`${inp} pr-12`}
            />
            {field.unit && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-ghost)]">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      );

    case "select":
      return (
        <div>
          <label className={lbl}>{field.label}</label>
          <select
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.helpText && (
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 flex items-center gap-1">
              <Info className="h-2.5 w-2.5 shrink-0" /> {field.helpText}
            </p>
          )}
        </div>
      );

    case "multi-select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <label className={lbl}>{field.label}</label>
          <div className="flex flex-wrap gap-1.5">
            {field.options?.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    onChange(next);
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium border transition-all cursor-pointer
                    ${
                      isSelected
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                        : "bg-[var(--bg-inverted)]/[0.03] border-[var(--border-subtle)] text-[var(--text-dim)] hover:border-[var(--border-focus)] hover:text-[var(--text-muted)]"
                    }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "boolean":
      return (
        <div className="flex items-center justify-between py-1">
          <div>
            <span className="text-[12px] text-[var(--text-muted)]">{field.label}</span>
            {field.helpText && (
              <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">{field.helpText}</p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => onChange(!value)}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0 ${
              value ? "bg-blue-500/60" : "bg-[var(--bg-surface)]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                value ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      );

    default:
      return null;
  }
}

/* ── Field Group Renderer ── */
function FieldGroup({
  groupLabel,
  fields,
  values,
  onChange,
}: {
  groupLabel: string;
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div>
      <GroupHeader label={groupLabel} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 mt-2">
        {fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(val) => onChange(field.key, val)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Template Picker ── */
function TemplatePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const templates = getAllTemplates();

  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--text-faint)] mb-2">
        Machine Type Template
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {templates.map((t) => {
          const isSelected = selected === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onSelect(t.slug)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer
                ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.03] hover:border-[var(--border-focus)] hover:bg-[var(--bg-inverted)]/[0.06]"
                }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <span className="text-2xl">{t.icon}</span>
              <span
                className={`text-[10px] font-bold text-center leading-tight ${
                  isSelected ? "text-blue-400" : "text-[var(--text-dim)]"
                }`}
              >
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SewingMachineSection({ data, onChange, subcategorySlug }: Props) {
  const [commonOpen, setCommonOpen] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(true);

  // Auto-detect template from subcategory, but allow manual override
  const detectedTemplate = useMemo(
    () => getTemplateForSubcategory(subcategorySlug),
    [subcategorySlug]
  );

  const activeTemplateSlug = data.template_slug || detectedTemplate?.slug || "";

  // Auto-persist detected template to parent state so it gets saved
  useEffect(() => {
    if (!data.template_slug && detectedTemplate?.slug) {
      onChange({ ...data, template_slug: detectedTemplate.slug });
    }
  }, [detectedTemplate?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get the active template definition
  const activeTemplate = useMemo(() => {
    if (!activeTemplateSlug) return null;
    return SEWING_MACHINE_TEMPLATES.find(
      (t) => t.slug === activeTemplateSlug
    ) || null;
  }, [activeTemplateSlug]);

  // Group common fields
  const commonGroups = useMemo(() => groupFields(COMMON_SEWING_FIELDS), []);

  // Group template-specific fields
  const templateGroups = useMemo(
    () => (activeTemplate ? groupFields(activeTemplate.fields) : []),
    [activeTemplate]
  );

  const handleTemplateChange = (slug: string) => {
    onChange({
      ...data,
      template_slug: slug,
      // Keep template_specs if same template, otherwise reset
      template_specs: slug === data.template_slug ? data.template_specs : {},
    });
  };

  const handleCommonChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      common_specs: { ...data.common_specs, [key]: value },
    });
  };

  const handleTemplateSpecChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      template_specs: { ...data.template_specs, [key]: value },
    });
  };

  // Count filled fields
  const filledCommon = Object.values(data.common_specs).filter(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  ).length;
  const filledTemplate = Object.values(data.template_specs).filter(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  ).length;

  return (
    <div className="space-y-5">
      {/* Template Picker */}
      <TemplatePicker selected={activeTemplateSlug} onSelect={handleTemplateChange} />

      {activeTemplateSlug && (
        <>
          {/* ── Common Fields Section ── */}
          <div className="bg-[var(--bg-surface-subtle)]/50 rounded-xl border border-white/[0.06] overflow-hidden">
            <button
              type="button"
              onClick={() => setCommonOpen(!commonOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                <Settings2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Common Sewing Machine Specs
                </h3>
                <p className="text-[10px] text-[var(--text-ghost)]">
                  Shared across all machine types
                </p>
              </div>
              {filledCommon > 0 && (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {filledCommon} / {COMMON_SEWING_FIELDS.length}
                </span>
              )}
              {commonOpen ? (
                <ChevronUp className="h-4 w-4 text-[var(--text-ghost)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--text-ghost)]" />
              )}
            </button>
            {commonOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-1">
                {commonGroups.map((g) => (
                  <FieldGroup
                    key={g.group}
                    groupLabel={g.group}
                    fields={g.fields}
                    values={data.common_specs}
                    onChange={handleCommonChange}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Template-Specific Fields Section ── */}
          {activeTemplate && templateGroups.length > 0 && (
            <div className="bg-[var(--bg-surface-subtle)]/50 rounded-xl border border-white/[0.06] overflow-hidden">
              <button
                type="button"
                onClick={() => setTemplateOpen(!templateOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Cpu className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {activeTemplate.icon} {activeTemplate.name} Specs
                  </h3>
                  <p className="text-[10px] text-[var(--text-ghost)]">
                    {activeTemplate.description}
                  </p>
                </div>
                {filledTemplate > 0 && (
                  <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    {filledTemplate} / {activeTemplate.fields.length}
                  </span>
                )}
                {templateOpen ? (
                  <ChevronUp className="h-4 w-4 text-[var(--text-ghost)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--text-ghost)]" />
                )}
              </button>
              {templateOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-1">
                  {templateGroups.map((g) => (
                    <FieldGroup
                      key={g.group}
                      groupLabel={g.group}
                      fields={g.fields}
                      values={data.template_specs}
                      onChange={handleTemplateSpecChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!activeTemplateSlug && (
        <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-xl">
          <Zap className="h-10 w-10 text-[var(--text-ghost)] mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-dim)] font-medium">Select a machine type above</p>
          <p className="text-[11px] text-[var(--text-ghost)] mt-1">
            Template-specific fields will appear based on your selection
          </p>
        </div>
      )}
    </div>
  );
}
