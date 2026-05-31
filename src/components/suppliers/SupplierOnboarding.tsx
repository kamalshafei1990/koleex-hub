"use client";

/* ---------------------------------------------------------------------------
   SupplierOnboarding — premium multi-step "New Supplier" intelligence workflow.

   A self-contained guided create flow (does NOT touch the shared Contacts form,
   so the classic directory form stays intact). Reuses existing architecture
   end-to-end — no new tables, no duplication:
     Step 1 Identity      → base contacts row (POST /api/contacts)
     Step 2 Commercial    → commercial scalars on the same insert
     Step 3 Strategic &   → strategic_status via PATCH /api/suppliers/[id]
            Classifications  (emits status_changed timeline + status_history),
                             classifications via POST .../classifications
                             (emits timeline, primary logic preserved)
   On finish it hands off to the Supplier 360 page where the deeper intelligence
   (Factory · Contacts/QR · Certs · Sourcing · Risk · Negotiation) is enriched.
   Required / Recommended / Optional indicators, progress + readiness preview,
   monochrome, keyboard-friendly, mobile responsive.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STRATEGIC_STATUS_LABELS, CLASSIFICATION_LABELS } from "@/lib/suppliers/intelligence";
import SuppliersNav from "./SuppliersNav";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";

const SUPPLIER_TYPES = ["Manufacturer", "Trading Company", "OEM", "ODM", "Distributor", "Service Provider", "Spare Parts", "Machinery", "Electronics", "Packaging", "Textile", "Chemical", "Logistics", "Other"];
const PAYMENT_TERMS = ["T/T", "L/C", "D/P", "D/A", "COD", "Net 30", "Net 60", "Net 90"];
const CURRENCIES = ["USD", "CNY", "EUR", "AED", "GBP", "JPY", "HKD"];
const REVENUE_RANGES = ["< $1M", "$1M–$5M", "$5M–$20M", "$20M–$50M", "$50M–$100M", "$100M+"];
const EMPLOYEE_RANGES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

type Need = "required" | "recommended" | "optional";
const needTone: Record<Need, string> = {
  required: "border-[var(--text-primary)] text-[var(--text-primary)]",
  recommended: "border-[var(--border-strong)] text-[var(--text-secondary)]",
  optional: "border-[var(--border-subtle)] text-[var(--text-faint)]",
};
function NeedChip({ need }: { need: Need }) {
  return <span className={`ml-2 inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${needTone[need]}`}>{need}</span>;
}

function Field({ label, need, children }: { label: string; need: Need; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}<NeedChip need={need} /></span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none";

interface FormState {
  company_name_en: string; company_name_cn: string; supplier_type: string; industry: string;
  website: string; year_established: string; country: string; province: string; city: string; supplier_address: string;
  currency: string; payment_terms: string; moq: string; lead_time: string; incoterms: string;
  annual_revenue_range: string; employee_count_range: string;
  strategic_status: string; strategic_status_reason: string; internal_note: string;
  classifications: string[]; primary_classification: string;
}
const EMPTY: FormState = {
  company_name_en: "", company_name_cn: "", supplier_type: "", industry: "", website: "", year_established: "",
  country: "", province: "", city: "", supplier_address: "", currency: "", payment_terms: "", moq: "", lead_time: "",
  incoterms: "", annual_revenue_range: "", employee_count_range: "", strategic_status: "", strategic_status_reason: "",
  internal_note: "", classifications: [], primary_classification: "",
};

const STEPS = [
  { key: "identity", title: "Identity", sub: "Who the supplier is", icon: Building2Icon },
  { key: "commercial", title: "Commercial", sub: "How you trade with them", icon: DollarSignIcon },
  { key: "strategic", title: "Strategic", sub: "Status & classification", icon: TargetIcon },
] as const;

export default function SupplierOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v })), []);

  // Readiness preview — share of the recommended signals captured.
  const readiness = useMemo(() => {
    const signals = [f.company_name_en, f.supplier_type, f.country, f.industry, f.website, f.currency, f.payment_terms, f.lead_time, f.moq, f.strategic_status, f.classifications.length ? "x" : ""];
    const filled = signals.filter((s) => (typeof s === "string" ? s.trim() : s)).length;
    return Math.round((filled / signals.length) * 100);
  }, [f]);

  const toggleClass = (key: string) => setF((p) => {
    const has = p.classifications.includes(key);
    const classifications = has ? p.classifications.filter((c) => c !== key) : [...p.classifications, key];
    let primary = p.primary_classification;
    if (has && primary === key) primary = classifications[0] ?? "";
    if (!has && !primary) primary = key;
    return { ...p, classifications, primary_classification: primary };
  });

  const canNext = step > 0 || f.company_name_en.trim().length > 0;

  const submit = useCallback(async () => {
    if (!f.company_name_en.trim()) { setErr("Company name (English) is required."); setStep(0); return; }
    setBusy(true); setErr(null);
    try {
      // 1) Create the base supplier record (identity + commercial scalars).
      const insert: Record<string, unknown> = {
        contact_type: "supplier", entity_type: "company",
        company_name_en: f.company_name_en.trim(),
        company_name_cn: f.company_name_cn.trim() || null,
        supplier_type: f.supplier_type || null, industry: f.industry || null,
        website: f.website.trim() || null, year_established: f.year_established.trim() || null,
        country: f.country.trim() || null, province: f.province.trim() || null, city: f.city.trim() || null,
        supplier_address: f.supplier_address.trim() || null,
        currency: f.currency || null, payment_terms: f.payment_terms || null,
        moq: f.moq.trim() || null, lead_time: f.lead_time.trim() || null, incoterms: f.incoterms.trim() || null,
        annual_revenue_range: f.annual_revenue_range || null, employee_count_range: f.employee_count_range || null,
        notes: f.internal_note.trim() || null,
      };
      const res = await fetch("/api/contacts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(insert) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to create supplier");
      const created = (await res.json()).contact as { id: string } | null;
      if (!created?.id) throw new Error("Supplier created but no id returned");
      const id = created.id;

      // 2) Strategic status — via PATCH so it emits the status_changed timeline
      //    event + supplier_status_history audit row (preserves architecture).
      if (f.strategic_status) {
        await fetch(`/api/suppliers/${id}`, {
          method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategic_status: f.strategic_status, strategic_status_reason: f.strategic_status_reason.trim() || null }),
        }).catch(() => {});
      }
      // 3) Classifications — via the existing API (emits timeline, primary logic).
      for (const c of f.classifications) {
        await fetch(`/api/suppliers/${id}/classifications`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classification: c, is_primary: c === f.primary_classification }),
        }).catch(() => {});
      }

      router.push(`/suppliers/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create supplier");
      setBusy(false);
    }
  }, [f, router]);

  return (
    <>
      <SuppliersNav active="directory" />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        {/* Hero + progress */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">New Supplier</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">Capture the essentials now — enrich factory, certs, sourcing &amp; risk on the supplier&rsquo;s page next.</p>
        </div>

        {/* Step rail */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const on = i === step;
            return (
              <button key={s.key} onClick={() => i <= step && setStep(i)} disabled={i > step}
                className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${on ? "border-[var(--text-primary)] bg-[var(--bg-surface)]" : done ? "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)]" : "border-[var(--border-subtle)] opacity-55"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${on || done ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"}`}>
                  {done ? <CheckIcon className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{s.title}</span>
                  <span className="hidden truncate text-[10px] text-[var(--text-faint)] sm:block">{s.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          {/* STEP 1 — IDENTITY */}
          {step === 0 ? (
            <div className="space-y-4">
              <Field label="Company name (English)" need="required">
                <input autoFocus value={f.company_name_en} onChange={(e) => set("company_name_en", e.target.value)} placeholder="e.g. Shenzhen ABC Trading Co., Ltd." className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Company name (Chinese)" need="recommended"><input value={f.company_name_cn} onChange={(e) => set("company_name_cn", e.target.value)} placeholder="深圳…" className={inputCls} /></Field>
                <Field label="Supplier type" need="recommended">
                  <select value={f.supplier_type} onChange={(e) => set("supplier_type", e.target.value)} className={inputCls}><option value="">Select…</option>{SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </Field>
                <Field label="Industry" need="recommended"><input value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Industrial sewing machinery" className={inputCls} /></Field>
                <Field label="Website" need="optional"><input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" className={inputCls} /></Field>
                <Field label="Country" need="recommended"><input value={f.country} onChange={(e) => set("country", e.target.value)} placeholder="China" className={inputCls} /></Field>
                <Field label="Year established" need="optional"><input value={f.year_established} onChange={(e) => set("year_established", e.target.value)} placeholder="2008" className={inputCls} /></Field>
                <Field label="Province / State" need="optional"><input value={f.province} onChange={(e) => set("province", e.target.value)} placeholder="Zhejiang" className={inputCls} /></Field>
                <Field label="City" need="optional"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Ningbo" className={inputCls} /></Field>
              </div>
              <Field label="Address" need="optional"><input value={f.supplier_address} onChange={(e) => set("supplier_address", e.target.value)} placeholder="Full address" className={inputCls} /></Field>
            </div>
          ) : null}

          {/* STEP 2 — COMMERCIAL */}
          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Currency" need="recommended">
                  <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}><option value="">Select…</option>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                </Field>
                <Field label="Payment terms" need="recommended">
                  <input list="pay-terms" value={f.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} placeholder="T/T 30% deposit, 70% before shipment" className={inputCls} />
                  <datalist id="pay-terms">{PAYMENT_TERMS.map((p) => <option key={p} value={p} />)}</datalist>
                </Field>
                <Field label="MOQ" need="optional"><input value={f.moq} onChange={(e) => set("moq", e.target.value)} placeholder="e.g. 100 units" className={inputCls} /></Field>
                <Field label="Lead time" need="recommended"><input value={f.lead_time} onChange={(e) => set("lead_time", e.target.value)} placeholder="e.g. 30 days" className={inputCls} /></Field>
                <Field label="Incoterms" need="optional"><input value={f.incoterms} onChange={(e) => set("incoterms", e.target.value)} placeholder="FOB / CIF / EXW" className={inputCls} /></Field>
                <Field label="Annual revenue" need="optional">
                  <select value={f.annual_revenue_range} onChange={(e) => set("annual_revenue_range", e.target.value)} className={inputCls}><option value="">Select…</option>{REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                </Field>
                <Field label="Employee count" need="optional">
                  <select value={f.employee_count_range} onChange={(e) => set("employee_count_range", e.target.value)} className={inputCls}><option value="">Select…</option>{EMPLOYEE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                </Field>
              </div>
            </div>
          ) : null}

          {/* STEP 3 — STRATEGIC & CLASSIFICATIONS */}
          {step === 2 ? (
            <div className="space-y-4">
              <Field label="Strategic status" need="recommended">
                <select value={f.strategic_status} onChange={(e) => set("strategic_status", e.target.value)} className={inputCls}>
                  <option value="">Not set</option>
                  {Object.entries(STRATEGIC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              {f.strategic_status ? (
                <Field label="Status reason" need="optional"><input value={f.strategic_status_reason} onChange={(e) => set("strategic_status_reason", e.target.value)} placeholder="Why this status?" className={inputCls} /></Field>
              ) : null}

              <div>
                <span className="mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]">Classifications<NeedChip need="recommended" /></span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => {
                    const on = f.classifications.includes(k);
                    return (
                      <button key={k} type="button" onClick={() => toggleClass(k)}
                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${on ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                {f.classifications.length > 1 ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span>Primary:</span>
                    <select value={f.primary_classification} onChange={(e) => set("primary_classification", e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[12px] text-[var(--text-primary)]">
                      {f.classifications.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABELS[c as keyof typeof CLASSIFICATION_LABELS] ?? c}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>

              <Field label="Internal note" need="optional"><textarea value={f.internal_note} onChange={(e) => set("internal_note", e.target.value)} rows={3} placeholder="Anything the team should know…" className={inputCls} /></Field>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-[11px] text-[var(--text-secondary)]">
                After saving you&rsquo;ll land on the supplier&rsquo;s page to add <span className="font-medium text-[var(--text-primary)]">Factory · Contacts &amp; QR · Certifications · Sourcing · Risk · Negotiation</span> intelligence.
              </div>
            </div>
          ) : null}

          {err ? <p className="mt-4 text-[12px] text-rose-400">{err}</p> : null}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]"><div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${readiness}%` }} /></div>
              <span>{readiness}% ready</span>
            </div>
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"><AngleLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />Back</button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="inline-flex items-center gap-1 rounded-lg bg-[var(--text-primary)] px-4 py-1.5 text-[12px] font-semibold text-[var(--bg-primary)] disabled:opacity-40">Next<AngleRightIcon className="h-3.5 w-3.5 rtl:rotate-180" /></button>
              ) : (
                <button onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 py-1.5 text-[12px] font-semibold text-[var(--bg-primary)] disabled:opacity-50">{busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}Create supplier</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
