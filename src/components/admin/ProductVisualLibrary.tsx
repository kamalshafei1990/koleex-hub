"use client";

/* ---------------------------------------------------------------------------
   ProductVisualLibrary — the single home for every visual in Product Data.

   One place to manage ALL product data points and decide how each is shown:
   Icon · Photo · Text · Icon+Text. Grouped into tabs:
     • Commercial      — merges the Control Panel value lists (Levels, Tags,
                          Colors, Voltage, Watt, Plug Types). Add/edit values
                          AND set each value's visual + representation here.
     • Classification  — Divisions / Categories / Subcategories  (next)
     • Identity & Common — the universal fields shared by all products (next)
     • Specs           — the SPECIAL specs unique to each Type (not the common
                          ones — those live in Identity & Common).
     • Media           — image / gallery / video / docs            (next)

   Kamal always picks/uploads the visual; nothing is auto-generated.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VisualAssetPicker, { type PickedAsset } from "@/components/admin/VisualAssetPicker";
import {
  fetchAttributeConfig, saveAttributeConfig, uploadAttributeImage,
  fetchAttributeUsage, mergeConfigWithUsage,
  type AttributeConfig, type VisualMode,
} from "@/lib/product-attributes";

const TABS = [
  { id: "commercial", label: "Commercial" },
  { id: "classification", label: "Classification" },
  { id: "identity", label: "Identity & Common" },
  { id: "specs", label: "Specs (per type)" },
  { id: "media", label: "Media" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* The commercial value lists we merge from the Control Panel. */
const ATTR_GROUPS: { key: keyof AttributeConfig; label: string; hint: string }[] = [
  { key: "levels", label: "Levels", hint: "Entry · Mid · Premium · Enterprise" },
  { key: "tags", label: "Tags", hint: "Free-form product tags" },
  { key: "colors", label: "Colors", hint: "Body / finish colors" },
  { key: "voltage", label: "Voltage", hint: "110V · 220V · 380V…" },
  { key: "watt", label: "Watt", hint: "Motor power options" },
  { key: "plug_types", label: "Plug Types", hint: "Socket standards by region" },
];

const MODES: { id: VisualMode; label: string }[] = [
  { id: "icon", label: "Icon" },
  { id: "photo", label: "Photo" },
  { id: "text", label: "Text" },
  { id: "icon_text", label: "Icon+Text" },
];

function valuesOf(cfg: AttributeConfig, key: keyof AttributeConfig): string[] {
  if (key === "plug_types") return (cfg.plug_types ?? []).map((p) => p.name);
  const v = cfg[key];
  return Array.isArray(v) ? (v as string[]) : [];
}
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProductVisualLibrary() {
  const [tab, setTab] = useState<TabId>("commercial");

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-6 lg:px-10 py-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">Product Data</p>
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Visual Library</h1>
        <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[720px]">
          The single home for every product data point and how it shows — Icon, Photo, Text, or Icon+Text. You pick from
          the Visual Library or upload; nothing is auto-generated.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6 border-b border-[var(--border-subtle)] pb-3">
        {TABS.map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors ${
              tab === tt.id
                ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {tab === "commercial" && <CommercialTab />}
      {tab === "specs" && <SpecsTab />}
      {(tab === "classification" || tab === "identity" || tab === "media") && (
        <ComingNext tab={tab} />
      )}
    </div>
  );
}

/* ── Commercial tab — the Control Panel merge ──────────────────────────── */

function CommercialTab() {
  const [cfg, setCfg] = useState<AttributeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ group: keyof AttributeConfig; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ group: keyof AttributeConfig; value: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, usage] = await Promise.all([fetchAttributeConfig(), fetchAttributeUsage()]);
        setCfg(mergeConfigWithUsage(c, usage));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: AttributeConfig, touchKey: string) => {
    setCfg(next);
    setSavingKey(touchKey);
    try {
      await saveAttributeConfig(next);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const imageFor = (c: AttributeConfig, group: keyof AttributeConfig, value: string): string => {
    const k = `${String(group)}:${value}`;
    if (c.value_images?.[k]) return c.value_images[k];
    if (group === "plug_types") return c.plug_types.find((p) => p.name === value)?.image ?? "";
    return "";
  };
  const modeFor = (c: AttributeConfig, group: keyof AttributeConfig, value: string): VisualMode => {
    const k = `${String(group)}:${value}`;
    if (c.value_modes?.[k]) return c.value_modes[k];
    return imageFor(c, group, value) ? "icon" : "text";
  };

  const setVisual = useCallback(
    (group: keyof AttributeConfig, value: string, url: string | null, mode?: VisualMode) => {
      if (!cfg) return;
      const k = `${String(group)}:${value}`;
      const images = { ...(cfg.value_images ?? {}) };
      const modes = { ...(cfg.value_modes ?? {}) };
      if (url === null) { delete images[k]; }
      else if (url) { images[k] = url; }
      if (mode) modes[k] = mode;
      else if (url && !modes[k]) modes[k] = "icon";
      persist({ ...cfg, value_images: images, value_modes: modes }, k);
    },
    [cfg, persist],
  );

  const onUploadFile = useCallback(
    async (file: File) => {
      const tgt = uploadTarget.current;
      if (!tgt || !cfg) return;
      setSavingKey(`${String(tgt.group)}:${tgt.value}`);
      const url = await uploadAttributeImage(String(tgt.group), slugify(tgt.value), file);
      if (url) setVisual(tgt.group, tgt.value, `${url}?t=${Date.now()}`, "icon");
      else setSavingKey(null);
      uploadTarget.current = null;
    },
    [cfg, setVisual],
  );

  if (loading || !cfg) {
    return <div className="h-60 grid place-items-center text-[13px] text-[var(--text-dim)]">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-[var(--text-dim)] -mt-2">
        These value lists used to live in the Control Panel — now managed here, each with its own visual.
      </p>

      {ATTR_GROUPS.map((g) => {
        const values = valuesOf(cfg, g.key);
        return (
          <section key={String(g.key)} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{g.label}</h2>
                <p className="text-[11px] text-[var(--text-dim)]">{g.hint}</p>
              </div>
              <span className="text-[11px] text-[var(--text-dim)]">{values.length} value{values.length === 1 ? "" : "s"}</span>
            </div>

            {values.length === 0 ? (
              <p className="px-4 py-5 text-[12px] text-[var(--text-dim)]">No values yet — add some in the product form or here later.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-subtle)]">
                {values.map((value) => {
                  const img = imageFor(cfg, g.key, value);
                  const mode = modeFor(cfg, g.key, value);
                  const k = `${String(g.key)}:${value}`;
                  return (
                    <div key={value} className="bg-[var(--bg-secondary)] p-3 flex items-center gap-3">
                      <span className="h-11 w-11 shrink-0 grid place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
                        {img ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={img} alt={value} className="max-h-8 max-w-8 object-contain" />
                        ) : (
                          <span className="text-[var(--text-ghost)] text-[10px] uppercase">none</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{value}</p>
                        {/* Mode segmented control */}
                        <div className="mt-1.5 inline-flex rounded-md border border-[var(--border-subtle)] overflow-hidden">
                          {MODES.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setVisual(g.key, value, img || "", m.id)}
                              className={`px-2 h-6 text-[10px] font-medium border-r border-[var(--border-subtle)] last:border-r-0 transition-colors ${
                                mode === m.id
                                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                                  : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => setPicker({ group: g.key, value })}
                          className="h-6 px-2 rounded-md text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                        >
                          Library
                        </button>
                        <button
                          onClick={() => { uploadTarget.current = { group: g.key, value }; fileRef.current?.click(); }}
                          className="h-6 px-2 rounded-md text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                        >
                          Upload
                        </button>
                      </div>
                      {savingKey === k && <span className="text-[10px] text-[var(--text-dim)] shrink-0">saving…</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadFile(f); e.target.value = ""; }}
      />

      <VisualAssetPicker
        open={picker !== null}
        title={picker ? `Visual for "${picker.value}"` : "Choose a visual"}
        onPick={(a: PickedAsset | null) => {
          if (picker) setVisual(picker.group, picker.value, a ? a.public_url : null, a ? "icon" : "text");
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}

/* ── Specs tab — SPECIAL specs per type (not common) ───────────────────── */

interface FieldRow { id: string; field_key: string; field_label: string; field_type: string; unit: string | null; options_json: Record<string, unknown> | null; }
interface SectionRow { id: string; title: string; fields: FieldRow[]; }
interface Tree { id: string; name: string; slug: string; sections: SectionRow[]; }
interface TemplateLite { id: string; name: string; slug: string; }

/* Sections that hold COMMON data (handled in Identity & Common), hidden here
   so the Specs tab shows only what's SPECIAL to the type. */
const COMMON_SECTIONS = new Set(["Basic Information", "Features & Highlights", "Packaging", "Electrical Specs", "Accessories"]);

function SpecsTab() {
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [slug, setSlug] = useState("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<{ field: FieldRow; value?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/product-templates");
        const data = (await res.json()) as { templates?: TemplateLite[] };
        const list = data.templates ?? [];
        setTemplates(list);
        if (list.length) setSlug((s) => s || list[0].slug);
      } catch { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/product-templates/${slug}`);
        setTree((await res.json()) as Tree);
      } catch { setTree(null); } finally { setLoading(false); }
    })();
  }, [slug]);

  const specialSections = useMemo(
    () => (tree ? tree.sections.filter((s) => !COMMON_SECTIONS.has(s.title)) : []),
    [tree],
  );

  const readOptions = (oj: Record<string, unknown> | null): Array<{ value: string; label?: string; icon?: string }> => {
    const arr = oj && Array.isArray((oj as { options?: unknown }).options) ? (oj as { options: unknown[] }).options : [];
    return arr.filter((o): o is { value: string } => !!o && typeof (o as { value?: unknown }).value === "string") as Array<{ value: string; label?: string; icon?: string }>;
  };

  const save = useCallback(async (field: FieldRow, nextOj: Record<string, unknown>) => {
    setSavingId(field.id);
    setTree((prev) => prev ? { ...prev, sections: prev.sections.map((s) => ({ ...s, fields: s.fields.map((f) => f.id === field.id ? { ...f, options_json: nextOj } : f) })) } : prev);
    try {
      await fetch(`/api/product-templates/${slug}/visual-map`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ field_id: field.id, options_json: nextOj }),
      });
    } finally { setSavingId(null); }
  }, [slug]);

  const applyPick = (asset: PickedAsset | null) => {
    if (!picker) return;
    const url = asset?.public_url ?? "";
    const f = picker.field;
    const oj: Record<string, unknown> = { ...(f.options_json ?? {}) };
    if (picker.value === undefined) {
      if (url) oj.field_icon_url = url; else delete oj.field_icon_url;
    } else {
      oj.options = readOptions(f.options_json).map((o) => o.value === picker.value ? { ...o, icon: url || undefined } : o);
    }
    setPicker(null);
    void save(f, oj);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--text-dim)]">Only the <span className="text-[var(--text-muted)] font-medium">special</span> specs of each type. Common specs live in Identity & Common.</p>
        {templates.length > 0 && (
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] outline-none">
            {templates.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-40 grid place-items-center text-[13px] text-[var(--text-dim)]">Loading…</div>
      ) : !tree ? (
        <div className="h-32 grid place-items-center text-[13px] text-[var(--text-dim)]">No template.</div>
      ) : specialSections.length === 0 ? (
        <div className="h-32 grid place-items-center text-[13px] text-[var(--text-dim)]">No special specs for this type yet.</div>
      ) : (
        specialSections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]"><h2 className="text-[13px] font-bold text-[var(--text-primary)]">{section.title}</h2></div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {section.fields.map((field) => {
                const oj = (field.options_json ?? {}) as { field_icon_url?: string };
                const options = readOptions(field.options_json);
                return (
                  <div key={field.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPicker({ field })} title="Set icon" className={`shrink-0 h-10 w-10 grid place-items-center rounded-lg border overflow-hidden ${oj.field_icon_url ? "border-[var(--border-subtle)] bg-[var(--bg-surface)]" : "border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40"}`}>
                        {oj.field_icon_url
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={oj.field_icon_url} alt="" className="max-h-7 max-w-7 object-contain" />
                          : <span className="text-[9px] uppercase text-[var(--text-ghost)]">icon</span>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{field.field_label}{field.unit ? <span className="text-[var(--text-dim)] font-normal"> · {field.unit}</span> : null}</p>
                        <p className="text-[11px] text-[var(--text-dim)]">{field.field_key} · {field.field_type}</p>
                      </div>
                      {savingId === field.id && <span className="text-[11px] text-[var(--text-dim)]">saving…</span>}
                    </div>
                    {options.length > 0 && (
                      <div className="mt-3 ml-[52px] flex flex-wrap gap-2">
                        {options.map((o) => (
                          <button key={o.value} onClick={() => setPicker({ field, value: o.value })} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]" title={`Icon for "${o.label ?? o.value}"`}>
                            <span className="h-6 w-6 grid place-items-center rounded bg-[var(--bg-surface-subtle)] overflow-hidden">
                              {o.icon
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={o.icon} alt="" className="max-h-5 max-w-5 object-contain" />
                                : <span className="text-[var(--text-ghost)] text-[12px]">+</span>}
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
        ))
      )}

      <VisualAssetPicker
        open={picker !== null}
        title={picker?.value !== undefined ? `Icon for "${picker.value}"` : picker ? `Icon for "${picker.field.field_label}"` : "Choose a visual"}
        onPick={applyPick}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}

function ComingNext({ tab }: { tab: TabId }) {
  const copy: Record<string, string> = {
    classification: "Divisions · Categories · Subcategories and their icons — building next on top of the existing classification logos.",
    identity: "The universal fields shared by all products (name · code · status · main image · the common specs) — mapped once here.",
    media: "Image · gallery · video · documents representation — building next.",
  };
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-8 text-center">
      <p className="text-[14px] font-semibold text-[var(--text-primary)]">Coming next</p>
      <p className="text-[12px] text-[var(--text-muted)] mt-1 max-w-[520px] mx-auto leading-relaxed">{copy[tab]}</p>
    </div>
  );
}
