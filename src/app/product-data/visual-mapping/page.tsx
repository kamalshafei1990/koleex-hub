"use client";

/* ---------------------------------------------------------------------------
   Product Data › Visual Mapping

   The single place to bind a VISUAL (icon / photo) to every spec field and
   every spec value of a product template. Reads the template structure, lets
   Kamal pick assets from the Visual Library, and saves the mapping into the
   field's options_json — no product data touched, no schema change.

   Storage convention (matches /api/product-templates/[slug]/visual-map):
     options_json.field_icon_url   → the field's icon
     options_json.field_photo_url  → the field's optional real photo
     options_json.options[i].icon  → a value's icon
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import VisualAssetPicker, { type PickedAsset } from "@/components/admin/VisualAssetPicker";

interface TemplateLite {
  id: string;
  name: string;
  slug: string;
  subcategory_slug: string | null;
}
interface FieldRow {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  unit: string | null;
  options_json: Record<string, unknown> | null;
}
interface SectionRow {
  id: string;
  title: string;
  fields: FieldRow[];
}
interface Tree {
  id: string;
  name: string;
  slug: string;
  sections: SectionRow[];
}

const SELECT_TYPES = new Set(["select", "multi_select", "icon_select", "image_select", "color_select"]);

interface OptionShape {
  value: string;
  label?: string;
  icon?: string;
  image?: string;
  [k: string]: unknown;
}

function readOptions(oj: Record<string, unknown> | null): OptionShape[] {
  const arr = oj && Array.isArray((oj as { options?: unknown }).options) ? (oj as { options: unknown[] }).options : [];
  return arr.filter((o): o is OptionShape => !!o && typeof (o as OptionShape).value === "string");
}

/* Picker target — what we're about to set a visual for. */
type Target =
  | { kind: "field_icon"; field: FieldRow }
  | { kind: "field_photo"; field: FieldRow }
  | { kind: "option_icon"; field: FieldRow; value: string };

function VisualMappingInner() {
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  /* Load template list once; default to the first (Lockstitch today). */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/product-templates");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { templates?: TemplateLite[] };
        const list = data.templates ?? [];
        setTemplates(list);
        if (list.length) setSlug((s) => s || list[0].slug);
      } catch {
        setErr("Couldn't load templates.");
        setLoading(false);
      }
    })();
  }, []);

  /* Load the selected template's tree. */
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/product-templates/${slug}`);
        if (!res.ok) throw new Error(String(res.status));
        setTree((await res.json()) as Tree);
      } catch {
        setErr("Couldn't load this template.");
        setTree(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const totals = useMemo(() => {
    if (!tree) return { fields: 0, withIcon: 0 };
    let fields = 0;
    let withIcon = 0;
    for (const s of tree.sections)
      for (const f of s.fields) {
        fields++;
        if ((f.options_json as { field_icon_url?: string } | null)?.field_icon_url) withIcon++;
      }
    return { fields, withIcon };
  }, [tree]);

  /* Persist a field's new options_json (optimistic). */
  const saveField = useCallback(
    async (field: FieldRow, nextOj: Record<string, unknown>) => {
      setSavingId(field.id);
      setTree((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) => ({
                ...s,
                fields: s.fields.map((f) => (f.id === field.id ? { ...f, options_json: nextOj } : f)),
              })),
            }
          : prev,
      );
      try {
        const res = await fetch(`/api/product-templates/${slug}/visual-map`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ field_id: field.id, options_json: nextOj }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setErr("Save failed — please retry.");
      } finally {
        setSavingId(null);
      }
    },
    [slug],
  );

  /* Apply the picked asset to whatever target is open. */
  const applyPick = useCallback(
    (asset: PickedAsset | null) => {
      if (!target) return;
      const url = asset?.public_url ?? "";
      const field = target.field;
      const oj: Record<string, unknown> = { ...(field.options_json ?? {}) };
      if (target.kind === "field_icon") {
        if (url) oj.field_icon_url = url;
        else delete oj.field_icon_url;
      } else if (target.kind === "field_photo") {
        if (url) oj.field_photo_url = url;
        else delete oj.field_photo_url;
      } else {
        const opts = readOptions(field.options_json).map((o) =>
          o.value === target.value ? { ...o, icon: url || undefined } : o,
        );
        oj.options = opts;
      }
      setTarget(null);
      void saveField(field, oj);
    },
    [target, saveField],
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 md:px-6 lg:px-10 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">Product Data</p>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Visual Mapping</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[640px]">
            Bind an icon or photo to every spec field and value. You pick from the Visual Library — nothing is
            auto-generated. The product page then renders these visuals automatically.
          </p>
        </div>
        {templates.length > 0 && (
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.slug}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {tree && (
        <p className="text-[12px] text-[var(--text-dim)] mb-4">
          <span className="text-[var(--text-muted)] font-semibold">{totals.withIcon}</span> / {totals.fields} fields have an icon
        </p>
      )}

      {err && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-400">{err}</div>
      )}

      {loading ? (
        <div className="h-60 grid place-items-center text-[13px] text-[var(--text-dim)]">Loading…</div>
      ) : !tree ? (
        <div className="h-40 grid place-items-center text-[13px] text-[var(--text-dim)]">No template.</div>
      ) : (
        <div className="space-y-6">
          {tree.sections.map((section) => (
            <section key={section.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]">
                <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{section.title}</h2>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {section.fields.map((field) => {
                  const oj = (field.options_json ?? {}) as { field_icon_url?: string; field_photo_url?: string };
                  const isSelect = SELECT_TYPES.has(field.field_type);
                  const options = isSelect ? readOptions(field.options_json) : [];
                  return (
                    <div key={field.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Field icon */}
                        <VisualButton
                          url={oj.field_icon_url}
                          label="icon"
                          onClick={() => setTarget({ kind: "field_icon", field })}
                        />
                        {/* Field photo */}
                        <VisualButton
                          url={oj.field_photo_url}
                          label="photo"
                          square
                          onClick={() => setTarget({ kind: "field_photo", field })}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                            {field.field_label}
                            {field.unit ? <span className="text-[var(--text-dim)] font-normal"> · {field.unit}</span> : null}
                          </p>
                          <p className="text-[11px] text-[var(--text-dim)]">{field.field_key} · {field.field_type}</p>
                        </div>
                        {savingId === field.id && <span className="text-[11px] text-[var(--text-dim)]">saving…</span>}
                      </div>

                      {/* Per-value icons */}
                      {options.length > 0 && (
                        <div className="mt-3 ml-[92px] flex flex-wrap gap-2">
                          {options.map((o) => (
                            <button
                              key={o.value}
                              onClick={() => setTarget({ kind: "option_icon", field, value: o.value })}
                              className="inline-flex items-center gap-1.5 pl-1 pr-2.5 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)] transition-colors"
                              title={`Set icon for "${o.label ?? o.value}"`}
                            >
                              <span className="h-6 w-6 grid place-items-center rounded bg-[var(--bg-surface-subtle)] overflow-hidden">
                                {o.icon ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={o.icon} alt="" className="max-h-5 max-w-5 object-contain" />
                                ) : (
                                  <span className="text-[var(--text-ghost)] text-[12px]">+</span>
                                )}
                              </span>
                              <span className="text-[11px] text-[var(--text-muted)]">{o.label ?? o.value}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <VisualAssetPicker
        open={target !== null}
        title={
          target?.kind === "field_photo"
            ? `Photo for "${target.field.field_label}"`
            : target?.kind === "option_icon"
              ? `Icon for "${target.value}"`
              : target
                ? `Icon for "${target.field.field_label}"`
                : "Choose a visual"
        }
        onPick={applyPick}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

function VisualButton({
  url,
  label,
  square,
  onClick,
}: {
  url?: string;
  label: string;
  square?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Set ${label}`}
      className={`shrink-0 h-10 w-10 grid place-items-center rounded-lg border overflow-hidden transition-colors ${
        url
          ? "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]"
          : "border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 hover:border-[var(--border-focus)]"
      } ${square ? "rounded-lg" : "rounded-lg"}`}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={label} className="max-h-7 max-w-7 object-contain" />
      ) : (
        <span className="text-[9px] uppercase tracking-wide text-[var(--text-ghost)]">{label}</span>
      )}
    </button>
  );
}

export default function VisualMappingPage() {
  return (
    <PermissionGate module="Product Data">
      <VisualMappingInner />
    </PermissionGate>
  );
}
