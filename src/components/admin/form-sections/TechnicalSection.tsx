"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Plus, Check } from "lucide-react";
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
  data: Pick<ProductFormState, "hs_code" | "voltage" | "plug_types" | "watt" | "colors">;
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
  label, values, onChange, placeholder, suggestions,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
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
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><X className="h-3 w-3" /></button>
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
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {open && hasSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[200px] overflow-y-auto">
            {available.length === 0 && input.trim() ? (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors">
                <Plus className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
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
                <Plus className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
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
                <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[var(--text-dim)] hover:text-[var(--text-muted)] ml-0.5"><X className="h-3 w-3" /></button>
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
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {open && hasSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-[220px] overflow-y-auto">
            {available.length === 0 && input.trim() ? (
              <button type="button" onClick={() => add()} className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-blue-400 hover:bg-white/[0.04] transition-colors">
                <Plus className="h-3 w-3" /> Create &quot;{input.trim()}&quot;
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
        {hasSuggestions && <button type="button" onClick={() => setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-muted)]"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button>}
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
                  <Check className="h-2.5 w-2.5 text-white" />
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

export default function TechnicalSection({ data, onChange, suggestions }: Props) {
  const hasPlugCards = suggestions?.plug_types && suggestions.plug_types.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5">HS Code</label>
          <input type="text" value={data.hs_code} onChange={(e) => onChange({ hs_code: e.target.value })} placeholder="e.g. 8428.90" className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]" />
        </div>
        <WattInput value={data.watt} onChange={(v) => onChange({ watt: v })} suggestions={suggestions?.watt} />
      </div>
      <ChipInput label="Voltage Options" values={data.voltage} onChange={(v) => onChange({ voltage: v })} placeholder={suggestions?.voltage?.length ? "Select or type voltage..." : "e.g. 220V (Enter to add)"} suggestions={suggestions?.voltage} />

      {/* Plug Types — card selector if images available, otherwise chip input */}
      {hasPlugCards ? (
        <PlugTypeSelector
          values={data.plug_types}
          onChange={(v) => onChange({ plug_types: v })}
          options={suggestions!.plug_types!}
        />
      ) : (
        <ChipInput label="Plug Types" values={data.plug_types} onChange={(v) => onChange({ plug_types: v })} placeholder="e.g. Type C (Enter to add)" />
      )}

      <ColorChipInput values={data.colors} onChange={(v) => onChange({ colors: v })} suggestions={suggestions?.colors} />
    </div>
  );
}
