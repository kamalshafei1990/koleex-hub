"use client";

/* Shared helpers for the product page's sections (redesign 19/09/2026).
 * Pure value formatting, the knowledge-list reader, and the spec glyph
 * lookup. Nothing here fetches product data; the loader did that.
 */
import { useCallback, useEffect, useState } from "react";
import type { ProductKnowledgeBlock, SpecField } from "@/types/product-schema";
import { fetchIconBindings, type BindingsMap } from "@/lib/visual-bindings";

export const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

export const labelForOption = (field: SpecField, optionValue: string): string =>
  field.options?.find((o) => o.value === optionValue)?.label ?? optionValue;

export const selectedValuesOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? (raw as unknown[]).map((v) => String(v)) : typeof raw === "string" && raw ? [raw] : [];

export const displayScalar = (raw: unknown): string =>
  Array.isArray(raw) ? raw.map((v) => String(v)).join(", ") : String(raw);

export const fileNameFromUrl = (url: string): string => {
  try {
    const path = url.split("?")[0].split("#")[0];
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url;
  } catch {
    return url;
  }
};

export const asKnowledgeList = (content: ProductKnowledgeBlock["content"] | undefined): string[] => {
  if (Array.isArray(content)) return content.map((c) => String(c)).filter((s) => s.trim());
  if (typeof content === "string") return content.trim() ? [content] : [];
  return [];
};

/** One display rule for a spec value — the sheet, the key figures, the
 *  family table and the compare block all read through it. */
export function formatSpecValue(f: SpecField | undefined, raw: unknown, yes: string, no: string): string {
  if (isEmptyValue(raw)) return "—";
  let d: string;
  if (Array.isArray(raw)) d = raw.map((v) => (f ? labelForOption(f, String(v)) : String(v))).join(", ");
  else if (typeof raw === "string") d = f ? labelForOption(f, raw) : raw;
  else if (typeof raw === "boolean") d = raw ? yes : no;
  else d = displayScalar(raw);
  return f?.unit && d ? `${d} ${f.unit}` : d;
}

/* ── Spec glyphs (Visual Library) ──
   A field's icon is the Semantic Icon Registry binding (`spec.<key>` /
   `field.<key>`), else a keyword rule over the key + label, else nothing —
   never a placeholder box. Group icons follow the same rules on the title.
   Each rule names a binding key FIRST and a real library path as fallback,
   so binding `group.electrical` in the Visual Library wins with no code. */
const VL_BASE = "https://yxyizbnfjrwrnmwhkvme.supabase.co/storage/v1/object/public/media/visual-library/";
const GROUP_ICON_RULES: Array<[RegExp, string, string]> = [
  [/inspect|detect|vision|scan|camera|sensor/i, "group.inspection", "general/security/eye.svg"],
  [/width|length|diameter|dimension|weight|size|physical/i, "group.physical", "pack/manufacturing/ruler-combined.svg"],
  [/pack|ship|logisti|carton|crate/i, "group.packing", "pack/misc/container-storage.svg"],
  [/electric|power|utilit|voltage|pneumatic|frequency|phase/i, "group.electrical", "pack/manufacturing/bolt.svg"],
  [/safe|complian|certif|standard/i, "group.compliance", "general/security/shield.svg"],
  [/perform|speed|capacit|output|precision/i, "group.performance", "general/time/timer.svg"],
  [/handl|feed|discharge|tension|transport|roll/i, "group.handling", "general/inventory/pallet.svg"],
  [/option|equipment|accessor|configur/i, "group.options", "pack/actions/settings-sliders.svg"],
  [/type|applicat|categor|material|fabric/i, "group.type", "pack/actions/layers.svg"],
];

export function useSpecGlyphs() {
  const [bindings, setBindings] = useState<BindingsMap>({});
  useEffect(() => {
    let alive = true;
    fetchIconBindings().then((b) => { if (alive) setBindings(b); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const fieldGlyph = useCallback((key: string, label?: string) => {
    const direct = bindings[`spec.${key}`] || bindings[`field.${key}`];
    if (direct) return direct;
    const hay = `${key} ${label ?? ""}`;
    for (const [re, k, fallback] of GROUP_ICON_RULES) if (re.test(hay)) return bindings[k] || VL_BASE + fallback;
    return null;
  }, [bindings]);
  const groupGlyph = useCallback((title: string) => {
    for (const [re, k, fallback] of GROUP_ICON_RULES) if (re.test(title)) return bindings[k] || VL_BASE + fallback;
    return null;
  }, [bindings]);
  return { fieldGlyph, groupGlyph };
}

/** A library SVG drawn as a currentColor mask — monochrome by construction. */
export function Glyph({ src, className = "h-4 w-4" }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-middle ${className}`}
      style={{
        maskImage: `url("${src}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain",
        WebkitMaskImage: `url("${src}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain",
      }}
    />
  );
}

/** The one section heading. Eyebrow = what kind of information; title =
 *  the section's name. Left-aligned, on the 8px grid; no display sizes. */
export function SectionHead({ id, eyebrow, title, aside }: { id?: string; eyebrow?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28 flex items-end justify-between gap-6 border-b border-[var(--border-subtle)] pb-4">
      <div className="space-y-1">
        {eyebrow ? <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{eyebrow}</div> : null}
        <h2 className="text-[24px] leading-[1.15] font-medium tracking-[-0.01em] text-[var(--text-primary)]">{title}</h2>
      </div>
      {aside ? <div className="shrink-0 text-[12px] text-[var(--text-dim)]">{aside}</div> : null}
    </div>
  );
}

/** A label / value list — the page's atom for facts. */
export function FactList({ rows, columns = 2 }: { rows: Array<{ key: string; label: React.ReactNode; value: React.ReactNode }>; columns?: 1 | 2 }) {
  if (rows.length === 0) return null;
  return (
    <dl className={`grid grid-cols-1 ${columns === 2 ? "md:grid-cols-2 md:gap-x-12" : ""}`}>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,11rem)_1fr] gap-4 border-b border-[var(--border-subtle)] py-3 text-[14px]">
          <dt className="text-[var(--text-dim)]">{r.label}</dt>
          <dd className="min-w-0 font-medium text-[var(--text-primary)] break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Monochrome chip. */
export function Chip({ children, glyph }: { children: React.ReactNode; glyph?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)]">
      {glyph ? <Glyph src={glyph} className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : null}
      {children}
    </span>
  );
}
