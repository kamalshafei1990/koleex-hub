"use client";

/* ---------------------------------------------------------------------------
   AssetRegistry — the "Registry" tab of the Asset Workspace (11th tab).
   Maps a visual asset to real KOLEEX business structure (division → category →
   subcategory → product system) with a usage role, shows inherited DNA,
   compatibility warnings and coverage contribution. Deterministic, no AI.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { REGISTRY_USAGE_ROLES, type RegistryUsageRole } from "@/lib/visual-library/types";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";

interface Link {
  id: string; usage_role: RegistryUsageRole; priority: number; required: boolean; recommended: boolean; deprecated: boolean;
  division_id: string | null; category_id: string | null; subcategory_id: string | null; product_system_id: string | null;
  division_name: string | null; category_name: string | null; subcategory_name: string | null; product_system_name: string | null;
}
interface Opt { id: string; name: string }
interface Resp {
  links: Link[];
  inherited_dna: { profile_id: string | null; source: string; profile_name: string | null; visual_style: string | null } | null;
  warnings: string[];
  coverage_contribution: { systems: number; roles: string[] };
  divisions: Opt[];
}

export default function AssetRegistry({ asset, onChanged }: { asset: { id: string; title: string }; onChanged?: () => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  // add-form cascade
  const [divId, setDivId] = useState(""); const [catId, setCatId] = useState(""); const [subId, setSubId] = useState(""); const [sysId, setSysId] = useState("");
  const [cats, setCats] = useState<Opt[]>([]); const [subs, setSubs] = useState<Opt[]>([]); const [systems, setSystems] = useState<Opt[]>([]);
  const [role, setRole] = useState<RegistryUsageRole>("feature");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visual-library/${asset.id}/registry`, { credentials: "include", cache: "no-store" });
      const j: Resp = res.ok ? await res.json() : null as never;
      if (j) setData(j);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // cascade fetches
  useEffect(() => {
    setCatId(""); setSubId(""); setSysId(""); setCats([]); setSubs([]); setSystems([]);
    if (!divId) return;
    fetch(`/api/visual-registry/categories?division_id=${divId}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { categories: [] }).then((j) => setCats((j.categories ?? []).map((c: Opt) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [divId]);
  useEffect(() => {
    setSubId(""); setSysId(""); setSubs([]); setSystems([]);
    if (!catId) return;
    fetch(`/api/visual-registry/subcategories?category_id=${catId}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { subcategories: [] }).then((j) => setSubs((j.subcategories ?? []).map((c: Opt) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [catId]);
  useEffect(() => {
    setSysId(""); setSystems([]);
    if (!subId) return;
    fetch(`/api/visual-registry/systems?subcategory_id=${subId}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { systems: [] }).then((j) => setSystems((j.systems ?? []).map((c: Opt) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [subId]);

  const addLink = async () => {
    if (!divId) return;
    setBusy(true);
    await fetch(`/api/visual-library/${asset.id}/registry`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", division_id: divId, category_id: catId || null, subcategory_id: subId || null, product_system_id: sysId || null, usage_role: role }),
    });
    setBusy(false); setAdding(false); setDivId(""); setRole("feature");
    await load(); onChanged?.();
  };
  const removeLink = async (linkId: string) => {
    setBusy(true);
    await fetch(`/api/visual-library/${asset.id}/registry`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", link_id: linkId }),
    });
    setBusy(false); await load(); onChanged?.();
  };

  if (loading) return <div className="flex justify-center py-10 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>;
  if (!data) return <p className="py-8 text-center text-[12.5px] text-[var(--text-dim)]">Couldn’t load registry.</p>;

  return (
    <div className="space-y-5">
      {/* Links */}
      <Section title={`Business mapping${data.links.length ? ` · ${data.links.length}` : ""}`}
        action={<button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-primary)] hover:border-[var(--border-color)]"><PlusIcon size={12} /> Map</button>}>
        {data.links.length === 0 ? (
          <p className="text-[11.5px] text-[var(--text-dim)]">Not mapped to any division/category/system yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 text-[12px] text-[var(--text-primary)]">
                    {[l.division_name, l.category_name, l.subcategory_name, l.product_system_name].filter(Boolean).map((n, i, arr) => (
                      <span key={i} className="flex items-center gap-1">{n}{i < arr.length - 1 && <span className="text-[var(--text-dim)]">›</span>}</span>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-[var(--accent)]">{l.usage_role.replace(/-/g, " ")}</span>
                    {l.required && <Tag>required</Tag>}{l.recommended && <Tag>recommended</Tag>}{l.deprecated && <Tag tone="rose">deprecated</Tag>}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => removeLink(l.id)} className="text-[var(--text-dim)] hover:text-rose-400 disabled:opacity-50"><CrossIcon size={13} /></button>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mt-2 space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
            <Select label="Division" value={divId} onChange={setDivId} options={data.divisions} placeholder="Select division…" />
            {divId && <Select label="Category" value={catId} onChange={setCatId} options={cats} placeholder="(optional)" />}
            {catId && <Select label="Subcategory" value={subId} onChange={setSubId} options={subs} placeholder="(optional)" />}
            {subId && <Select label="Product system" value={sysId} onChange={setSysId} options={systems} placeholder="(optional)" />}
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-dim)]">Usage role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as RegistryUsageRole)} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
                {REGISTRY_USAGE_ROLES.map((r) => <option key={r} value={r}>{r.replace(/-/g, " ")}</option>)}
              </select>
            </label>
            <button type="button" disabled={!divId || busy} onClick={addLink}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40">
              {busy ? <SpinnerIcon size={12} className="animate-spin" /> : null} Add mapping
            </button>
          </div>
        )}
      </Section>

      {/* Inherited DNA */}
      <Section title="Inherited brand DNA">
        {data.inherited_dna && (data.inherited_dna.profile_name || data.inherited_dna.visual_style) ? (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {data.inherited_dna.profile_name && <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-primary)]">{data.inherited_dna.profile_name}</span>}
            {data.inherited_dna.visual_style && <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-muted)]">style · {data.inherited_dna.visual_style}</span>}
            <span className="text-[10.5px] text-[var(--text-dim)]">from {data.inherited_dna.source}</span>
          </div>
        ) : <p className="text-[11.5px] text-[var(--text-dim)]">No DNA inherited — map to a division/category with a DNA profile.</p>}
      </Section>

      {/* Coverage contribution */}
      <Section title="Coverage contribution">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-muted)]">Systems · <span className="font-semibold text-[var(--text-primary)]">{data.coverage_contribution.systems}</span></span>
          {data.coverage_contribution.roles.length > 0
            ? data.coverage_contribution.roles.map((r) => <span key={r} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] text-[var(--text-muted)]">{r.replace(/-/g, " ")}</span>)
            : <span className="text-[var(--text-dim)]">No role contribution yet.</span>}
        </div>
      </Section>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-1.5">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-300"><span className="mt-px">⚠</span><span>{w}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}
function Tag({ children, tone }: { children: React.ReactNode; tone?: "rose" }) {
  return <span className={`rounded-full border px-1.5 py-px text-[9.5px] font-medium ${tone === "rose" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-dim)]"}`}>{children}</span>;
}
function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}
