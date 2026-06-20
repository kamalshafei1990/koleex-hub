"use client";

/* ---------------------------------------------------------------------------
   CatalogEditorModal — one shared, field-driven create/edit dialog for the
   trade-configuration catalogs (Payment Terms, Incoterms, Shipping Methods,
   Shipping Documents). Each manager passes a field schema + endpoint; this
   handles form state, POST (create) vs PATCH (edit), and error surfacing.

   No new API — the catalog routes already accept the column allowlists.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

export type CatalogField =
  | { key: string; label: string; type: "text" | "textarea" | "number"; required?: boolean; placeholder?: string; help?: string; full?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; help?: string; full?: boolean }
  | { key: string; label: string; type: "toggle"; help?: string; full?: boolean }
  | { key: string; label: string; type: "chips"; placeholder?: string; help?: string; full?: boolean };

/** text[] columns are edited as a comma-separated string and split on save. */
function toEditable(field: CatalogField, raw: unknown): unknown {
  if (field.type === "chips") return Array.isArray(raw) ? raw.join(", ") : (raw ?? "");
  if (field.type === "toggle") return !!raw;
  return raw ?? "";
}

export function CatalogEditorModal({
  open, title, endpoint, fields, initial, idValue, onClose, onSaved,
}: {
  open: boolean;
  title: string;
  endpoint: string;
  fields: CatalogField[];
  initial: Record<string, unknown>;
  /** present → edit (PATCH with this id); absent → create (POST). */
  idValue?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const seed: Record<string, unknown> = {};
    for (const f of fields) seed[f.key] = toEditable(f, initial[f.key]);
    setForm(seed);
    setError(null);
  }, [open, initial, fields]);

  if (!open) return null;

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    /* Required-field guard. */
    for (const f of fields) {
      if ((f as { required?: boolean }).required && !String(form[f.key] ?? "").trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      let v = form[f.key];
      if (f.type === "number") v = v === "" || v == null ? null : Number(v);
      else if (f.type === "chips") v = String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      else if (f.type === "toggle") v = !!v;
      payload[f.key] = v;
    }
    if (idValue) payload.id = idValue;
    try {
      const res = await fetch(endpoint, {
        method: idValue ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(body.error || `Save failed (${res.status})`); return; }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 py-10" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className={f.full || f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1">
                {f.label}{(f as { required?: boolean }).required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea rows={2} value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls.replace("h-9", "") + " py-2 resize-y"} />
              ) : f.type === "select" ? (
                <select value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "toggle" ? (
                <label className="flex items-center gap-2 h-9 cursor-pointer select-none">
                  <input type="checkbox" checked={!!form[f.key]} onChange={(e) => set(f.key, e.target.checked)} className="accent-[var(--bg-inverted)] h-4 w-4" />
                  <span className="text-[12px] text-[var(--text-muted)]">{form[f.key] ? "Yes" : "No"}</span>
                </label>
              ) : (
                <input type={f.type === "number" ? "number" : "text"} value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
              )}
              {f.help && <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">{f.help}</p>}
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 flex items-center justify-end gap-2">
          {error && <span className="text-[12px] text-red-400 flex-1">{error}</span>}
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="h-9 px-4 rounded-lg text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50">
            {saving ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon size={14} />}
            {idValue ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shared delete helper — soft-deletes via the catalog's DELETE ?id= route. */
export async function deleteCatalogRow(endpoint: string, id: string): Promise<string | null> {
  try {
    const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return body.error || `Delete failed (${res.status})`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Network error";
  }
}
