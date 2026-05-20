"use client";

/* ===========================================================================
   FinanceBankAccounts · dialog surfaces.

   Carved out of FinanceBankAccounts.tsx (Fix #6) so the parent
   component file stays focused on data fetching + list/detail
   rendering. The two drawers live here:

     · EditDrawer            — create / edit a bank account
     · ManualMovementDrawer  — record a one-off cash movement
                                (bank fees, FX, adjustments, …)

   Both drawers are pure UI: they own their local form state, call
   the relevant /api/finance endpoints, and notify the parent via
   `onSaved()` so the parent re-fetches.

   The small `Field` form-atom + `INPUT` class constant are exported
   too — they're used inside both drawers and by a couple of small
   form rows elsewhere in the parent.
   ========================================================================== */

import { useEffect, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import RrIcon from "@/components/ui/RrIcon";
import type {
  BankAccount,
  BankAccountStatus,
  CashMovementDirection,
  CashMovementType,
} from "@/lib/finance/types";

export const INPUT =
  "w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 transition focus:border-white/[0.22] focus:outline-none focus:ring-1 focus:ring-white/[0.08]";

export function Field({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        <span>{label}</span>
        {required && <span className="text-rose-400">*</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[10px] text-gray-500">{hint}</span>}
    </label>
  );
}

const STATUS_OPTIONS: BankAccountStatus[] = ["active", "frozen", "closed", "archived"];

export function EditDrawer({
  draft, onClose, onSaved,
}: {
  draft: Partial<BankAccount> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [local, setLocal] = useState<Partial<BankAccount>>(draft ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLocal(draft ?? {}); setError(null); }, [draft]);

  if (!draft) return null;
  const isEdit = !!draft.id;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!local.bank_name?.trim() || !local.account_name?.trim()) {
        throw new Error("Bank name and account name are required");
      }
      if (!local.currency?.trim()) throw new Error("Currency is required");
      const path = isEdit ? `/api/finance/bank-accounts/${draft.id}` : "/api/finance/bank-accounts";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      const j = (await r.json().catch(() => ({}))) as { account?: BankAccount; error?: string };
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4 sm:py-8" onClick={onClose}>
      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "min(92vh, 800px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">{isEdit ? "Edit bank account" : "New bank account"}</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Treasury-grade entry. Account number is masked in list views.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/[0.06] hover:text-gray-100">
            <RrIcon name="cross" size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank name" required>
                <input className={INPUT} value={local.bank_name ?? ""} onChange={(e) => setLocal({ ...local, bank_name: e.target.value })} />
              </Field>
              <Field label="Account name" required>
                <input className={INPUT} value={local.account_name ?? ""} onChange={(e) => setLocal({ ...local, account_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" required hint="ISO code (USD / EUR / EGP / CNY …)">
                <input className={INPUT + " uppercase"} maxLength={4} value={local.currency ?? ""} onChange={(e) => setLocal({ ...local, currency: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Country" hint="ISO country (EG / CN / US …)">
                <input className={INPUT + " uppercase"} maxLength={3} value={local.country ?? ""} onChange={(e) => setLocal({ ...local, country: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account number">
                <input className={INPUT + " font-mono"} value={local.account_number ?? ""} onChange={(e) => setLocal({ ...local, account_number: e.target.value })} />
              </Field>
              <Field label="IBAN">
                <input className={INPUT + " font-mono"} value={local.iban ?? ""} onChange={(e) => setLocal({ ...local, iban: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SWIFT / BIC">
                <input className={INPUT + " font-mono uppercase"} value={local.swift_code ?? ""} onChange={(e) => setLocal({ ...local, swift_code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Status">
                <select className={INPUT} value={local.status ?? "active"} onChange={(e) => setLocal({ ...local, status: e.target.value as BankAccountStatus })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Available">
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.available_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, available_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Pending">
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.pending_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, pending_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Restricted">
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.restricted_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, restricted_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Opening">
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.opening_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, opening_balance: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <label className="inline-flex items-center gap-2 text-[12px] text-gray-300">
              <input type="checkbox" checked={!!local.is_primary} onChange={(e) => setLocal({ ...local, is_primary: e.target.checked })} />
              Make primary for this currency
            </label>
            <Field label="Notes">
              <textarea
                rows={2}
                className={INPUT + " resize-none"}
                value={((local.metadata as Record<string, unknown> | undefined)?.notes as string) ?? ""}
                onChange={(e) => setLocal({ ...local, metadata: { ...(local.metadata ?? {}), notes: e.target.value } })}
              />
            </Field>
          </div>
        </div>
        <div className="border-t border-white/[0.06] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-rose-300 truncate">{error ?? ""}</span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/[0.18]">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                {saving ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                {isEdit ? "Save changes" : "Create account"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOVEMENT_TYPES: CashMovementType[] = ["incoming", "outgoing", "transfer", "fee", "fx", "refund", "adjustment"];

export function ManualMovementDrawer({
  open, accountId, accounts, onClose, onSaved,
}: {
  open: boolean;
  accountId: string | null;
  accounts: BankAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<{
    bank_account_id: string;
    movement_type: CashMovementType;
    direction: CashMovementDirection;
    amount: string;
    movement_date: string;
    bank_reference: string;
    counterparty_name: string;
    notes: string;
  }>(() => ({
    bank_account_id: accountId ?? "",
    movement_type: "incoming",
    direction: "inflow",
    amount: "",
    movement_date: new Date().toISOString().slice(0, 10),
    bank_reference: "",
    counterparty_name: "",
    notes: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft((d) => ({ ...d, bank_account_id: accountId ?? d.bank_account_id }));
      setError(null);
    }
  }, [open, accountId]);
  if (!open) return null;

  const account = accounts.find((a) => a.id === draft.bank_account_id) ?? null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!draft.bank_account_id) throw new Error("Pick a bank account");
      const amt = Number(draft.amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be positive");
      const res = await fetch("/api/finance/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: draft.bank_account_id,
          movement_type: draft.movement_type,
          direction: draft.direction,
          amount: amt,
          currency: account?.currency,
          movement_date: draft.movement_date,
          bank_reference: draft.bank_reference || null,
          counterparty_name: draft.counterparty_name || null,
          notes: draft.notes || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { movement?: unknown; error?: string };
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  /* Auto-sync movement_type → direction. Operator can still override. */
  const onTypeChange = (mt: CashMovementType) => {
    setDraft((d) => ({
      ...d,
      movement_type: mt,
      direction:
        mt === "incoming" || mt === "refund" ? "inflow"
        : mt === "outgoing" || mt === "fee"  ? "outflow"
        : d.direction,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4 sm:py-8" onClick={onClose}>
      <div className="relative flex w-full max-w-lg flex-col rounded-t-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">Manual cash movement</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Used for bank fees, FX, adjustments, and one-off entries. The movement enters the reconciliation queue as unreconciled.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/[0.06] hover:text-gray-100">
            <RrIcon name="cross" size={12} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Bank account" required>
            <select className={INPUT} value={draft.bank_account_id} onChange={(e) => setDraft({ ...draft, bank_account_id: e.target.value })}>
              <option value="">Pick an account</option>
              {accounts.filter((a) => a.status === "active").map((a) => (
                <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name} ({a.currency})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" required>
              <select className={INPUT} value={draft.movement_type} onChange={(e) => onTypeChange(e.target.value as CashMovementType)}>
                {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Direction" required>
              <select className={INPUT} value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as CashMovementDirection })}>
                <option value="inflow">Money in</option>
                <option value="outflow">Money out</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount (${account?.currency ?? "—"})`} required>
              <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Field>
            <Field label="Movement date" required>
              <input type="date" className={INPUT} value={draft.movement_date} onChange={(e) => setDraft({ ...draft, movement_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank reference">
              <input className={INPUT + " font-mono"} value={draft.bank_reference} onChange={(e) => setDraft({ ...draft, bank_reference: e.target.value })} />
            </Field>
            <Field label="Counterparty">
              <input className={INPUT} value={draft.counterparty_name} onChange={(e) => setDraft({ ...draft, counterparty_name: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={2} className={INPUT + " resize-none"} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
        <div className="border-t border-white/[0.06] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-rose-300 truncate">{error ?? ""}</span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/[0.18]">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                {saving ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                Record movement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
