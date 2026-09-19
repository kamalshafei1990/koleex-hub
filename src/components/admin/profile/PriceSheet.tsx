"use client";

/* ---------------------------------------------------------------------------
   PriceSheet — the Price tab of the product profile, editable in place.

   THIS IS THE EDITOR'S PRICE TAB, READ-ONLY UNTIL YOU PRESS EDIT: the same
   cards, in the same order, fed by the same engine. Before this the record
   showed a flat list of per-variant rows and none of what the editor shows —
   no factory cost synced to the supplier, no landed cost, no Base FOB chain,
   no market prices (owner: "the layout is totally different and even the
   data is different").

     Cost Price          factory cost (¥) ↔ the primary supplier link, landed
                         cost, cost basis, the supplier's other price options
     Base FOB Price      cost → net internal → level → base FOB   (CALCULATED)
     Market & Customer   the market / channel ladder                (CALCULATED)
     Selling prices      per variant: pricing mode, USD prices, MOQ, lead time

   Edit is per card and keeps the layout: every tile stays in its cell and the
   value becomes the control. Cost saves through the supplier-link set (the
   editor's own two-way sync) or, with no supplier linked, onto the primary
   variant; selling prices PATCH each changed variant with its optimistic lock.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import { landedCostCny, saveProductSuppliers, updateModel, type ProductSupplierLinkRow } from "@/lib/products-admin";
import KdsSelect from "@/components/kds/Select";
import BaseFobCard from "../form-sections/BaseFobCard";
import PricingIntelligenceCard from "../form-sections/PricingIntelligenceCard";
import PriceOptionsFobList from "../form-sections/PriceOptionsFobList";
import { Group, StatTile, FactChip, CalcBadge, INP_B } from "./primitives";
import CircleDollarSignIcon from "@/components/icons/ui/CircleDollarSignIcon";
import CalculatorIcon from "@/components/icons/ui/CalculatorIcon";
import Globe2Icon from "@/components/icons/ui/Globe2Icon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import StickyNoteIcon from "@/components/icons/ui/StickyNoteIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import ReceiptIcon from "@/components/icons/ui/ReceiptIcon";
import PercentIcon from "@/components/icons/ui/PercentIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";

type Row = Record<string, unknown>;
type LinkRow = ProductSupplierLinkRow & Row & { supplier?: { name: string; logo: string | null } | null };
type PriceOpt = { price: string; note: string; note_i18n: Record<string, string> | null };
type ModelDraft = {
  pricing_mode: string; price_note: string; global_price: string; head_only_price: string;
  complete_set_price: string; cost_price: string; moq: string; lead_time: string;
};
type Draft = { cost: string; options: PriceOpt[]; models: Record<string, ModelDraft> };
type Card = "cost" | "selling";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (v: string) => { const x = v.trim(); if (!x) return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const money = (v: unknown, digits = 2) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
};
const DEC = /^\d*\.?\d*$/;
/* A blank tile says so quietly — the big bold figure is for numbers. */
const blank = (label: string) => <span className="text-[13px] font-medium text-[var(--text-ghost)]">{label}</span>;

export default function PriceSheet({
  product, models, suppliers, costVisible, productId, t, lang, motion, canEdit, onDirtyChange, onSaved, onHistory, notSet,
}: {
  product: Row | undefined;
  models: Row[];
  suppliers: Array<Row & { supplier: { name: string; logo: string | null } | null }>;
  costVisible: boolean;
  productId: string | undefined;
  t: (k: string, fb: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  /** A save landed: what changed, so the page shows it at once, then re-reads. */
  onSaved: (u: { models?: Record<string, Record<string, unknown>>; suppliers?: Row[] }) => void;
  onHistory: (m: { id: string; name: string }) => void;
  notSet: string;
}) {
  const [editing, setEditing] = useState<Card | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initialJson, setInitialJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  /* The option the tab is previewing the FOB cards from (null = main price). */
  const [previewRaw, setPreviewRaw] = useState<number | null>(null);
  const [ladderStatus, setLadderStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  /* The primary supplier link — the editor's single source for the factory
     cost once a supplier exists. */
  const links = suppliers as unknown as LinkRow[];
  const link = useMemo<LinkRow | null>(() => links.find((s) => s.is_primary) ?? links[0] ?? null, [links]);
  const primaryModel = models[0];
  const modelId = (m: Row) => String(m.id ?? "");

  const modelDraftOf = (m: Row): ModelDraft => ({
    pricing_mode: str(m.pricing_mode) || "fixed",
    price_note: str(m.price_note),
    global_price: str(m.global_price),
    head_only_price: str(m.head_only_price),
    complete_set_price: str(m.complete_set_price),
    cost_price: str(m.cost_price),
    moq: str(m.moq),
    lead_time: str(m.lead_time),
  });
  const begin = (k: Card) => {
    const d: Draft = {
      cost: str(link ? link.unit_cost_cny : primaryModel?.cost_price),
      options: ((link?.price_options ?? []) as Array<{ price: number | null; note: string; note_i18n?: Record<string, string> | null }>)
        .map((o) => ({ price: o.price === null || o.price === undefined ? "" : String(o.price), note: o.note ?? "", note_i18n: o.note_i18n ?? null })),
      models: Object.fromEntries(models.map((m) => [modelId(m), modelDraftOf(m)])),
    };
    setDraft(d); setInitialJson(JSON.stringify(d)); setSaveErr(null); setEditing(k);
  };
  const cancel = () => { setEditing(null); setDraft(null); setSaveErr(null); };
  const dirty = !!draft && JSON.stringify(draft) !== initialJson;
  useEffect(() => { onDirtyChange(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const patchModel = (id: string, u: Partial<ModelDraft>) =>
    setDraft((d) => (d ? { ...d, models: { ...d.models, [id]: { ...d.models[id], ...u } } } : d));

  /* ── What the sheet reads from: the draft while editing, the rows otherwise. */
  const eCost = editing === "cost";
  const eSell = editing === "selling";
  const costStr = eCost && draft ? draft.cost : str(link ? link.unit_cost_cny : primaryModel?.cost_price);
  const costNum = numOrNull(costStr);
  const options: PriceOpt[] = eCost && draft
    ? draft.options
    : ((link?.price_options ?? []) as Array<{ price: number | null; note: string; note_i18n?: Record<string, string> | null }>)
        .map((o) => ({ price: o.price === null || o.price === undefined ? "" : String(o.price), note: o.note ?? "", note_i18n: o.note_i18n ?? null }));

  /* Landed cost — the same maths the editor's Price tab prices from. */
  const landedFor = (raw: number | null) => landedCostCny({
    unit_cost_cny: raw,
    cost_basis: link?.cost_basis ?? null,
    cost_includes_tax: link?.cost_includes_tax ?? null,
    cost_extras: link?.cost_extras ?? null,
  });
  const landed = landedFor(costNum);
  const previewLanded = previewRaw !== null ? landedFor(previewRaw).landed : null;
  const engineCost = previewLanded ?? landed.landed ?? costNum;
  const basisIncomplete = !!link && landed.parts.length === 0 && landed.taxPercent === null
    && (link.cost_basis !== "delivered" || !link.cost_includes_tax);

  const priced = options
    .map((o, idx) => {
      const raw = o.price === "" ? NaN : Number(o.price);
      if (!Number.isFinite(raw) || raw <= 0) return null;
      return { idx, raw, landed: landedFor(raw).landed ?? raw, label: (((o.note_i18n ?? {})[lang] || "").trim() || o.note || "").trim() };
    })
    .filter((x): x is { idx: number; raw: number; landed: number; label: string } => x !== null);
  const unpriced = options.filter((o) => !(Number(o.price) > 0));
  const linkNote = (((link?.notes_i18n ?? {}) as Record<string, string>)[lang] || "").trim() || str(link?.notes);

  /* ── Save ── */
  const save = async () => {
    if (!draft || !editing || !productId || !dirty) return;
    setSaving(true); setSaveErr(null);
    try {
      if (editing === "cost") {
        const cost = numOrNull(draft.cost);
        if (link) {
          /* The link set is replaced whole (the API's contract) — every other
             link goes back exactly as it came, only the primary's cost and
             ladder change. */
          const rows = links.map((s) => {
            const { supplier: _s, ...rest } = s;
            void _s;
            if (s !== link) return rest;
            return {
              ...rest,
              unit_cost_cny: cost,
              price_options: draft.options.map((o) => ({ price: numOrNull(o.price), note: o.note, note_i18n: o.note_i18n })),
            };
          });
          const ok = await saveProductSuppliers(productId, rows as ProductSupplierLinkRow[]);
          if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save the cost."));
          /* One source: once the supplier carries the cost, the variant's own
             copy is cleared (the editor does the same). */
          const clearModel = !!primaryModel && primaryModel.cost_price != null && primaryModel.cost_price !== "";
          if (clearModel) await updateModel(modelId(primaryModel), { cost_price: null });
          onSaved({
            suppliers: rows.map((r, i) => ({ ...r, supplier: suppliers[i]?.supplier ?? null })),
            models: clearModel ? { [modelId(primaryModel)]: { cost_price: null } } : undefined,
          });
        } else if (primaryModel) {
          const r = await updateModel(modelId(primaryModel), { cost_price: cost, _expected_updated_at: primaryModel.updated_at ?? null });
          if (!r.ok) throw new Error(r.conflict ? t("pr.conflict", "This variant was changed by someone else — reload and try again.") : t("pr.saveFailed", "Couldn't save the cost."));
          onSaved({ models: { [modelId(primaryModel)]: { cost_price: cost, updated_at: r.updated_at ?? primaryModel.updated_at } } });
        }
      } else {
        const changed: Record<string, Record<string, unknown>> = {};
        for (const m of models) {
          const id = modelId(m);
          const before = modelDraftOf(m);
          const after = draft.models[id];
          if (!after || JSON.stringify(before) === JSON.stringify(after)) continue;
          const patch: Record<string, unknown> = { _expected_updated_at: m.updated_at ?? null };
          if (after.pricing_mode !== before.pricing_mode) patch.pricing_mode = after.pricing_mode;
          if (after.price_note !== before.price_note) patch.price_note = after.price_note.trim() || null;
          if (after.global_price !== before.global_price) patch.global_price = numOrNull(after.global_price);
          if (after.head_only_price !== before.head_only_price) patch.head_only_price = numOrNull(after.head_only_price);
          if (after.complete_set_price !== before.complete_set_price) patch.complete_set_price = numOrNull(after.complete_set_price);
          if (after.cost_price !== before.cost_price) patch.cost_price = numOrNull(after.cost_price);
          if (after.moq !== before.moq) patch.moq = numOrNull(after.moq);
          if (after.lead_time !== before.lead_time) patch.lead_time = after.lead_time.trim() || null;
          const r = await updateModel(id, patch);
          if (!r.ok) throw new Error(r.conflict ? t("pr.conflict", "This variant was changed by someone else — reload and try again.") : t("pr.saveFailed", "Couldn't save the prices."));
          const { _expected_updated_at: _x, ...applied } = patch;
          void _x;
          changed[id] = { ...applied, updated_at: r.updated_at ?? m.updated_at };
        }
        onSaved({ models: changed });
      }
      setEditing(null); setDraft(null);
    } catch (e) {
      setSaveErr(humanizeError(e));
    } finally {
      setSaving(false);
    }
  };
  const gp = (k: Card) => ({
    editLabel: t("action.edit", "Edit"),
    onEdit: canEdit ? () => begin(k) : undefined,
    editing: editing === k,
    saving,
    error: editing === k ? saveErr : null,
    onSave: save,
    onCancel: cancel,
    saveLabel: t("action.save", "Save"),
    cancelLabel: t("action.cancel", "Cancel"),
    canSave: dirty,
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
  };

  /* The ladder → Buyer Options bridge, the editor's own (owner decision
     2026-08-29): the option rows become ONE required choice group whose
     deltas are COST deltas in CNY. Writes at once — it is an action, not a
     field of this card. */
  const ladderToOptions = async () => {
    if (!link || !productId || priced.length === 0 || costNum === null) return;
    setLadderStatus("saving");
    try {
      const res = await fetch(`/api/product-options?product_id=${productId}`, { credentials: "include" });
      const j = (await res.json()) as { options?: Array<Record<string, unknown> & { id?: string; title?: string; values?: Array<Record<string, unknown>> }> };
      const existing = (j.options ?? []).map((o) => ({
        key: String(o.id ?? ""), title: o.title, title_i18n: o.title_i18n, kind: o.kind, required: o.required, active: o.active,
        values: (o.values ?? []).map((v) => ({
          key: String(v.id ?? ""), label: v.label, label_i18n: v.label_i18n, image_url: v.image_url,
          linked_product_id: v.linked_product_id, linked_model_id: v.linked_model_id,
          price_delta_cny: v.price_delta_cny, weight_delta_kg: v.weight_delta_kg, cbm_delta: v.cbm_delta, is_default: v.is_default, active: v.active,
        })),
      }));
      const GROUP_TITLE = "Configuration";
      const kept = existing.filter((o) => o.title !== GROUP_TITLE);
      const group = {
        key: crypto.randomUUID(), title: GROUP_TITLE, title_i18n: { zh: "配置", ar: "التهيئة" }, kind: "choice", required: true, active: true,
        values: [
          { key: crypto.randomUUID(), label: (str(link.notes)).trim() || "Standard", label_i18n: link.notes_i18n ?? null, price_delta_cny: null, weight_delta_kg: null, is_default: true, active: true },
          ...priced.map((o2) => ({
            key: crypto.randomUUID(),
            label: (options[o2.idx]?.note || "").trim() || `Option ¥${o2.raw.toLocaleString()}`,
            label_i18n: options[o2.idx]?.note_i18n ?? null,
            price_delta_cny: o2.raw - costNum, weight_delta_kg: null, is_default: false, active: true,
          })),
        ],
      };
      const put = await fetch("/api/product-options", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, options: [...kept, group] }),
      });
      if (!put.ok) throw new Error(String(put.status));
      setLadderStatus("done");
    } catch {
      setLadderStatus("error");
    }
  };

  const basisLabel = (b: unknown) =>
    b === "factory_only" ? t("sup.costFactory", "Factory only (ex-works)")
      : b === "packing" ? t("sup.costPacking", "+ Packing (no delivery)")
      : t("sup.costDelivered", "Delivered to Koleex (full landed)");
  const modeLabel = (m: string) =>
    m === "from" ? t("mv.pricingFrom", "From — base + options")
      : m === "on_request" ? t("mv.pricingOnRequest", "Priced per configuration")
      : t("mv.pricingFixed", "Fixed price");
  const modeOptions = [
    { value: "fixed", label: t("mv.pricingFixed", "Fixed price") },
    { value: "from", label: t("mv.pricingFrom", "From — base + options") },
    { value: "on_request", label: t("mv.pricingOnRequest", "Priced per configuration") },
  ];
  const numInput = (value: string, onChange: (v: string) => void, opts?: { placeholder?: string; disabled?: boolean; wide?: boolean }) => (
    <input
      inputMode="decimal"
      value={value}
      disabled={opts?.disabled}
      onChange={(e) => { const v = e.target.value; if (v === "" || DEC.test(v)) onChange(v); }}
      placeholder={opts?.placeholder ?? "0"}
      className={`${INP_B} ${opts?.wide ? "w-full" : "w-full max-w-[140px]"} tabular-nums disabled:opacity-50`}
    />
  );

  const calcNote = (text: string) => (
    <div className="flex items-center gap-2 mb-3 text-[10.5px] text-[var(--text-ghost)]">
      <CalcBadge label={t("pk.calculated", "Calculated")} />
      <span>{text}</span>
    </div>
  );

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      {/* ── 1. Cost Price ─────────────────────────────────────────────── */}
      {costVisible && (
        <Group motion={motion} icon={<CircleDollarSignIcon className="h-4 w-4" />} title={t("pricing.costPriceTitle", "Cost Price")} count={t("pricing.costPriceBadge", "Factory · CNY")} {...gp("cost")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <StatTile
              label={t("pricing.factoryCostCny", "Factory cost (CNY)")}
              value={costNum === null ? blank(notSet) : `¥${money(costNum, 0)}`}
              unit={eCost ? "¥" : undefined}
              tone="accent"
              input={eCost && draft ? numInput(draft.cost, (v) => setDraft((d) => (d ? { ...d, cost: v } : d))) : undefined}
            />
            <StatTile
              label={t("pr.landed", "Landed cost")}
              value={landed.landed === null ? "—" : `¥${money(landed.landed, 0)}`}
              extra={
                <div className="mt-1 text-[10px] text-[var(--text-ghost)] leading-snug">
                  <CalcBadge label={t("pk.calculated", "Calculated")} />
                  {landed.landed !== null && (landed.parts.length > 0 || landed.taxPercent !== null) ? (
                    <span className="block mt-1 tabular-nums">
                      ¥{money(costNum, 0)}{landed.parts.map((pt) => ` + ¥${pt.amount.toLocaleString()} ${pt.label}`).join("")}{landed.taxPercent !== null ? ` + ${landed.taxPercent}% VAT` : ""}
                    </span>
                  ) : (
                    <span className="block mt-1">{t("pr.landedSame", "Same as the factory cost — nothing to add.")}</span>
                  )}
                </div>
              }
            />
            <FactChip
              icon={<FactoryIcon className="h-5 w-5" />}
              label={t("pr.source", "Cost source")}
              value={link ? (link.supplier?.name ?? "—") : t("pr.onVariant", "On the variant")}
              note={link ? t("pricing.costPriceHintSynced", "Synced with the Supplier tab") : t("pr.noLink", "No supplier linked yet — once one is linked the cost moves onto it.")}
            />
            <FactChip
              icon={<ReceiptIcon className="h-5 w-5" />}
              label={t("pr.basis", "Cost basis")}
              value={link ? basisLabel(link.cost_basis) : "—"}
              note={link ? t("pr.basisOnSupplier", "Set on the Supplier tab") : undefined}
              tone={basisIncomplete ? "warn" : "plain"}
            />
            <FactChip
              icon={<PercentIcon className="h-5 w-5" />}
              label={t("pr.tax", "Tax")}
              value={!link ? "—" : link.cost_includes_tax === false ? t("sup.taxNotIncluded", "Tax NOT included") : t("sup.taxIncluded", "Tax included")}
              note={link && link.cost_includes_tax === false
                ? (landed.taxPercent !== null ? t("pr.taxAdded", "{n}% VAT added to the landed cost").replace("{n}", String(landed.taxPercent)) : t("pr.taxMissing", "VAT rate not entered — enter it on the Supplier tab."))
                : undefined}
              tone={link && link.cost_includes_tax === false && landed.taxPercent === null ? "warn" : "plain"}
            />
          </div>
          {basisIncomplete && (
            <p className="mt-2 text-[10.5px] text-amber-400/90">⚠ {t("pricing.basisIncomplete", "The supplier price is not full-landed/tax-in and the missing costs are not entered yet (Supplier tab) — pricing below uses the raw price.")}</p>
          )}
          {costNum === null && (
            <p className="mt-2 text-[10.5px] text-[var(--text-ghost)]">{t("pr.noCost", "No factory cost yet — the Base FOB and market prices below need it.")}</p>
          )}
          {previewRaw !== null && (
            <p className="mt-2 text-[10.5px] text-[var(--accent)]">
              ▸ {t("pricing.previewingOption", "Previewing the pricing below from option")} <b className="tabular-nums">¥{previewRaw.toLocaleString()}</b> — {t("pricing.previewingOptionHint", "the main price is unchanged; click the option again to switch back.")}
            </p>
          )}

          {(linkNote || options.length > 0) && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1.5">{t("pr.options", "The supplier's price options")}</div>
              {linkNote && <p className="text-[10.5px] italic leading-snug text-[var(--text-muted)] whitespace-pre-wrap mb-1">{linkNote}</p>}
              {priced.length > 0 && (
                <PriceOptionsFobList
                  items={priced}
                  selectedRaw={previewRaw}
                  onSelect={setPreviewRaw}
                  onEditPrice={eCost && draft
                    ? (idx, value) => setDraft((d) => (d ? { ...d, options: d.options.map((o, i) => (i === idx ? { ...o, price: value } : o)) } : d))
                    : undefined}
                />
              )}
              {unpriced.map((o, oi) => {
                const onote = ((o.note_i18n ?? {})[lang] || "").trim() || o.note;
                return (
                  <p key={`u${oi}`} className="mt-1 text-[10.5px] leading-snug text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-subtle)] tabular-nums">¥—</span>
                    {onote ? <span className="italic"> — {onote}</span> : null}
                  </p>
                );
              })}
              {canEdit && !eCost && priced.length > 0 && link && productId && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={ladderStatus === "saving" || ladderStatus === "done"}
                    onClick={() => void ladderToOptions()}
                    className={`h-7 px-2.5 rounded-lg border text-[10.5px] font-medium transition-colors ${
                      ladderStatus === "done"
                        ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {ladderStatus === "saving" ? t("pricing.ladder2optSaving", "Adding…")
                      : ladderStatus === "done" ? t("pricing.ladder2optDone", "✓ Added as Buyer Options — set the weight deltas on the Options tab")
                      : ladderStatus === "error" ? t("pricing.ladder2optError", "Failed — try again")
                      : t("pricing.ladder2opt", "Add these as Buyer Options (Options tab)")}
                  </button>
                </div>
              )}
            </div>
          )}
        </Group>
      )}

      {/* ── 2. Base FOB ───────────────────────────────────────────────── */}
      {costVisible && (
        <Group motion={motion} icon={<CalculatorIcon className="h-4 w-4" />} title={t("pricing.baseFobTitle", "Base FOB Price")} count={t("pricing.baseFobBadge", "Auto · by product level")}>
          {calcNote(t("pr.baseNote", "From the landed cost and the product level, through Commercial Setup — change either and this moves."))}
          <BaseFobCard costCny={engineCost !== null && Number.isFinite(engineCost) ? engineCost : null} currency="CNY" />
        </Group>
      )}

      {/* ── 3. Market & Customer Pricing ──────────────────────────────── */}
      {costVisible && (
        <Group motion={motion} icon={<Globe2Icon className="h-4 w-4" />} title={t("pricing.fobTitle", "Market & Customer Pricing")} count={t("pricing.fobBadge", "Live · from Commercial Setup")}>
          {calcNote(t("pr.marketNote", "The market and channel prices for the cost above, live from Commercial Setup."))}
          {/* The card's chain row and tier table have a floor width; on a
              phone they scroll inside the card, the page never does. */}
          <div className="min-w-0 max-w-full overflow-x-auto">
            <PricingIntelligenceCard
              costCny={engineCost !== null && Number.isFinite(engineCost) ? engineCost : null}
              currency="CNY"
              subcategorySlug={str(product?.subcategory_slug) || null}
              supportsCompleteSet={!!product?.supports_complete_set}
            />
          </div>
        </Group>
      )}

      {/* ── 4. Selling prices, per variant ────────────────────────────── */}
      <Group motion={motion} icon={<TagsIcon className="h-4 w-4" />} title={t("pr.selling", "Selling prices")} count={models.length === 1 ? t("pr.variant1", "1 variant") : t("pr.variantsN", "{n} variants").replace("{n}", String(models.length))} {...gp("selling")}>
        {models.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noPrice", "No variant to price.")}</p>
        ) : (
          <div className="space-y-3">
            {models.map((m, i) => {
              const id = modelId(m);
              const d = eSell && draft ? draft.models[id] : modelDraftOf(m);
              const mode = d.pricing_mode || "fixed";
              const costHere = d.cost_price.trim() ? numOrNull(d.cost_price) : (link ? costNum : null);
              const costFromLink = !d.cost_price.trim() && !!link && costNum !== null;
              return (
                <div key={id || i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <div className="flex items-center gap-2 mb-3 min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{str(m.model_name) || t("pp.untitledVariant", "Untitled variant")}</span>
                    <span className="text-[11px] font-mono text-[var(--text-dim)] shrink-0">{str(m.primary_model) || "—"}</span>
                    {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">{t("pp.primary", "Primary")}</span>}
                    <span className="flex-1" />
                    {costVisible && !eSell && (
                      <button
                        type="button"
                        onClick={() => onHistory({ id, name: str(m.model_name) })}
                        className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 transition-colors"
                      >
                        <HistoryIcon className="h-3 w-3" /> {t("pp.f.costHistory", "Cost history")}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    <StatTile
                      label={t("mv.pricingMode", "Pricing")}
                      value={<span className="text-[15px]">{modeLabel(mode)}</span>}
                      input={eSell ? (
                        <KdsSelect value={mode} onChange={(v) => patchModel(id, { pricing_mode: v })} options={modeOptions} triggerClassName={`${INP_B} w-full pe-8 text-start`} />
                      ) : undefined}
                    />
                    <StatTile
                      label={t("mv.sellUsd", "Global Selling Price (USD)")}
                      value={d.global_price.trim() ? `$${money(d.global_price)}` : blank(notSet)}
                      unit={eSell ? "$" : undefined}
                      tone="accent"
                      input={eSell ? numInput(d.global_price, (v) => patchModel(id, { global_price: v }), { disabled: mode === "on_request" }) : undefined}
                    />
                    {costVisible && (
                      <StatTile
                        label={t("mv.headOnlyPrice", "Head-Only Price")}
                        value={d.head_only_price.trim() ? `$${money(d.head_only_price)}` : blank(notSet)}
                        unit={eSell ? "$" : undefined}
                        input={eSell ? numInput(d.head_only_price, (v) => patchModel(id, { head_only_price: v })) : undefined}
                      />
                    )}
                    {costVisible && (
                      <StatTile
                        label={t("mv.completeSetPrice", "Complete Set Price")}
                        value={d.complete_set_price.trim() ? `$${money(d.complete_set_price)}` : blank(notSet)}
                        unit={eSell ? "$" : undefined}
                        input={eSell ? numInput(d.complete_set_price, (v) => patchModel(id, { complete_set_price: v })) : undefined}
                      />
                    )}
                    {costVisible && (
                      <StatTile
                        label={t("mv.costCny", "Cost Price (CNY)")}
                        value={costHere === null ? blank(notSet) : `¥${money(costHere, 0)}`}
                        unit={eSell && !link ? "¥" : undefined}
                        /* With a supplier linked the cost lives on the link (the
                           Cost Price card above) — here it is read, not typed. */
                        input={eSell && !link ? numInput(d.cost_price, (v) => patchModel(id, { cost_price: v }), { disabled: mode === "on_request" }) : undefined}
                        extra={costFromLink ? <div className="mt-1 text-[10px] text-[var(--text-ghost)]">{t("pp.f.costFromSupplier", "From the supplier link — not set on this variant.")}</div> : undefined}
                      />
                    )}
                    <StatTile
                      label={t("mv.moq", "MOQ (Min Order Qty)")}
                      value={d.moq.trim() ? d.moq : blank(notSet)}
                      input={eSell ? numInput(d.moq, (v) => patchModel(id, { moq: v }), { placeholder: "e.g. 10" }) : undefined}
                    />
                    <StatTile
                      label={t("mv.leadTime", "Lead Time")}
                      value={d.lead_time.trim() ? <span className="text-[15px]">{d.lead_time}</span> : blank(notSet)}
                      input={eSell ? (
                        <input value={d.lead_time} onChange={(e) => patchModel(id, { lead_time: e.target.value })} placeholder={t("mv.phLeadTime", "e.g. 7-14 days")} className={`${INP_B} w-full`} />
                      ) : undefined}
                    />
                    {mode !== "fixed" && (
                      <FactChip
                        wide
                        icon={<StickyNoteIcon className="h-5 w-5" />}
                        label={t("mv.priceNote", "What drives the price")}
                        value={d.price_note.trim() || notSet}
                        input={eSell ? (
                          <input value={d.price_note} onChange={(e) => patchModel(id, { price_note: e.target.value })} placeholder={t("mv.phPriceNote", "e.g. depends on table width, motor and automation level")} className={`${INP_B} w-full`} />
                        ) : undefined}
                      />
                    )}
                  </div>
                  {costVisible && m.cost_updated_at ? (
                    <div className="mt-2 text-[10.5px] text-[var(--text-ghost)]">
                      {t("pp.f.costMeta", "Updated {date} by {name} · via {src}")
                        .replace("{date}", new Date(String(m.cost_updated_at)).toLocaleDateString("en-GB"))
                        .replace("{name}", str(m.cost_updated_by_name) || "—")
                        .replace("{src}", t("pp.h.src." + str(m.cost_source), str(m.cost_source) || "—"))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Group>
    </div>
  );
}
