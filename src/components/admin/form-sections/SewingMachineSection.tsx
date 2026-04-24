"use client";

import { useMemo, useEffect, useState } from "react";
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
} from "@/lib/sewing-machine-templates";
import {
  getKindsForSubcategory,
  getKindBySlug,
  type MachineKind,
} from "@/lib/machine-kinds";
import {
  resolveSpecs,
  hasNewSpecSystem,
  SpecGlyph,
  getFieldGlyph,
  getGroupGlyph,
  getCardGlyph,
  type SpecCard as NewSpecCard,
  type SpecField as NewSpecField,
} from "@/lib/machine-specs";

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

/* ─────────────────────────────────────────────────────────────────────────
   FrequencyDots — 3-dot priority cue next to a field label.

   Maps the spec tier to a "how common is this on real machines" hint:
     · essential   → ●●●  (very common — almost every product has this)
     · recommended → ●●○  (common — fill if you have the data)
     · advanced    → ●○○  (rare / niche — only if it matters)

   Renders nothing for legacy templates (no tier) so the form stays
   visually quiet for products outside the new three-tier system.
   ───────────────────────────────────────────────────────────────────────── */

function FrequencyDots({ tier }: { tier?: "essential" | "recommended" | "advanced" }) {
  if (!tier) return null;
  const filled = tier === "essential" ? 3 : tier === "recommended" ? 2 : 1;
  const tip =
    tier === "essential"
      ? "Very common — fill first"
      : tier === "recommended"
      ? "Common — nice to have"
      : "Rare / niche";
  return (
    <span
      className="inline-flex items-center gap-[1.5px] mr-1 align-middle shrink-0"
      title={tip}
      aria-label={tip}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`block h-1 w-1 rounded-full ${
            i < filled ? "bg-amber-400" : "bg-amber-400/15"
          }`}
        />
      ))}
    </span>
  );
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

  /* Shared label renderer. Three priority cues sit before the label
     itself:
       · 3-dot frequency badge (●●● / ●●○ / ●○○)  — how common is
         this spec in real machines? Pulled from `field.tier`.
       · Red asterisk — required field.
     Number fields still append the unit in parens at the end. The
     dots only appear for fields in the new three-tier spec system;
     legacy templates leave `tier` undefined and render unbadged. */
  const renderLabel = (withUnit: boolean) => (
    <label className={lbl}>
      <FrequencyDots tier={field.tier} />
      {field.label}
      {field.required && (
        <span className="text-red-400 ml-0.5" aria-label="required">*</span>
      )}
      {withUnit && field.unit && (
        <span className="text-[var(--text-ghost)] ml-1">({field.unit})</span>
      )}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div>
          {renderLabel(true)}
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
          {renderLabel(true)}
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
          {renderLabel(false)}
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
          {renderLabel(false)}
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
            <span className="text-[12px] text-[var(--text-muted)] inline-flex items-center">
              <FrequencyDots tier={field.tier} />
              <span>{field.label}</span>
              {field.required && (
                <span className="text-red-400 ml-0.5" aria-label="required">*</span>
              )}
            </span>
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

/* ── Machine Kind Picker ──
       Lists every kind that belongs to the product's subcategory
       (e.g. Lockstitch → Walking-Foot, Long-Arm, Cylinder-Bed, ...).
       Each card renders its custom SVG icon from the machine-kinds
       catalog. Selecting a kind implicitly chooses the spec template
       that will drive the Specs step. */
function MachineKindPicker({
  kinds,
  selectedKindSlug,
  onSelect,
  subcategorySlug,
}: {
  kinds: MachineKind[];
  selectedKindSlug: string;
  onSelect: (kind: MachineKind) => void;
  subcategorySlug: string;
}) {
  const heading = subcategorySlug
    ? "Which kind of machine?"
    : "Sewing Machine Type";
  const sub = subcategorySlug
    ? "Pick the specific machine kind. Spec fields are auto-driven by the template behind this choice."
    : "Pick a subcategory first — or choose any kind from the full list below.";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{heading}</h3>
          <p className="text-[11px] text-[var(--text-ghost)] mt-0.5">{sub}</p>
        </div>
        <span className="text-[10px] font-medium text-[var(--text-ghost)] uppercase tracking-wider">
          {kinds.length} {kinds.length === 1 ? "option" : "options"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {kinds.map((k) => {
          const isSelected = selectedKindSlug === k.slug;
          const Icon = k.icon;
          return (
            <button
              key={k.slug}
              type="button"
              onClick={() => onSelect(k)}
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
              <Icon
                size={30}
                className={`mt-1 mb-1 transition-colors ${
                  isSelected
                    ? "text-blue-400"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                }`}
              />
              <span
                className={`text-[11px] font-bold text-center leading-tight ${
                  isSelected ? "text-blue-400" : "text-[var(--text-dim)] group-hover:text-[var(--text-primary)]"
                }`}
              >
                {k.name}
              </span>
              <span className="text-[9px] text-[var(--text-ghost)] text-center line-clamp-2 leading-snug">
                {k.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SpecRowControl — the input-only half of a dense spec row.

   Separated from the label so the row layout can pair
   [label | dots | * | (?)] on the left with just the control on the
   right. Shares field-type handling with the classic FieldRenderer
   but skips labels/help-text — those are rendered by SpecRow.
   ═══════════════════════════════════════════════════════════════════════════ */

function SpecRowControl({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inp =
    "w-full h-9 px-3 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";

  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inp}
        />
      );

    case "number":
      return (
        <div className="relative">
          <input
            type="number"
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : "")}
            placeholder={field.placeholder}
            step={field.step}
            min={field.min}
            max={field.max}
            className={`${inp} ${field.unit ? "pr-11" : ""}`}
          />
          {field.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-ghost)] pointer-events-none">
              {field.unit}
            </span>
          )}
        </div>
      );

    case "select":
      return (
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        >
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "multi-select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
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
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer
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
      );
    }

    case "boolean":
      return (
        <div className="flex justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => onChange(!value)}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${
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

/* ═══════════════════════════════════════════════════════════════════════════
   SpecRow — one dense horizontal row: [dots · label · * · (?)  |  control]

   Tuned for power data entry: one row per field, ~40px tall, help
   text collapses to a (?) tooltip so nothing bloats vertical rhythm.
   Hover highlights the whole row so the eye can track label→input.
   ═══════════════════════════════════════════════════════════════════════════ */

function SpecRow({
  field,
  value,
  onChange,
  filled,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (v: unknown) => void;
  filled: boolean;
}) {
  const isBoolean = field.type === "boolean";
  const isMulti = field.type === "multi-select";
  // Boolean rows pull the switch next to the label for a tight 1-line look.
  // Multi-select and everything else use the standard 2-col grid with a
  // consistent 240px label column so inputs vertically align across cards.
  return (
    <div
      className={`group grid ${
        isBoolean
          ? "grid-cols-[1fr_auto]"
          : "grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]"
      } gap-x-5 gap-y-1.5 items-center px-4 py-2.5 border-b border-[var(--border-subtle)]/20 last:border-b-0 hover:bg-[var(--bg-inverted)]/[0.02] transition-colors`}
    >
      {/* Label cell */}
      <div className="flex items-center gap-1.5 min-w-0">
        <SpecGlyph
          name={getFieldGlyph(field.key)}
          size={14}
          className={`shrink-0 ${
            filled ? "text-[var(--text-muted)]" : "text-[var(--text-ghost)]"
          }`}
        />
        <FrequencyDots tier={field.tier} />
        <span
          className={`text-[12.5px] ${
            filled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
          } ${field.required ? "font-semibold" : "font-medium"} truncate`}
          title={field.helpText}
        >
          {field.label}
        </span>
        {field.required && (
          <span className="text-red-400 text-[12px] shrink-0 leading-none" aria-label="required">
            *
          </span>
        )}
        {!isBoolean && field.unit && field.type !== "number" && (
          <span className="text-[10px] text-[var(--text-ghost)] shrink-0">({field.unit})</span>
        )}
        {field.helpText && (
          <span
            className="inline-flex shrink-0 ml-auto"
            title={field.helpText}
            aria-label={field.helpText}
          >
            <InfoIcon className="h-3 w-3 text-[var(--text-ghost)] hover:text-[var(--text-muted)] cursor-help transition-colors" />
          </span>
        )}
      </div>

      {/* Control cell. Multi-select can wrap into multi-line, so let
          the row expand — alignment stays clean because items-center
          centers the label to the (taller) control block. */}
      <div className={isMulti ? "self-start pt-1" : ""}>
        <SpecRowControl field={field} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SpecRowGroup — a collapsible section inside a card.

   Header mimics the catalog reference: thin uppercase label on the
   left, horizontal rule, count on the right, chevron toggles collapse.
   When collapsed, rows unmount — freeing scroll space once the admin
   has finished a section.
   ═══════════════════════════════════════════════════════════════════════════ */

function SpecRowGroup({
  group,
  fields,
  values,
  onChange,
  collapsed,
  onToggleCollapse,
}: {
  group: string;
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const filledCount = fields.filter((f) => {
    const v = values[f.key];
    return v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
  }).length;
  const allFilled = filledCount === fields.length;

  return (
    <div className="mb-1 last:mb-0">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2.5 px-4 pt-4 pb-2 group/header cursor-pointer"
        aria-expanded={!collapsed}
      >
        <SpecGlyph
          name={getGroupGlyph(group)}
          size={14}
          className="shrink-0 text-[var(--text-faint)]"
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]">
          {group}
        </span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]/40" />
        <span
          className={`text-[10px] font-semibold tabular-nums shrink-0 ${
            allFilled ? "text-emerald-400" : "text-[var(--text-ghost)]"
          }`}
        >
          {filledCount}/{fields.length}
        </span>
        <AngleDownIconLocal
          className={`h-3 w-3 text-[var(--text-ghost)] shrink-0 transition-all opacity-0 group-hover/header:opacity-100 ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
      </button>
      {!collapsed && (
        <div>
          {fields.map((field) => {
            const v = values[field.key];
            const filled =
              v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
            return (
              <SpecRow
                key={field.key}
                field={field}
                value={v}
                onChange={(val) => onChange(field.key, val)}
                filled={filled}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SpecCardRenderer — renders one three-tier card (Common / Family / Kind)

   Rewritten for data-entry density. Uses SpecRowGroup (collapsible,
   thin header) + SpecRow (1-line field) instead of the old grid
   panels. Honors the `requiredOnly` prop to hide non-required fields
   in bulk, and the `showAdvanced` toggle to surface the rare fields.
   ═══════════════════════════════════════════════════════════════════════════ */

function SpecCardRenderer({
  card,
  values,
  onChange,
  accentText,
  accentEdge,
  stepNumber,
  anchorId,
  requiredOnly,
}: {
  card: NewSpecCard;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /* Tier color used ONLY for the digit inside the numbered badge
     and the small dot — never for whole-card chrome. Keeps the page
     visually quiet while still cueing common / family / kind. */
  accentText: string;
  /* Tier color for the tiny dot on the numbered badge. */
  accentEdge: string;
  stepNumber: number;
  anchorId: string;
  requiredOnly: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) =>
    setCollapsed((c) => ({ ...c, [group]: !c[group] }));

  /* Required-only filter trumps everything — when active, only
     required fields render, regardless of tier. Otherwise, tier
     "essential"+"recommended" show by default; "advanced" hides
     behind the toggle. */
  const filterFn = requiredOnly
    ? (f: NewSpecField) => !!f.required
    : (f: NewSpecField) => f.tier !== "advanced";

  const visibleFields = card.fields.filter(filterFn);
  const advancedFields = requiredOnly
    ? []
    : card.fields.filter((f) => f.tier === "advanced");

  /* Group fields by their `group` attribute, preserving field order. */
  const groupFieldsByHeading = (fields: NewSpecField[]) => {
    const groups: { group: string; fields: NewSpecField[] }[] = [];
    const map = new Map<string, NewSpecField[]>();
    for (const f of fields) {
      const g = f.group || "General";
      if (!map.has(g)) {
        map.set(g, []);
        groups.push({ group: g, fields: map.get(g)! });
      }
      map.get(g)!.push(f);
    }
    return groups;
  };

  const visibleGroups = groupFieldsByHeading(visibleFields);
  const advancedGroups = groupFieldsByHeading(advancedFields);

  // Fill counter — helps admins see progress per card at a glance.
  const filled = card.fields.filter((f) => {
    const v = values[f.key];
    return v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
  }).length;

  const hasAnyVisible = visibleGroups.some((g) => g.fields.length > 0);

  return (
    <div
      id={anchorId}
      className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden scroll-mt-28"
    >
      {/* Header — numbered step badge + card icon + title + subtitle
          + fill counter. Layout matches the rest of the hub: neutral
          chrome with one small tier dot. The single colored mark is
          the digit inside the numbered badge — keeps the tier
          identity readable without flooding the page with green/blue/
          violet. */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="h-7 w-7 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 relative">
          <span className={`text-[12px] font-bold tabular-nums ${accentText}`}>{stepNumber}</span>
          {/* Tiny tier dot — the only spot of color on the card. */}
          <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${accentEdge}`} />
        </div>
        <div className="h-7 w-7 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
          <SpecGlyph
            name={getCardGlyph(card.source)}
            size={14}
            className="text-[var(--text-muted)]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">{card.title}</h3>
          {card.subtitle && (
            <p className="text-[11px] text-[var(--text-ghost)] truncate mt-0.5">{card.subtitle}</p>
          )}
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] tabular-nums shrink-0 text-[var(--text-muted)]">
          {filled} / {card.fields.length}
        </span>
      </div>

      {/* Groups */}
      <div className="px-2 py-2">
        {!hasAnyVisible && (
          <p className="text-center py-8 text-[11px] text-[var(--text-ghost)]">
            {requiredOnly
              ? "No required fields in this section."
              : "No fields available."}
          </p>
        )}
        {visibleGroups.map((g) => (
          <SpecRowGroup
            key={g.group}
            group={g.group}
            fields={g.fields as unknown as TemplateField[]}
            values={values}
            onChange={onChange}
            collapsed={!!collapsed[g.group]}
            onToggleCollapse={() => toggleGroup(g.group)}
          />
        ))}
      </div>

      {/* Advanced — only when the card has advanced fields AND we're
          not already in required-only mode. */}
      {advancedGroups.length > 0 && (
        <div className="px-5 pb-4 pt-2 border-t border-[var(--border-subtle)]/60">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors"
          >
            <AngleDownIconLocal className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Hide advanced" : `Show advanced (${advancedFields.length})`}
          </button>
          {showAdvanced && (
            <div className="mt-2">
              {advancedGroups.map((g) => (
                <SpecRowGroup
                  key={g.group}
                  group={g.group}
                  fields={g.fields as unknown as TemplateField[]}
                  values={values}
                  onChange={onChange}
                  collapsed={!!collapsed[g.group]}
                  onToggleCollapse={() => toggleGroup(g.group)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Tiny local angle-down icon so we don't add another import for one
   usage inside the progressive-disclosure toggle. */
function AngleDownIconLocal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SpecsProgressBar — sticky step-level progress

   Three thin segmented bars (Common / Family / Kind) plus an overall
   "X / N fields filled" counter. Sticks to the top of the Specs step
   so admins always know how much is left, regardless of which card
   they're scrolled to.

   Color matches each card's accent (emerald / blue / violet) so the
   bars and the cards read as the same system.
   ═══════════════════════════════════════════════════════════════════════════ */

function SpecsProgressBar({
  cards,
  data,
  requiredOnly,
  onToggleRequiredOnly,
  onJump,
}: {
  cards: NewSpecCard[];
  data: SewingSpecsFormState;
  requiredOnly: boolean;
  onToggleRequiredOnly: () => void;
  onJump: (idx: number) => void;
}) {
  // One stat row per card. Pulls values from the right bucket since
  // common saves to common_specs and family/kind save to template_specs.
  const stats = cards.map((card) => {
    const isCommon = card.source === "common";
    const values = isCommon ? data.common_specs : data.template_specs;
    const filled = card.fields.filter((f) => {
      const v = values[f.key];
      return (
        v !== "" && v !== null && v !== undefined &&
        !(Array.isArray(v) && v.length === 0)
      );
    }).length;
    const total = card.fields.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const fill =
      card.source === "common"
        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
        : card.source === "family"
        ? "bg-gradient-to-r from-blue-500 to-blue-400"
        : "bg-gradient-to-r from-violet-500 to-violet-400";
    const text =
      card.source === "common"
        ? "text-emerald-400"
        : card.source === "family"
        ? "text-blue-400"
        : "text-violet-400";
    return { label: card.title, filled, total, pct, fill, text, source: card.source };
  });

  const totalFilled = stats.reduce((a, s) => a + s.filled, 0);
  const totalFields = stats.reduce((a, s) => a + s.total, 0);
  const overallPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

  const dotColor = (source: "common" | "family" | "kind") =>
    source === "common" ? "bg-emerald-400" : source === "family" ? "bg-blue-400" : "bg-violet-400";

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1">
      <div className="bg-[var(--bg-primary)]/92 backdrop-blur-md border border-[var(--border-subtle)] rounded-2xl px-5 py-3.5 shadow-sm">
        {/* Header row — overall progress + required-only toggle.
            Neutral palette throughout; the only colored marks are
            the small tier dots in the card rows below. */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-faint)]">
              Specs progress
            </span>
            <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
              {overallPct}%
            </span>
            <span className="text-[11px] text-[var(--text-ghost)] tabular-nums truncate">
              · {totalFilled} of {totalFields} fields
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleRequiredOnly}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
              requiredOnly
                ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                : "bg-[var(--bg-inverted)]/[0.03] border-[var(--border-subtle)] text-[var(--text-ghost)] hover:border-[var(--border-focus)] hover:text-[var(--text-muted)]"
            }`}
            title="Show only required fields"
          >
            <span className="text-red-400/80 text-[11px] leading-none">*</span>
            Required only
          </button>
        </div>

        {/* One compact row per card — tier dot, label, bar, X/Y. The
            whole row is a jump link to that card's anchor. */}
        <div className="space-y-2">
          {stats.map((s, idx) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onJump(idx)}
              className="group w-full grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1 hover:bg-[var(--bg-inverted)]/[0.03] transition-colors cursor-pointer"
              title={`Jump to ${s.label}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor(s.source)}`} />
                <span className="text-[11px] font-semibold text-[var(--text-muted)] truncate text-left">
                  {s.label}
                </span>
              </div>
              <div className="h-1 rounded-full bg-[var(--bg-inverted)]/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--text-muted)]/40 transition-all duration-300"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-ghost)] tabular-nums shrink-0 group-hover:text-[var(--text-dim)] transition-colors">
                {s.filled}/{s.total}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NewSpecsRender — three-tier renderer (Common / Family / Kind)

   Resolves the card stack via `resolveSpecs(subcategory, kind)`, then
   renders one SpecCardRenderer per card with the right save target:

     · source === "common" → writes to data.common_specs
     · source === "family" or "kind" → writes to data.template_specs

   Storage keeps the existing two-bucket schema. The new family/kind
   field keys are namespaced (ls_*, wf_*, hd_*, ...) so they never
   collide with old-template keys still living in template_specs.
   ═══════════════════════════════════════════════════════════════════════════ */

function NewSpecsRender({
  subcategorySlug,
  activeKindSlug,
  data,
  handleCommonChange,
  handleTemplateSpecChange,
}: {
  subcategorySlug: string;
  activeKindSlug: string;
  data: SewingSpecsFormState;
  handleCommonChange: (key: string, value: unknown) => void;
  handleTemplateSpecChange: (key: string, value: unknown) => void;
}) {
  const resolved = useMemo(
    () => resolveSpecs(subcategorySlug, activeKindSlug),
    [subcategorySlug, activeKindSlug]
  );

  const [requiredOnly, setRequiredOnly] = useState(false);

  if (!resolved) return null;

  /* Tier color maps. Used ONLY for the small digit inside the
     numbered badge and the tiny tier dot — never for whole-card
     chrome. The page stays neutral with the rest of the hub; the
     three-tier identity comes through the icon, the title, and the
     subtle dot. */
  const accentTextFor = (card: NewSpecCard) => {
    if (card.source === "common") return "text-emerald-400";
    if (card.source === "family") return "text-blue-400";
    return "text-violet-400";
  };

  const accentEdgeFor = (card: NewSpecCard) => {
    if (card.source === "common") return "bg-emerald-400";
    if (card.source === "family") return "bg-blue-400";
    return "bg-violet-400";
  };

  const anchorIdFor = (card: NewSpecCard, idx: number) =>
    `specs-card-${card.source}-${idx}`;

  // Jump handler — scroll the card's DOM anchor into view. Uses
  // scroll-mt on the card root so the sticky progress bar doesn't
  // cover it after the jump lands.
  const handleJump = (idx: number) => {
    const card = resolved.cards[idx];
    if (!card) return;
    const el = document.getElementById(anchorIdFor(card, idx));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      {/* Sticky progress bar with jump-nav chips + required-only toggle. */}
      <SpecsProgressBar
        cards={resolved.cards}
        data={data}
        requiredOnly={requiredOnly}
        onToggleRequiredOnly={() => setRequiredOnly((v) => !v)}
        onJump={handleJump}
      />

      {resolved.cards.map((card, idx) => {
        const isCommon = card.source === "common";
        const values = isCommon ? data.common_specs : data.template_specs;
        const onChange = isCommon ? handleCommonChange : handleTemplateSpecChange;
        return (
          <SpecCardRenderer
            key={`${card.source}-${idx}`}
            card={card}
            values={values}
            onChange={onChange}
            accentText={accentTextFor(card)}
            accentEdge={accentEdgeFor(card)}
            stepNumber={idx + 1}
            anchorId={anchorIdFor(card, idx)}
            requiredOnly={requiredOnly}
          />
        );
      })}
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

  /* The "kind" is the specific sub-type the admin chose (e.g.
     "lockstitch-walking-foot"). Stored inside common_specs under the
     conventional `machine_kind` key so no schema change is needed.
     A kind implies a spec template — when the kind changes, we
     propagate that to template_slug so the Specs step renders the
     right fields. */
  const activeKindSlug =
    (data.common_specs?.machine_kind as string | undefined) || "";
  const activeKind = useMemo(
    () => (activeKindSlug ? getKindBySlug(activeKindSlug) : null),
    [activeKindSlug]
  );

  const kindsForSubcategory = useMemo(
    () => getKindsForSubcategory(subcategorySlug),
    [subcategorySlug]
  );

  const activeTemplateSlug =
    data.template_slug || activeKind?.templateSlug || detectedTemplate?.slug || "";

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

  /* Kind click handler. Persists the machine kind slug inside
     common_specs.machine_kind AND aligns template_slug with the
     kind's implied template. If the template changed, wipe the
     template-specific spec values so the admin doesn't carry over
     numbers that don't apply to the new field shape. */
  const handleKindChange = (kind: MachineKind) => {
    const templateChanged = kind.templateSlug !== data.template_slug;
    onChange({
      ...data,
      template_slug: kind.templateSlug,
      template_specs: templateChanged ? {} : data.template_specs,
      common_specs: {
        ...data.common_specs,
        machine_kind: kind.slug,
      },
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
      {/* Machine Kind Picker — shown in "full" and "template" modes */}
      {(mode === "full" || mode === "template") && (
        <MachineKindPicker
          kinds={kindsForSubcategory}
          selectedKindSlug={activeKindSlug}
          onSelect={handleKindChange}
          subcategorySlug={subcategorySlug}
        />
      )}

      {mode === "template" && !activeKindSlug && (
        <div className="text-center py-8 border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface-subtle)]/30">
          <p className="text-[12px] text-[var(--text-dim)]">Pick a machine kind to unlock its spec fields in the next step.</p>
        </div>
      )}

      {mode === "template" && activeKind && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <activeKind.icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{activeKind.name}</div>
            <div className="text-[11px] text-[var(--text-ghost)] truncate">{activeKind.description}</div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Selected</span>
        </div>
      )}

      {/* Specs fields — shown in "full" and "specs" modes.
          Two paths:
            1. New three-tier system (Common + Family + optional Kind)
               for subcategories registered in machine-specs/resolver.
            2. Legacy Common + Template layout for everything else,
               kept as-is until each family is ported. */}
      {(mode === "full" || mode === "specs") && activeTemplateSlug && (
        <>
          {hasNewSpecSystem(subcategorySlug) ? (
            <NewSpecsRender
              subcategorySlug={subcategorySlug}
              activeKindSlug={activeKindSlug}
              data={data}
              handleCommonChange={handleCommonChange}
              handleTemplateSpecChange={handleTemplateSpecChange}
            />
          ) : (
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
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      {activeKind ? <activeKind.icon size={18} /> : <Settings2Icon className="h-4 w-4" />}
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
