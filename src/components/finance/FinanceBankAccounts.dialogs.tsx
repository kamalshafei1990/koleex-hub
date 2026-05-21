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
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

export const INPUT =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-[var(--text-ghost)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

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
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        <span>{label}</span>
        {required && <span className="text-rose-400">*</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[10px] text-[var(--text-dim)]">{hint}</span>}
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
  const { t } = useTranslation(financeT);
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
        throw new Error(t("bank.err.namesRequired", "Bank name and account name are required"));
      }
      if (!local.currency?.trim()) throw new Error(t("bank.err.currencyRequired", "Currency is required"));
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
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "min(92vh, 800px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">{isEdit ? t("bank.edit.title", "Edit bank account") : t("bank.new.title", "New bank account")}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("bank.edit.subtitle", "Treasury-grade entry. Account number is masked in list views.")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
            <RrIcon name="cross" size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bank.field.bankName", "Bank name")} required>
                <input className={INPUT} value={local.bank_name ?? ""} onChange={(e) => setLocal({ ...local, bank_name: e.target.value })} />
              </Field>
              <Field label={t("bank.field.accountName", "Account name")} required>
                <input className={INPUT} value={local.account_name ?? ""} onChange={(e) => setLocal({ ...local, account_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bank.field.currency", "Currency")} required hint={t("bank.field.currencyHint", "ISO code (USD / EUR / EGP / CNY …)")}>
                <input className={INPUT + " uppercase"} maxLength={4} value={local.currency ?? ""} onChange={(e) => setLocal({ ...local, currency: e.target.value.toUpperCase() })} />
              </Field>
              <Field label={t("bank.field.country", "Country")} hint={t("bank.field.countryHint", "ISO country (EG / CN / US …)")}>
                <input className={INPUT + " uppercase"} maxLength={3} value={local.country ?? ""} onChange={(e) => setLocal({ ...local, country: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bank.field.accountNumber", "Account number")}>
                <input className={INPUT + " font-mono"} value={local.account_number ?? ""} onChange={(e) => setLocal({ ...local, account_number: e.target.value })} />
              </Field>
              <Field label={t("bank.field.iban", "IBAN")}>
                <input className={INPUT + " font-mono"} value={local.iban ?? ""} onChange={(e) => setLocal({ ...local, iban: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bank.field.swift", "SWIFT / BIC")}>
                <input className={INPUT + " font-mono uppercase"} value={local.swift_code ?? ""} onChange={(e) => setLocal({ ...local, swift_code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label={t("bank.field.status", "Status")}>
                <select className={INPUT} value={local.status ?? "active"} onChange={(e) => setLocal({ ...local, status: e.target.value as BankAccountStatus })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={t("bank.field.available", "Available")}>
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.available_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, available_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label={t("bank.field.pending", "Pending")}>
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.pending_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, pending_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label={t("bank.field.restricted", "Restricted")}>
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.restricted_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, restricted_balance: Number(e.target.value) || 0 })} />
              </Field>
              <Field label={t("bank.field.opening", "Opening")}>
                <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={local.opening_balance ?? 0}
                  onChange={(e) => setLocal({ ...local, opening_balance: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text-highlight)]">
              <input type="checkbox" checked={!!local.is_primary} onChange={(e) => setLocal({ ...local, is_primary: e.target.checked })} />
              {t("bank.field.makePrimary", "Make primary for this currency")}
            </label>
            <Field label={t("bank.field.notes", "Notes")}>
              <textarea
                rows={2}
                className={INPUT + " resize-none"}
                value={((local.metadata as Record<string, unknown> | undefined)?.notes as string) ?? ""}
                onChange={(e) => setLocal({ ...local, metadata: { ...(local.metadata ?? {}), notes: e.target.value } })}
              />
            </Field>
          </div>
        </div>
        <div className="border-t border-[var(--border-subtle)] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-rose-300 truncate">{error ?? ""}</span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]">{t("bank.action.cancel", "Cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                {saving ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                {isEdit ? t("bank.action.saveChanges", "Save changes") : t("bank.action.createAccount", "Create account")}
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
  const { t } = useTranslation(financeT);
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
      if (!draft.bank_account_id) throw new Error(t("movement.err.pickAccount", "Pick a bank account"));
      const amt = Number(draft.amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(t("movement.err.positiveAmount", "Amount must be positive"));
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
      <div className="relative flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">{t("movement.title", "Manual cash movement")}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("movement.intro", "Used for bank fees, FX, adjustments, and one-off entries. The movement enters the reconciliation queue as unreconciled.")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
            <RrIcon name="cross" size={12} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label={t("movement.field.bankAccount", "Bank account")} required>
            <select className={INPUT} value={draft.bank_account_id} onChange={(e) => setDraft({ ...draft, bank_account_id: e.target.value })}>
              <option value="">{t("movement.pickAccount", "Pick an account")}</option>
              {accounts.filter((a) => a.status === "active").map((a) => (
                <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name} ({a.currency})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("movement.field.type", "Type")} required>
              <select className={INPUT} value={draft.movement_type} onChange={(e) => onTypeChange(e.target.value as CashMovementType)}>
                {MOVEMENT_TYPES.map((mt) => <option key={mt} value={mt}>{mt}</option>)}
              </select>
            </Field>
            <Field label={t("movement.field.direction", "Direction")} required>
              <select className={INPUT} value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as CashMovementDirection })}>
                <option value="inflow">{t("movement.direction.in", "Money in")}</option>
                <option value="outflow">{t("movement.direction.out", "Money out")}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("movement.field.amountWith", "Amount ({ccy})").replace("{ccy}", account?.currency ?? "—")} required>
              <input type="number" inputMode="decimal" className={INPUT + " tabular-nums"} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Field>
            <Field label={t("movement.field.date", "Movement date")} required>
              <input type="date" className={INPUT} value={draft.movement_date} onChange={(e) => setDraft({ ...draft, movement_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("movement.field.ref", "Bank reference")}>
              <input className={INPUT + " font-mono"} value={draft.bank_reference} onChange={(e) => setDraft({ ...draft, bank_reference: e.target.value })} />
            </Field>
            <Field label={t("movement.field.counter", "Counterparty")}>
              <input className={INPUT} value={draft.counterparty_name} onChange={(e) => setDraft({ ...draft, counterparty_name: e.target.value })} />
            </Field>
          </div>
          <Field label={t("bank.field.notes", "Notes")}>
            <textarea rows={2} className={INPUT + " resize-none"} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
        <div className="border-t border-[var(--border-subtle)] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-rose-300 truncate">{error ?? ""}</span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]">{t("bank.action.cancel", "Cancel")}</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                {saving ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                {t("movement.action.record", "Record movement")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
