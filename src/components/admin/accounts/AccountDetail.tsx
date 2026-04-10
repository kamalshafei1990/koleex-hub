"use client";

/* ---------------------------------------------------------------------------
   AccountDetail — Read-only profile view with quick actions:
     - Edit
     - Reset Temporary Password (new random password, force change on login)
     - Activate / Deactivate
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, KeyRound, PowerOff, Power, UserCircle2, Mail, Phone,
  Building2, Shield, Globe, Flag, Clock, CheckCircle2, Copy, AlertCircle,
} from "lucide-react";
import {
  fetchAccountById, fetchCompanies, fetchRoles, setAccountStatus,
  resetAccountPassword, generateTemporaryPassword,
} from "@/lib/accounts-admin";
import type {
  AccountRow, CompanyRow, RoleRow, AccountStatus, CustomerLevel,
} from "@/types/supabase";

const statusColors: Record<AccountStatus, string> = {
  active:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
  inactive:  "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  suspended: "bg-red-500/15 text-red-300 border-red-500/25",
};

const levelColors: Record<CustomerLevel, string> = {
  silver:   "bg-slate-400/15 text-slate-300 border-slate-400/25",
  gold:     "bg-amber-400/15 text-amber-300 border-amber-400/25",
  platinum: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  diamond:  "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25",
};

const cardWrap =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

interface Props {
  accountId: string;
}

export default function AccountDetail({ accountId }: Props) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [role, setRole] = useState<RoleRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTempPw, setNewTempPw] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const a = await fetchAccountById(accountId);
      setAccount(a);
      if (a) {
        const [cs, rs] = await Promise.all([fetchCompanies(), fetchRoles()]);
        setCompany(cs.find((c) => c.id === a.company_id) || null);
        setRole(rs.find((r) => r.id === a.role_id) || null);
      }
      setLoading(false);
    })();
  }, [accountId]);

  async function handleToggleStatus() {
    if (!account) return;
    const next: AccountStatus = account.status === "active" ? "inactive" : "active";
    setWorking(true);
    const ok = await setAccountStatus(account.id, next);
    setWorking(false);
    if (ok) {
      setAccount({ ...account, status: next });
      setToast(next === "active" ? "Account activated." : "Account deactivated.");
    } else {
      setError("Could not update account status.");
    }
  }

  async function handleResetPassword() {
    if (!account) return;
    const pw = generateTemporaryPassword();
    setWorking(true);
    const ok = await resetAccountPassword(account.id, pw);
    setWorking(false);
    if (ok) {
      setNewTempPw(pw);
      setToast("Temporary password reset. Copy it and share securely.");
    } else {
      setError("Could not reset the password.");
    }
  }

  function copyNewPw() {
    if (!newTempPw) return;
    navigator.clipboard?.writeText(newTempPw).catch(() => {});
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-[960px] mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-[var(--bg-surface-subtle)] rounded" />
            <div className="h-40 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="h-64 bg-[var(--bg-surface-subtle)] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-dim)] mb-4">Account not found.</p>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  const isActive = account.status === "active";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/accounts"
              className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)]">
                {account.full_name}
              </h1>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                @{account.username} · {account.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetPassword}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" /> Reset Password
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
            >
              {isActive ? (
                <>
                  <PowerOff className="h-4 w-4" /> Deactivate
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" /> Activate
                </>
              )}
            </button>
            <Link
              href={`/accounts/${account.id}/edit`}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>

        {toast && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {newTempPw && (
          <div className="mb-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                New Temporary Password
              </p>
              <p className="text-[14px] font-mono text-[var(--text-primary)] mt-1">
                {newTempPw}
              </p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">
                The user will be forced to change this on their next login.
              </p>
            </div>
            <button
              onClick={copyNewPw}
              className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        )}

        <div className="space-y-5">

          {/* Identity card */}
          <section className={cardWrap}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className="h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                {account.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.avatar_url}
                    alt={account.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="h-10 w-10 text-[var(--text-dim)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${statusColors[account.status]}`}
                  >
                    {account.status}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
                    {account.user_type}
                  </span>
                  {account.customer_level && (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${levelColors[account.customer_level]}`}
                    >
                      {account.customer_level}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 mt-4 text-[13px] text-[var(--text-muted)]">
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={account.email} />
                  {account.phone && (
                    <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={account.phone} />
                  )}
                  {company && (
                    <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={company.name} />
                  )}
                  {role && (
                    <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="Role" value={role.name} />
                  )}
                  {account.country && (
                    <InfoRow icon={<Flag className="h-3.5 w-3.5" />} label="Country" value={account.country} />
                  )}
                  {account.currency && (
                    <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Currency" value={account.currency} />
                  )}
                  {account.last_login_at && (
                    <InfoRow
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="Last Login"
                      value={new Date(account.last_login_at).toLocaleString()}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Permissions card */}
          <section className={cardWrap}>
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--text-faint)]" />
              Permissions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PermRow label="Access Products" on={account.can_access_products} />
              <PermRow label="View Pricing" on={account.can_view_pricing} />
              <PermRow label="Create Quotations" on={account.can_create_quotations} />
              {account.user_type === "customer" && (
                <PermRow label="Place Orders" on={account.can_place_orders} />
              )}
              <PermRow label="2FA Enabled" on={account.two_factor_enabled} />
              <PermRow label="Force Password Change" on={account.force_password_change} />
            </div>
          </section>

          {/* Notes card */}
          {(account.account_notes || account.internal_notes) && (
            <section className={cardWrap}>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">
                Notes
              </h2>
              {account.account_notes && (
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-1.5">
                    Account notes
                  </p>
                  <p className="text-[13px] text-[var(--text-muted)] whitespace-pre-wrap">
                    {account.account_notes}
                  </p>
                </div>
              )}
              {account.internal_notes && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-1.5">
                    Internal notes
                  </p>
                  <p className="text-[13px] text-[var(--text-muted)] whitespace-pre-wrap">
                    {account.internal_notes}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Meta */}
          <p className="text-[11px] text-[var(--text-ghost)] px-1">
            Created {new Date(account.created_at).toLocaleString()} · Updated{" "}
            {new Date(account.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[var(--text-dim)]">{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
        {label}
      </span>
      <span className="truncate text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function PermRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className={`h-11 px-4 rounded-lg border text-[12px] font-medium flex items-center justify-between ${
        on
          ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
          : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-[var(--text-ghost)]"}`}
      />
    </div>
  );
}
