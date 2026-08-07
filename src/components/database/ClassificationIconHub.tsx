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

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { fetchDivisions, fetchCategories, fetchSubcategories } from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import { fetchIconBindings, invalidateIconBindings, type BindingsMap } from "@/lib/visual-bindings";
import IconBindingPicker from "./IconBindingPicker";
import PencilIcon from "@/components/icons/ui/PencilIcon";

interface Node { slug: string; name: string; level: "division" | "category" | "subcategory"; parent?: string }

function Glyph({ url, className = "h-4 w-4" }: { url: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ maskImage: `url("${url}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${url}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

export default function ClassificationIconHub() {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [bindings, setBindings] = useState<BindingsMap>({});
  const [pickDivId, setPickDivId] = useState<string>("");
  const [pickCatId, setPickCatId] = useState<string>("");
  const [editing, setEditing] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [d, c, sc, b] = await Promise.all([
      fetchDivisions().catch(() => []),
      fetchCategories().catch(() => []),
      fetchSubcategories().catch(() => []),
      fetchIconBindings(),
    ]);
    setDivisions(d);
    setCategories(c);
    setSubcategories(sc);
    setBindings(b);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const cats = useMemo(
    () => (pickDivId ? categories.filter((c) => c.division_id === pickDivId) : []),
    [categories, pickDivId],
  );
  const subs = useMemo(
    () => (pickCatId ? subcategories.filter((s) => s.category_id === pickCatId) : []),
    [subcategories, pickCatId],
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{t("vh.divisions", "Divisions")} · {divisions.length}</h3>
          <div className="space-y-0.5">
            {divisions.map((d) => (
              <div key={d.id} className={pickDivId === d.id ? "rounded-xl ring-1 ring-[var(--border-focus)]" : ""} onClickCapture={() => { setPickDivId(d.id); setPickCatId(""); }}>
                <NodeRow node={{ slug: d.slug, name: d.name, level: "division" }} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">
            {t("vh.categories", "Categories")} · {cats.length}{pickDivId ? "" : ` (${t("vh.pickDivision", "pick a division")})`}
          </h3>
          <div className="space-y-0.5 max-h-[62vh] overflow-y-auto">
            {cats.map((c) => (
              <div key={c.id} className={pickCatId === c.id ? "rounded-xl ring-1 ring-[var(--border-focus)]" : ""} onClickCapture={() => setPickCatId(c.id)}>
                <NodeRow node={{ slug: c.slug, name: c.name, level: "category" }} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">
            {t("vh.subcategories", "Subcategories")} · {subs.length}{pickCatId ? "" : ` (${t("vh.pickCategory", "pick a category")})`}
          </h3>
          <div className="space-y-0.5 max-h-[62vh] overflow-y-auto">
            {subs.map((sc) => (
              <NodeRow key={sc.id} node={{ slug: sc.slug, name: sc.name, level: "subcategory" }} />
            ))}
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
          onSaved={() => { invalidateIconBindings(); void fetchIconBindings().then(setBindings); }}
        />
      )}
    </div>
  );
}
