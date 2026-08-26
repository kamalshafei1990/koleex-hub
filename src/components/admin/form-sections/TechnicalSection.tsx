"use client";

import { useTranslation } from "@/lib/i18n";
import KdsSelect from "@/components/kds/Select";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { useState, useRef, useEffect, type ReactNode } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import DropletsIcon from "@/components/icons/ui/DropletsIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import type { ProductFormState } from "@/types/product-form";


interface Props {
  data: Pick<
    ProductFormState,
    | "hs_code"
    | "voltage"
    | "plug_types"
    | "watt"
    | "colors"
    | "motor_power_w"
    | "power_consumption_w"
    | "machine_weight_kg"
    | "machine_dimensions"
    | "ce_certified"
    | "rohs_compliant"
    | "frequency_hz"
    | "phase"
    | "ip_rating"
    | "operating_temp"
    | "oil_mist_filter"
    | "pneumatic_supply"
  >;
  onChange: (u: Partial<ProductFormState>) => void;
  /* No value-list suggestions any more — the schema is the only source for
     the electrical and appearance fields these used to feed. */
  /* Column keys the active product schema already captures (schema_specs).
     Those fields are hidden here so the operator enters them ONCE in the
     schema-driven Specs editor; they are mirrored to these columns on save.
     A card with all its fields hidden is skipped entirely. */
  hiddenFields?: Set<string>;
}

/* ── ChipInput with dropdown suggestions ── */
function ChipInput({
  label, values, onChange, placeholder, suggestions, icon,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  icon?: React.ReactNode;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const available = (suggestions || []).filter(
    s => !values.includes(s) && (!input || s.toLowerCase().includes(input.toLowerCase()))
  );

  const add = (v?: string) => {
    const val = (v || input).trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    setInput("");
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasSuggestions = suggestions && suggestions.length > 0;

  return (
    <div ref={ref}>
      {icon ? (
        <FieldLabel icon={icon}>{label}</FieldLabel>
      ) : (
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">{label}</label>
      )}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><CrossIcon className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); if (hasSuggestions) setOpen(true); }}
          onFocus={() => { if (hasSuggestions) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="w-full h-10 px-4 pr-9 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
        {hasSuggestions && (
          <button type="button" onClick={() => setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors">
            <AngleDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {open && hasSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[200px] overflow-y-auto">
            {available.length === 0 && input.trim() ? (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors">
                <PlusIcon className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
              </button>
            ) : available.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-white/25 text-center">{t("tech.allSelected", "All options selected")}</div>
            ) : (
              available.map(s => (
                <button key={s} type="button" onClick={() => add(s)} className="w-full flex items-center px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.04] hover:text-white transition-colors text-left">
                  {s}
                </button>
              ))
            )}
            {available.length > 0 && input.trim() && !available.some(s => s.toLowerCase() === input.trim().toLowerCase()) && (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors border-t border-white/[0.04]">
                <PlusIcon className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   Sub-card wrapper — visual section divider with accent + count.
   Used by the three Technical groups: Electrical / Physical / Compliance.
   ───────────────────────────────────────────────────────────────────────── */

function SubCard({
  number,
  title,
  subtitle,
  accent,
  icon,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  /* Tier color used ONLY for the digit inside the numbered badge
     and a tiny dot — never for whole-card chrome. Same language as
     the Specs page so Technical reads as part of the same hub. */
  accent: { dot: string; text: string };
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="h-9 w-9 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 relative">
          <span className={`text-[14px] font-bold tabular-nums ${accent.text}`}>{number}</span>
          {/* Tiny tier dot — the only spot of color on the card. */}
          <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${accent.dot}`} />
        </div>
        {icon && (
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-primary)]">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[11.5px] text-[var(--text-ghost)] truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

/* Field label with an inline icon chip — matches the look of the
   Specs page row labels. Use whenever a Technical field would
   benefit from a visual cue. */
function FieldLabel({ icon, children, helpText }: { icon: ReactNode; children: ReactNode; helpText?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[var(--bg-inverted)]/[0.04] text-[var(--text-muted)] shrink-0">
        {icon}
      </span>
      <label
        className="text-[12px] font-medium text-[var(--text-subtle)]"
        title={helpText}
      >
        {children}
      </label>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Number-with-unit input. Replaces the legacy free-text Watt input
   (which mixed "500W", "550 W", "0.5 kW") with a typed numeric value
   plus a fixed unit indicator inside the input.
   ───────────────────────────────────────────────────────────────────────── */

function NumberUnit({
  label,
  value,
  unit,
  placeholder,
  onChange,
  helpText,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  placeholder?: string;
  onChange: (v: string) => void;
  helpText?: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      {icon ? (
        <FieldLabel icon={icon} helpText={helpText}>{label}</FieldLabel>
      ) : (
        <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 pl-4 pr-12 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-ghost)] pointer-events-none">
          {unit}
        </span>
      </div>
      {helpText && (
        <p className="text-[10px] text-[var(--text-ghost)] mt-1">{helpText}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Compact toggle row used for boolean flags (CE / RoHS / etc.). Label
   on the left, switch on the right — reads as a settings row, not a
   form field.
   ───────────────────────────────────────────────────────────────────────── */

function ToggleRow({
  label,
  helpText,
  value,
  onChange,
  icon,
}: {
  label: string;
  helpText?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 flex items-center gap-2.5">
        {icon && (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[var(--bg-inverted)]/[0.04] text-[var(--text-muted)] shrink-0">
            {icon}
          </span>
        )}
        <div>
          <div className="text-[13px] text-[var(--text-primary)] font-medium">{label}</div>
          {helpText && (
            <div className="text-[11px] text-[var(--text-ghost)] mt-0.5">{helpText}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
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
}

export default function TechnicalSection({ data, onChange, hiddenFields }: Props) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const hidden = (k: string) => hiddenFields?.has(k) ?? false;
  const elecVisible = ["frequency_hz", "motor_power_w", "power_consumption_w", "phase", "pneumatic_supply"].some((k) => !hidden(k));
  const physVisible = ["machine_dimensions", "machine_weight_kg"].some((k) => !hidden(k));
  const compTopVisible = ["hs_code", "ip_rating", "operating_temp"].some((k) => !hidden(k));
  /* CE/RoHS moved to the dedicated Compliance & Warranty tab; only the
     oil-mist-filter toggle remains in the technical block. */
  const compTogglesVisible = ["oil_mist_filter"].some((k) => !hidden(k));
  const compVisible = compTopVisible || compTogglesVisible;

  // Per-card accents — only the digit inside the numbered badge and
  // a tiny dot get tinted. Whole-card chrome stays neutral so the
  // Technical step matches the Specs page palette and the rest of
  // the hub.
  const electricalAccent = { dot: "bg-amber-400", text: "text-amber-400" };
  const physicalAccent   = { dot: "bg-blue-400",  text: "text-blue-400"  };
  const complianceAccent = { dot: "bg-emerald-400", text: "text-emerald-400" };

  return (
    <div className="space-y-5">
      {/* ── 1. Electrical ──
            Voltage + plug types + motor power + power consumption.
            Plug types remain a card selector when admin has uploaded
            plug images, otherwise a chip input. */}
      {elecVisible && (
      <SubCard
        number={1}
        title={t("tech.secElectrical", "Electrical")}
        subtitle={t("tech.secElectricalSub", "Frequency, motor power, phase, and the air supply this machine needs")}
        accent={electricalAccent}
        icon={<ZapIcon className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voltage · Plug Types · Colors were removed here on 2026-08-25.
              They were PRODUCT-level columns for things that separate MODELS —
              a machine sold in a 220V and a 380V model has no honest single
              value — and across 272 products they held 1, 0 and 0 entries.
              The spec schema is the input now (`voltage_options`, plural, in
              _shared-machine-groups); SCHEMA_KEY_TO_COLUMN in ProductForm
              still mirrors it down to these columns on save, so every legacy
              reader keeps working. The columns were NOT dropped. */}
          {!hidden("frequency_hz") && (
          <ChipInput
            label={t("tech.frequency", "Frequency (Hz)")}
            icon={<RefreshCwIcon className="h-3.5 w-3.5" />}
            values={data.frequency_hz}
            onChange={(v) => onChange({ frequency_hz: v })}
            placeholder="e.g. 50 (Enter to add)"
            suggestions={["50", "60", "50/60"]}
          />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!hidden("motor_power_w") && (
          <NumberUnit
            label={t("tech.motorPower", "Motor Power")}
            icon={<PowerIcon className="h-3.5 w-3.5" />}
            value={data.motor_power_w}
            unit="W"
            placeholder="e.g. 550"
            onChange={(v) => onChange({ motor_power_w: v })}
            helpText="Replaces the old free-text Watt field."
          />
          )}
          {!hidden("power_consumption_w") && (
          <NumberUnit
            label={t("tech.powerConsumption", "Power Consumption")}
            icon={<GaugeIcon className="h-3.5 w-3.5" />}
            value={data.power_consumption_w}
            unit="W"
            placeholder="e.g. 600"
            onChange={(v) => onChange({ power_consumption_w: v })}
            helpText="Total draw under typical load."
          />
          )}
          {!hidden("phase") && (
          <div>
            <FieldLabel icon={<LayersIcon className="h-3.5 w-3.5" />}>{t("tech.phase", "Phase")}</FieldLabel>
            <KdsSelect
              value={data.phase}
              onChange={(v) => onChange({ phase: v })}
              options={[{ value: "single", label: t("tech.singlePhase", "Single phase") }, { value: "three", label: t("tech.threePhase", "Three phase") }]}
              placeholder="Select…"
              triggerClassName="w-full h-10 ps-4 pe-9 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors text-start"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Three phase typical for 380V industrial machines.
            </p>
          </div>
          )}
        </div>

        {/* Pneumatic supply requirement — relevant for automatic
            stations and pneumatic presser-foot lifters. Sits at
            the bottom of the Electrical card because it's a power
            requirement, not a compliance flag. */}
        {!hidden("pneumatic_supply") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]/40">
          <ToggleRow
            label={t("tech.pneumatic", "Pneumatic Supply Required")}
            icon={<ZapIcon className="h-3.5 w-3.5" />}
            helpText="Machine needs an external air-compressor line to operate."
            value={data.pneumatic_supply}
            onChange={(v) => onChange({ pneumatic_supply: v })}
          />
        </div>
        )}
      </SubCard>
      )}

      {/* ── 2. Physical (Bare Machine) ──
            Distinct from per-variant packed/shipment data which lives
            on the Models step. These describe the running machine,
            not the crate it ships in. */}
      {physVisible && (
      <SubCard
        number={2}
        title={t("tech.secPhysical", "Physical (Bare Machine)")}
        subtitle={t("tech.secPhysicalSub", "Footprint and weight of the machine itself — packed shipment data lives on the Models step")}
        accent={physicalAccent}
        icon={<RulerIcon className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!hidden("machine_dimensions") && (
          <div>
            <FieldLabel icon={<RulerIcon className="h-3.5 w-3.5" />}>
              {t("tech.machineDimsLwh", "Machine Dimensions (L × W × H)")}
            </FieldLabel>
            <input
              type="text"
              value={data.machine_dimensions}
              onChange={(e) => onChange({ machine_dimensions: e.target.value })}
              placeholder="e.g. 480 × 180 × 360 mm"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Footprint of the machine in operation. Free-text so you can use any unit / format.
            </p>
          </div>
          )}
          {!hidden("machine_weight_kg") && (
          <NumberUnit
            label={t("tech.machineWeight", "Machine Weight")}
            icon={<ScaleIcon className="h-3.5 w-3.5" />}
            value={data.machine_weight_kg}
            unit="kg"
            placeholder="e.g. 32"
            onChange={(v) => onChange({ machine_weight_kg: v })}
            helpText="Bare-head weight. Packed crate weight is per-variant on Models."
          />
          )}
        </div>
      </SubCard>
      )}

      {/* ── 3. Compliance & Customs ──
            HS code, certifications, and product colors. These either
            constrain where the product can be sold (CE, RoHS) or
            classify it for customs (HS code). Colors land here as a
            product-level visual attribute used in catalog filtering. */}
      {compVisible && (
      <SubCard
        number={3}
        title={t("tech.secCompliance", "Compliance & Customs")}
        subtitle={t("tech.secComplianceSub", "Certifications, HS classification, and environmental ratings")}
        accent={complianceAccent}
        icon={<ShieldCheckIcon className="h-4 w-4" />}
      >
        {compTopVisible && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!hidden("hs_code") && (
          <div>
            <FieldLabel icon={<HashtagIcon className="h-3.5 w-3.5" />}>{t("logistics.hsCode", "HS Code")}</FieldLabel>
            <input
              type="text"
              value={data.hs_code}
              onChange={(e) => onChange({ hs_code: e.target.value })}
              placeholder="e.g. 8452.21"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              {t("logistics.hsHint", "Harmonized System tariff code.")}
            </p>
          </div>
          )}
          {!hidden("ip_rating") && (
          <div>
            <FieldLabel icon={<DropletsIcon className="h-3.5 w-3.5" />}>{t("tech.ipRating", "IP Rating")}</FieldLabel>
            <input
              type="text"
              value={data.ip_rating}
              onChange={(e) => onChange({ ip_rating: e.target.value })}
              placeholder="e.g. IP44"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              {t("tech.ipRatingHint", "Ingress protection (dust + water).")}
            </p>
          </div>
          )}
          {!hidden("operating_temp") && (
          <div>
            <FieldLabel icon={<SparklesIcon className="h-3.5 w-3.5" />}>{t("tech.operatingTemp", "Operating Temperature")}</FieldLabel>
            <input
              type="text"
              value={data.operating_temp}
              onChange={(e) => onChange({ operating_temp: e.target.value })}
              placeholder="e.g. 0–40 °C"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              {t("tech.operatingTempHint", "Recommended operating range.")}
            </p>
          </div>
          )}
        </div>
        )}

        {compTogglesVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]/40">
          {/* CE Certified + RoHS Compliant now live on the Compliance &
              Warranty tab (ProductForm) to keep all compliance in one place. */}
          {/* Oil-mist filter — for cleanroom and light-fabric
              production. Independent of drive type so a non-air-
              purify head can still optionally have an after-market
              filter retrofit. */}
          {!hidden("oil_mist_filter") && (
          <ToggleRow
            label={t("tech.oilMist", "Oil-Mist Filter")}
            icon={<DropletsIcon className="h-3.5 w-3.5" />}
            helpText="Air-purify / mist filter — keeps oil mist out of cleanroom + light-fabric environments."
            value={data.oil_mist_filter}
            onChange={(v) => onChange({ oil_mist_filter: v })}
          />
          )}
        </div>
        )}

      </SubCard>
      )}
    </div>
  );
}
