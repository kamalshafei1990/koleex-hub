"use client";

/* ---------------------------------------------------------------------------
   SpecIconHub — Database › Visual Library › Specs & Attributes (top block).

   THE control center for spec-field and attribute icons. It reads the REAL
   spec-template registry (the same schemas Product Data resolves), so any
   field the owner adds to a template appears here AUTOMATICALLY — no manual
   sync. The icon bound here (Semantic Icon Registry, spec.<field_key>)
   renders in the product record's spec rows and anywhere else that field
   shows. Rows without a manual binding show the keyword-suggested glyph,
   marked AUTO — clicking binds a real one.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { listSchemas } from "@/lib/product-schema";
import { fetchIconBindings, invalidateIconBindings, type BindingsMap } from "@/lib/visual-bindings";
import IconBindingPicker from "./IconBindingPicker";
import PencilIcon from "@/components/icons/ui/PencilIcon";

/* Legacy technical columns on the products table — pre-schema fields that
   still render on records. Their icons are field.* bindings (many seeded);
   listed here so the control center covers EVERYTHING, not just templates. */
const LEGACY_FIELDS: Array<{ key: string; label: string }> = [
  { key: "voltage", label: "Voltage / power" },
  { key: "colors", label: "Colors" },
  { key: "dimensions", label: "Machine dimensions" },
  { key: "weight", label: "Machine weight" },
  { key: "hs_code", label: "HS code" },
  { key: "origin", label: "Country of origin" },
  { key: "moq", label: "MOQ" },
  { key: "lead_time", label: "Lead time" },
  { key: "warranty", label: "Warranty" },
  { key: "packing", label: "Packing" },
  { key: "cbm", label: "CBM / volume" },
  { key: "barcode", label: "Barcode" },
  { key: "sku", label: "SKU" },
];

const ATTRIBUTES: Array<{ key: string; label: string }> = [
  { key: "voltage", label: "Voltage options" },
  { key: "plug_types", label: "Plug types" },
  { key: "colors", label: "Colors" },
  { key: "watt", label: "Watt options" },
  { key: "levels", label: "Product levels" },
  { key: "tags", label: "Tags" },
];

function Glyph({ url, className = "h-4 w-4" }: { url: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ maskImage: `url("${url}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${url}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

export default function SpecIconHub() {
  const [bindings, setBindings] = useState<BindingsMap>({});
  const [editing, setEditing] = useState<{ key: string; label: string; domain: "spec" | "attribute" | "field" } | null>(null);
  const [openSchema, setOpenSchema] = useState<string | null>(null);

  useEffect(() => { void fetchIconBindings().then(setBindings); }, []);

  /* Deduped by schema id — dual bindings (XFFP fabric-prep, ironing-systems
     re-binds) describe the SAME fields; one entry per family is the truth. */
  const schemas = useMemo(() => {
    const seen = new Set<string>();
    return listSchemas().filter((s) => {
      const fam = s.name;
      if (seen.has(fam)) return false;
      seen.add(fam);
      return true;
    });
  }, []);

  const refresh = () => { invalidateIconBindings(); void fetchIconBindings().then(setBindings); };

  const FieldRow = ({ k, label, domain, unit }: { k: string; label: string; domain: "spec" | "attribute" | "field"; unit?: string | null }) => {
    const url = bindings[`${domain}.${k}`];
    return (
      <button
        type="button"
        onClick={() => setEditing({ key: k, label, domain })}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 transition-colors text-start group"
      >
        <span className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${url ? "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]" : "border-dashed border-[var(--border-strong)] text-[var(--text-ghost)]"}`}>
          {url ? <Glyph url={url} /> : <span className="text-[13px] leading-none">?</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{label}{unit ? <span className="text-[10.5px] text-[var(--text-ghost)] ms-1">({unit})</span> : null}</span>
          <span className="block text-[10px] font-mono text-[var(--text-ghost)]">{domain}.{k}</span>
        </span>
        {!url && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-ghost)] shrink-0">AUTO</span>}
        <PencilIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  };

  return (
    <div className="space-y-5 mb-8">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-[13.5px] font-bold text-[var(--text-primary)]">Spec & attribute icons — control center</h2>
        <p className="text-[11.5px] text-[var(--text-dim)] mt-1 leading-relaxed">
          Live from the spec-template registry: every field of every template is listed automatically — add a field in Product Data and it appears here by itself. Bind its icon from the General Icons library (one icon = one meaning); AUTO means no manual binding yet, so the system shows a keyword-matched suggestion.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
        <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">Attributes · {ATTRIBUTES.length}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {ATTRIBUTES.map((a) => <FieldRow key={a.key} k={a.key} label={a.label} domain="attribute" />)}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
        <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">Legacy technical columns · {LEGACY_FIELDS.length}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {LEGACY_FIELDS.map((a) => <FieldRow key={a.key} k={a.key} label={a.label} domain="field" />)}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
        <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">Spec templates · {schemas.length}</h3>
        <div className="space-y-1">
          {schemas.map((s) => {
            const fields = s.groups.flatMap((g) => g.fields);
            const bound = fields.filter((f) => bindings[`spec.${f.key}`]).length;
            const open = openSchema === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-[var(--border-subtle)]/60">
                <button
                  type="button"
                  onClick={() => setOpenSchema(open ? null : s.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-start"
                >
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)] flex-1 truncate">{s.name} <span className="text-[10px] text-[var(--text-ghost)] font-normal">v{s.version}</span></span>
                  <span className="text-[10px] text-[var(--text-ghost)] tabular-nums shrink-0">{bound}/{fields.length} bound</span>
                  <span className={`text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open && (
                  <div className="px-2 pb-2 grid grid-cols-1 md:grid-cols-2 gap-1 border-t border-[var(--border-subtle)]/60 pt-2">
                    {fields.map((f) => (
                      <FieldRow key={`${s.id}:${f.key}`} k={f.key} label={f.label ?? f.key} domain="spec" unit={f.unit} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {editing && (
        <IconBindingPicker
          semanticKey={`${editing.domain}.${editing.key}`}
          domain={editing.domain}
          label={editing.label}
          currentUrl={bindings[`${editing.domain}.${editing.key}`] ?? null}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
