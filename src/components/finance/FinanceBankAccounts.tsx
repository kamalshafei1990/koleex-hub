"use client";

/* ===========================================================================
   FinanceBankAccounts — Phase 2.7

   Operational treasury surface for managing bank accounts. Two
   primary modes:

     · LIST  — compact treasury cards grouped by currency
     · DETAIL — overview · movements · imports · reconciliation · risk
       rendered inline below the list once an account is selected

   Calm, dense, Hub-native. No spreadsheet feel, no fluff.
   ========================================================================== */

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import { ReconciliationBadge } from "@/components/payment/ReconciliationBadge";
import RrIcon from "@/components/ui/RrIcon";
import { fmtMoney } from "@/lib/finance/calc";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
import {
  EditDrawer, ManualMovementDrawer, Field, INPUT,
} from "@/components/finance/FinanceBankAccounts.dialogs";
import type {
  BankAccount,
  BankAccountStatus,
  BankStatementImport,
  CashMovement,
  CashMovementDirection,
  CashMovementType,
  ReconciliationStatus,
} from "@/lib/finance/types";
import type { BankAccountListItem } from "@/app/api/finance/bank-accounts/route";
import type { BankAccountDetailResponse } from "@/app/api/finance/bank-accounts/[id]/route";

/* ────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

function maskAccountNumber(raw: string | null | undefined): string {
  if (!raw) return "—";
  const stripped = raw.replace(/\s/g, "");
  if (stripped.length <= 4) return stripped;
  return `••• ${stripped.slice(-4)}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/* ────────────────────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────────────────────── */

export default function FinanceBankAccounts() {
  const { t } = useTranslation(financeT);
  const baseCurrency = useBaseCurrency();
  const [accounts, setAccounts] = useState<BankAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BankAccountDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movementDrawer, setMovementDrawer] = useState<{ accountId: string } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/finance/bank-accounts", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { accounts?: BankAccountListItem[]; error?: string };
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setAccounts(j.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/finance/bank-accounts/${id}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as BankAccountDetailResponse | { error?: string };
      if (!r.ok || !("account" in j)) throw new Error(("error" in j ? j.error : null) ?? `HTTP ${r.status}`);
      setDetail(j as BankAccountDetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (openAccountId) void loadDetail(openAccountId); else setDetail(null); }, [openAccountId, loadDetail]);

  /* ── KPI strip across the whole tenant. ── */
  const tenantKpi = useMemo(() => {
    let avail = 0, pending = 0, restricted = 0, unrec = 0;
    let primary: BankAccountListItem | null = null;
    for (const a of accounts) {
      if (a.status !== "active") continue;
      avail     += a.available_balance;
      pending   += a.pending_balance;
      restricted += a.restricted_balance;
      unrec     += a.unreconciled_count;
      if (a.is_primary && !primary) primary = a;
    }
    return { avail, pending, restricted, unrec, primary, total: accounts.length };
  }, [accounts]);

  /* ── Group accounts by currency for the grid. ── */
  const groups = useMemo(() => {
    const m = new Map<string, BankAccountListItem[]>();
    for (const a of accounts) {
      const k = a.currency || "—";
      const arr = m.get(k) ?? [];
      arr.push(a);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [accounts]);

  const startNew = () => setEditing({
    bank_name: "",
    account_name: "",
    currency: tenantKpi.primary?.currency ?? baseCurrency,
    status: "active",
    available_balance: 0,
    pending_balance: 0,
    restricted_balance: 0,
    is_primary: accounts.length === 0,
  });

  const onSaved = useCallback(async () => {
    await loadList();
    if (openAccountId) await loadDetail(openAccountId);
  }, [loadList, loadDetail, openAccountId]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("bankAccounts.title", "Bank Accounts")}
          subtitle={t("bankAccounts.subtitle.long", "Manage treasury accounts, monitor balances, and hand statements to reconciliation.")}
          action={
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
            >
              <RrIcon name="plus" size={12} />
              {t("bankAccounts.btnNew", "New account")}
            </button>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label={t("bankAccounts.kpi.available", "Available")} value={tenantKpi.avail} unit={baseCurrency} hint={t("bankAccounts.kpi.availableHint", "Across active accounts")} loading={loading} />
          <MetricCard label={t("bankAccounts.kpi.pending", "Pending")} value={tenantKpi.pending} unit={baseCurrency} hint={t("bankAccounts.kpi.pendingHint", "Not yet cleared")} loading={loading} />
          <MetricCard label={t("bankAccounts.kpi.restricted", "Restricted")} value={tenantKpi.restricted} unit={baseCurrency} hint={t("bankAccounts.kpi.restrictedHint", "Holds + reserves")} loading={loading} />
          <MetricCard label={t("bankAccounts.kpi.unreconciled", "Unreconciled movements")} value={tenantKpi.unrec} unit={t("bankAccounts.cm", "cm.")} hint={t("bankAccounts.kpi.unreconciledHint", "Across all accounts")} loading={loading} />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <SectionCard>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
              <RrIcon name="loading" size={14} className="animate-spin" />
              {t("bankAccounts.loading", "Loading bank accounts…")}
            </div>
          </SectionCard>
        ) : accounts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={t("bankAccounts.empty.title", "No bank accounts yet")}
              hint={t("bankAccounts.empty.hint", "Add your first account to start tracking treasury and importing statements.")}
              action={
                <button
                  onClick={startNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
                >
                  <RrIcon name="plus" size={12} />
                  {t("bankAccounts.empty.cta", "Add first account")}
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map(([ccy, list]) => (
              <div key={ccy}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    <RrIcon name="bank" size={11} />
                    {t("bankAccounts.group.accounts", "{ccy} accounts").replace("{ccy}", ccy)}
                    <span className="rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{list.length}</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {list.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      onOpen={() => setOpenAccountId(a.id === openAccountId ? null : a.id)}
                      active={a.id === openAccountId}
                      onEdit={() => setEditing(a)}
                      onAddMovement={() => setMovementDrawer({ accountId: a.id })}
                      onArchive={async () => {
                        if (!window.confirm(t("bankAccounts.archiveConfirm", "Archive {bank} · {account}?").replace("{bank}", a.bank_name).replace("{account}", a.account_name))) return;
                        const r = await fetch(`/api/finance/bank-accounts/${a.id}/archive`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "archived" }),
                        });
                        if (r.ok) void loadList();
                      }}
                      onSetPrimary={async () => {
                        const r = await fetch(`/api/finance/bank-accounts/${a.id}/set-primary`, { method: "POST" });
                        if (r.ok) void loadList();
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail panel rendered inline once an account is opened. */}
        {openAccountId && (
          <div className="mt-6">
            {detailLoading ? (
              <SectionCard>
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-dim)]">
                  <RrIcon name="loading" size={14} className="animate-spin" />
                  {t("bankAccounts.loadingAccount", "Loading account…")}
                </div>
              </SectionCard>
            ) : detail ? (
              <AccountDetail
                detail={detail}
                onClose={() => setOpenAccountId(null)}
                onEdit={() => setEditing(detail.account)}
                onAddMovement={() => setMovementDrawer({ accountId: detail.account.id })}
              />
            ) : null}
          </div>
        )}
      </div>

      <EditDrawer
        draft={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await onSaved(); }}
      />

      <ManualMovementDrawer
        open={!!movementDrawer}
        accountId={movementDrawer?.accountId ?? null}
        accounts={accounts}
        onClose={() => setMovementDrawer(null)}
        onSaved={async () => { setMovementDrawer(null); await onSaved(); }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   AccountCard
   ──────────────────────────────────────────────────────────────────────── */

function AccountCard({
  account, active, onOpen, onEdit, onAddMovement, onArchive, onSetPrimary,
}: {
  account: BankAccountListItem;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onAddMovement: () => void;
  onArchive: () => void;
  onSetPrimary: () => void;
}) {
  const { t } = useTranslation(financeT);
  const status = account.status;
  const inactive = status !== "active";
  const dsReconciled = daysSince(account.last_reconciled_at);
  const dsImport = daysSince(account.last_import_at);
  const lowCash = account.available_balance < 25_000 && status === "active";

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 transition ${
        active ? "border-[var(--border-strong)] bg-[var(--bg-surface-subtle)]" : "border-[var(--border-subtle)] hover:border-[var(--border-color)]"
      } ${inactive ? "opacity-70" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-primary)]">{account.bank_name}</span>
            {account.is_primary && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{t("bankAccounts.badge.primary", "Primary")}</span>
            )}
            {status === "frozen" && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">{t("bankAccounts.badge.frozen", "Frozen")}</span>
            )}
            {(status === "archived" || status === "closed") && (
              <span className="rounded-full bg-gray-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-highlight)]">{status}</span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-[var(--text-highlight)]">{account.account_name}</div>
          <div className="mt-0.5 inline-flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
            <span className="font-mono">{maskAccountNumber(account.account_number)}</span>
            {account.country && <span>· {account.country}</span>}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
        >
          {active ? t("bankAccounts.action.close", "Close") : t("bankAccounts.action.open", "Open")}
          <RrIcon name={active ? "cross" : "arrow-up-right"} size={9} />
        </button>
      </div>

      {/* Balance grid */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)]/40 px-3 py-2.5">
        <BalanceCell label={t("bankAccounts.balance.available", "Available")} value={account.available_balance} ccy={account.currency} tone={lowCash ? "warning" : "neutral"} />
        <BalanceCell label={t("bankAccounts.balance.pending", "Pending")}   value={account.pending_balance}   ccy={account.currency} tone="neutral" />
        <BalanceCell label={t("bankAccounts.balance.restricted", "Restricted")} value={account.restricted_balance} ccy={account.currency} tone="neutral" />
      </div>

      {/* Operational counters */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {account.unreconciled_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
            <RrIcon name="info" size={9} />
            {t("bankAccounts.unrec.n", "{n} unreconciled").replace("{n}", String(account.unreconciled_count))}
          </span>
        )}
        {lowCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">
            <RrIcon name="info" size={9} />
            {t("bankAccounts.lowCash", "Low cash")}
          </span>
        )}
        {dsReconciled != null && (
          <span className="text-[var(--text-dim)]">
            {t("bankAccounts.reconciledAgo", "Reconciled {ago}").replace("{ago}", dsReconciled === 0 ? t("bankAccounts.today", "today") : t("bankAccounts.daysAgo", "{n}d ago").replace("{n}", String(dsReconciled)))}
          </span>
        )}
        {dsImport != null && (
          <span className="text-[var(--text-dim)]">
            · {t("bankAccounts.importedAgo", "Imported {ago}").replace("{ago}", dsImport === 0 ? t("bankAccounts.today", "today") : t("bankAccounts.daysAgo", "{n}d ago").replace("{n}", String(dsImport)))}
          </span>
        )}
        {dsImport == null && (
          <span className="text-[var(--text-dim)]">· {t("bankAccounts.noImport", "No import yet")}</span>
        )}
      </div>

      {/* Action footer */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <Link
          href={`/finance/bank-imports?account=${account.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
        >
          <RrIcon name="upload" size={9} />
          {t("bankAccounts.action.import", "Import statement")}
        </Link>
        <button
          onClick={onAddMovement}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
        >
          <RrIcon name="plus" size={9} />
          {t("bankAccounts.action.manual", "Manual movement")}
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
        >
          <RrIcon name="pencil" size={9} />
          {t("bankAccounts.action.edit", "Edit")}
        </button>
        {!account.is_primary && status === "active" && (
          <button
            onClick={onSetPrimary}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-highlight)] hover:border-emerald-500/30 hover:text-emerald-300"
          >
            <RrIcon name="check" size={9} />
            {t("bankAccounts.action.makePrimary", "Make primary")}
          </button>
        )}
        {status === "active" && (
          <button
            onClick={onArchive}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-highlight)] hover:border-rose-500/30 hover:text-rose-300"
          >
            <RrIcon name="trash" size={9} />
            {t("bankAccounts.action.archive", "Archive")}
          </button>
        )}
      </div>
    </div>
  );
}

function BalanceCell({ label, value, ccy, tone }: { label: string; value: number; ccy: string; tone: "neutral" | "warning" }) {
  const cls = tone === "warning" ? "text-amber-300" : "text-[var(--text-primary)]";
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{label}</div>
      <div className={`mt-0.5 truncate text-[14px] font-bold tabular-nums ${cls}`}>{fmtMoney(value, ccy, { compact: true })}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   AccountDetail
   ──────────────────────────────────────────────────────────────────────── */

function AccountDetail({
  detail, onClose, onEdit, onAddMovement,
}: {
  detail: BankAccountDetailResponse;
  onClose: () => void;
  onEdit: () => void;
  onAddMovement: () => void;
}) {
  const { t } = useTranslation(financeT);
  const a = detail.account;
  const { movements, imports, reconciliation, counters } = detail;
  const lowCash = a.available_balance < 25_000;
  const idleCash = a.available_balance > 250_000 && counters.unreconciled_count === 0;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">{t("bankAccounts.detail.eyebrow", "Account detail")}</div>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight">{a.bank_name} · <span className="font-medium text-[var(--text-highlight)]">{a.account_name}</span></h2>
          <div className="mt-1 text-[11px] text-[var(--text-dim)]">
            <span className="font-mono">{maskAccountNumber(a.account_number)}</span>
            {a.iban && <span> · IBAN {maskAccountNumber(a.iban)}</span>}
            {a.swift_code && <span> · SWIFT {a.swift_code}</span>}
            {a.country && <span> · {a.country}</span>}
            <span> · {a.currency}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/finance/bank-imports?account=${a.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90"
          >
            <RrIcon name="upload" size={11} />
            {t("bankAccounts.action.import", "Import statement")}
          </Link>
          <button
            onClick={onAddMovement}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
          >
            <RrIcon name="plus" size={11} />
            {t("bankAccounts.action.manual", "Manual movement")}
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
          >
            <RrIcon name="pencil" size={11} />
            {t("bankAccounts.action.edit", "Edit")}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-2 text-xs text-[var(--text-highlight)] hover:border-rose-500/30 hover:text-rose-300"
            aria-label={t("bankAccounts.detail.closeAria", "Close detail")}
          >
            <RrIcon name="cross" size={11} />
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label={t("bankAccounts.balance.available", "Available")} value={a.available_balance} unit={a.currency} tone={lowCash ? "warning" : "neutral"} hint={t("bankAccounts.balance.spendable", "Spendable today")} loading={false} />
        <MetricCard label={t("bankAccounts.balance.pending", "Pending")}   value={a.pending_balance}   unit={a.currency} hint={t("bankAccounts.balance.awaiting", "Awaiting clearance")} loading={false} />
        <MetricCard label={t("bankAccounts.balance.restricted", "Restricted")} value={a.restricted_balance} unit={a.currency} hint={t("bankAccounts.balance.holds", "Holds + reserves")} loading={false} />
        <MetricCard label={t("bankAccounts.balance.current", "Current")}   value={a.current_balance}   unit={a.currency} hint={t("bankAccounts.balance.sum", "Sum of all positions")} loading={false} />
      </div>

      {/* Risk + activity strip */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
        {lowCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">
            <RrIcon name="info" size={9} /> {t("bankAccounts.risk.lowCash", "Low available cash")}
          </span>
        )}
        {idleCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
            <RrIcon name="info" size={9} /> {t("bankAccounts.risk.idle", "Idle cash")}
          </span>
        )}
        {reconciliation.unreconciled >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
            <RrIcon name="info" size={9} /> {t("bankAccounts.risk.unrecN", "{n} unreconciled movements").replace("{n}", String(reconciliation.unreconciled))}
          </span>
        )}
        {a.currency !== "USD" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-300">
            <RrIcon name="coins" size={9} /> {t("bankAccounts.risk.fx", "FX exposure ({ccy})").replace("{ccy}", a.currency)}
          </span>
        )}
        <span className="ml-auto text-[var(--text-dim)]">
          {a.last_reconciled_at
            ? <>{t("bankAccounts.activity.lastReconciled", "Last reconciled {date}").replace("{date}", new Date(a.last_reconciled_at).toLocaleDateString())} · </>
            : <>{t("bankAccounts.activity.neverReconciled", "Never reconciled")} · </>}
          {counters.last_import_at
            ? <>{t("bankAccounts.activity.lastImport", "Last import {date}").replace("{date}", new Date(counters.last_import_at).toLocaleDateString())}</>
            : <>{t("bankAccounts.noImport", "No import yet")}</>}
        </span>
      </div>

      {/* Two-column body: cash movements + side stack (imports, reconciliation) */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title={t("bankAccounts.movements.title", "Cash movement timeline")}
          subtitle={t("bankAccounts.movements.subtitle", "Most-recent 100 movements on this account.")}
        >
          {movements.length === 0 ? (
            <EmptyState title={t("bankAccounts.movements.empty.title", "No movements yet")} hint={t("bankAccounts.movements.empty.hint", "Import a statement or record a manual movement to seed activity.")} />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {movements.map((m) => (
                <MovementRow key={m.id} movement={m} accountCurrency={a.currency} />
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title={t("bankAccounts.recon.title", "Reconciliation summary")} subtitle={t("bankAccounts.recon.subtitle", "Counts derive from movement statuses on this account.")}>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <ReconStat label={t("bankAccounts.recon.matched", "Matched")}        value={reconciliation.matched}        tone="emerald" />
              <ReconStat label={t("bankAccounts.recon.partial", "Partial")}        value={reconciliation.partially_matched} tone="amber" />
              <ReconStat label={t("bankAccounts.recon.unrec", "Unreconciled")}   value={reconciliation.unreconciled}   tone="amber" />
              <ReconStat label={t("bankAccounts.recon.mismatch", "Mismatch")}       value={reconciliation.mismatch}       tone="rose" />
              <ReconStat label={t("bankAccounts.recon.verified", "Verified")}       value={reconciliation.verified}       tone="emerald" />
              <ReconStat label={t("bankAccounts.recon.disputed", "Disputed")}       value={reconciliation.disputed}       tone="rose" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
              <span className="text-[var(--text-secondary)]">{t("bankAccounts.recon.pending", "Pending candidates")}</span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{reconciliation.pending_candidates}</span>
            </div>
            <Link
              href="/finance/reconciliation"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]"
            >
              {t("bankAccounts.recon.openQueue", "Open reconciliation queue")}
              <RrIcon name="arrow-up-right-from-square" size={9} />
            </Link>
          </SectionCard>

          <SectionCard title={t("bankAccounts.imports.title", "Statement imports")} subtitle={t("bankAccounts.imports.subtitle", "Last {n} for this account.").replace("{n}", String(imports.length))}>
            {imports.length === 0 ? (
              <EmptyState title={t("bankAccounts.imports.empty.title", "No imports yet")} hint={t("bankAccounts.imports.empty.hint", "Import a CSV or XLSX statement to populate movements.")} />
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {imports.map((i) => (
                  <ImportRow key={i.id} imp={i} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ReconStat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const cls = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-rose-300";
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{label}</div>
      <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function MovementRow({ movement, accountCurrency }: { movement: CashMovement; accountCurrency: string }) {
  const { t } = useTranslation(financeT);
  const ccy = movement.currency ?? accountCurrency;
  const dirLabel = movement.direction === "inflow" ? t("bankAccounts.row.moneyIn", "Money in") : t("bankAccounts.row.moneyOut", "Money out");
  const dirTone = movement.direction === "inflow" ? "text-emerald-300" : "text-rose-300";
  const sign = movement.direction === "inflow" ? "+" : "−";
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)] tabular-nums">{movement.movement_date}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase ${dirTone}`}>{dirLabel}</span>
          <span className="text-[12px] font-bold tabular-nums">{sign}{fmtMoney(movement.amount, ccy, { compact: true })}</span>
          <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-highlight)]">{movement.movement_type}</span>
          {movement.bank_reference && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-highlight)]">{movement.bank_reference}</span>}
          <span className="ml-auto inline-flex items-center gap-1">
            <ReconciliationBadge status={movement.reconciliation_status as ReconciliationStatus} compact />
          </span>
        </div>
        {movement.counterparty_name && (
          <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{movement.counterparty_name}</div>
        )}
        {movement.notes && (
          <div className="mt-0.5 truncate text-[10.5px] text-[var(--text-dim)]">{movement.notes}</div>
        )}
      </div>
    </li>
  );
}

function ImportRow({ imp }: { imp: BankStatementImport }) {
  const { t } = useTranslation(financeT);
  return (
    <li className="flex items-start gap-2 py-2">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]">
        <RrIcon name="upload" size={9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[11.5px] font-semibold text-[var(--text-primary)]">{imp.file_name}</span>
          <ImportStatusChip status={imp.status} />
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
          {new Date(imp.uploaded_at).toLocaleDateString()} · {t("bankAccounts.imports.rows", "{n} rows").replace("{n}", String(imp.row_count))}
          {imp.duplicate_count > 0 && <> · {t("bankAccounts.imports.dups", "{n} duplicates").replace("{n}", String(imp.duplicate_count))}</>}
          {imp.error_count > 0 && <> · {t("bankAccounts.imports.errors", "{n} errors").replace("{n}", String(imp.error_count))}</>}
          {imp.imported_count > 0 && <> · {t("bankAccounts.imports.movements", "{n} movements").replace("{n}", String(imp.imported_count))}</>}
        </div>
      </div>
    </li>
  );
}

function ImportStatusChip({ status }: { status: BankStatementImport["status"] }) {
  const { t } = useTranslation(financeT);
  const cls =
    status === "confirmed" ? "bg-emerald-500/15 text-emerald-300" :
    status === "parsed"    ? "bg-amber-500/15 text-amber-300" :
    status === "failed"    ? "bg-rose-500/15 text-rose-300" :
    status === "cancelled" ? "bg-gray-500/15 text-[var(--text-highlight)]" :
                              "bg-gray-500/15 text-[var(--text-highlight)]";
  const label =
    status === "confirmed" ? t("bankImports.impStatus.confirmed", "Confirmed") :
    status === "parsed"    ? t("bankImports.impStatus.parsed", "Parsed") :
    status === "failed"    ? t("bankImports.impStatus.failed", "Failed") :
    status === "cancelled" ? t("bankImports.impStatus.cancelled", "Cancelled") :
                              t("bankImports.impStatus.uploaded", "Uploaded");
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

/* EditDrawer, ManualMovementDrawer, the Field atom and the INPUT
   constant were extracted to ./FinanceBankAccounts.dialogs.tsx in
   Fix #6. They're imported at the top of this file so the call
   sites elsewhere in the component still work unchanged. */

