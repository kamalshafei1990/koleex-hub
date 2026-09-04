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
import TagsIcon from "@/components/icons/ui/TagsIcon";
import TypeIcon from "@/components/icons/ui/TypeIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import QuoteIcon from "@/components/icons/ui/QuoteIcon";
import CircleDollarSignIcon from "@/components/icons/ui/CircleDollarSignIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import { useEffect, useState } from "react";

const inp =
  "w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
const lbl = "block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5";

/* Per-member localized text rows (中文 + العربية) with one-tap AI
   translate — the same /api/ai/translate service the Hero uses. Rows sit
   STACKED under their English field; a filled row never disappears. */
function MemberI18nRows({
  source, value, onChange,
}: {
  source: string;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [busy, setBusy] = useState<string | null>(null);
  const set = (loc: string, v: string) => {
    const next = { ...value };
    if (v) next[loc] = v; else delete next[loc];
    onChange(next);
  };
  const auto = async (loc: string) => {
    if (!source.trim() || busy) return;
    setBusy(loc);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: source.trim(), target_lang: loc, source_lang: "en" }),
      });
      const j = res.ok ? await res.json() : null;
      if (j?.translated) set(loc, j.translated);
    } catch { /* advisory only */ }
    setBusy(null);
  };
  const row = (loc: string, label: string, rtl = false) => (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="shrink-0 w-8 text-[9px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{label}</span>
      <input
        dir={rtl ? "rtl" : "ltr"}
        value={value[loc] || ""}
        onChange={(e) => set(loc, e.target.value)}
        placeholder={t("fam.i18nPh", "Translation")}
        className={`flex-1 h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/50 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors ${rtl ? "text-right" : ""}`}
      />
      <button
        type="button"
        onClick={() => auto(loc)}
        disabled={!source.trim() || busy != null}
        title={t("fam.autoTranslate", "AI translate")}
        className="kx-ai-glow shrink-0 h-8 px-2 rounded-lg text-[10px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/30 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 transition-colors"
      >
        {busy === loc ? "…" : "AI"}
      </button>
    </div>
  );
  return (
    <div>
      {row("zh", "中文")}
      {row("ar", "عربي", true)}
    </div>
  );
}

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
                i === 0
                  ? isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[#567FB2] ring-2 ring-[#567FB2]/45"
                    : "bg-[#567FB2]/15 text-[#BCD8F0] border-[#567FB2]/70 hover:bg-[#567FB2]/25"
                  : isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
              }`}
            >
              {i === 0 && (
                <span title={t("pp.primary", "Primary")} className="inline-flex">
                  <CrownIcon className={`h-3 w-3 shrink-0 ${isActive ? "text-[#7FA9D6]" : "text-[#7FA9D6]"}`} />
                </span>
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
        onCancel={() => setAskRemove(null)}
        onConfirm={() => { if (askRemove != null && onRemove) onRemove(askRemove); setAskRemove(null); }}
        title={t("famGrid.removeModel", "Remove model")}
        message={t("famGrid.removeConfirm", "Remove this model from the family? Its differences are discarded when you save.")}
        confirmLabel={t("famGrid.removeModel", "Remove model")}
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
  isPrimary = false, onEditCodeInHero, excludeProductId, refBinding,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  photoUrl?: string | null;
  onSetPhoto?: (f: File) => void;
  onRemovePhoto?: () => void;
  /* The family's product name — the member's name DEFAULTS to it (shown
     as placeholder) and stays editable per model. */
  familyProductName?: string;
  /* PRIMARY member: its code carries the coding-governance workflow
     (prefix validation, uniqueness, Approve/Lock) which lives in Hero —
     the panel shows the code read-only and jumps there. Other members
     get an editable code WITH its own live uniqueness check below. */
  isPrimary?: boolean;
  onEditCodeInHero?: () => void;
  excludeProductId?: string;
  /* PRIMARY member: the supplier reference is the SAME fact as the
     primary supplier link's "supplier product code" — this binding keeps
     the two in lock-step (writes mirror both stores). */
  refBinding?: { value: string; onChange: (v: string) => void };
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  /* Live uniqueness for NON-primary codes — same endpoint the Hero
     governance block uses; debounced; purely advisory (save-side rules
     still apply). */
  /* The check result remembers WHICH code it answered; everything shown is
     derived from that at render, so the effect writes state only from the
     async response — the old sync setCodeState({idle}/{checking}) pair was
     two cascading re-renders per keystroke (react-hooks/set-state-in-effect). */
  const [checked, setChecked] = useState<{ code: string; s: "ok" | "taken"; conflict?: string } | null>(null);
  const code = (model.primary_model || "").trim();
  const codeState: { s: "idle" | "checking" | "ok" | "taken"; conflict?: string } =
    isPrimary || !code || code.length < 3
      ? { s: "idle" }
      : checked && checked.code === code
        ? { s: checked.s, conflict: checked.conflict }
        : { s: "checking" };
  useEffect(() => {
    if (isPrimary || !code || code.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code });
        if (excludeProductId) params.set("excludeProductId", excludeProductId);
        const res = await fetch(`/api/products/check-primary-model?${params.toString()}`, { credentials: "include" });
        if (cancelled) return;
        const j = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (j?.available === false && j?.conflict) {
          setChecked({ code, s: "taken", conflict: j.conflict.product_name || j.conflict.primary_model });
        } else if (j) {
          setChecked({ code, s: "ok" });
        } else {
          setChecked(null);
        }
      } catch { if (!cancelled) setChecked(null); }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [code, isPrimary, excludeProductId]);
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
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><TagsIcon className="h-3 w-3" /> {t("model.primaryModel", "KOLEEX model code")}</span></label>
          {isPrimary ? (
            <div className="flex items-center gap-2">
              <span className={`${inp} font-mono flex items-center bg-[var(--bg-surface)]/60 text-[var(--text-muted)] cursor-default select-all`}>
                {model.primary_model || "—"}
              </span>
              {onEditCodeInHero && (
                <button type="button" onClick={onEditCodeInHero}
                  className="shrink-0 h-10 px-3 rounded-lg text-[11px] font-semibold text-[var(--accent,#0066FF)] bg-[var(--accent,#0066FF)]/10 hover:bg-[var(--accent,#0066FF)]/15 border border-[var(--accent,#0066FF)]/30 transition-colors whitespace-nowrap">
                  {t("fam.codeManagedInHero", "Managed below ↓")}
                </button>
              )}
            </div>
          ) : (
            <>
              <input value={model.primary_model || ""} onChange={(e) => onUpdate({ primary_model: e.target.value })} placeholder="XF-600" className={`${inp} font-mono`} />
              {codeState.s === "checking" && (
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("fam.codeChecking", "Checking availability…")}</p>
              )}
              {codeState.s === "ok" && (
                <p className="text-[10px] text-emerald-400/90 mt-1">{t("fam.codeAvailable", "Code is available.")}</p>
              )}
              {codeState.s === "taken" && (
                <p className="text-[10px] text-rose-400 mt-1">
                  {t("fam.codeTaken", "Already used by: {p}").replace("{p}", codeState.conflict || "")}
                </p>
              )}
            </>
          )}
        </div>
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><TypeIcon className="h-3 w-3" /> {t("fam.productName", "Product name (this model)")}</span></label>
          {isPrimary ? (
            <>
              <span className={`${inp} flex items-center bg-[var(--bg-surface)]/60 text-[var(--text-muted)] cursor-default`}>
                {familyProductName || model.model_name || "—"}
              </span>
              <p className="text-[10px] text-[var(--text-ghost)] mt-1">
                {t("fam.primaryNameHint", "The primary carries the family name — edit it in the Hero fields below.")}
              </p>
            </>
          ) : (
            <>
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
              <MemberI18nRows
                source={model.model_name || familyProductName || ""}
                value={model.name_i18n || {}}
                onChange={(next) => onUpdate({ name_i18n: next })}
              />
            </>
          )}
        </div>
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><HashtagIcon className="h-3 w-3" /> {t("model.referenceModel", "Supplier reference")}</span></label>
          <input
            value={refBinding ? refBinding.value : model.reference_model}
            onChange={(e) => refBinding ? refBinding.onChange(e.target.value) : onUpdate({ reference_model: e.target.value })}
            placeholder="YL-600D"
            className={`${inp} font-mono`}
          />
          {refBinding && (
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              {t("fam.refPrimarySync", "Synced with the Supplier tab's model number.")}
            </p>
          )}
        </div>
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><QuoteIcon className="h-3 w-3" /> {t("fam.tagline", "Tagline")}</span></label>
          <input value={model.tagline} onChange={(e) => onUpdate({ tagline: e.target.value })} placeholder={t("fam.taglinePh", "One-line pitch")} className={inp} />
          <MemberI18nRows
            source={model.tagline || ""}
            value={model.tagline_i18n || {}}
            onChange={(next) => onUpdate({ tagline_i18n: next })}
          />
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
  model, onUpdate, costVisible = true, familyCost, costBinding, costNote, costExtras,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  costVisible?: boolean;
  /* The FAMILY's baseline factory cost — the primary supplier link's
     unit_cost_cny (the number the Supplier tab edits), else the primary
     model's cost. A member with an empty cost INHERITS it; typing a
     figure here is this model's own cost. */
  familyCost?: string | number | null;
  /* PRIMARY member: factory cost is the FAMILY baseline, two-way synced
     with the primary supplier link (the Supplier tab's number). The
     binding routes writes there instead of the model column. */
  costBinding?: { value: string; onChange: (v: string) => void };
  /* The price's note (Supplier tab) — shown as a caption under the cost. */
  costNote?: string | null;
  /* Extra prices (price_options), locale-resolved by the parent. */
  costExtras?: { price: string; note: string }[];
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
        {costVisible && costBinding && (
          <div>
            <label className={lbl}><span className="inline-flex items-center gap-1.5"><CircleDollarSignIcon className="h-3 w-3" /> {t("fam.cost", "Factory cost (CNY)")}</span></label>
            <div className="relative">
              <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">¥</span>
              <input type="number" step="0.01" value={costBinding.value}
                onChange={(e) => costBinding.onChange(e.target.value)} placeholder="0.00" className={`${inp} ps-8`} />
            </div>
            <p className="text-[10px] text-[var(--text-ghost)] mt-1 leading-relaxed">
              {t("fam.costPrimarySync", "Family baseline — two-way synced with the Supplier tab.")}
            </p>
            {costNote?.trim() ? (
              <p className="mt-1.5 text-[10.5px] italic leading-snug text-[var(--text-muted)] border-s-2 border-[var(--border-strong)] ps-2 whitespace-pre-wrap">
                {costNote}
              </p>
            ) : null}
            {(costExtras ?? []).length > 0 && (
              <div className="mt-1 space-y-0.5 border-s-2 border-[var(--border-strong)] ps-2">
                {(costExtras ?? []).map((o, oi) => (
                  <p key={oi} className="text-[10.5px] leading-snug text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-subtle)] tabular-nums">¥{o.price || "—"}</span>
                    {o.note ? <span className="italic"> — {o.note}</span> : null}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {costVisible && !costBinding && (
          <div>
            {money(t("fam.cost", "Factory cost (CNY)"), "cost_price", "¥",
              familyCost != null && familyCost !== "" ? String(familyCost) : "0.00")}
            <p className="text-[10px] text-[var(--text-ghost)] mt-1 leading-relaxed">
              {familyCost != null && familyCost !== ""
                ? t("fam.costInherit", "Empty = inherits the supplier cost (¥{v}). Type a figure for this model's own cost.").replace("{v}", String(familyCost))
                : t("fam.costOwn", "This model's own factory cost — the Supplier tab's cost is the family baseline.")}
            </p>
            {costNote?.trim() ? (
              <p className="mt-1.5 text-[10.5px] italic leading-snug text-[var(--text-muted)] border-s-2 border-[var(--border-strong)] ps-2 whitespace-pre-wrap">
                {costNote}
              </p>
            ) : null}
            {(costExtras ?? []).length > 0 && (
              <div className="mt-1 space-y-0.5 border-s-2 border-[var(--border-strong)] ps-2">
                {(costExtras ?? []).map((o, oi) => (
                  <p key={oi} className="text-[10.5px] leading-snug text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-subtle)] tabular-nums">¥{o.price || "—"}</span>
                    {o.note ? <span className="italic"> — {o.note}</span> : null}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {money(t("fam.global", "Global price (USD)"), "global_price", "$")}
        {costVisible && money(t("fam.headOnly", "Head-only price"), "head_only_price", "¥")}
        {costVisible && money(t("fam.setPrice", "Complete-set price"), "complete_set_price", "¥")}
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><BoxesIcon className="h-3 w-3" /> {t("fam.moq", "MOQ")}</span></label>
          <input type="number" value={model.moq || ""} onChange={(e) => onUpdate({ moq: e.target.value })} placeholder="1" className={inp} />
        </div>
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3 w-3" /> {t("fam.leadTime", "Lead time")}</span></label>
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


/* ── Supplier panel (member view) ────────────────────────────────────────
   Owner rule: the SUPPLIER is a family-level fact — only the primary
   product can change which company supplies the family. A member opens
   this panel to type ITS OWN supplier-side facts: the supplier's model
   number, its cost, its name (+ zh/ar), its photo. */
export function MemberSupplierPanel({
  model, onUpdate, supplierName, supplierLogo, familyCost, familyProductName,
  photoUrl, onSetPhoto, onRemovePhoto,
}: {
  model: ModelFormState;
  onUpdate: (u: Partial<ModelFormState>) => void;
  supplierName: string | null;
  supplierLogo: string | null;
  familyCost?: string | number | null;
  familyProductName?: string;
  photoUrl?: string | null;
  onSetPhoto?: (f: File) => void;
  onRemovePhoto?: () => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  return (
    <div className="rounded-2xl border border-[#567FB2]/30 bg-[var(--bg-secondary)] p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="h-1.5 w-1.5 rounded-full bg-[#567FB2]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("fam.supTitle", "This model — as supplied")}
        </h3>
        <span className="text-[11px] font-mono text-[var(--text-dim)]">{model.primary_model || ""}</span>
      </div>

      {/* Locked supplier identity — family-level. */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-3.5 py-2.5">
        {supplierLogo ? (
          <span className="h-9 w-9 shrink-0 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={supplierLogo} alt="" className="h-full w-full object-contain p-0.5" />
          </span>
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)]">
            <FactoryIcon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
            {supplierName || t("fam.supNone", "No supplier linked yet")}
          </p>
          <p className="text-[10.5px] text-[var(--text-ghost)]">
            {t("fam.supLocked", "Family-level — the supplier is changed from the PRIMARY product only.")}
          </p>
        </div>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">
          {t("fam.locked", "Locked")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><HashtagIcon className="h-3 w-3" /> {t("fam.supModelNo", "Supplier model number")}</span></label>
          <input
            value={model.reference_model}
            onChange={(e) => onUpdate({ reference_model: e.target.value })}
            placeholder="YL-600D"
            className={`${inp} font-mono`}
          />
        </div>
        <div>
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><CircleDollarSignIcon className="h-3 w-3" /> {t("fam.cost", "Factory cost (CNY)")}</span></label>
          <div className="relative">
            <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">¥</span>
            <input
              type="number" step="0.01"
              value={model.cost_price || ""}
              onChange={(e) => onUpdate({ cost_price: e.target.value })}
              placeholder={familyCost != null && familyCost !== "" ? String(familyCost) : "0.00"}
              className={`${inp} ps-8`}
            />
          </div>
          <p className="text-[10px] text-[var(--text-ghost)] mt-1 leading-relaxed">
            {familyCost != null && familyCost !== ""
              ? t("fam.costInherit", "Empty = inherits the supplier cost (¥{v}). Type a figure for this model's own cost.").replace("{v}", String(familyCost))
              : t("fam.costOwn", "This model's own factory cost — the Supplier tab's cost is the family baseline.")}
          </p>
        </div>
        <div className="md:col-span-2">
          <label className={lbl}><span className="inline-flex items-center gap-1.5"><TypeIcon className="h-3 w-3" /> {t("fam.productName", "Product name (this model)")}</span></label>
          <input
            value={model.model_name}
            onChange={(e) => onUpdate({ model_name: e.target.value })}
            placeholder={familyProductName || t("fam.memberNamePh", "Descriptive name")}
            className={inp}
          />
          <MemberI18nRows
            source={model.model_name || familyProductName || ""}
            value={model.name_i18n || {}}
            onChange={(next) => onUpdate({ name_i18n: next })}
          />
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
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSetPhoto(f); e.currentTarget.value = ""; }} />
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
