"use client";

/* ---------------------------------------------------------------------------
   Shipping — "Add a forwarder quote".

   The one place in this module where a REAL, CURRENT, BOOKABLE price can come
   from today. A provider API has to be bought, a market band cannot be booked,
   and Koleex's own history is a past date wearing our own logo. A quotation
   that a named forwarder emailed us this morning is none of those things — it
   is simply not in the Hub yet. This form is the missing door.

   ── WHAT THE FORM IS SHAPED AROUND ────────────────────────────────────────
   An operator sitting with a PDF quotation open beside them, copying it. So
   the fields follow the order a forwarder's quotation actually prints in:
   who quoted it, how much and per what, until when, how long it takes, what it
   covers, then the itemised local charges.

   ── THE FOUR THINGS IT WILL NOT DO ────────────────────────────────────────
   · It will not accept a price with no expiry. `valid_until` is the only
     reason a forwarder quote may be shown as CURRENT while Koleex history may
     not, so a quote without one would quietly become an undated number that
     never stops being "today's price".
   · It will not guess what the price covers. The three inclusion controls
     default to "Not stated" and stay there unless the operator says
     otherwise — comparability.ts keeps "the source did not say" in its own
     bucket, and a silent `false` would let a port-to-port price be compared
     against a door-to-door one.
   · It will not total across currencies. If a surcharge is in EUR beside a
     USD freight rate, the all-in line says so instead of inventing a rate.
   · It will not edit the lane. The route comes from the search behind it, so
     a quote can never be filed against a lane the operator is not looking at.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import FormModal from "@/components/kds/FormModal";
import Checkbox from "@/components/kds/Checkbox";
import DatePicker from "@/components/ui/DatePicker";
import { useSkin } from "@/lib/appearance";
import { CURRENCIES } from "@/lib/commercial-policy/pricing-config";
import { CONTAINER_EQUIPMENT, type ContainerEquipment, type ShippingMode } from "@/lib/shipping/types";
import { saveForwarderQuote, RateSearchError, type ForwarderQuoteInput } from "./shipping-client";

import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";

type T = (k: string, f?: string) => string;

/** The surcharge codes the dictionary knows. "FEE" is the honest catch-all —
    an unknown charge keeps the operator's own wording rather than being
    forced into a trade code that would misdescribe it on a comparison. */
const SURCHARGE_CODES = ["THC", "BAF", "CAF", "GRI", "PSS", "AMS", "DOC", "TLX", "ISPS", "INS", "FEE"] as const;

interface SurchargeDraft { code: string; amount: string; per: "container" | "cbm" | "kg" | "shipment" }

export interface QuoteLane {
  mode: ShippingMode;
  origin: string;
  destination: string;
  originLabel: string;
  destinationLabel: string;
  destinationCountry?: string;
  /** Preselected when the operator opened this from an FCL search. */
  equipment?: ContainerEquipment;
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function ForwarderQuoteModal({ open, onClose, onSaved, lane, t, lang }: {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful save so the caller can re-run the search. */
  onSaved: () => void;
  lane: QuoteLane;
  t: T;
  lang: string;
}) {
  const aurora = useSkin() === "aurora";
  const CHIP_ON = aurora ? "kx-chip-on" : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]";
  const CHIP_OFF = "border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";

  const isFcl = lane.mode === "ocean_fcl";
  const isAir = lane.mode === "air";

  const [forwarder, setForwarder] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [equipment, setEquipment] = useState<ContainerEquipment>(lane.equipment ?? "40HQ");
  const [weightBreak, setWeightBreak] = useState("");
  const [lumpSum, setLumpSum] = useState(false);
  const [validFrom, setValidFrom] = useState(today());
  const [validUntil, setValidUntil] = useState(inDays(14));
  const [transitMin, setTransitMin] = useState("");
  const [transitMax, setTransitMax] = useState("");
  const [carrier, setCarrier] = useState("");
  const [scope, setScope] = useState(isAir ? "airport_to_airport" : "port_to_port");
  const [incOrigin, setIncOrigin] = useState("");
  const [incDest, setIncDest] = useState("");
  const [incCustoms, setIncCustoms] = useState("");
  const [indicative, setIndicative] = useState(false);
  const [notes, setNotes] = useState("");
  const [surcharges, setSurcharges] = useState<SurchargeDraft[]>([]);
  const [coverOpen, setCoverOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* A reopened form must not carry the last quote's numbers. The reset runs on
     OPEN rather than on close so a mis-click that closes the dialog does not
     destroy ten fields of typing before the operator can reopen it. */
  useEffect(() => {
    if (!open) return;
    setForwarder(""); setAmount(""); setCurrency("USD");
    setEquipment(lane.equipment ?? "40HQ"); setWeightBreak(""); setLumpSum(false);
    setValidFrom(today()); setValidUntil(inDays(14));
    setTransitMin(""); setTransitMax(""); setCarrier("");
    setScope(lane.mode === "air" ? "airport_to_airport" : "port_to_port");
    setIncOrigin(""); setIncDest(""); setIncCustoms("");
    setIndicative(false); setNotes(""); setSurcharges([]);
    setCoverOpen(false); setError(null);
  }, [open, lane.equipment, lane.mode]);

  const defaultPer: SurchargeDraft["per"] = isFcl ? "container" : lane.mode === "ocean_lcl" ? "cbm" : "kg";

  /* The all-in line the operator can check against the bottom of the PDF in
     front of them. It refuses rather than converts — see allInTotal(). */
  const total = useMemo(() => {
    const base = Number(amount);
    if (!Number.isFinite(base) || base <= 0) return null;
    let sum = base;
    for (const s of surcharges) {
      const n = Number(s.amount);
      if (!Number.isFinite(n) || n <= 0) continue;
      sum += n;
    }
    return Math.round(sum * 100) / 100;
  }, [amount, surcharges]);

  const valid =
    forwarder.trim().length > 0 &&
    Number(amount) > 0 &&
    Boolean(validUntil) &&
    (!validFrom || validFrom <= validUntil);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload: ForwarderQuoteInput = {
        mode: lane.mode,
        origin: lane.origin,
        destination: lane.destination,
        destinationCountry: lane.destinationCountry,
        forwarder: forwarder.trim(),
        amount: Number(amount),
        currency,
        equipment: isFcl ? equipment : undefined,
        weightBreak: isAir && weightBreak.trim() ? weightBreak.trim() : undefined,
        lumpSum,
        scope,
        includesOriginCharges: incOrigin === "yes" || incOrigin === "no" ? incOrigin : undefined,
        includesDestinationCharges: incDest === "yes" || incDest === "no" ? incDest : undefined,
        includesCustoms: incCustoms === "yes" || incCustoms === "no" ? incCustoms : undefined,
        surcharges: surcharges.flatMap((s) => {
          const n = Number(s.amount);
          if (!Number.isFinite(n) || n <= 0) return [];
          return [{ code: s.code, label: t(`surcharge.${s.code}`, s.code), amount: n, currency, per: s.per }];
        }),
        validFrom: validFrom || undefined,
        validUntil,
        transitDaysMin: Number(transitMin) > 0 ? Number(transitMin) : undefined,
        transitDaysMax: Number(transitMax) > 0 ? Number(transitMax) : undefined,
        carrier: carrier.trim() || undefined,
        isEstimate: indicative,
        notes: notes.trim() || undefined,
      };
      await saveForwarderQuote(payload);
      onSaved();
      onClose();
    } catch (e) {
      const code = e instanceof RateSearchError ? e.code : "save_failed";
      setError(t(`quote.err.${code}`, t("quote.err.save_failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t("quote.title")}
      subtitle={t("quote.subtitle")}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="h-9 rounded-lg px-3 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">
            {t("action.cancel")}
          </button>
          <button type="button" onClick={submit} disabled={!valid || busy}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12px] font-semibold transition-opacity disabled:opacity-40 ${CHIP_ON}`}>
            {busy ? <SpinnerIcon size={13} className="animate-spin" /> : <PlusIcon size={12} />}
            {t("quote.save")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ── the lane, stated not editable ───────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{lane.originLabel}</span>
          <ArrowRightIcon size={12} className="shrink-0 text-[var(--text-ghost)] rtl:rotate-180" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{lane.destinationLabel}</span>
          <span className="ms-auto rounded-md bg-[var(--bg-inverted)]/[0.06] px-2 py-0.5 text-[11px] text-[var(--text-dim)]">
            {t(`mode.${lane.mode}`)}
          </span>
        </div>

        {/* ── who quoted it, and how much ─────────────────────────────────── */}
        <Field label={t("quote.forwarder")} required>
          <input value={forwarder} onChange={(e) => setForwarder(e.target.value)}
            placeholder={t("quote.forwarder.ph")} maxLength={120} className={INPUT} />
        </Field>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Field label={t("quote.amount")} required>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder="0.00" className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t("quote.currency")}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={SELECT}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </Field>
          <Field label={t("quote.per")}>
            <div className="flex h-10 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-[12px] text-[var(--text-dim)]">
              {lumpSum ? t("unit.shipment") : isFcl ? t("unit.container") : lane.mode === "ocean_lcl" ? t("unit.cbm") : t("unit.kg")}
            </div>
          </Field>
        </div>

        {isFcl ? (
          <Field label={t("field.containers")} required>
            <div className="flex gap-1.5">
              {CONTAINER_EQUIPMENT.map((eq) => (
                <button key={eq} type="button" onClick={() => setEquipment(eq)} aria-pressed={equipment === eq}
                  className={`h-10 min-w-[64px] rounded-xl px-3 font-mono text-[12px] font-semibold tabular-nums transition-colors ${equipment === eq ? CHIP_ON : CHIP_OFF}`}>
                  {eq}
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        {isAir ? (
          <Field label={t("quote.weightBreak")} hint={t("quote.weightBreak.hint")}>
            <input value={weightBreak} onChange={(e) => setWeightBreak(e.target.value)}
              placeholder="+100" maxLength={12} className={`${INPUT} font-mono`} />
          </Field>
        ) : null}

        <Check checked={lumpSum} onChange={setLumpSum} label={t("quote.lumpSum")} hint={t("quote.lumpSum.hint")} />

        {/* ── how long it is good for ─────────────────────────────────────── */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t("quote.validFrom")}>
            <DatePicker value={validFrom} onChange={setValidFrom} lang={lang} heightCls="h-10" max={validUntil || undefined} />
          </Field>
          <Field label={t("quote.validUntil")} required hint={t("quote.validUntil.hint")}>
            <DatePicker value={validUntil} onChange={setValidUntil} lang={lang} heightCls="h-10" min={validFrom || undefined} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label={t("quote.transitMin")}>
            <input value={transitMin} onChange={(e) => setTransitMin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder="—" className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t("quote.transitMax")}>
            <input value={transitMax} onChange={(e) => setTransitMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder="—" className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t("quote.carrier")}>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={80}
              placeholder={t("quote.carrier.ph")} className={INPUT} />
          </Field>
        </div>

        {/* ── what the price covers ───────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--border-subtle)]">
          <button type="button" onClick={() => setCoverOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-start">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("quote.covers")}</span>
            <span className="text-[11px] text-[var(--text-ghost)]">{coverOpen ? t("action.hideDetails") : t("quote.covers.open")}</span>
          </button>
          {coverOpen ? (
            <div className="space-y-2 border-t border-[var(--border-subtle)] px-3 py-3">
              <p className="inline-flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-ghost)]">
                <InfoIcon size={12} className="mt-[1px] shrink-0" />
                {t("quote.covers.why")}
              </p>
              <Field label={t("quote.scope")}>
                <select value={scope} onChange={(e) => setScope(e.target.value)} className={SELECT}>
                  {["port_to_port", "door_to_port", "port_to_door", "door_to_door", "airport_to_airport"].map((s) => (
                    <option key={s} value={s}>{t(`scope.${s}`, s)}</option>
                  ))}
                </select>
              </Field>
              <TriState label={t("quote.incOrigin")} value={incOrigin} onChange={setIncOrigin} t={t} />
              <TriState label={t("quote.incDest")} value={incDest} onChange={setIncDest} t={t} />
              <TriState label={t("quote.incCustoms")} value={incCustoms} onChange={setIncCustoms} t={t} />
            </div>
          ) : null}
        </div>

        {/* ── itemised local charges ──────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">{t("res.surcharges")}</span>
            <button type="button"
              onClick={() => setSurcharges((p) => [...p, { code: "THC", amount: "", per: defaultPer }])}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <PlusIcon size={11} />{t("quote.addSurcharge")}
            </button>
          </div>
          {surcharges.length ? (
            <div className="space-y-1.5">
              {/* ⚠️ A GRID, NOT A WRAPPING FLEX ROW. The first version was
                  `flex flex-wrap` with per-control width utilities, and two of
                  them lost: `INPUT` already carries `w-full`, so appending
                  `w-[92px]` set two same-specificity width rules and the
                  cascade — not the class order in this string — decided the
                  winner. The amount field went full width, pushed every
                  sibling onto its own line, and one charge occupied four rows.
                  Fixed columns make the widths the grid's job and let the
                  controls keep `w-full` inside their own cell. */}
              {surcharges.map((s, i) => (
                /* Below 640 the explanatory label is dropped rather than
                   squeezed — `display:none` takes it out of the grid entirely,
                   so the row becomes code / amount / per / remove and still
                   fits a 375pt phone. The modal is viewport-anchored (fixed
                   inset-0), so `sm:` here measures the thing that actually
                   constrains it, unlike a pane inside the Hub's rail. */
                <div key={i} className="grid grid-cols-[76px_minmax(0,1fr)_92px_28px] items-center gap-1.5 sm:grid-cols-[88px_minmax(0,1fr)_88px_120px_32px]">
                  <select value={s.code} className={`${SELECT} w-full`}
                    onChange={(e) => setSurcharges((p) => p.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}>
                    {SURCHARGE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="hidden min-w-0 truncate text-[11px] text-[var(--text-ghost)] sm:block">{t(`surcharge.${s.code}`, s.code)}</span>
                  <input value={s.amount} inputMode="decimal" placeholder="0.00"
                    aria-label={t(`surcharge.${s.code}`, s.code)}
                    onChange={(e) => setSurcharges((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))}
                    className={`${INPUT} tabular-nums`} />
                  <select value={s.per} className={`${SELECT} w-full`}
                    onChange={(e) => setSurcharges((p) => p.map((x, j) => (j === i ? { ...x, per: e.target.value as SurchargeDraft["per"] } : x)))}>
                    <option value="shipment">{t("unit.shipment")}</option>
                    <option value="container">{t("unit.container")}</option>
                    <option value="cbm">{t("unit.cbm")}</option>
                    <option value="kg">{t("unit.kg")}</option>
                  </select>
                  <button type="button" aria-label={t("quote.removeSurcharge")} title={t("quote.removeSurcharge")}
                    onClick={() => setSurcharges((p) => p.filter((_, j) => j !== i))}
                    className="flex h-8 w-full items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)]">
                    <CrossIcon size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-ghost)]">{t("quote.noSurcharges")}</p>
          )}
        </div>

        {total != null ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
            <span className="text-[12px] text-[var(--text-dim)]">{t("res.estimatedTotal")}</span>
            <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
              {currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ) : null}

        <Check checked={indicative} onChange={setIndicative} label={t("quote.indicative")} hint={t("quote.indicative.hint")} />

        <Field label={t("quote.notes")}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600}
            placeholder={t("quote.notes.ph")}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] px-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]" />
        </Field>

        {error ? (
          <p className="inline-flex items-start gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            <TriangleWarningIcon size={13} className="mt-[1px] shrink-0 text-[var(--text-ghost)]" />
            {error}
          </p>
        ) : null}
      </div>
    </FormModal>
  );
}

/* ── local primitives, matching the app's own field look ──────────────────── */

const INPUT = "h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] px-3 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]";
const SELECT = "h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] px-2 text-[12px] text-[var(--text-primary)]";

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">
        {label}{required ? <span className="ms-0.5 text-[var(--text-dim)]">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] leading-snug text-[var(--text-ghost)]">{hint}</span> : null}
    </label>
  );
}

/** The kit's elected checkbox (CB-3), not a raw input: a native checkbox paints
 *  in the OS accent colour and would be the one blue square on a monochrome
 *  screen. The hint sits outside the control so it is not part of the hit
 *  target's label. */
function Check({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <div className="min-w-0">
      <Checkbox checked={checked} onChange={onChange}
        label={<span className="text-start text-[12px] text-[var(--text-secondary)]">{label}</span>} />
      {hint ? <span className="mt-0.5 block ps-6 text-[10px] leading-snug text-[var(--text-ghost)]">{hint}</span> : null}
    </div>
  );
}

/** ⚠️ THREE states, not two. "Not stated" is the default and it is a real
 *  answer — see the header, and comparability.ts's `flag()`. */
function TriState({ label, value, onChange, t }: {
  label: string; value: string; onChange: (v: string) => void; t: T;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 text-[12px] text-[var(--text-dim)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        <option value="">{t("quote.notStated")}</option>
        <option value="yes">{t("quote.included")}</option>
        <option value="no">{t("quote.excluded")}</option>
      </select>
    </div>
  );
}
