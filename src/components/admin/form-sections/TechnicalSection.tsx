"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import DropletsIcon from "@/components/icons/ui/DropletsIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import type { ProductFormState } from "@/types/product-form";

interface PlugTypeOption {
  name: string;
  image?: string | null;
  countries?: string[];
  description?: string;
}

function countryFlag(code: string): string {
  if (code === "EU") return "\u{1F1EA}\u{1F1FA}";
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

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
  >;
  onChange: (u: Partial<ProductFormState>) => void;
  suggestions?: {
    voltage?: string[];
    plug_types?: PlugTypeOption[];
    colors?: string[];
    watt?: string[];
  };
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[200px] overflow-y-auto">
            {available.length === 0 && input.trim() ? (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors">
                <PlusIcon className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
              </button>
            ) : available.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-white/25 text-center">All options selected</div>
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

/* ── Named color → hex mapping for visual swatches ── */
const NAMED_COLOR_HEX: Record<string, string> = {
  white: "#ffffff", ivory: "#fffff0", cream: "#fffdd0", beige: "#f5f5dc", champagne: "#f7e7ce",
  black: "#0a0a0a", graphite: "#1a1a1a", charcoal: "#36454f", gray: "#808080", grey: "#808080", silver: "#c0c0c0",
  red: "#dc2626", crimson: "#dc143c", maroon: "#800000", burgundy: "#800020",
  orange: "#f97316", amber: "#f59e0b", yellow: "#eab308", gold: "#d4af37",
  green: "#16a34a", emerald: "#10b981", olive: "#808000", lime: "#84cc16", teal: "#14b8a6",
  blue: "#2563eb", navy: "#000080", "royal blue": "#4169e1", cyan: "#06b6d4", sky: "#0ea5e9",
  purple: "#9333ea", violet: "#7c3aed", indigo: "#4f46e5", magenta: "#d946ef", pink: "#ec4899", rose: "#e11d48",
  brown: "#78350f", tan: "#d2b48c", khaki: "#c3b091", bronze: "#cd7f32", copper: "#b87333",
};

function colorToSwatch(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  if (NAMED_COLOR_HEX[v]) return NAMED_COLOR_HEX[v];
  // two-word fallback (e.g. "matte black" → "black")
  const parts = v.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (NAMED_COLOR_HEX[parts[i]]) return NAMED_COLOR_HEX[parts[i]];
  }
  return null;
}

/* ── ColorChipInput with visual swatches ── */
function ColorChipInput({
  values, onChange, suggestions,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
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
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Colors</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => {
            const swatch = colorToSwatch(v);
            return (
              <span key={v} className="inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                <span
                  className="h-5 w-5 rounded-full border border-white/10 shadow-inner shrink-0"
                  style={{ background: swatch || "linear-gradient(135deg,#333,#555)" }}
                  title={swatch || "unknown color"}
                />
                {v}
                <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)] ml-0.5"><CrossIcon className="h-3 w-3" /></button>
              </span>
            );
          })}
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
          placeholder={hasSuggestions ? "Select or type color..." : "e.g. Silver (Enter to add)"}
          className="w-full h-10 px-4 pr-9 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
        {input && colorToSwatch(input) && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border border-white/10 hidden"
            style={{ background: colorToSwatch(input)! }}
          />
        )}
        {hasSuggestions && (
          <button type="button" onClick={() => setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors">
            <AngleDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {open && hasSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[220px] overflow-y-auto">
            {available.length === 0 && input.trim() ? (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors">
                <PlusIcon className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
              </button>
            ) : available.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-white/25 text-center">All options selected</div>
            ) : (
              available.map(s => {
                const sw = colorToSwatch(s);
                return (
                  <button key={s} type="button" onClick={() => add(s)} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.04] hover:text-white transition-colors text-left">
                    <span
                      className="h-4 w-4 rounded-full border border-white/10 shrink-0"
                      style={{ background: sw || "linear-gradient(135deg,#333,#555)" }}
                    />
                    {s}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Watt dropdown ── */
function WattInput({ value, onChange, suggestions }: { value: string; onChange: (v: string) => void; suggestions?: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const available = (suggestions || []).filter(s => !value || s.toLowerCase().includes(value.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasSuggestions = suggestions && suggestions.length > 0;

  return (
    <div ref={ref}>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">Watt</label>
      <div className="relative">
        <input type="text" value={value} onChange={(e) => { onChange(e.target.value); if (hasSuggestions) setOpen(true); }} onFocus={() => { if (hasSuggestions) setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} placeholder="e.g. 500W" className="w-full h-10 px-4 pr-9 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]" />
        {hasSuggestions && <button type="button" onClick={() => setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-muted)]"><AngleDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button>}
        {open && hasSuggestions && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[200px] overflow-y-auto">
            {available.map(s => <button key={s} type="button" onClick={() => { onChange(s); setOpen(false); }} className="w-full flex items-center px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.04] hover:text-white transition-colors text-left">{s}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Plug Type Card Selector ── */
function PlugTypeSelector({
  values, onChange, options,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: PlugTypeOption[];
}) {
  const toggle = (name: string) => {
    if (values.includes(name)) onChange(values.filter(v => v !== name));
    else onChange([...values, name]);
  };

  if (!options.length) return null;

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-2">Plug Types</label>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {options.map(opt => {
          const selected = values.includes(opt.name);
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => toggle(opt.name)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer
                ${selected
                  ? "border-blue-500 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.03] hover:border-[var(--border-focus)] hover:bg-[var(--bg-inverted)]/[0.06]"
                }`}
            >
              {selected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <CheckIcon className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              {opt.image ? (
                <div className="w-14 h-14 flex items-center justify-center overflow-hidden">
                  <img src={opt.image} alt={opt.name} className="plug-icon w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                  <span className="text-[16px] font-bold text-[var(--text-dim)]">{opt.name.replace("Type ", "")}</span>
                </div>
              )}
              <span className={`text-[10px] font-bold ${selected ? "text-blue-400" : "text-[var(--text-dim)]"}`}>
                {opt.name}
              </span>
              {opt.countries && opt.countries.length > 0 && (
                <div className="flex items-center gap-0.5 flex-wrap justify-center">
                  {opt.countries.slice(0, 4).map(c => <span key={c} className="text-[10px] leading-none">{countryFlag(c)}</span>)}
                </div>
              )}
            </button>
          );
        })}
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
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
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

export default function TechnicalSection({ data, onChange, suggestions }: Props) {
  const hasPlugCards = suggestions?.plug_types && suggestions.plug_types.length > 0;

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
      <SubCard
        number={1}
        title="Electrical"
        subtitle="Voltage, frequency, motor power, phase, and the plug types this product ships with"
        accent={electricalAccent}
        icon={<ZapIcon className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChipInput
            label="Voltage Options"
            icon={<ZapIcon className="h-3.5 w-3.5" />}
            values={data.voltage}
            onChange={(v) => onChange({ voltage: v })}
            placeholder={suggestions?.voltage?.length ? "Select or type voltage..." : "e.g. 220V (Enter to add)"}
            suggestions={suggestions?.voltage}
          />
          <ChipInput
            label="Frequency (Hz)"
            icon={<RefreshCwIcon className="h-3.5 w-3.5" />}
            values={data.frequency_hz}
            onChange={(v) => onChange({ frequency_hz: v })}
            placeholder="e.g. 50 (Enter to add)"
            suggestions={["50", "60", "50/60"]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberUnit
            label="Motor Power"
            icon={<PowerIcon className="h-3.5 w-3.5" />}
            value={data.motor_power_w}
            unit="W"
            placeholder="e.g. 550"
            onChange={(v) => onChange({ motor_power_w: v })}
            helpText="Replaces the old free-text Watt field."
          />
          <NumberUnit
            label="Power Consumption"
            icon={<GaugeIcon className="h-3.5 w-3.5" />}
            value={data.power_consumption_w}
            unit="W"
            placeholder="e.g. 600"
            onChange={(v) => onChange({ power_consumption_w: v })}
            helpText="Total draw under typical load."
          />
          <div>
            <FieldLabel icon={<LayersIcon className="h-3.5 w-3.5" />}>Phase</FieldLabel>
            <select
              value={data.phase}
              onChange={(e) => onChange({ phase: e.target.value })}
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="">Select…</option>
              <option value="single">Single phase</option>
              <option value="three">Three phase</option>
            </select>
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Three phase typical for 380V industrial machines.
            </p>
          </div>
        </div>
        {hasPlugCards ? (
          <PlugTypeSelector
            values={data.plug_types}
            onChange={(v) => onChange({ plug_types: v })}
            options={suggestions!.plug_types!}
          />
        ) : (
          <ChipInput
            label="Plug Types"
            icon={<BadgeCheckIcon className="h-3.5 w-3.5" />}
            values={data.plug_types}
            onChange={(v) => onChange({ plug_types: v })}
            placeholder="e.g. Type C (Enter to add)"
          />
        )}
      </SubCard>

      {/* ── 2. Physical (Bare Machine) ──
            Distinct from per-variant packed/shipment data which lives
            on the Models step. These describe the running machine,
            not the crate it ships in. */}
      <SubCard
        number={2}
        title="Physical (Bare Machine)"
        subtitle="Footprint and weight of the machine itself — packed shipment data lives on the Models step"
        accent={physicalAccent}
        icon={<RulerIcon className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel icon={<RulerIcon className="h-3.5 w-3.5" />}>
              Machine Dimensions (L × W × H)
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
          <NumberUnit
            label="Machine Weight"
            icon={<ScaleIcon className="h-3.5 w-3.5" />}
            value={data.machine_weight_kg}
            unit="kg"
            placeholder="e.g. 32"
            onChange={(v) => onChange({ machine_weight_kg: v })}
            helpText="Bare-head weight. Packed crate weight is per-variant on Models."
          />
        </div>
      </SubCard>

      {/* ── 3. Compliance & Customs ──
            HS code, certifications, and product colors. These either
            constrain where the product can be sold (CE, RoHS) or
            classify it for customs (HS code). Colors land here as a
            product-level visual attribute used in catalog filtering. */}
      <SubCard
        number={3}
        title="Compliance & Customs"
        subtitle="Certifications, HS classification, environmental ratings, and visual attributes"
        accent={complianceAccent}
        icon={<ShieldCheckIcon className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel icon={<HashtagIcon className="h-3.5 w-3.5" />}>HS Code</FieldLabel>
            <input
              type="text"
              value={data.hs_code}
              onChange={(e) => onChange({ hs_code: e.target.value })}
              placeholder="e.g. 8452.21"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Harmonized System tariff code.
            </p>
          </div>
          <div>
            <FieldLabel icon={<DropletsIcon className="h-3.5 w-3.5" />}>IP Rating</FieldLabel>
            <input
              type="text"
              value={data.ip_rating}
              onChange={(e) => onChange({ ip_rating: e.target.value })}
              placeholder="e.g. IP44"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Ingress protection (dust + water).
            </p>
          </div>
          <div>
            <FieldLabel icon={<SparklesIcon className="h-3.5 w-3.5" />}>Operating Temperature</FieldLabel>
            <input
              type="text"
              value={data.operating_temp}
              onChange={(e) => onChange({ operating_temp: e.target.value })}
              placeholder="e.g. 0–40 °C"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Recommended operating range.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]/40">
          <ToggleRow
            label="CE Certified"
            icon={<BadgeCheckIcon className="h-3.5 w-3.5" />}
            helpText="Required for sale in the European Economic Area."
            value={data.ce_certified}
            onChange={(v) => onChange({ ce_certified: v })}
          />
          <ToggleRow
            label="RoHS Compliant"
            icon={<AwardIcon className="h-3.5 w-3.5" />}
            helpText="EU restriction on hazardous substances in electronics."
            value={data.rohs_compliant}
            onChange={(v) => onChange({ rohs_compliant: v })}
          />
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)]/40">
          <ColorChipInput
            values={data.colors}
            onChange={(v) => onChange({ colors: v })}
            suggestions={suggestions?.colors}
          />
        </div>
      </SubCard>
    </div>
  );
}
