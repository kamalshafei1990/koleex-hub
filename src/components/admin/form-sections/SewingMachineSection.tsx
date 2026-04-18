"use client";

import { useMemo, useEffect } from "react";
import ShirtIcon from "@/components/icons/ui/ShirtIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import type { TemplateField } from "@/lib/sewing-machine-templates";
import {
  COMMON_SEWING_FIELDS,
  SEWING_MACHINE_TEMPLATES,
  getTemplateForSubcategory,
  groupFields,
  getAllTemplates,
} from "@/lib/sewing-machine-templates";

/* ── Icons and colors for each group ── */
const GROUP_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Performance: { icon: <GaugeIcon className="h-3.5 w-3.5" />, color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400" },
  "Needle & Thread": { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400" },
  Mechanical: { icon: <WrenchIcon className="h-3.5 w-3.5" />, color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400" },
  Physical: { icon: <RulerIcon className="h-3.5 w-3.5" />, color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300" },
  Application: { icon: <ShirtIcon className="h-3.5 w-3.5" />, color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400" },
  Automation: { icon: <WorkflowIcon className="h-3.5 w-3.5" />, color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400" },
  Stitch: { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400" },
  Capacity: { icon: <GaugeIcon className="h-3.5 w-3.5" />, color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400" },
  Configuration: { icon: <CogIcon className="h-3.5 w-3.5" />, color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300" },
  "Needle Setup": { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400" },
  "Thread Configuration": { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400" },
  Feed: { icon: <WorkflowIcon className="h-3.5 w-3.5" />, color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400" },
  Cutting: { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400" },
  "Needle Configuration": { icon: <ScissorsIcon className="h-3.5 w-3.5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400" },
};

function getGroupMeta(name: string) {
  return GROUP_META[name] || { icon: <LayersIcon className="h-3.5 w-3.5" />, color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300" };
}

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
  /**
   * "full" (default) renders template picker + specs fields
   * "template" renders only the machine type picker card grid
   * "specs" renders only the dynamic spec fields (assumes a template is already chosen)
   */
  mode?: "full" | "template" | "specs";
}

/* ── Group Header with icon chip ── */
function GroupHeader({ label }: { label: string }) {
  const { icon, color } = getGroupMeta(label);
  return (
    <div className="flex items-center gap-3 pt-5 pb-2 first:pt-1">
      <div className={`h-8 w-8 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-primary)]">{label}</span>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
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
              <InfoIcon className="h-2.5 w-2.5 shrink-0" /> {field.helpText}
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
              <InfoIcon className="h-2.5 w-2.5 shrink-0" /> {field.helpText}
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
                  {isSelected && <CheckIcon className="h-3 w-3" />}
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
              value ? "bg-emerald-500" : "bg-zinc-600"
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

/* ── Field Group Renderer (visual panel) ── */
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
      <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--border-subtle)]/60 p-4 mt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
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

/* ── Template Picker — visual machine type cards ── */
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
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Sewing Machine Type</h3>
          <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">Choose the template that matches this machine. Fields adjust automatically.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {templates.map((t) => {
          const isSelected = selected === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onSelect(t.slug)}
              className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left
                ${
                  isSelected
                    ? "border-blue-500 bg-gradient-to-br from-blue-500/15 to-blue-600/5 shadow-[0_4px_16px_rgba(59,130,246,0.2)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/80 hover:-translate-y-0.5"
                }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <CheckIcon className="h-3 w-3 text-white" />
                </div>
              )}
              <span className="text-3xl mt-1 mb-1">{t.icon}</span>
              <span
                className={`text-[11px] font-bold text-center leading-tight ${
                  isSelected ? "text-blue-400" : "text-[var(--text-dim)] group-hover:text-[var(--text-primary)]"
                }`}
              >
                {t.name}
              </span>
              <span className="text-[9px] text-[var(--text-ghost)] text-center line-clamp-2 leading-snug">{t.description}</span>
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

export default function SewingMachineSection({ data, onChange, subcategorySlug, mode = "full" }: Props) {
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
    <div className="space-y-6">
      {/* Template Picker — shown in "full" and "template" modes */}
      {(mode === "full" || mode === "template") && (
        <TemplatePicker selected={activeTemplateSlug} onSelect={handleTemplateChange} />
      )}

      {mode === "template" && !activeTemplateSlug && (
        <div className="text-center py-8 border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <p className="text-[12px] text-[var(--text-dim)]">Pick a machine type to unlock its spec fields in the next step.</p>
        </div>
      )}

      {mode === "template" && activeTemplateSlug && activeTemplate && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-xl">
            {activeTemplate.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{activeTemplate.name}</div>
            <div className="text-[11px] text-[var(--text-ghost)] truncate">{activeTemplate.description}</div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Selected</span>
        </div>
      )}

      {/* Specs fields — shown in "full" and "specs" modes */}
      {(mode === "full" || mode === "specs") && activeTemplateSlug && (
        <>
          {/* ── Common Fields Section ── */}
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
                <Settings2Icon className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Common Sewing Specs</h3>
                <p className="text-[11px] text-[var(--text-ghost)]">Performance · Needle &amp; Thread · Mechanical · Physical · Application · Automation</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                {filledCommon} / {COMMON_SEWING_FIELDS.length}
              </span>
            </div>
            <div className="space-y-2">
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
          </div>

          {/* ── Template-Specific Fields Section ── */}
          {activeTemplate && templateGroups.length > 0 && (
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-subtle)]">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center text-2xl">
                  {activeTemplate.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{activeTemplate.name} Specs</h3>
                  <p className="text-[11px] text-[var(--text-ghost)]">{activeTemplate.description}</p>
                </div>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                  {filledTemplate} / {activeTemplate.fields.length}
                </span>
              </div>
              <div className="space-y-2">
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
            </div>
          )}
        </>
      )}

      {mode === "full" && !activeTemplateSlug && (
        <div className="text-center py-12 border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto mb-3 flex items-center justify-center">
            <ZapIcon className="h-6 w-6 text-[var(--text-ghost)]" />
          </div>
          <p className="text-[13px] text-[var(--text-dim)] font-medium">Select a machine type above</p>
          <p className="text-[11px] text-[var(--text-ghost)] mt-1">Template-specific fields will appear based on your selection</p>
        </div>
      )}

      {mode === "specs" && !activeTemplateSlug && (
        <div className="text-center py-12 border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto mb-3 flex items-center justify-center">
            <ZapIcon className="h-6 w-6 text-[var(--text-ghost)]" />
          </div>
          <p className="text-[13px] text-[var(--text-dim)] font-medium">Pick a machine type first</p>
          <p className="text-[11px] text-[var(--text-ghost)] mt-1">Go back to the Machine Type step to select a template before filling specs.</p>
        </div>
      )}
    </div>
  );
}
