"use client";

/* ---------------------------------------------------------------------------
   ClassifySheet — the Classify tab of the product profile, editable in place.

   Division → Category → Subcategory, the editor's three tiers, as the same
   rows the record has always shown; Edit turns the three values into three
   dependent dropdowns (with the classification icon hub's glyphs) and leaves
   everything else where it is. The subcategory code and the spec template
   are CALCULATED from the choice; the tier is edited on Hero, the family is
   the product + its models.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { updateProduct } from "@/lib/products-admin";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import KdsSelect from "@/components/kds/Select";
import BoundIcon from "@/components/common/BoundIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import { Group, FieldRow, MaskGlyph, Blank, CalcBadge, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type Draft = { division_slug: string; category_slug: string; subcategory_slug: string };
type Taxo = { divisions: DivisionRow[]; categories: CategoryRow[]; subcategories: SubcategoryRow[] };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ClassifySheet({
  product, subcategory, schema, modelCount, productId, t, lang, motion, canEdit, onDirtyChange, onSaved, notSet,
  taxoName, classIcons, glyph,
}: {
  product: Row | undefined;
  subcategory: { slug: string; code: string; name: string } | null;
  schema: { name: string; version: string } | null;
  modelCount: number;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (patch: Row) => void;
  notSet: string;
  /** Translated name of a taxonomy row by tier + slug (the page's index). */
  taxoName: (tier: "division" | "category" | "subcategory", slug: unknown) => string | null;
  classIcons: Record<string, Record<string, string>>;
  glyph: (label: string) => React.ReactNode;
}) {
  const [taxo, setTaxo] = useState<Taxo | null>(null);
  const sheet = useSheetEdit<"classify", Draft>({
    t, onDirtyChange,
    makeDraft: () => ({
      division_slug: str(product?.division_slug),
      category_slug: str(product?.category_slug),
      subcategory_slug: str(product?.subcategory_slug),
    }),
    valid: (_c, d) => !!d.division_slug && !!d.category_slug && !!d.subcategory_slug,
    commit: async (_c, d) => {
      if (!productId) return;
      const patch = { division_slug: d.division_slug, category_slug: d.category_slug, subcategory_slug: d.subcategory_slug };
      await updateProduct(productId, patch);
      onSaved(patch);
    },
  });
  const e = sheet.editing === "classify";
  const d = sheet.draft;

  /* The full taxonomy (ids, parents) is only needed while editing. */
  useEffect(() => {
    if (!e || taxo) return;
    let alive = true;
    void import("@/lib/products-admin").then(({ fetchTaxonomyAll }) =>
      fetchTaxonomyAll().then((all) => { if (alive) setTaxo(all); }).catch(() => {}));
    return () => { alive = false; };
  }, [e, taxo]);

  const localName = (r: { name: string; name_zh?: string | null; name_ar?: string | null }) =>
    (lang === "zh" ? r.name_zh : lang === "ar" ? r.name_ar : null) || r.name;
  const iconOf = (tier: string, slug: string) => {
    const src = classIcons[tier]?.[slug];
    return src ? <MaskGlyph src={src} className="h-4 w-4" /> : undefined;
  };
  const divId = taxo?.divisions.find((x) => x.slug === d?.division_slug)?.id;
  const catId = taxo?.categories.find((x) => x.slug === d?.category_slug)?.id;
  const cats = taxo && divId ? taxo.categories.filter((c) => c.division_id === divId) : [];
  const subs = taxo && catId ? taxo.subcategories.filter((s) => s.category_id === catId) : [];
  const sel = `${INP_B} w-full pe-8 text-start`;

  const divSlug = e && d ? d.division_slug : str(product?.division_slug);
  const catSlug = e && d ? d.category_slug : str(product?.category_slug);
  const subSlug = e && d ? d.subcategory_slug : str(product?.subcategory_slug);
  const subRow = taxo?.subcategories.find((s) => s.slug === subSlug) as (SubcategoryRow & { code?: string | null }) | undefined;
  const subCode = subSlug === str(product?.subcategory_slug) ? subcategory?.code : subRow?.code;
  const glyphFor = (tier: "division" | "category" | "subcategory", slug: string, label: string) => {
    const src = classIcons[tier]?.[slug];
    return src ? <MaskGlyph src={src} className="h-4 w-4" /> : glyph(label);
  };
  const val = (tier: "division" | "category" | "subcategory", slug: string) => {
    if (!slug) return <Blank label={notSet} />;
    const fromIndex = taxoName(tier, slug);
    if (fromIndex) return fromIndex;
    const row = tier === "division" ? taxo?.divisions.find((x) => x.slug === slug)
      : tier === "category" ? taxo?.categories.find((x) => x.slug === slug)
      : taxo?.subcategories.find((x) => x.slug === slug);
    return row ? localName(row) : slug;
  };
  const level = str(product?.level);

  return (
    <div onKeyDown={sheet.onKeyDown}>
      <Group
        motion={motion}
        icon={<BoundIcon semanticKey="field.category" className="h-4 w-4" fallback={<FolderTreeIcon className="h-4 w-4" />} />}
        title={t("pp.sec.classification", "Classification")}
        count={t("classify.badge", "Division · Category · Subcategory")}
        {...sheet.gp("classify", canEdit)}
      >
        {/* Two columns on a wide screen: seven short facts in one column left
            most of the card empty. The hierarchy still reads top-left down. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0 sm:[&>*:nth-last-child(2):nth-child(odd)]:border-b-0">
          <FieldRow
            label={t("pp.f.division", "Division")}
            glyph={glyphFor("division", divSlug, t("pp.f.division", "Division"))}
            value={val("division", divSlug)}
            input={e && d ? (
              <KdsSelect
                value={d.division_slug}
                onChange={(v) => sheet.patch({ division_slug: v, category_slug: "", subcategory_slug: "" })}
                options={(taxo?.divisions ?? []).map((x) => ({ value: x.slug, label: localName(x), icon: iconOf("division", x.slug) }))}
                placeholder={taxo ? t("cl.pickDivision", "Pick a division…") : t("cl.loading", "Loading…")}
                triggerClassName={sel}
              />
            ) : undefined}
          />
          <FieldRow
            label={t("pp.f.category", "Category")}
            glyph={glyphFor("category", catSlug, t("pp.f.category", "Category"))}
            value={val("category", catSlug)}
            input={e && d ? (
              <KdsSelect
                value={d.category_slug}
                onChange={(v) => sheet.patch({ category_slug: v, subcategory_slug: "" })}
                options={cats.map((x) => ({ value: x.slug, label: localName(x), icon: iconOf("category", x.slug) }))}
                placeholder={d.division_slug ? t("cl.pickCategory", "Pick a category…") : t("cl.divisionFirst", "Pick the division first")}
                triggerClassName={sel}
                disabled={!d.division_slug}
              />
            ) : undefined}
          />
          <FieldRow
            label={t("pp.f.subcategory", "Subcategory")}
            glyph={glyphFor("subcategory", subSlug, t("pp.f.subcategory", "Subcategory"))}
            value={val("subcategory", subSlug)}
            help={e ? t("cl.templateNote", "The subcategory picks the spec template and the KOLEEX code prefix — change it and the Specs tab follows.") : undefined}
            input={e && d ? (
              <KdsSelect
                value={d.subcategory_slug}
                onChange={(v) => sheet.patch({ subcategory_slug: v })}
                options={subs.map((x) => ({ value: x.slug, label: localName(x), icon: iconOf("subcategory", x.slug) }))}
                placeholder={d.category_slug ? t("cl.pickSubcategory", "Pick a subcategory…") : t("cl.categoryFirst", "Pick the category first")}
                triggerClassName={sel}
                disabled={!d.category_slug}
              />
            ) : undefined}
          />
          <FieldRow
            label={t("pp.f.subCode", "Subcategory code")}
            glyph={glyph(t("pp.f.subCode", "Subcategory code"))}
            value={subCode ? subCode : <Blank label={notSet} />}
            mono
            badge={<CalcBadge label={t("pk.calculated", "Calculated")} />}
          />
          <FieldRow
            label={t("pp.f.family", "Family")}
            glyph={glyph(t("pp.f.family", "Family"))}
            value={modelCount > 1
              ? t("pp.f.familyOfN", "Family of {n} models").replace("{n}", String(modelCount))
              : t("pp.f.standalone", "Standalone product")}
            help={t("cl.familyNote", "The product and its models on the Variants tab.")}
          />
          <FieldRow
            label={t("pp.f.level", "Level")}
            glyph={glyph(t("pp.f.level", "Level"))}
            value={level ? t(`hero.level${level.charAt(0).toUpperCase()}${level.slice(1)}`, level) : <Blank label={notSet} />}
            help={t("cl.levelOnHero", "Set on the Hero tab (market tier).")}
          />
          <FieldRow
            label={t("pp.f.template", "Spec template")}
            glyph={glyph(t("pp.f.template", "Spec template"))}
            value={schema ? `${schema.name} v${schema.version}` : <Blank label={notSet} />}
            badge={<CalcBadge label={t("pk.calculated", "Calculated")} />}
          />
        </div>
      </Group>
    </div>
  );
}
