"use client";

/* ---------------------------------------------------------------------------
   Family member context — the owner's model of family editing:

     "In Hero I press HAS FAMILY → a second tab strip appears under the
      main tabs, one tab per member (+ add). I pick a member there, then
      whatever main tab I open (Hero / Specs / Price / Logistics) edits
      THAT member."

   The strip selects WHICH PRODUCT the form is pointed at; the main tabs
   stay WHAT SECTION. Member-owned data = product_models columns (+ spec
   overrides + model photo); everything else is family-shared and says so.

   These are dumb panels over ModelFormState — no fetching, no saving;
   the form's normal save path persists the models array.
   --------------------------------------------------------------------------- */

import type { ModelFormState } from "@/types/product-form";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ConfirmDialog from "./ConfirmDialog";
import { useState } from "react";

const inp =
  "w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
const lbl = "block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5";

export function memberLabel(m: ModelFormState, i: number): string {
  return (m.primary_model || "").trim() || (m.model_name || "").trim() || `#${i + 1}`;
}

/* ── The second tab strip ── */
export function FamilyStrip({
  models, active, onPick, onAdd, onRemove,
}: {
  models: ModelFormState[];
  active: number;
  onPick: (i: number) => void;
  onAdd: () => void;
  /* Remove a NON-primary member. The × sits on the ACTIVE pill only —
     you must be looking at a model to delete it, never a stray tap. */
  onRemove?: (i: number) => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [askRemove, setAskRemove] = useState<number | null>(null);
  return (
    <div className="mb-4 -mt-1">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] pe-1">
          <BoxesIcon className="h-3 w-3" />
          {t("fam.strip", "Family")}
        </span>
        {models.map((m, i) => {
          const isActive = active === i;
          return (
            <button
              key={m._tempId}
              type="button"
              onClick={() => onPick(i)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold tabular-nums transition-colors ${
                isActive
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                  : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
              }`}
            >
              {i === 0 && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[var(--text-inverted)]" : "bg-[var(--text-ghost)]"}`}
                  title={t("pp.primary", "Primary")}
                />
              )}
              {memberLabel(m, i)}
              {isActive && i > 0 && onRemove && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t("famGrid.removeModel", "Remove model")}
                  title={t("famGrid.removeModel", "Remove model")}
                  onClick={(e) => { e.stopPropagation(); setAskRemove(i); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setAskRemove(i); } }}
                  className="ms-0.5 -me-1 h-5 w-5 rounded-md inline-flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity"
                >
                  <CrossIcon className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
        >
          <PlusIcon className="h-3 w-3" /> {t("fam.addMember", "Add model")}
        </button>
      </div>
      {active > 0 && (
        <p className="mt-1 text-[10.5px] text-[#567FB2] font-medium">
          {t("fam.editingNote", "You are editing {code} — Hero, Specs, Price and Logistics save to this model. Other tabs are family-shared.")
            .replace("{code}", memberLabel(models[active], active))}
        </p>
      )}
      <ConfirmDialog
        open={askRemove != null}
        onClose={() => setAskRemove(null)}
        onConfirm={() => { if (askRemove != null && onRemove) onRemove(askRemove); setAskRemove(null); }}
        title={t("famGrid.removeModel", "Remove model")}
        message={t("famGrid.removeConfirm", "Remove this model from the family? Its differences are discarded when you save.")}
        confirmLabel={t("famGrid.removeModel", "Remove model")}
        destructive
      />
    </div>
  );
}

/* ── Divider shown above family-shared content while a member is active ── */
export function FamilySharedDivider() {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] shrink-0">
        {t("fam.sharedBelow", "Family-shared — applies to all models")}
      </span>
      <span className="flex-1 h-px bg-[var(--border-subtle)]" />
    </div>
  );
}

/* ── Hero panel: the member's identity ── */
export function MemberIdentityPanel({
  model, onUpdate, photoUrl, onSetPhoto, onRemovePhoto, familyProductName,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  photoUrl?: string | null;
  onSetPhoto?: (f: File) => void;
  onRemovePhoto?: () => void;
  /* The family's product name — the member's name DEFAULTS to it (shown
     as placeholder) and stays editable per model. */
  familyProductName?: string;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  return (
    <div className="rounded-2xl border border-[#567FB2]/30 bg-[var(--bg-secondary)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("fam.identityTitle", "This model's identity")}
        </h3>
        <span className="text-[11px] font-mono text-[var(--text-dim)]">{model.primary_model || ""}</span>
        <span className="flex-1" />
        {/* Status inherits from the product: while the product is active
            every member is sellable AUTOMATICALLY. This switch is the
            manual exception — off = discontinued, this member alone
            leaves the customer card, search and lineup. */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {model.status === "discontinued"
              ? t("fam.memberInactive", "Inactive (manual)")
              : t("fam.memberActive", "Active — follows product")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={model.status !== "discontinued"}
            onClick={() => onUpdate({ status: model.status === "discontinued" ? "active" : "discontinued" })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              model.status !== "discontinued" ? "bg-emerald-500" : "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            }`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              model.status !== "discontinued" ? "start-[18px]" : "start-0.5"
            }`} />
          </button>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("model.primaryModel", "KOLEEX model code")}</label>
          <input value={model.primary_model || ""} onChange={(e) => onUpdate({ primary_model: e.target.value })} placeholder="XF-600" className={`${inp} font-mono`} />
        </div>
        <div>
          <label className={lbl}>{t("fam.productName", "Product name (this model)")}</label>
          <input
            value={model.model_name}
            onChange={(e) => onUpdate({ model_name: e.target.value })}
            placeholder={familyProductName || t("fam.memberNamePh", "Descriptive name")}
            className={inp}
          />
          {familyProductName ? (
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              {t("fam.productNameHint", "Defaults to the family name — edit it freely for this model.")}
            </p>
          ) : null}
        </div>
        <div>
          <label className={lbl}>{t("model.referenceModel", "Supplier reference")}</label>
          <input value={model.reference_model} onChange={(e) => onUpdate({ reference_model: e.target.value })} placeholder="YL-600D" className={`${inp} font-mono`} />
        </div>
        <div>
          <label className={lbl}>{t("fam.tagline", "Tagline")}</label>
          <input value={model.tagline} onChange={(e) => onUpdate({ tagline: e.target.value })} placeholder={t("fam.taglinePh", "One-line pitch")} className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("fam.stock", "Stock status")}</label>
          <input value={model.stock_status} onChange={(e) => onUpdate({ stock_status: e.target.value })} placeholder="In stock / 15 days" className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("fam.barcode", "Barcode")}</label>
          <input value={model.barcode || ""} onChange={(e) => onUpdate({ barcode: e.target.value })} placeholder="EAN / UPC" className={`${inp} font-mono`} />
        </div>
      </div>
      {onSetPhoto && (
        <div className="flex items-center gap-3 pt-1">
          {photoUrl ? (
            <span className="h-14 w-14 shrink-0 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" className="h-full w-full object-contain p-1" />
            </span>
          ) : (
            <span className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)]">
              <ImageRawIcon className="h-5 w-5" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--text-ghost)] leading-relaxed">
              {photoUrl
                ? t("models.photoOwn", "This model shows its own photo.")
                : t("models.photoInherits", "No photo — this model inherits the family's main photo.")}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <label className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer text-[var(--accent,#0066FF)] bg-[var(--accent,#0066FF)]/10 hover:bg-[var(--accent,#0066FF)]/15 border border-[var(--accent,#0066FF)]/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSetPhoto(f); e.currentTarget.value = ""; }}
                />
                {photoUrl ? t("models.photoReplace", "Replace") : t("models.photoAdd", "Add photo")}
              </label>
              {photoUrl && onRemovePhoto && (
                <button type="button" onClick={onRemovePhoto}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-muted)] hover:text-rose-300 hover:bg-rose-500/10 border border-[var(--border-subtle)] transition-colors">
                  {t("models.photoRemove", "Remove")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Price panel: the member's commercial numbers ── */
export function MemberPricingPanel({
  model, onUpdate, costVisible = true, familyCost,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  costVisible?: boolean;
  /* The FAMILY's baseline factory cost — the primary supplier link's
     unit_cost_cny (the number the Supplier tab edits), else the primary
     model's cost. A member with an empty cost INHERITS it; typing a
     figure here is this model's own cost. */
  familyCost?: string | number | null;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const money = (label: string, key: keyof ModelFormState, sign: string, ph = "0.00") => (
    <div>
      <label className={lbl}>{label}</label>
      <div className="relative">
        <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">{sign}</span>
        <input
          type="number" step="0.01"
          value={(model[key] as string) || ""}
          onChange={(e) => onUpdate({ [key]: e.target.value } as Partial<ModelFormState>)}
          placeholder={ph}
          className={`${inp} ps-8`}
        />
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-[#567FB2]/30 bg-[var(--bg-secondary)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("fam.pricingTitle", "This model's cost & price")}
        </h3>
        <span className="text-[11px] font-mono text-[var(--text-dim)]">{model.primary_model || ""}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {costVisible && (
          <div>
            {money(t("fam.cost", "Factory cost (CNY)"), "cost_price", "¥",
              familyCost != null && familyCost !== "" ? String(familyCost) : "0.00")}
            <p className="text-[10px] text-[var(--text-ghost)] mt-1 leading-relaxed">
              {familyCost != null && familyCost !== ""
                ? t("fam.costInherit", "Empty = inherits the supplier cost (¥{v}). Type a figure for this model's own cost.").replace("{v}", String(familyCost))
                : t("fam.costOwn", "This model's own factory cost — the Supplier tab's cost is the family baseline.")}
            </p>
          </div>
        )}
        {money(t("fam.global", "Global price (USD)"), "global_price", "$")}
        {costVisible && money(t("fam.headOnly", "Head-only price"), "head_only_price", "¥")}
        {costVisible && money(t("fam.setPrice", "Complete-set price"), "complete_set_price", "¥")}
        <div>
          <label className={lbl}>{t("fam.moq", "MOQ")}</label>
          <input type="number" value={model.moq || ""} onChange={(e) => onUpdate({ moq: e.target.value })} placeholder="1" className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("fam.leadTime", "Lead time")}</label>
          <input value={model.lead_time || ""} onChange={(e) => onUpdate({ lead_time: e.target.value })} placeholder="15–20 days" className={inp} />
        </div>
      </div>
    </div>
  );
}

/* ── Logistics panel: the member's packing & shipping ── */
export function MemberLogisticsPanel({
  model, onUpdate,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const f = (label: string, key: keyof ModelFormState, ph: string, type: "text" | "number" = "text") => (
    <div>
      <label className={lbl}>{label}</label>
      <input
        type={type}
        value={(model[key] as string) || ""}
        onChange={(e) => onUpdate({ [key]: e.target.value } as Partial<ModelFormState>)}
        placeholder={ph}
        className={inp}
      />
    </div>
  );
  return (
    <div className="rounded-2xl border border-[#567FB2]/30 bg-[var(--bg-secondary)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("fam.logisticsTitle", "This model's packing & shipping")}
        </h3>
        <span className="text-[11px] font-mono text-[var(--text-dim)]">{model.primary_model || ""}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {f(t("fam.packingType", "Packing type"), "packing_type", "Wooden case")}
        {f(t("fam.carton", "Carton dimensions (cm)"), "carton_dimensions", "120 × 80 × 110")}
        {f(t("fam.cbm", "CBM (m³)"), "cbm", "1.06", "number")}
        {f(t("fam.nw", "Net weight (kg)"), "net_weight", "180", "number")}
        {f(t("fam.gw", "Gross weight (kg)"), "weight", "210", "number")}
        {f(t("fam.c20", "Qty / 20ft"), "container_20ft_qty", "26", "number")}
        {f(t("fam.c40", "Qty / 40ft"), "container_40ft_qty", "54", "number")}
        {f(t("fam.c40hq", "Qty / 40HQ"), "container_40hq_qty", "60", "number")}
      </div>
    </div>
  );
}
