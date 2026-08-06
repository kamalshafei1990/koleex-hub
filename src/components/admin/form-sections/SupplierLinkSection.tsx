"use client";

/* ---------------------------------------------------------------------------
   SupplierLinkSection — the product↔supplier LINK control.

   Supplier master data (name, logo, country, contacts, ratings…) lives in
   the Suppliers app and is shown here READ-ONLY, pulled from the supplier
   list. This control only edits the per-product facts that belong on the
   product_suppliers link: supplier code, MOQ, lead time, unit cost, payment
   terms, notes, and which supplier is primary. No supplier-master field is
   duplicated or editable here.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { LOCALES } from "@/types/product-form";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import { useCnyUsd, formatUsd, formatRate, fxSourceTitle } from "@/lib/use-cny-usd";
import StarIcon from "@/components/icons/ui/StarIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import { uploadProductFile, fetchSupplierNames } from "@/lib/products-admin";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { ScreenshotCaptureModal } from "@/components/quotations/ScreenshotCaptureModal";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import TypeIcon from "@/components/icons/ui/TypeIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import CircleDollarSignIcon from "@/components/icons/ui/CircleDollarSignIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import PercentIcon from "@/components/icons/ui/PercentIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import TimerIcon from "@/components/icons/ui/TimerIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import FlaskConicalIcon from "@/components/icons/ui/FlaskConicalIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import StickyNoteIcon from "@/components/icons/ui/StickyNoteIcon";
import { FieldHelp, SUPPLIER_LINK_HELP as H } from "@/components/admin/form-sections/FieldHelp";
import type { ProductSupplierFormState } from "@/types/product-form";

const SOURCING_STATUS: { value: string; label: string }[] = [
  { value: "preferred", label: "Preferred" },
  { value: "backup", label: "Backup" },
  { value: "trial", label: "Trial" },
  { value: "phasing_out", label: "Phasing out" },
];
const TOOLING_OWNERS: { value: string; label: string }[] = [
  { value: "koleex", label: "KOLEEX-owned" },
  { value: "supplier", label: "Supplier-owned" },
  { value: "shared", label: "Shared" },
];

interface SupplierContact {
  name: string | null; role: string | null; email: string | null; mobile: string | null;
}
interface SupplierOption {
  id: string; name: string; name_cn?: string | null; logo: string | null;
  /* Supplier-level defaults — source of truth for shared fields. */
  supply_type?: string | null; payment_terms?: string | null;
  currency?: string | null; moq?: string | null; lead_time?: string | null;
  /* Contact info (read-only quick-look). */
  email?: string | null; phone?: string | null; website?: string | null;
  wechat?: string | null; location?: string | null;
  primary_contact?: SupplierContact | null;
  /* Supplier profile (read-only quick-look). */
  rating?: number | null; sample_status?: string | null; employees?: string | null;
  year_established?: string | null; categories?: string[] | null; certifications?: string[] | null;
}

interface Props {
  links: ProductSupplierFormState[];
  suppliers: SupplierOption[];
  onChange: (links: ProductSupplierFormState[]) => void;
  /* Family member view: the SAME full page, but the supplier itself is
     locked (family-level; only the primary product changes it), the
     add/remove controls disappear, and the star button PROMOTES this
     member to be the family's primary model. */
  memberMode?: { memberCode: string; onMakePrimary: () => void };
  /* Resolved product/member specs offered by "Import from product specs"
     under the cost note. */
  productSpecs?: { label: string; value: string; unit?: string | null }[];
}

const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";
const inp =
  "w-full h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function SupplierLinkSection({ links, suppliers, onChange, memberMode, productSpecs }: Props) {
  const { t, lang } = useTranslation(PRODUCTS_UI_I18N);
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  /* Localised supplier product name (owner request 2026-08-03).
     Per-card: which locale is being edited, whether the row is
     expanded, and the in-flight / result state of auto-translate.
     Mirrors the Hero tab's name-translation contract exactly. */
  const [nameLocale, setNameLocale] = useState<Record<string, string>>({});
  const [nameTrOpen, setNameTrOpen] = useState<Record<string, boolean>>({});
  const [translatingName, setTranslatingName] = useState<string | null>(null);
  const [nameTrMsg, setNameTrMsg] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});
  const [uploadingQuoteId, setUploadingQuoteId] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);   // supplier whose info popup is open
  const [specPickerFor, setSpecPickerFor] = useState<string | null>(null); // link whose spec-import list is open
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);      // link whose price-note editor is expanded
  const [noteLocale, setNoteLocale] = useState<Record<string, string>>({});
  const [translatingNote, setTranslatingNote] = useState<string | null>(null);
  const [noteTrMsg, setNoteTrMsg] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});
  const [extraLocale, setExtraLocale] = useState<Record<string, string>>({});   // key `${tempId}:${idx}`
  const [translatingExtra, setTranslatingExtra] = useState<string | null>(null);

  /* Self-healing supplier list. The form loads suppliers at mount in a big
     parallel batch with a timeout; /api/suppliers occasionally spikes to
     several seconds, so that batch sometimes hands us an empty list and the
     picker had nothing to offer (the button then wrongly said "All suppliers
     linked"). We keep a local copy synced from the prop, and if it ever
     arrives empty we fetch the directory ourselves (warm ≈ 40ms) — plus a
     manual Retry — so linking a supplier never gets stuck. */
  const [supList, setSupList] = useState<SupplierOption[]>(suppliers);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supLoadFailed, setSupLoadFailed] = useState(false);

  useEffect(() => { if (suppliers.length) setSupList(suppliers); }, [suppliers]);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    setSupLoadFailed(false);
    try {
      const list = (await fetchSupplierNames()) as unknown as SupplierOption[];
      if (list.length) setSupList(list);
      else setSupLoadFailed(true);
    } catch {
      setSupLoadFailed(true);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  /* If the parent handed us nothing, recover on our own. */
  useEffect(() => {
    if (suppliers.length === 0 && supList.length === 0) loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkedIds = new Set(links.map((l) => l.supplier_id));
  const available = supList.filter((s) => !linkedIds.has(s.id));
  const supOf = (id: string) => supList.find((s) => s.id === id);
  const nameOf = (id: string) => supOf(id)?.name || "(unknown supplier)";
  const nameCnOf = (id: string) => supOf(id)?.name_cn || null;
  const logoOf = (id: string) => supOf(id)?.logo || null;

  const add = (supplierId: string) => {
    if (!supplierId || linkedIds.has(supplierId)) return;
    const isFirst = links.length === 0;
    onChange([
      ...links,
      {
        _tempId: crypto.randomUUID(),
        supplier_id: supplierId,
        is_primary: isFirst, // first link defaults to primary
        supplier_product_code: "",
        moq: "",
        lead_time_days: "",
        unit_cost_cny: "",
        currency: "CNY",
        cost_basis: "delivered",
        cost_includes_tax: true,
        payment_terms: "",
        notes: "",
        notes_i18n: {},
        price_options: [],
        supplier_product_name: "",
        supplier_product_name_i18n: {},
        supplier_product_photo: "",
        supply_type: "",
        sample_available: false,
        sample_cost: "",
        incoterms: "",
        supplier_warranty_months: "",
        price_tiers: [],
        price_quoted_on: "",
        price_valid_until: "",
        quotation_file_url: "",
        quotation_file_name: "",
        sourcing_status: "",
        preferred_reason: "",
        min_order_value: "",
        tooling_owner: "",
        tooling_cost: "",
      },
    ]);
    setPickerOpen(false);
  };

  const update = (tempId: string, patch: Partial<ProductSupplierFormState>) =>
    onChange(links.map((l) => (l._tempId === tempId ? { ...l, ...patch } : l)));

  const remove = (tempId: string) => onChange(links.filter((l) => l._tempId !== tempId));

  /* Auto-translate the supplier's product name into the chosen locale.
     source_lang stays "auto" because factories name their machines in
     their own language (usually Chinese) — unlike the Hero name, which
     is always English-sourced. Same honest fallback handling: the API
     answers 200 with fallback:true when no provider is configured. */
  const autoTranslateName = useCallback(
    async (tempId: string, source: string, target: string) => {
      const text = source.trim();
      if (!text) return;
      setTranslatingName(tempId);
      setNameTrMsg((m) => ({ ...m, [tempId]: undefined as never }));
      try {
        const res = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text, target_lang: target, source_lang: "auto" }),
        });
        const data = (await res.json()) as {
          translated?: string;
          fallback?: boolean;
          reason?: string;
        };
        if (!res.ok || data?.fallback || !data?.translated) {
          setNameTrMsg((m) => ({
            ...m,
            [tempId]: {
              kind: "error",
              text:
                data?.reason === "no_provider"
                  ? t("sup.trNoProvider", "Auto-translate is off — no translation service is configured. Type it manually for now.")
                  : t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually."),
            },
          }));
          return;
        }
        const row = links.find((l) => l._tempId === tempId);
        update(tempId, {
          supplier_product_name_i18n: {
            ...(row?.supplier_product_name_i18n ?? {}),
            [target]: data.translated,
          },
        });
        setNameTrMsg((m) => ({
          ...m,
          [tempId]: { kind: "ok", text: t("sup.trDone", "Translated — review before saving.") },
        }));
      } catch {
        setNameTrMsg((m) => ({
          ...m,
          [tempId]: { kind: "error", text: t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually.") },
        }));
      } finally {
        setTranslatingName(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [links, t],
  );

  /* Same contract as autoTranslateName, for the price note. */
  const autoTranslateNote = useCallback(
    async (tempId: string, source: string, target: string) => {
      const text = source.trim();
      if (!text) return;
      setTranslatingNote(tempId);
      setNoteTrMsg((m) => ({ ...m, [tempId]: undefined as never }));
      try {
        const res = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text, target_lang: target, source_lang: "auto" }),
        });
        const data = (await res.json()) as { translated?: string; fallback?: boolean; reason?: string };
        if (!res.ok || data?.fallback || !data?.translated) {
          setNoteTrMsg((m) => ({
            ...m,
            [tempId]: {
              kind: "error",
              text: data?.reason === "no_provider"
                ? t("sup.trNoProvider", "Auto-translate is off — no translation service is configured. Type it manually for now.")
                : t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually."),
            },
          }));
          return;
        }
        const row = links.find((l) => l._tempId === tempId);
        update(tempId, { notes_i18n: { ...(row?.notes_i18n ?? {}), [target]: data.translated } });
        setNoteTrMsg((m) => ({ ...m, [tempId]: { kind: "ok", text: t("sup.trDone", "Translated — review before saving.") } }));
      } catch {
        setNoteTrMsg((m) => ({ ...m, [tempId]: { kind: "error", text: t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually.") } }));
      } finally {
        setTranslatingNote(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [links, t],
  );

  /* Marking a link primary unmarks the others — at most one primary. */
  const setPrimary = (tempId: string) =>
    onChange(links.map((l) => ({ ...l, is_primary: l._tempId === tempId })));

  return (
    <div className="space-y-3">
      {links.length === 0 ? (
        <p className="text-[12px] text-[var(--text-ghost)] py-5 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
          {t("sup.noneLinked", "No supplier linked yet. Link a supplier from the Suppliers app below.")}
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const logo = logoOf(l.supplier_id);
            return (
              <div key={l._tempId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                {/* ── Supplier identity — clear header (logo + name) + actions ── */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setInfoId(l.supplier_id)}
                    title={t("sup.viewDetails", "View supplier details")}
                    className="group flex items-center gap-3 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-[var(--bg-inverted)]/[0.04] transition-colors"
                  >
                    <div className="h-11 w-11 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-full w-full object-contain p-1" />
                      ) : (
                        <FactoryIcon className="h-5 w-5 text-[var(--text-ghost)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{nameOf(l.supplier_id)}</span>
                        <InfoIcon className="h-3.5 w-3.5 text-[var(--text-ghost)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {nameCnOf(l.supplier_id) && (
                        <div className="text-[12px] text-[var(--text-muted)] truncate">{nameCnOf(l.supplier_id)}</div>
                      )}
                      <div className="text-[10px] text-[var(--text-ghost)]">{t("sup.identityHint", "Supplier · tap for details · managed in the Suppliers app")}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {memberMode ? (
                      /* Member view: the star PROMOTES this model to be the
                         family's primary (owner rule) — supplier link
                         management stays on the primary. */
                      <button
                        type="button"
                        onClick={memberMode.onMakePrimary}
                        title={t("sup.makeModelPrimary", "Make this model the PRIMARY of the family")}
                        className="h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors bg-[var(--bg-surface)] text-[#7FA9D6] border-[#567FB2]/50 hover:bg-[#567FB2]/10"
                      >
                        <StarIcon className="h-3 w-3" /> {t("sup.makeModelPrimary2", "Make primary model")}
                      </button>
                    ) : (
                    <>
                    <button
                      type="button"
                      onClick={() => setPrimary(l._tempId)}
                      aria-pressed={l.is_primary}
                      title={l.is_primary ? t("sup.primaryTitle", "Primary supplier") : t("sup.makePrimary", "Make primary")}
                      className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                        l.is_primary
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <StarIcon className="h-3 w-3" /> {l.is_primary ? t("sup.primary", "Primary") : t("sup.makePrimary", "Make primary")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l._tempId)}
                      aria-label={t("sup.removeLink", "Remove supplier link")}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] border border-[var(--border-subtle)] hover:border-[var(--state-error,#FF3333)]/40 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                    </>
                    )}
                  </div>
                </div>

                {/* ── HERO — big centered product photo, then name · model · cost ── */}
                <div className="rounded-xl bg-[var(--bg-surface)]/40 border border-[var(--border-subtle)] p-4 space-y-4">
                  <SupplierPhoto
                    url={l.supplier_product_photo}
                    uploading={uploadingId === l._tempId}
                    sizeClass="h-44 w-44 sm:h-52 sm:w-52 mx-auto"
                    onPick={async (file) => {
                      setUploadingId(l._tempId);
                      const res = await uploadProductFile(file);
                      setUploadingId(null);
                      if (res) update(l._tempId, { supplier_product_photo: res.url });
                    }}
                    onClear={() => update(l._tempId, { supplier_product_photo: "" })}
                  />

                  <div className="space-y-3">
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><TypeIcon className="h-3 w-3" /> {t("sup.productName", "Product name")}</span><FieldHelp {...H.productName} /></label>
                      <input
                        className="w-full h-11 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[16px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-dim)] placeholder:font-normal outline-none focus:border-[var(--border-focus)]"
                        value={l.supplier_product_name}
                        placeholder={t("sup.productNamePh", "What the supplier calls this product")}
                        onChange={(e) => update(l._tempId, { supplier_product_name: e.target.value })}
                      />
                      {/* ── Other languages (same contract as the Hero tab) ──
                          The factory names the machine in its own language;
                          this keeps the other locales next to it. Collapsed
                          until asked for, or auto-open when data exists. */}
                      {(() => {
                        const i18n = l.supplier_product_name_i18n ?? {};
                        const hasAny = Object.values(i18n).some((v) => (v || "").trim().length > 0);
                        const open = nameTrOpen[l._tempId] ?? hasAny;
                        if (!open) {
                          return (
                            <button
                              type="button"
                              onClick={() => setNameTrOpen((o) => ({ ...o, [l._tempId]: true }))}
                              className="mt-1.5 text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline inline-flex items-center gap-1"
                            >
                              + {t("sup.addLanguage", "Add another language")}
                            </button>
                          );
                        }
                        const loc = nameLocale[l._tempId] ?? "zh";
                        const isRtl = loc === "ar" || loc === "ur";
                        const localeName = LOCALES.find((x) => x.code === loc)?.name ?? loc;
                        const msg = nameTrMsg[l._tempId];
                        return (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <select
                                value={loc}
                                onChange={(e) => {
                                  setNameLocale((m) => ({ ...m, [l._tempId]: e.target.value }));
                                  setNameTrMsg((m) => ({ ...m, [l._tempId]: undefined as never }));
                                }}
                                className="h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                              >
                                {LOCALES.map((x) => (
                                  <option key={x.code} value={x.code}>{x.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => autoTranslateName(l._tempId, l.supplier_product_name, loc)}
                                disabled={!l.supplier_product_name.trim() || translatingName === l._tempId}
                                className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                              >
                                {translatingName === l._tempId
                                  ? t("sup.translating", "Translating…")
                                  : t("sup.autoTranslate", "Auto-translate")}
                              </button>
                            </div>
                            <input
                              dir={isRtl ? "rtl" : "ltr"}
                              value={i18n[loc] ?? ""}
                              onChange={(e) =>
                                update(l._tempId, {
                                  supplier_product_name_i18n: { ...i18n, [loc]: e.target.value },
                                })
                              }
                              placeholder={t("sup.nameInLang", "Product name in {lang}").replace("{lang}", localeName)}
                              className={`w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[14px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] placeholder:font-normal outline-none focus:border-[var(--border-focus)] ${isRtl ? "text-right" : ""}`}
                            />
                            {msg && (
                              <p className={`text-[11px] leading-relaxed ${msg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>
                                {msg.text}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><HashtagIcon className="h-3 w-3" /> {t("sup.modelNumber", "Model number")}</span><FieldHelp {...H.modelNumber} /></label>
                      <input className={inp} value={l.supplier_product_code} placeholder={`${t("sup.eg", "e.g.")} JK-58420`}
                        onChange={(e) => update(l._tempId, { supplier_product_code: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><CircleDollarSignIcon className="h-3 w-3" /> {t("sup.costPrice", "Cost price")}</span><FieldHelp {...H.costPrice} /></label>
                      <div className="flex gap-1.5">
                        <input className={`${inp} flex-1 min-w-0`} value={l.unit_cost_cny} inputMode="decimal" placeholder={`${t("sup.eg", "e.g.")} 1850`}
                          onChange={(e) => update(l._tempId, { unit_cost_cny: e.target.value.replace(/[^0-9.]/g, "") })} />
                        <div className="h-9 w-[84px] shrink-0 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] flex items-center justify-center" title={t("sup.cnyTitle", "Factory cost is always entered in CNY (¥) — the pricing engine works from the CNY cost.")}>
                          CNY
                        </div>
                      </div>
                      {/* Live USD reading of what was just typed. Below the
                          field, not inside it: the entry stays unambiguously
                          CNY — which is what gets saved and what the pricing
                          engine uses — while the person entering it can still
                          sanity-check the number in the currency they think
                          in. Appears only once the figure is real. */}
                      <UsdHint cny={l.unit_cost_cny} />
                      {/* Price note — an annotation OF this price, not a
                          separate section (owner). Collapsed = one muted
                          italic line; expanded = tiny editor + spec import.
                          Anywhere the price is displayed, this note rides
                          along as its caption. */}
                      {noteOpenFor === l._tempId ? (
                        <div className="mt-1.5">
                          <textarea autoFocus rows={2} className={`${inp} h-auto min-h-[56px] py-2 resize-y`} value={l.notes}
                            placeholder={t("sup.costNotePh", "What this price covers — configuration, included parts, spec lines…")}
                            onChange={(e) => update(l._tempId, { notes: e.target.value })} />
                          {/* Note in other languages — same contract as the
                              supplier product name (select locale + glow
                              Auto-translate + per-locale text). */}
                          {(() => {
                            const nloc = noteLocale[l._tempId] ?? "zh";
                            const nRtl = nloc === "ar" || nloc === "ur";
                            const ni18n = l.notes_i18n ?? {};
                            const nmsg = noteTrMsg[l._tempId];
                            return (
                              <div className="mt-1.5 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <select value={nloc}
                                    onChange={(e) => { setNoteLocale((m) => ({ ...m, [l._tempId]: e.target.value })); setNoteTrMsg((m) => ({ ...m, [l._tempId]: undefined as never })); }}
                                    className="h-8 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
                                    {LOCALES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                                  </select>
                                  <button type="button"
                                    onClick={() => autoTranslateNote(l._tempId, l.notes, nloc)}
                                    disabled={!l.notes.trim() || translatingNote === l._tempId}
                                    className="kx-ai-glow h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
                                    {translatingNote === l._tempId ? t("sup.translating", "Translating…") : t("sup.autoTranslate", "Auto-translate")}
                                  </button>
                                </div>
                                <textarea dir={nRtl ? "rtl" : "ltr"} rows={2} value={ni18n[nloc] ?? ""}
                                  onChange={(e) => update(l._tempId, { notes_i18n: { ...ni18n, [nloc]: e.target.value } })}
                                  placeholder={t("sup.noteInLang", "Price note in {lang}").replace("{lang}", LOCALES.find((x) => x.code === nloc)?.name ?? nloc)}
                                  className={`${inp} h-auto min-h-[48px] py-2 resize-y`} />
                                {nmsg && <p className={`text-[10.5px] ${nmsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{nmsg.text}</p>}
                              </div>
                            );
                          })()}
                          <div className="mt-1 flex items-center justify-between">
                            {(productSpecs ?? []).length > 0 ? (
                              <button type="button"
                                onClick={() => setSpecPickerFor(specPickerFor === l._tempId ? null : l._tempId)}
                                className="text-[10.5px] font-medium text-[var(--accent,#567FB2)] hover:underline">
                                {specPickerFor === l._tempId ? t("sup.importSpecsClose", "Close specs") : t("sup.importSpecs", "Import from product specs")}
                              </button>
                            ) : <span />}
                            <button type="button" onClick={() => { setNoteOpenFor(null); setSpecPickerFor(null); }}
                              className="text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                              {t("sup.noteDone", "Done")}
                            </button>
                          </div>
                          {specPickerFor === l._tempId && (productSpecs ?? []).length > 0 && (
                            <div className="mt-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2 max-h-56 overflow-y-auto space-y-0.5">
                              <div className="flex items-center justify-between px-1.5 pb-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{t("sup.importSpecsHint", "Click a line to add it to the note")}</span>
                                <button type="button"
                                  onClick={() => {
                                    const all = (productSpecs ?? []).map((sp) => `${sp.label}: ${sp.value}${sp.unit ? ` ${sp.unit}` : ""}`)
                                      .filter((line) => !(l.notes || "").includes(line));
                                    if (all.length) update(l._tempId, { notes: [l.notes, ...all].filter(Boolean).join("\n") });
                                  }}
                                  className="text-[10px] font-medium text-[var(--accent,#567FB2)] hover:underline">
                                  {t("sup.importSpecsAll", "Insert all")}
                                </button>
                              </div>
                              {(productSpecs ?? []).map((sp, si) => {
                                const line = `${sp.label}: ${sp.value}${sp.unit ? ` ${sp.unit}` : ""}`;
                                const used = (l.notes || "").includes(line);
                                return (
                                  <button key={si} type="button" disabled={used}
                                    onClick={() => update(l._tempId, { notes: [l.notes, line].filter(Boolean).join("\n") })}
                                    className={`w-full text-start px-1.5 py-1 rounded-lg text-[11px] transition-colors ${used ? "text-[var(--text-ghost)] line-through cursor-default" : "text-[var(--text-muted)] hover:bg-[var(--bg-inverted)]/[0.05] hover:text-[var(--text-primary)]"}`}>
                                    <span className="font-medium">{sp.label}:</span> {sp.value}{sp.unit ? ` ${sp.unit}` : ""}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : l.notes ? (
                        <button type="button" onClick={() => setNoteOpenFor(l._tempId)}
                          title={t("sup.notePriceEdit", "Edit price note")}
                          className="mt-1 w-full text-start text-[10.5px] italic leading-snug text-[var(--text-muted)] hover:text-[var(--text-primary)] border-s-2 border-[var(--border-strong)] ps-2 whitespace-pre-wrap transition-colors">
                          {((l.notes_i18n ?? {})[lang] || "").trim() || l.notes}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setNoteOpenFor(l._tempId)}
                          className="mt-1 text-[10px] font-medium text-[var(--accent,#567FB2)] hover:underline">
                          <StickyNoteIcon className="h-3 w-3 inline-block align-[-2px] me-1" /> + {t("sup.addPriceNote", "Add price note")}
                        </button>
                      )}

                      {/* EXTRA PRICES — the same supplier can quote several
                          prices (configurations, sets, options); each carries
                          its own note and rides along wherever the price is
                          shown. Saved in price_options (+ member overrides). */}
                      {(l.price_options ?? []).map((po, pi) => {
                        const updPO = (patch: Partial<typeof po>) =>
                          update(l._tempId, { price_options: (l.price_options ?? []).map((x, xi) => (xi === pi ? { ...x, ...patch } : x)) });
                        const ekey = `${l._tempId}:${pi}`;
                        const eloc = extraLocale[ekey] ?? "zh";
                        const eRtl = eloc === "ar" || eloc === "ur";
                        return (
                          <div key={pi} className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-[var(--text-ghost)] shrink-0">¥</span>
                              <input inputMode="decimal" value={po.price} placeholder="0"
                                onChange={(e) => updPO({ price: e.target.value.replace(/[^0-9.]/g, "") })}
                                className={`${inp} w-[110px] shrink-0`} />
                              <input value={po.note} placeholder={t("sup.priceOptNotePh", "What this price covers…")}
                                onChange={(e) => updPO({ note: e.target.value })}
                                className={`${inp} flex-1 min-w-0`} />
                              <button type="button" onClick={() => update(l._tempId, { price_options: (l.price_options ?? []).filter((_, xi) => xi !== pi) })}
                                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] hover:border-[var(--state-error,#FF3333)]/50 flex items-center justify-center transition-colors"
                                title={t("sup.removePrice", "Remove this price")}>
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select value={eloc}
                                onChange={(e) => setExtraLocale((m) => ({ ...m, [ekey]: e.target.value }))}
                                className="h-8 px-2 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] shrink-0">
                                {LOCALES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                              </select>
                              <input dir={eRtl ? "rtl" : "ltr"} value={(po.note_i18n ?? {})[eloc] ?? ""}
                                onChange={(e) => updPO({ note_i18n: { ...(po.note_i18n ?? {}), [eloc]: e.target.value } })}
                                placeholder={t("sup.noteInLang", "Price note in {lang}").replace("{lang}", LOCALES.find((x) => x.code === eloc)?.name ?? eloc)}
                                className={`${inp} flex-1 min-w-0 h-8`} />
                              <button type="button"
                                onClick={async () => {
                                  const text = po.note.trim();
                                  if (!text) return;
                                  setTranslatingExtra(ekey);
                                  try {
                                    const res = await fetch("/api/ai/translate", {
                                      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                                      body: JSON.stringify({ text, target_lang: eloc, source_lang: "auto" }),
                                    });
                                    const data = (await res.json()) as { translated?: string; fallback?: boolean };
                                    if (res.ok && data?.translated && !data.fallback) {
                                      updPO({ note_i18n: { ...(po.note_i18n ?? {}), [eloc]: data.translated } });
                                    }
                                  } catch { /* leave the field for manual entry */ }
                                  setTranslatingExtra(null);
                                }}
                                disabled={!po.note.trim() || translatingExtra === ekey}
                                className="kx-ai-glow h-8 px-2.5 rounded-lg text-[10.5px] font-bold whitespace-nowrap text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
                                {translatingExtra === ekey ? t("sup.translating", "Translating…") : t("sup.autoTranslate", "Auto-translate")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button"
                        onClick={() => update(l._tempId, { price_options: [...(l.price_options ?? []), { price: "", note: "", note_i18n: {} }] })}
                        className="mt-1.5 text-[10px] font-medium text-[var(--accent,#567FB2)] hover:underline block">
                        + {t("sup.addAnotherPrice", "Add another price")}
                      </button>
                    </div>
                  </div>
                  {/* What the cost already includes. Display + warning only —
                      lets the same machine quoted ex-works vs full-landed be
                      told apart so it isn't silently mis-leveled. */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><BoxIcon className="h-3 w-3" /> {t("sup.costIncludes", "Cost includes")}</span><FieldHelp {...H.costIncludes} /></label>
                      <select className={inp} value={l.cost_basis}
                        onChange={(e) => update(l._tempId, { cost_basis: e.target.value as ProductSupplierFormState["cost_basis"] })}>
                        <option value="delivered">{t("sup.costDelivered", "Delivered to Koleex (full landed)")}</option>
                        <option value="packing">{t("sup.costPacking", "+ Packing (no delivery)")}</option>
                        <option value="factory_only">{t("sup.costFactory", "Factory only (ex-works)")}</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><PercentIcon className="h-3 w-3" /> {t("sup.taxVat", "Tax (VAT)")}</span><FieldHelp {...H.taxVat} /></label>
                      <button type="button"
                        onClick={() => update(l._tempId, { cost_includes_tax: !l.cost_includes_tax })}
                        className={`h-9 w-full px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between transition-colors ${l.cost_includes_tax ? "border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.05] text-[var(--text-primary)]" : "border-amber-500/40 bg-amber-500/[0.06] text-amber-400"}`}>
                        <span>{l.cost_includes_tax ? t("sup.taxIncluded", "Tax included") : t("sup.taxNotIncluded", "Tax NOT included")}</span>
                        <span className={`h-4 w-7 rounded-full relative transition-colors ${l.cost_includes_tax ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}>
                          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${l.cost_includes_tax ? "left-3.5" : "left-0.5"}`} />
                        </span>
                      </button>
                    </div>
                  </div>
                  {(l.cost_basis !== "delivered" || !l.cost_includes_tax) && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-amber-400/90">
                      ⚠ {t("sup.costWarnA", "This cost is NOT full-landed/tax-in. Its margin isn\u2019t directly comparable to delivered costs — add the missing")} {l.cost_basis === "factory_only" ? t("sup.missPackDelivery", "packing + delivery") : l.cost_basis === "packing" ? t("sup.missDelivery", "delivery") : t("sup.missComponents", "components")}{!l.cost_includes_tax ? " + VAT" : ""} {t("sup.costWarnB", "before relying on the auto-detected level.")}
                    </p>
                  )}

                </div>

                {/* From the supplier (Suppliers app) — source of truth, read-only here */}
                {(() => {
                  const sup = supOf(l.supplier_id);
                  const facts: { label: string; value: string | null | undefined; help?: { en: string; zh: string } }[] = [
                    { label: t("sup.supplyType", "Supply type"), value: sup?.supply_type, help: H.supplyType },
                    { label: "MOQ", value: sup?.moq, help: H.moq },
                    { label: t("sup.leadTime", "Lead time"), value: sup?.lead_time, help: H.leadTime },
                    { label: t("sup.paymentTerms", "Payment terms"), value: sup?.payment_terms, help: H.paymentTerms },
                    { label: t("sup.currency", "Currency"), value: sup?.currency },
                  ];
                  return (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">{t("sup.fromSupplier", "From the supplier")}</span>
                        <span className="text-[10px] text-[var(--text-ghost)]">{t("sup.editInSuppliers", "edit in the Suppliers app")}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {facts.map((f) => (
                          <div key={f.label}>
                            <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{f.label}{f.help && <FieldHelp {...f.help} />}</div>
                            <div className="text-[12px] text-[var(--text-primary)] truncate">{f.value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Quotation & volume pricing — per product, from this supplier */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">{t("sup.quoteVolume", "Quotation & volume pricing")}</span>
                    {l.price_valid_until && (() => {
                      const expired = new Date(l.price_valid_until) < new Date(new Date().toDateString());
                      return (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)]"
                          style={{ color: expired ? "var(--state-error,#FF3333)" : "var(--state-success,#00CC66)" }}>
                          {expired ? t("sup.quoteExpired", "Quote expired") : t("sup.quoteValid", "Quote valid")}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Quote dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><CalendarRawIcon className="h-3 w-3" /> {t("sup.quotedOn", "Quoted on")}</span><FieldHelp {...H.quotedOn} /></label>
                      <input type="date" className={inp} value={l.price_quoted_on}
                        onChange={(e) => update(l._tempId, { price_quoted_on: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><TimerIcon className="h-3 w-3" /> {t("sup.validUntil", "Valid until")}</span><FieldHelp {...H.validUntil} /></label>
                      <input type="date" className={inp} value={l.price_valid_until}
                        onChange={(e) => update(l._tempId, { price_valid_until: e.target.value })} />
                    </div>
                  </div>

                  {/* Volume price tiers */}
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><BarChart3Icon className="h-3 w-3" /> {t("sup.volumePricing", "Volume pricing (qty → unit price)")}</span><FieldHelp {...H.volumePricing} /></label>
                    <div className="space-y-1.5">
                      {l.price_tiers.map((tier, ti) => (
                        <div key={ti} className="flex items-center gap-1.5">
                          <input className={`${inp} flex-1`} inputMode="numeric" placeholder={t("sup.minQtyPh", "Min qty (e.g. 10)")} value={tier.min_qty}
                            onChange={(e) => update(l._tempId, { price_tiers: l.price_tiers.map((t, i) => i === ti ? { ...t, min_qty: e.target.value.replace(/[^0-9]/g, "") } : t) })} />
                          <span className="text-[var(--text-ghost)] text-[12px]">→</span>
                          <input className={`${inp} flex-1`} inputMode="decimal" placeholder={t("sup.unitPricePh", "Unit price")} value={tier.price}
                            onChange={(e) => update(l._tempId, { price_tiers: l.price_tiers.map((t, i) => i === ti ? { ...t, price: e.target.value.replace(/[^0-9.]/g, "") } : t) })} />
                          <button type="button" aria-label={t("sup.removeTier", "Remove tier")}
                            onClick={() => update(l._tempId, { price_tiers: l.price_tiers.filter((_, i) => i !== ti) })}
                            className="h-9 w-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)]">
                            <CrossIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => update(l._tempId, { price_tiers: [...l.price_tiers, { min_qty: "", price: "" }] })}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-ghost)] transition-colors">
                        <PlusIcon className="h-3 w-3" /> {t("sup.addTier", "Add price tier")}
                      </button>
                    </div>
                  </div>

                  {/* Supplier quotation file */}
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><DocumentIcon className="h-3 w-3" /> {t("sup.quoteFile", "Supplier quotation / spec file")}</span><FieldHelp {...H.quoteFile} /></label>
                    {l.quotation_file_url ? (
                      <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <a href={l.quotation_file_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">
                          {l.quotation_file_name || t("sup.viewQuote", "View quotation")}
                        </a>
                        <button type="button" aria-label={t("sup.removeFile", "Remove file")} onClick={() => update(l._tempId, { quotation_file_url: "", quotation_file_name: "" })}
                          className="shrink-0 text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)]">
                          <CrossIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] hover:border-[var(--text-ghost)] transition-colors">
                        {uploadingQuoteId === l._tempId ? t("sup.uploading", "Uploading…") : (<><UploadIcon className="h-3.5 w-3.5" /> {t("sup.uploadQuote", "Upload quotation (PDF/image)")}</>)}
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" disabled={uploadingQuoteId === l._tempId}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingQuoteId(l._tempId);
                            const res = await uploadProductFile(file);
                            setUploadingQuoteId(null);
                            if (res) update(l._tempId, { quotation_file_url: res.url, quotation_file_name: file.name });
                          }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Per-product link fields (product-specific — not on the supplier record) */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Incoterms intentionally removed (owner, 2026-07-31):
                      it duplicated the "Cost includes" basis the pricing
                      engine reads, and domestic-China sourcing doesn't use
                      trade terms — they live on the customer side in
                      Quotations. Column kept; reintroduce per-supplier if
                      overseas sourcing ever starts. */}
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><FlaskConicalIcon className="h-3 w-3" /> {t("sup.sampleCost", "Sample cost")}</span><FieldHelp {...H.sampleCost} /></label>
                    <input className={inp} value={l.sample_cost} inputMode="decimal" placeholder={`${t("sup.eg", "e.g.")} 200`}
                      onChange={(e) => update(l._tempId, { sample_cost: e.target.value.replace(/[^0-9.]/g, "") })} />
                  </div>
                  <div>
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-3 w-3" /> {t("sup.warrantyMonths", "Supplier warranty (months)")}</span><FieldHelp {...H.warrantyMonths} /></label>
                    <input className={inp} value={l.supplier_warranty_months} inputMode="numeric" placeholder={`${t("sup.eg", "e.g.")} 12`}
                      onChange={(e) => update(l._tempId, { supplier_warranty_months: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                  <div className="flex items-end pb-0.5">
                    <button type="button" onClick={() => update(l._tempId, { sample_available: !l.sample_available })}
                      aria-pressed={l.sample_available}
                      className={`h-9 px-3 w-full rounded-lg border text-[12px] font-medium flex items-center justify-center gap-2 transition-colors ${
                        l.sample_available
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                      }`}>
                      <span className={`h-2 w-2 rounded-full ${l.sample_available ? "bg-[var(--state-success,#00CC66)]" : "bg-[var(--text-ghost)]"}`} />
                      {l.sample_available ? t("sup.sampleAvailable", "Sample available") : t("sup.sampleNotAvailable", "Sample not available")}
                    </button>
                  </div>
                </div>
                {/* Sourcing strategy — how this supplier is positioned for THIS product */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">{t("sup.sourcingStrategy", "Sourcing strategy")}</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><ActivityIcon className="h-3 w-3" /> {t("sup.sourcingStatus", "Sourcing status")}</span><FieldHelp {...H.sourcingStatus} /></label>
                      <select className={inp} value={l.sourcing_status} onChange={(e) => update(l._tempId, { sourcing_status: e.target.value })}>
                        <option value="">—</option>
                        {SOURCING_STATUS.map((s) => <option key={s.value} value={s.value}>{t(`sup.st.${s.value}`, s.label)}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><StarIcon className="h-3 w-3" /> {t("sup.whyThisSupplier", "Why this supplier")}</span><FieldHelp {...H.whyThisSupplier} /></label>
                      <input className={inp} value={l.preferred_reason} placeholder={t("sup.whyPh", "e.g. best price / quality / fastest lead time")}
                        onChange={(e) => update(l._tempId, { preferred_reason: e.target.value })} />
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><WalletIcon className="h-3 w-3" /> {t("sup.minOrderValue", "Min order value")}</span><FieldHelp {...H.minOrderValue} /></label>
                      <div className="flex gap-1.5">
                        <input className={`${inp} flex-1 min-w-0`} value={l.min_order_value} inputMode="decimal" placeholder={`${t("sup.eg", "e.g.")} 5000`}
                          onChange={(e) => update(l._tempId, { min_order_value: e.target.value.replace(/[^0-9.]/g, "") })} />
                        <div className="h-9 w-[84px] shrink-0 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] flex items-center justify-center" title={t("sup.cnyTitle", "Factory cost is always entered in CNY (¥) — the pricing engine works from the CNY cost.")}>
                          CNY
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><WrenchIcon className="h-3 w-3" /> {t("sup.toolingOwner", "Tooling / mold owner")}</span><FieldHelp {...H.toolingOwner} /></label>
                      <select className={inp} value={l.tooling_owner} onChange={(e) => update(l._tempId, { tooling_owner: e.target.value })}>
                        <option value="">—</option>
                        {TOOLING_OWNERS.map((o) => <option key={o.value} value={o.value}>{t(`sup.to.${o.value}`, o.label)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}><span className="inline-flex items-center gap-1.5"><HandCoinsIcon className="h-3 w-3" /> {t("sup.toolingCost", "Tooling / mold cost")}</span><FieldHelp {...H.toolingCost} /></label>
                      <input className={inp} value={l.tooling_cost} inputMode="decimal" placeholder={`${t("sup.eg", "e.g.")} 12000`}
                        onChange={(e) => update(l._tempId, { tooling_cost: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add a supplier — opens a searchable picker (89+ suppliers).
          The empty supplier list is treated honestly: "loading", "couldn't
          load → Retry", or genuinely "all linked" — never a misleading
          disabled button when the directory simply hasn't arrived. */}
      {memberMode ? (
        /* Member view: supplier management is LOCKED — family-level. */
        <div className="flex items-center gap-2 rounded-xl border border-[#567FB2]/30 bg-[#567FB2]/[0.06] px-3.5 py-2.5">
          <StarIcon className="h-3.5 w-3.5 text-[#7FA9D6] shrink-0" />
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {t("sup.memberLocked", "You are editing model {code}: the values below start as the PRIMARY's and save to this model when you change them. The supplier itself is family-level — switch to the primary model to change or add suppliers.").replace("{code}", memberMode.memberCode)}
          </p>
        </div>
      ) : supList.length === 0 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
            disabled={loadingSuppliers}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {loadingSuppliers ? t("sup.loadingSuppliers", "Loading suppliers…") : supLoadFailed ? t("sup.retryLoad", "Retry loading suppliers") : t("sup.load", "Load suppliers")}
          </button>
          <span className="text-[10px] text-[var(--text-ghost)]">
            {supLoadFailed ? t("sup.loadFailed", "couldn\u2019t reach the Suppliers app — try again") : t("sup.fromApp", "from the Suppliers app")}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={available.length === 0}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {available.length ? t("sup.linkSupplier", "Link a supplier") : t("sup.allLinked", "All suppliers linked")}
          </button>
          <span className="text-[10px] text-[var(--text-ghost)]">{t("sup.fromApp", "from the Suppliers app")}</span>
        </div>
      )}

      {pickerOpen && (
        <SupplierPickerModal
          suppliers={available}
          onPick={add}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {infoId && supOf(infoId) && (
        <SupplierInfoModal supplier={supOf(infoId)!} router={router} onClose={() => setInfoId(null)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SupplierInfoModal — quick-look popup of the supplier's key facts. All data
   is sourced from the Suppliers app (read-only here); a link opens the full
   profile in a new tab.
   --------------------------------------------------------------------------- */
function SupplierInfoModal({ supplier, router, onClose }: { supplier: SupplierOption; router: ReturnType<typeof useRouter>; onClose: () => void }) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const facts: { label: string; value: string | null | undefined }[] = [
    { label: t("sup.supplyType", "Supply type"), value: supplier.supply_type },
    { label: "MOQ", value: supplier.moq },
    { label: t("sup.leadTime", "Lead time"), value: supplier.lead_time },
    { label: t("sup.paymentTerms", "Payment terms"), value: supplier.payment_terms },
    { label: t("sup.currency", "Currency"), value: supplier.currency },
  ];
  /* Profile facts only show when populated (most suppliers leave them blank). */
  if (supplier.rating) facts.push({ label: t("sup.rating", "Rating"), value: `★ ${supplier.rating}/5` });
  if (supplier.sample_status) facts.push({ label: t("sup.samples", "Samples"), value: supplier.sample_status });
  if (supplier.employees) facts.push({ label: t("sup.employees", "Employees"), value: supplier.employees });
  if (supplier.year_established) facts.push({ label: t("sup.established", "Established"), value: supplier.year_established });
  const cats = supplier.categories || [];
  const certs = supplier.certifications || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
              {supplier.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={supplier.logo} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <FactoryIcon className="h-6 w-6 text-[var(--text-ghost)]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[var(--text-primary)] leading-tight">{supplier.name}</div>
              {supplier.name_cn && <div className="text-[13px] text-[var(--text-muted)] truncate">{supplier.name_cn}</div>}
              <div className="text-[10px] text-[var(--text-ghost)] mt-0.5">{t("sup.managedIn", "Managed in the Suppliers app")}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.05]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Key facts */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map((f) => (
              <div key={f.label}>
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)]">{f.label}</div>
                <div className="text-[13px] text-[var(--text-primary)] truncate">{f.value || "—"}</div>
              </div>
            ))}
          </div>

          {/* Product categories + certifications (chips, only when present) */}
          {(cats.length > 0 || certs.length > 0) && (
            <div className="mt-3 space-y-2">
              {cats.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-1">{t("sup.productCategories", "Product categories")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)]">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {certs.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-1">{t("sup.certifications", "Certifications")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {certs.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)]">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contact */}
        {(supplier.email || supplier.phone || supplier.website || supplier.wechat || supplier.location || supplier.primary_contact) && (
          <div className="px-4 pb-4">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-ghost)] mb-2">{t("sup.contact", "Contact")}</div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] divide-y divide-[var(--border-subtle)]">
              {supplier.primary_contact?.name && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">{supplier.primary_contact.name}</div>
                    {supplier.primary_contact.role && <div className="text-[11px] text-[var(--text-ghost)] truncate">{supplier.primary_contact.role}</div>}
                  </div>
                  {supplier.primary_contact.mobile && (
                    <a href={`tel:${supplier.primary_contact.mobile}`} className="text-[12px] text-[var(--accent,#0066FF)] shrink-0 hover:underline">{supplier.primary_contact.mobile}</a>
                  )}
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">{t("sup.email", "Email")}</span>
                  <a href={`mailto:${supplier.email}`} className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">{supplier.email}</a>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">{t("sup.phone", "Phone")}</span>
                  <a href={`tel:${supplier.phone}`} className="text-[12px] text-[var(--text-primary)] truncate hover:underline">{supplier.phone}</a>
                </div>
              )}
              {supplier.wechat && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">WeChat</span>
                  <span className="text-[12px] text-[var(--text-primary)] truncate">{supplier.wechat}</span>
                </div>
              )}
              {supplier.website && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">{t("sup.website", "Website")}</span>
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent,#0066FF)] truncate hover:underline">{supplier.website.replace(/^https?:\/\//, "")}</a>
                </div>
              )}
              {supplier.location && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] text-[var(--text-ghost)]">{t("sup.location", "Location")}</span>
                  <span className="text-[12px] text-[var(--text-primary)] truncate text-right">{supplier.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer — open full profile */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <button type="button"
            onClick={() => { onClose(); router.push(`/suppliers/${supplier.id}`); }}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg">
            <ExternalLinkIcon className="h-3.5 w-3.5" /> {t("sup.openProfile", "Open full profile")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SupplierPhoto — the product photo for a supplier link. Click or drag-drop
   to upload; object-contain so the whole product shows (no crop); hover to
   change; small remove control. Uploads to storage via the parent's onPick.
   --------------------------------------------------------------------------- */
function SupplierPhoto({
  url, uploading, onPick, onClear, sizeClass = "h-28 w-28",
}: {
  url: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  sizeClass?: string;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [drag, setDrag] = useState(false);
  /* WeChat-style region capture (shared with Quotations): freeze a frame
     of the chosen screen/window, drag to crop, and the crop lands here as
     a normal file upload. Clipboard paste works inside the modal too. */
  const [shotOpen, setShotOpen] = useState(false);
  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onPick(f);
  };
  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
        className={`group relative block h-full w-full rounded-xl overflow-hidden cursor-pointer transition-colors ${
          url
            ? "border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            : drag
              ? "border-2 border-dashed border-[var(--border-focus)] bg-[var(--accent,#0066FF)]/[0.06]"
              : "border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-ghost)]"
        }`}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-contain p-1.5" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white">
                <UploadIcon className="h-3.5 w-3.5" /> {t("sup.change", "Change")}
              </span>
            </div>
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-[var(--text-ghost)] group-hover:text-[var(--text-muted)] transition-colors">
            <PictureIcon className="h-7 w-7" />
            <span className="text-[10px] font-medium">{t("sup.addPhoto", "Add photo")}</span>
            <span className="text-[9px] text-[var(--text-faint)]">{t("sup.dropOrClick", "drop or click")}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/85 text-[10px] font-medium text-[var(--text-muted)]">
            {t("sup.uploading", "Uploading…")}
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => take(e.target.files)} />
      </label>
      {url && !uploading && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("sup.removePhoto", "Remove photo")}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-2 border-[var(--bg-card)] hover:opacity-90 transition-opacity"
        >
          <CrossIcon className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Screenshot capture — mark a region of the screen (or paste a
          clipboard screenshot) and it uploads like a picked file. */}
      {!uploading && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShotOpen(true); }}
          title={t("sup.screenshotTitle", "Capture part of the screen (or paste a screenshot)")}
          className="absolute left-1/2 -translate-x-1/2 -bottom-3.5 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] shadow-sm transition-colors whitespace-nowrap"
        >
          <CameraIcon className="h-3 w-3" /> {t("sup.screenshot", "Screenshot")}
        </button>
      )}
      <ScreenshotCaptureModal
        open={shotOpen}
        onCapture={(file) => onPick(file)}
        onClose={() => setShotOpen(false)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Searchable supplier picker — modal with live filter + keyboard control.
   Esc closes, ↑/↓ move, Enter selects. Brand: monochrome + single blue accent.
   --------------------------------------------------------------------------- */
function SupplierPickerModal({
  suppliers,
  onPick,
  onClose,
}: {
  suppliers: SupplierOption[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [view, setView] = useState<"list" | "grid">("list");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Render via a portal on <body> so the fixed overlay is sized to the
     viewport — not clipped by a transformed ancestor (the form's animated
     step container), which was collapsing the supplier list to ~1 row. */
  useEffect(() => { setMounted(true); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.name_cn || "").toLowerCase().includes(q),
    );
  }, [query, suppliers]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const s = filtered[active]; if (s) onPick(s.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, active, onClose, onPick]);

  /* Keep the highlighted row in view as you arrow through. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted) return null;

  return createPortal((
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t("sup.linkSupplier", "Link a supplier")}
    >
      <div className="w-full max-w-2xl flex flex-col max-h-[78vh] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header + search */}
        <div className="shrink-0 p-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("sup.linkSupplier", "Link a supplier")}</h3>
            <div className="flex items-center gap-2">
              {/* List / grid view toggle */}
              <div className="flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label={t("sup.listView", "List view")}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${view === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                  <LayoutListIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label={t("sup.gridView", "Grid view")}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${view === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                  <LayoutGridIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
                <CrossIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              placeholder={t("sup.searchPh", "Search suppliers by name…")}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] text-center py-8">{t("sup.noMatch", "No suppliers match")} “{query}”.</p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5">
              {filtered.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(s.id)}
                  className={`flex flex-col items-center text-center gap-2 p-3 rounded-xl border transition-colors ${
                    i === active ? "border-[var(--border-focus)] bg-[var(--bg-surface)]" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <div className="h-14 w-14 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                    {s.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <FactoryIcon className="h-6 w-6 text-[var(--text-ghost)]" />
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">{s.name}</p>
                    {s.name_cn && <p className="text-[10px] text-[var(--text-ghost)] truncate mt-0.5">{s.name_cn}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id}
                type="button"
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(s.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  i === active ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-surface)]"
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <FactoryIcon className="h-4 w-4 text-[var(--text-ghost)]" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block text-[13px] text-[var(--text-primary)] truncate">{s.name}</span>
                  {s.name_cn && <span className="block text-[11px] text-[var(--text-ghost)] truncate">{s.name_cn}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="shrink-0 px-3.5 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-ghost)]">
          <span>{filtered.length} {t("sup.of", "of")} {suppliers.length} {t("sup.suppliersWord", "suppliers")}</span>
          <span>{t("sup.keysHint", "↑↓ to navigate · ↵ to link · esc to close")}</span>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ── "≈ $" under a CNY cost field ──
   Its own component so an unparseable or empty entry renders nothing at all —
   a stray "$0" under a half-typed number reads like a real price of zero.
   The rate rides alongside the amount: this field is where someone decides
   whether a cost is right, and a conversion you can't check is one you have
   to take on trust. */
function UsdHint({ cny }: { cny: string }) {
  const fx = useCnyUsd();
  const amount = Number(String(cny ?? "").replace(/,/g, ""));
  if (!fx || !Number.isFinite(amount) || amount <= 0) return null;
  return (
    <p className="mt-1.5 flex items-baseline gap-2 flex-wrap" title={fxSourceTitle(fx)}>
      <span className="text-[13px] font-semibold text-[var(--text-secondary)] tabular-nums">
        ≈ {formatUsd(amount, fx.rate)}
      </span>
      <span className="text-[11px] text-[var(--text-ghost)] tabular-nums">
        {formatRate(fx.rate)}
        {fx.source === "fallback" ? " (offline)" : ""}
      </span>
    </p>
  );
}
