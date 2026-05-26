"use client";

/* ---------------------------------------------------------------------------
   TemplateForm — orchestrator.

     1. Fetch the template tree by slug.
     2. Hydrate values when productId is supplied (otherwise preview-only).
     3. Render each section + collect state by field_key.
     4. Save back via POST when the user clicks "Save".

   Phase 1 keeps state purely local (useState). Future phases can swap
   in react-hook-form / zod / autosave without changing the component
   surface area.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import SectionRenderer from "./SectionRenderer";
import type {
  TemplateTree,
  FieldValueMap,
} from "@/lib/product-templates/types";

interface Props {
  templateSlug: string;
  /** When supplied, values are fetched + saves persist to that product. */
  productId?: string;
  /** Optional model scope for saves (omit to write product-wide values). */
  modelId?: string;
  /** Phase 1 demo flag — disables network saves, shows the JSON payload. */
  previewOnly?: boolean;
}

export default function TemplateForm({
  templateSlug,
  productId,
  modelId,
  previewOnly,
}: Props) {
  const [tree, setTree] = useState<TemplateTree | null>(null);
  const [values, setValues] = useState<FieldValueMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  /* Fetch template structure. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/product-templates/${encodeURIComponent(templateSlug)}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const j = (await res.json()) as TemplateTree;
        if (!cancelled) setTree(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateSlug]);

  /* Hydrate existing values when bound to a product. */
  useEffect(() => {
    if (!productId || !tree) return;
    let cancelled = false;
    (async () => {
      try {
        const q = modelId ? `?modelId=${encodeURIComponent(modelId)}` : "";
        const res = await fetch(
          `/api/product-templates/${encodeURIComponent(templateSlug)}/values/${encodeURIComponent(productId)}${q}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const j = (await res.json()) as { values: FieldValueMap };
        if (!cancelled && j.values) setValues(j.values);
      } catch {
        /* silent — empty values just means the form starts blank */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, modelId, templateSlug, tree]);

  /* Field-count summary for the "X fields filled" pill. */
  const totals = useMemo(() => {
    if (!tree) return { total: 0, filled: 0 };
    let total = 0;
    let filled = 0;
    for (const s of tree.sections) {
      for (const f of s.fields) {
        total += 1;
        const v = values[f.field_key];
        const isFilled =
          v !== undefined &&
          v !== null &&
          !(typeof v === "string" && v === "") &&
          !(Array.isArray(v) && v.length === 0);
        if (isFilled) filled += 1;
      }
    }
    return { total, filled };
  }, [tree, values]);

  /* Strip the renderer-internal `__rid` markers from repeater /
     feature_card rows before sending to the API. The DB never sees
     these — they exist only so React can use a stable key per row. */
  function sanitizeForSave(input: FieldValueMap): FieldValueMap {
    const out: FieldValueMap = {};
    for (const [k, v] of Object.entries(input)) {
      if (Array.isArray(v)) {
        out[k] = v.map((row) => {
          if (row && typeof row === "object" && !Array.isArray(row)) {
            const { __rid: _drop, ...rest } = row as Record<string, unknown>;
            return rest;
          }
          return row;
        });
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async function handleSave() {
    const payload = sanitizeForSave(values);
    if (previewOnly) {
      setSaveMsg(`Preview only — payload: ${JSON.stringify(payload).slice(0, 200)}…`);
      return;
    }
    if (!productId) {
      setSaveMsg("Cannot save: no productId bound to this form.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const q = modelId ? `?modelId=${encodeURIComponent(modelId)}` : "";
      const res = await fetch(
        `/api/product-templates/${encodeURIComponent(templateSlug)}/values/${encodeURIComponent(productId)}${q}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ values: payload }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { upserted?: number; deleted?: number };
      setSaveMsg(
        `Saved — ${j.upserted ?? 0} updated, ${j.deleted ?? 0} cleared.`,
      );
    } catch (e) {
      setSaveMsg(e instanceof Error ? `Save failed: ${e.message}` : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-[12.5px] text-black/50 dark:text-white/50">
        Loading template…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!tree) return null;

  return (
    <div className="space-y-4">
      {/* Top bar — name + Save */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-black dark:text-white">
            {tree.name}
          </h1>
          {tree.description && (
            <p className="mt-0.5 text-[12px] text-black/50 dark:text-white/45">
              {tree.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-black/50 dark:text-white/40">
            {totals.filled}/{totals.total} filled
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 h-9 rounded-lg bg-black dark:bg-white text-white dark:text-black text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : previewOnly ? "Preview JSON" : "Save"}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] px-3 py-2 text-[11.5px] text-black/70 dark:text-white/70">
          {saveMsg}
        </div>
      )}

      {/* Sections */}
      {tree.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          values={values}
          onFieldChange={(key, v) =>
            setValues((prev) => ({ ...prev, [key]: v }))
          }
        />
      ))}
    </div>
  );
}
