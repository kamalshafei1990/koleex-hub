"use client";

/* ---------------------------------------------------------------------------
   CertificationsSection (Phase 4) — one card per real certificate.
   Backed by product_certifications. Model-scope (model_ids) column exists
   on the table but is left to all-models here; a per-cert model picker is
   a later refinement.
   --------------------------------------------------------------------------- */

import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import type { ProductCertificationFormState } from "@/types/product-form";

interface Props {
  certifications: ProductCertificationFormState[];
  onChange: (c: ProductCertificationFormState[]) => void;
}

const CERT_TYPES = ["CE", "RoHS", "ISO9001", "ISO14001", "UL", "CCC", "FCC", "REACH", "Other"];
const STATUSES = ["active", "pending", "expired"];

const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";
const inp =
  "w-full h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function CertificationsSection({ certifications, onChange }: Props) {
  const add = () => onChange([...certifications, {
    _tempId: crypto.randomUUID(),
    cert_type: "CE", certified_standard: "", cert_number: "", issuer: "",
    issued_date: "", expiry_date: "", reminder_days: "", country_scope: "",
    model_ids: [], file_url: "", verification_url: "", status: "active", notes: "",
  }]);
  const update = (id: string, patch: Partial<ProductCertificationFormState>) =>
    onChange(certifications.map((c) => (c._tempId === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => onChange(certifications.filter((c) => c._tempId !== id));

  return (
    <div className="space-y-3">
      {certifications.length === 0 ? (
        <p className="text-[12px] text-[var(--text-ghost)] py-5 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
          No certificates recorded. Add CE, RoHS, ISO and other compliance certificates below.
        </p>
      ) : (
        <div className="space-y-3">
          {certifications.map((c) => (
            <div key={c._tempId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 text-[var(--text-muted)]">
                  <BadgeCheckIcon className="h-4 w-4 shrink-0" />
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {c.cert_type || "Certificate"}{c.cert_number ? ` · ${c.cert_number}` : ""}
                  </span>
                </div>
                <button type="button" onClick={() => remove(c._tempId)} aria-label="Remove certificate"
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] border border-[var(--border-subtle)] transition-colors">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Type</label>
                  <select className={inp} value={c.cert_type} onChange={(e) => update(c._tempId, { cert_type: e.target.value })}>
                    {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Standard</label>
                  <input className={inp} value={c.certified_standard} placeholder="e.g. EN ISO 12100"
                    onChange={(e) => update(c._tempId, { certified_standard: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Certificate no.</label>
                  <input className={inp} value={c.cert_number} placeholder="e.g. CE-2024-0193"
                    onChange={(e) => update(c._tempId, { cert_number: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Issuer</label>
                  <input className={inp} value={c.issuer} placeholder="e.g. TÜV / SGS"
                    onChange={(e) => update(c._tempId, { issuer: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Issued</label>
                  <input type="date" className={inp} value={c.issued_date}
                    onChange={(e) => update(c._tempId, { issued_date: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Expires</label>
                  <input type="date" className={inp} value={c.expiry_date}
                    onChange={(e) => update(c._tempId, { expiry_date: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Remind (days before)</label>
                  <input className={inp} inputMode="numeric" value={c.reminder_days} placeholder="e.g. 30"
                    onChange={(e) => update(c._tempId, { reminder_days: e.target.value.replace(/[^0-9]/g, "") })} />
                </div>
                <div>
                  <label className={lbl}>Country scope</label>
                  <input className={inp} value={c.country_scope} placeholder="e.g. EU, GCC"
                    onChange={(e) => update(c._tempId, { country_scope: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp} value={c.status} onChange={(e) => update(c._tempId, { status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>Certificate file URL</label>
                  <input className={inp} value={c.file_url} placeholder="https://…"
                    onChange={(e) => update(c._tempId, { file_url: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Verification URL</label>
                  <input className={inp} value={c.verification_url} placeholder="https://verify…"
                    onChange={(e) => update(c._tempId, { verification_url: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <input className={inp} value={c.notes} placeholder="Optional notes…"
                  onChange={(e) => update(c._tempId, { notes: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={add}
        className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors">
        <PlusIcon className="h-3.5 w-3.5" /> Add certificate
      </button>
    </div>
  );
}
