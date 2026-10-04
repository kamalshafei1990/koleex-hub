"use client";

/* ---------------------------------------------------------------------------
   ClassificationIconHub — Database › Visual Library › Classification.

   THE control center for classification icons (owner directive): it walks
   the REAL live taxonomy (divisions → categories → subcategories — the same
   tables the classify tab uses, not the old parallel visual_* copies) and
   binds ONE unique icon per node through the Semantic Icon Registry.
   Change or remove an icon here → every consumer (classify tab, product
   record, category cards) follows within the 60s cache window.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useWarmData } from "@/lib/warm-cache";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { fetchDivisions, fetchCategories, fetchSubcategories } from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import { MACHINE_KINDS } from "@/lib/machine-kinds";
import { fetchIconBindings, invalidateIconBindings, type BindingsMap } from "@/lib/visual-bindings";
import IconBindingPicker from "./IconBindingPicker";
import PencilIcon from "@/components/icons/ui/PencilIcon";

interface Node { slug: string; name: string; level: "division" | "category" | "subcategory" | "kind"; parent?: string }

function Glyph({ url, className = "h-4 w-4" }: { url: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ maskImage: `url("${url}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${url}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

type IconHubSnap = {
  divisions: DivisionRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  bindings: BindingsMap;
};

export default function ClassificationIconHub() {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [pickDivId, setPickDivId] = useState<string>("");
  const [pickCatId, setPickCatId] = useState<string>("");
  const [pickSubSlug, setPickSubSlug] = useState<string>("");
  const [editing, setEditing] = useState<Node | null>(null);
  /* Warm: the whole classification tree, none of it filtered server-side.
     It is reference data that changes rarely and is read constantly, which
     is the ideal shape for this cache. */
  const fetchAll = useCallback(async (): Promise<IconHubSnap> => {
    const [d, c, sc, b] = await Promise.all([
      fetchDivisions().catch(() => []),
      fetchCategories().catch(() => []),
      fetchSubcategories().catch(() => []),
      fetchIconBindings(),
    ]);
    return { divisions: d, categories: c, subcategories: sc, bindings: b };
  }, []);
  const { data, loading, reload: load } = useWarmData<IconHubSnap>("db:classification-icons", fetchAll);
  const divisions = useMemo(() => data?.divisions ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const subcategories = useMemo(() => data?.subcategories ?? [], [data]);
  const bindings = useMemo(() => data?.bindings ?? ({} as BindingsMap), [data]);

  /* No selection = show EVERYTHING, ORGANIZED (owner: children grouped
     under their parent — categories by division, subcategories by category,
     kinds by subcategory). Picking a parent narrows the cascade below it. */
  const cats = useMemo(
    () => (pickDivId ? categories.filter((c) => c.division_id === pickDivId) : categories),
    [categories, pickDivId],
  );
  const catGroups = useMemo(() => {
    const byDiv = new Map<string, CategoryRow[]>();
    for (const c of cats) {
      const k = c.division_id ?? "?";
      const arr = byDiv.get(k) ?? [];
      arr.push(c);
      byDiv.set(k, arr);
    }
    return divisions
      .filter((d) => byDiv.has(d.id))
      .map((d) => ({ id: d.id, label: d.name, items: byDiv.get(d.id)! }));
  }, [cats, divisions]);

  const subs = useMemo(() => {
    if (pickCatId) return subcategories.filter((s) => s.category_id === pickCatId);
    if (pickDivId) {
      const catIds = new Set(cats.map((c) => c.id));
      return subcategories.filter((s) => (s.category_id ? catIds.has(s.category_id) : false));
    }
    return subcategories;
  }, [subcategories, pickCatId, pickDivId, cats]);
  const subGroups = useMemo(() => {
    const byCat = new Map<string, SubcategoryRow[]>();
    for (const sc of subs) {
      const k = sc.category_id ?? "?";
      const arr = byCat.get(k) ?? [];
      arr.push(sc);
      byCat.set(k, arr);
    }
    /* Order follows the division cascade (same order the Categories column
       shows), so the two columns read in parallel. */
    const orderedCats = catGroups.flatMap((g) => g.items);
    const rest = categories.filter((c) => byCat.has(c.id) && !orderedCats.some((o) => o.id === c.id));
    return [...orderedCats, ...rest]
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ id: c.id, label: c.name, items: byCat.get(c.id)! }));
  }, [subs, categories, catGroups]);

  /* 4th tier — machine kinds, grouped under their subcategory. The cascade
     follows whatever the columns to the left are showing. */
  const kinds = useMemo(() => {
    if (pickSubSlug) return MACHINE_KINDS.filter((k) => k.subcategory === pickSubSlug);
    if (pickCatId || pickDivId) {
      const subSlugs = new Set(subs.map((s) => s.slug));
      return MACHINE_KINDS.filter((k) => subSlugs.has(k.subcategory));
    }
    return MACHINE_KINDS;
  }, [pickSubSlug, pickCatId, pickDivId, subs]);
  const kindGroups = useMemo(() => {
    const bySub = new Map<string, typeof MACHINE_KINDS>();
    for (const k of kinds) {
      const arr = bySub.get(k.subcategory) ?? [];
      arr.push(k);
      bySub.set(k.subcategory, arr);
    }
    const nameOf = new Map(subcategories.map((s) => [s.slug, s.name]));
    const cascade = subGroups.flatMap((g) => g.items);
    const ordered: { id: string; label: string; items: typeof MACHINE_KINDS }[] = [];
    const seen = new Set<string>();
    for (const sc of cascade) {
      if (bySub.has(sc.slug) && !seen.has(sc.slug)) { ordered.push({ id: sc.slug, label: sc.name, items: bySub.get(sc.slug)! }); seen.add(sc.slug); }
    }
    for (const [slug, items] of bySub) {
      if (!seen.has(slug)) ordered.push({ id: slug, label: nameOf.get(slug) ?? slug, items });
    }
    return ordered;
  }, [kinds, subcategories, subGroups]);

  /* Parent hairline header inside a column — same style the owner sees on
     the catalog sections. */
  const GroupHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-dim)] truncate">{label}</span>
      <span className="h-px flex-1 bg-[var(--border-faint)]" />
    </div>
  );

  const iconOf = (level: string, slug: string) => bindings[`classification.${level}.${slug}`];

  const NodeRow = ({ node }: { node: Node }) => {
    const url = iconOf(node.level, node.slug);
    return (
      <button
        type="button"
        onClick={() => setEditing(node)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 transition-colors text-start group"
      >
        <span className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${url ? "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]" : "border-dashed border-[var(--border-strong)] text-[var(--text-ghost)]"}`}>
          {url ? <Glyph url={url} className="h-[18px] w-[18px]" /> : <span className="text-[14px] leading-none">?</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--text-primary)] truncate">{node.name}</span>
          <span className="block text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{node.slug}</span>
        </span>
        {!url && <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-400 shrink-0">{t("vh.noIcon", "No icon")}</span>}
        <PencilIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  };

  if (loading) return <p className="py-16 text-center text-[13px] text-[var(--text-dim)]">{t("vh.loading", "Loading the live taxonomy…")}</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-[13.5px] font-bold text-[var(--text-primary)]">{t("vh.title", "Classification icons — control center")}</h2>
        <p className="text-[11.5px] text-[var(--text-dim)] mt-1 leading-relaxed">
          {t("vh.sub", "This is the LIVE taxonomy (the same tree products classify against). Click any node to bind its icon from the General Icons library. One icon = one meaning, enforced. Changes reach the whole system within a minute.")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{t("vh.divisions", "Divisions")} · {divisions.length}</h3>
          <div className="space-y-0.5">
            {divisions.map((d) => (
              <div key={d.id} className={pickDivId === d.id ? "rounded-xl ring-1 ring-[var(--border-focus)]" : ""} onClickCapture={() => { setPickDivId(d.id); setPickCatId(""); setPickSubSlug(""); }}>
                <NodeRow node={{ slug: d.slug, name: d.name, level: "division" }} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">
            {t("vh.categories", "Categories")} · {cats.length}{pickDivId ? "" : ` — ${t("vh.allShown", "all shown; pick a parent to narrow")}`}
          </h3>
          <div className="space-y-0.5 max-h-[62vh] overflow-y-auto">
            {catGroups.map((g) => (
              <div key={g.id}>
                <GroupHead label={g.label} />
                {g.items.map((c) => (
                  <div key={c.id} className={pickCatId === c.id ? "rounded-xl ring-1 ring-[var(--border-focus)]" : ""} onClickCapture={() => { setPickCatId(c.id); setPickSubSlug(""); }}>
                    <NodeRow node={{ slug: c.slug, name: c.name, level: "category" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">
            {t("vh.subcategories", "Subcategories")} · {subs.length}
          </h3>
          <div className="space-y-0.5 max-h-[62vh] overflow-y-auto">
            {subGroups.map((g) => (
              <div key={g.id}>
                <GroupHead label={g.label} />
                {g.items.map((sc) => (
                  <div key={sc.id} className={pickSubSlug === sc.slug ? "rounded-xl ring-1 ring-[var(--border-focus)]" : ""} onClickCapture={() => setPickSubSlug(sc.slug)}>
                    <NodeRow node={{ slug: sc.slug, name: sc.name, level: "subcategory" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">
            {t("vh.kinds", "Machine kinds")} · {kinds.length}
          </h3>
          <div className="space-y-0.5 max-h-[62vh] overflow-y-auto">
            {kindGroups.map((g) => (
              <div key={g.id}>
                <GroupHead label={g.label} />
                {g.items.map((k) => (
                  <NodeRow key={k.slug} node={{ slug: k.slug, name: k.name, level: "kind" }} />
                ))}
              </div>
            ))}
            {pickSubSlug && kinds.length === 0 && (
              <p className="px-3 py-4 text-[11px] text-[var(--text-ghost)]">{t("vh.noKinds", "This subcategory has no machine kinds registered.")}</p>
            )}
          </div>
        </section>
      </div>

      {editing && (
        <IconBindingPicker
          semanticKey={`classification.${editing.level}.${editing.slug}`}
          domain="classification"
          label={editing.name}
          currentUrl={iconOf(editing.level, editing.slug) ?? null}
          onClose={() => setEditing(null)}
          /* Reload the whole snapshot rather than patching bindings alone:
             the cache holds one object, so a half-updated copy would be the
             thing that gets shown on the next visit. */
          onSaved={() => { invalidateIconBindings(); void load(); }}
        />
      )}
    </div>
  );
}
