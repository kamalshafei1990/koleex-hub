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

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import { ReconciliationBadge } from "@/components/payment/ReconciliationBadge";
import RrIcon from "@/components/ui/RrIcon";
import { fmtMoney } from "@/lib/finance/calc";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
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
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
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
          title="Bank Accounts"
          subtitle="Manage treasury accounts, monitor balances, and hand statements to reconciliation."
          action={
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
            >
              <RrIcon name="plus" size={12} />
              New account
            </button>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Available" value={tenantKpi.avail} unit={baseCurrency} hint="Across active accounts" loading={loading} />
          <MetricCard label="Pending" value={tenantKpi.pending} unit={baseCurrency} hint="Not yet cleared" loading={loading} />
          <MetricCard label="Restricted" value={tenantKpi.restricted} unit={baseCurrency} hint="Holds + reserves" loading={loading} />
          <MetricCard label="Unreconciled movements" value={tenantKpi.unrec} unit="cm." hint="Across all accounts" loading={loading} />
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
              Loading bank accounts…
            </div>
          </SectionCard>
        ) : accounts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No bank accounts yet"
              hint="Add your first account to start tracking treasury and importing statements."
              action={
                <button
                  onClick={startNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
                >
                  <RrIcon name="plus" size={12} />
                  Add first account
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map(([ccy, list]) => (
              <div key={ccy}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    <RrIcon name="bank" size={11} />
                    {ccy} accounts
                    <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-gray-400">{list.length}</span>
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
                        if (!window.confirm(`Archive ${a.bank_name} · ${a.account_name}?`)) return;
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
                  Loading account…
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
  const status = account.status;
  const inactive = status !== "active";
  const dsReconciled = daysSince(account.last_reconciled_at);
  const dsImport = daysSince(account.last_import_at);
  const lowCash = account.available_balance < 25_000 && status === "active";

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 transition ${
        active ? "border-white/[0.18] bg-white/[0.03]" : "border-white/[0.06] hover:border-white/[0.12]"
      } ${inactive ? "opacity-70" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-primary)]">{account.bank_name}</span>
            {account.is_primary && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Primary</span>
            )}
            {status === "frozen" && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">Frozen</span>
            )}
            {(status === "archived" || status === "closed") && (
              <span className="rounded-full bg-gray-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-300">{status}</span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-gray-300">{account.account_name}</div>
          <div className="mt-0.5 inline-flex items-center gap-2 text-[10px] text-gray-500">
            <span className="font-mono">{maskAccountNumber(account.account_number)}</span>
            {account.country && <span>· {account.country}</span>}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 text-[10px] font-medium text-gray-300 hover:border-white/[0.18]"
        >
          {active ? "Close" : "Open"}
          <RrIcon name={active ? "cross" : "arrow-up-right"} size={9} />
        </button>
      </div>

      {/* Balance grid */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)]/40 px-3 py-2.5">
        <BalanceCell label="Available" value={account.available_balance} ccy={account.currency} tone={lowCash ? "warning" : "neutral"} />
        <BalanceCell label="Pending"   value={account.pending_balance}   ccy={account.currency} tone="neutral" />
        <BalanceCell label="Restricted" value={account.restricted_balance} ccy={account.currency} tone="neutral" />
      </div>

      {/* Operational counters */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {account.unreconciled_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
            <RrIcon name="info" size={9} />
            {account.unreconciled_count} unreconciled
          </span>
        )}
        {lowCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">
            <RrIcon name="info" size={9} />
            Low cash
          </span>
        )}
        {dsReconciled != null && (
          <span className="text-gray-500">
            Reconciled {dsReconciled === 0 ? "today" : `${dsReconciled}d ago`}
          </span>
        )}
        {dsImport != null && (
          <span className="text-gray-500">
            · Imported {dsImport === 0 ? "today" : `${dsImport}d ago`}
          </span>
        )}
        {dsImport == null && (
          <span className="text-gray-500">· No import yet</span>
        )}
      </div>

      {/* Action footer */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <Link
          href={`/finance/bank-imports?account=${account.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 font-medium text-gray-300 hover:border-white/[0.18]"
        >
          <RrIcon name="upload" size={9} />
          Import statement
        </Link>
        <button
          onClick={onAddMovement}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 font-medium text-gray-300 hover:border-white/[0.18]"
        >
          <RrIcon name="plus" size={9} />
          Manual movement
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 font-medium text-gray-300 hover:border-white/[0.18]"
        >
          <RrIcon name="pencil" size={9} />
          Edit
        </button>
        {!account.is_primary && status === "active" && (
          <button
            onClick={onSetPrimary}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 font-medium text-gray-300 hover:border-emerald-500/30 hover:text-emerald-300"
          >
            <RrIcon name="check" size={9} />
            Make primary
          </button>
        )}
        {status === "active" && (
          <button
            onClick={onArchive}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 font-medium text-gray-300 hover:border-rose-500/30 hover:text-rose-300"
          >
            <RrIcon name="trash" size={9} />
            Archive
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
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
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
  const a = detail.account;
  const { movements, imports, reconciliation, counters } = detail;
  const lowCash = a.available_balance < 25_000;
  const idleCash = a.available_balance > 250_000 && counters.unreconciled_count === 0;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Account detail</div>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight">{a.bank_name} · <span className="font-medium text-gray-300">{a.account_name}</span></h2>
          <div className="mt-1 text-[11px] text-gray-500">
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
            Import statement
          </Link>
          <button
            onClick={onAddMovement}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/[0.18]"
          >
            <RrIcon name="plus" size={11} />
            Manual movement
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/[0.18]"
          >
            <RrIcon name="pencil" size={11} />
            Edit
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2.5 py-2 text-xs text-gray-300 hover:border-rose-500/30 hover:text-rose-300"
            aria-label="Close detail"
          >
            <RrIcon name="cross" size={11} />
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Available" value={a.available_balance} unit={a.currency} tone={lowCash ? "warning" : "neutral"} hint="Spendable today" loading={false} />
        <MetricCard label="Pending"   value={a.pending_balance}   unit={a.currency} hint="Awaiting clearance" loading={false} />
        <MetricCard label="Restricted" value={a.restricted_balance} unit={a.currency} hint="Holds + reserves" loading={false} />
        <MetricCard label="Current"   value={a.current_balance}   unit={a.currency} hint="Sum of all positions" loading={false} />
      </div>

      {/* Risk + activity strip */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
        {lowCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">
            <RrIcon name="info" size={9} /> Low available cash
          </span>
        )}
        {idleCash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
            <RrIcon name="info" size={9} /> Idle cash
          </span>
        )}
        {reconciliation.unreconciled >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
            <RrIcon name="info" size={9} /> {reconciliation.unreconciled} unreconciled movements
          </span>
        )}
        {a.currency !== "USD" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-300">
            <RrIcon name="coins" size={9} /> FX exposure ({a.currency})
          </span>
        )}
        <span className="ml-auto text-gray-500">
          {a.last_reconciled_at
            ? <>Last reconciled {new Date(a.last_reconciled_at).toLocaleDateString()} · </>
            : <>Never reconciled · </>}
          {counters.last_import_at
            ? <>Last import {new Date(counters.last_import_at).toLocaleDateString()}</>
            : <>No import yet</>}
        </span>
      </div>

      {/* Two-column body: cash movements + side stack (imports, reconciliation) */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title="Cash movement timeline"
          subtitle="Most-recent 100 movements on this account."
        >
          {movements.length === 0 ? (
            <EmptyState title="No movements yet" hint="Import a statement or record a manual movement to seed activity." />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {movements.map((m) => (
                <MovementRow key={m.id} movement={m} accountCurrency={a.currency} />
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Reconciliation summary" subtitle="Counts derive from movement statuses on this account.">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <ReconStat label="Matched"        value={reconciliation.matched}        tone="emerald" />
              <ReconStat label="Partial"        value={reconciliation.partially_matched} tone="amber" />
              <ReconStat label="Unreconciled"   value={reconciliation.unreconciled}   tone="amber" />
              <ReconStat label="Mismatch"       value={reconciliation.mismatch}       tone="rose" />
              <ReconStat label="Verified"       value={reconciliation.verified}       tone="emerald" />
              <ReconStat label="Disputed"       value={reconciliation.disputed}       tone="rose" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
              <span className="text-gray-400">Pending candidates</span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{reconciliation.pending_candidates}</span>
            </div>
            <Link
              href="/finance/reconciliation"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
            >
              Open reconciliation queue
              <RrIcon name="arrow-up-right-from-square" size={9} />
            </Link>
          </SectionCard>

          <SectionCard title="Statement imports" subtitle={`Last ${imports.length} for this account.`}>
            {imports.length === 0 ? (
              <EmptyState title="No imports yet" hint="Import a CSV or XLSX statement to populate movements." />
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
    <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function MovementRow({ movement, accountCurrency }: { movement: CashMovement; accountCurrency: string }) {
  const ccy = movement.currency ?? accountCurrency;
  const dirLabel = movement.direction === "inflow" ? "Money in" : "Money out";
  const dirTone = movement.direction === "inflow" ? "text-emerald-300" : "text-rose-300";
  const sign = movement.direction === "inflow" ? "+" : "−";
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-500 tabular-nums">{movement.movement_date}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase ${dirTone}`}>{dirLabel}</span>
          <span className="text-[12px] font-bold tabular-nums">{sign}{fmtMoney(movement.amount, ccy, { compact: true })}</span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-gray-300">{movement.movement_type}</span>
          {movement.bank_reference && <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-gray-300">{movement.bank_reference}</span>}
          <span className="ml-auto inline-flex items-center gap-1">
            <ReconciliationBadge status={movement.reconciliation_status as ReconciliationStatus} compact />
          </span>
        </div>
        {movement.counterparty_name && (
          <div className="mt-0.5 truncate text-[11px] text-gray-400">{movement.counterparty_name}</div>
        )}
        {movement.notes && (
          <div className="mt-0.5 truncate text-[10.5px] text-gray-500">{movement.notes}</div>
        )}
      </div>
    </li>
  );
}

function ImportRow({ imp }: { imp: BankStatementImport }) {
  return (
    <li className="flex items-start gap-2 py-2">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
        <RrIcon name="upload" size={9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[11.5px] font-semibold text-[var(--text-primary)]">{imp.file_name}</span>
          <ImportStatusChip status={imp.status} />
        </div>
        <div className="mt-0.5 text-[10px] text-gray-500">
          {new Date(imp.uploaded_at).toLocaleDateString()} · {imp.row_count} rows
          {imp.duplicate_count > 0 && <> · {imp.duplicate_count} duplicates</>}
          {imp.error_count > 0 && <> · {imp.error_count} errors</>}
          {imp.imported_count > 0 && <> · {imp.imported_count} movements</>}
        </div>
      </div>
    </li>
  );
}

function ImportStatusChip({ status }: { status: BankStatementImport["status"] }) {
  const cls =
    status === "confirmed" ? "bg-emerald-500/15 text-emerald-300" :
    status === "parsed"    ? "bg-amber-500/15 text-amber-300" :
    status === "failed"    ? "bg-rose-500/15 text-rose-300" :
    status === "cancelled" ? "bg-gray-500/15 text-gray-300" :
                              "bg-gray-500/15 text-gray-300";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   EditDrawer — create / edit bank account
   ──────────────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS: BankAccountStatus[] = ["active", "frozen", "closed", "archived"];

function EditDrawer({
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
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      /* If creating, optionally set primary. */
      if (!isEdit && local.is_primary && j.account?.id) {
        /* already handled in create flow. */
      }
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

/* ────────────────────────────────────────────────────────────────────────
   ManualMovementDrawer
   ──────────────────────────────────────────────────────────────────────── */

const MOVEMENT_TYPES: CashMovementType[] = ["incoming", "outgoing", "transfer", "fee", "fx", "refund", "adjustment"];

function ManualMovementDrawer({
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
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
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

/* ────────────────────────────────────────────────────────────────────────
   Atoms
   ──────────────────────────────────────────────────────────────────────── */

const INPUT =
  "w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 transition focus:border-white/[0.22] focus:outline-none focus:ring-1 focus:ring-white/[0.08]";

function Field({
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

